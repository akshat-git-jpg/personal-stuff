"""pp-drive — agent-native CLI for Google Drive (upload + folder structure).

Talks to the Drive API directly (no MCP), reusing mcp/google-shared/ OAuth — same token cache as
the other Google CLIs. Built for the tutorial-pipeline handoff: find-or-create folders and mirror
a local folder tree into Drive.

All subcommands take --account EMAIL (e.g. kushalbakliwal25@gmail.com).

  accounts                                         list available token accounts
  find-folder NAME [--parent ID]                   print folder id under parent (empty if none)
  ensure-folder NAME [--parent ID]                 find-or-create, print id
  upload FILE --parent ID [--name N] [--overwrite] upload a file, print id + link
  mirror LOCALDIR [--parent ID] [--overwrite]      recreate the local tree in Drive (dirs→folders,
                                                   files→uploads), print the top folder id + link

Idempotent: folders are found-or-created; files are skipped if a same-named file already exists in
that folder (use --overwrite to replace). 'root' or omitted --parent means My Drive root.
"""
from __future__ import annotations
import sys, argparse, mimetypes
from pathlib import Path

from auth import get_credentials, list_accounts  # noqa: E402
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

FOLDER_MIME = "application/vnd.google-apps.folder"


def svc(account):
    return build("drive", "v3", credentials=get_credentials(account), cache_discovery=False)


def _esc(name):
    return name.replace("\\", "\\\\").replace("'", "\\'")


def _find(s, name, parent, folder_only):
    q = [f"name = '{_esc(name)}'", "trashed = false"]
    if folder_only:
        q.append(f"mimeType = '{FOLDER_MIME}'")
    if parent and parent != "root":
        q.append(f"'{parent}' in parents")
    elif parent == "root":
        q.append("'root' in parents")
    r = s.files().list(q=" and ".join(q), fields="files(id,name)", pageSize=1,
                       supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
    files = r.get("files", [])
    return files[0]["id"] if files else None


def ensure_folder(s, name, parent):
    fid = _find(s, name, parent, folder_only=True)
    if fid:
        return fid
    meta = {"name": name, "mimeType": FOLDER_MIME}
    if parent and parent != "root":
        meta["parents"] = [parent]
    return s.files().create(body=meta, fields="id", supportsAllDrives=True).execute()["id"]


def upload_file(s, path, parent, name=None, overwrite=False):
    path = Path(path)
    name = name or path.name
    existing = _find(s, name, parent, folder_only=False)
    media = MediaFileUpload(str(path), mimetype=mimetypes.guess_type(str(path))[0]
                            or "application/octet-stream", resumable=True)
    if existing:
        if not overwrite:
            return existing, False
        s.files().update(fileId=existing, media_body=media, supportsAllDrives=True).execute()
        return existing, True
    meta = {"name": name}
    if parent and parent != "root":
        meta["parents"] = [parent]
    fid = s.files().create(body=meta, media_body=media, fields="id",
                           supportsAllDrives=True).execute()["id"]
    return fid, True


def mirror(s, localdir, parent, overwrite=False):
    localdir = Path(localdir)
    top = ensure_folder(s, localdir.name, parent)
    n_dirs = n_files = n_skip = 0

    def rec(d, pid):
        nonlocal n_dirs, n_files, n_skip
        for child in sorted(d.iterdir()):
            if child.is_dir():
                cid = ensure_folder(s, child.name, pid); n_dirs += 1
                print(f"  📁 {child.relative_to(localdir.parent)}", file=sys.stderr)
                rec(child, cid)
            else:
                _, wrote = upload_file(s, child, pid, overwrite=overwrite)
                n_files += wrote; n_skip += (0 if wrote else 1)
                print(f"  {'⬆' if wrote else '·'} {child.relative_to(localdir.parent)}", file=sys.stderr)

    rec(localdir, top)
    print(f"mirror: {n_dirs} folders, {n_files} uploaded, {n_skip} skipped", file=sys.stderr)
    return top


def link(fid):
    return f"https://drive.google.com/drive/folders/{fid}"


def main():
    ap = argparse.ArgumentParser(prog="pp-drive")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("accounts")
    for name in ("find-folder", "ensure-folder"):
        p = sub.add_parser(name); p.add_argument("name"); p.add_argument("--parent", default="root"); p.add_argument("--account", required=True)
    up = sub.add_parser("upload"); up.add_argument("file"); up.add_argument("--parent", required=True)
    up.add_argument("--name"); up.add_argument("--overwrite", action="store_true"); up.add_argument("--account", required=True)
    mi = sub.add_parser("mirror"); mi.add_argument("localdir"); mi.add_argument("--parent", default="root")
    mi.add_argument("--overwrite", action="store_true"); mi.add_argument("--account", required=True)
    a = ap.parse_args()

    if a.cmd == "accounts":
        print("\n".join(list_accounts())); return
    s = svc(a.account)
    if a.cmd == "find-folder":
        print(_find(s, a.name, a.parent, folder_only=True) or "")
    elif a.cmd == "ensure-folder":
        fid = ensure_folder(s, a.name, a.parent); print(fid)
    elif a.cmd == "upload":
        fid, wrote = upload_file(s, a.file, a.parent, a.name, a.overwrite)
        print(f"{fid}  {'uploaded' if wrote else 'skipped (exists)'}  https://drive.google.com/file/d/{fid}")
    elif a.cmd == "mirror":
        top = mirror(s, a.localdir, a.parent, a.overwrite); print(f"{top}  {link(top)}")


if __name__ == "__main__":
    main()
