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
  stat ID                                          print tab-separated id, name, mimeType
  list-folder ID                                   print tab-separated id, name, mimeType for children
  download ID --out PATH                           download a file (Docs/Sheets/Slides exported), print saved <path>
  search QUERY [--max N] [--raw]                   find files by name (or a raw Drive query with --raw)
  move ID --to FOLDER_ID                           move a file/folder into another folder
  rename ID NEW_NAME                               rename a file/folder
  share ID (--email E [--role R] [--no-notify] | --anyone [--role R])
                                                   give a person (or anyone with the link) access
  trash ID                                         move to Drive trash (recoverable for 30 days)

Every ID argument also accepts a pasted Drive URL.

Idempotent: folders are found-or-created; files are skipped if a same-named file already exists in
that folder (use --overwrite to replace). 'root' or omitted --parent means My Drive root.
"""
from __future__ import annotations
import sys, re, argparse, mimetypes
from pathlib import Path

from auth import get_credentials, list_accounts  # noqa: E402
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

FOLDER_MIME = "application/vnd.google-apps.folder"
URL_ID_RE = re.compile(r"/(?:file/d|folders|document/d|spreadsheets/d|presentation/d)/([a-zA-Z0-9-_]+)|[?&]id=([a-zA-Z0-9-_]+)")
EXPORT_MIME = {
    "application/vnd.google-apps.document": "application/pdf",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "application/pdf",
    "application/vnd.google-apps.drawing": "image/png",
}
SEARCH_FIELDS = "files(id,name,mimeType,modifiedTime,webViewLink)"


def extract_id(value):
    """Accept a raw id or a pasted Drive URL."""
    m = URL_ID_RE.search(value.strip())
    return (m.group(1) or m.group(2)) if m else value.strip()


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


# 8 MB chunks, not the library default of 100 MB. `resumable=True` alone is not
# enough for a big file: googleapiclient still pushes one 100 MB chunk per
# request, and a single chunk that outruns the socket timeout kills the whole
# upload with `TimeoutError: The write operation timed out` and leaves nothing
# behind. That is exactly how a 1.18 GB video final failed to deliver on
# 2026-08-02. Smaller chunks each finish well inside the timeout, and
# num_retries lets the client re-send a chunk instead of losing the transfer.
UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024
UPLOAD_RETRIES = 5


def upload_file(s, path, parent, name=None, overwrite=False):
    path = Path(path)
    name = name or path.name
    existing = _find(s, name, parent, folder_only=False)
    media = MediaFileUpload(str(path), mimetype=mimetypes.guess_type(str(path))[0]
                            or "application/octet-stream", resumable=True,
                            chunksize=UPLOAD_CHUNK_BYTES)
    if existing:
        if not overwrite:
            return existing, False
        s.files().update(fileId=existing, media_body=media,
                         supportsAllDrives=True).execute(num_retries=UPLOAD_RETRIES)
        return existing, True
    meta = {"name": name}
    if parent and parent != "root":
        meta["parents"] = [parent]
    fid = s.files().create(body=meta, media_body=media, fields="id",
                           supportsAllDrives=True).execute(num_retries=UPLOAD_RETRIES)["id"]
    return fid, True


def stat(s, file_id):
    """Return {id, name, mimeType} for any file/folder id."""
    return s.files().get(fileId=file_id, fields="id,name,mimeType",
                         supportsAllDrives=True).execute()


def list_folder(s, parent):
    """List immediate children (files+folders) of a folder id. Returns [{id,name,mimeType,shortcutDetails?}]."""
    q = f"'{parent}' in parents and trashed = false"
    r = s.files().list(q=q, fields="files(id,name,mimeType,shortcutDetails)", pageSize=1000,
                       supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
    return r.get("files", [])


def download_file(s, file_id, dest):
    """Download a file to a local path; Google-native files are exported. Returns dest."""
    from googleapiclient.http import MediaIoBaseDownload
    mime = stat(s, file_id)["mimeType"]
    if mime.startswith("application/vnd.google-apps"):
        if mime not in EXPORT_MIME:
            raise SystemExit(f"pp-drive: cannot export {mime}")
        request = s.files().export_media(fileId=file_id, mimeType=EXPORT_MIME[mime])
    else:
        request = s.files().get_media(fileId=file_id, supportsAllDrives=True)
    with open(dest, "wb") as f:
        downloader = MediaIoBaseDownload(f, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
    return dest


def search(s, query, max_results=25, raw=False):
    """Name-contains search, or a raw Drive query string. Returns [{id,name,mimeType,...}]."""
    q = query if raw else f"name contains '{_esc(query)}'"
    kw = {} if raw else {"orderBy": "modifiedTime desc"}
    r = s.files().list(q=f"({q}) and trashed = false", pageSize=max_results, fields=SEARCH_FIELDS,
                       supportsAllDrives=True, includeItemsFromAllDrives=True, **kw).execute()
    return r.get("files", [])


def move(s, file_id, target):
    prev = s.files().get(fileId=file_id, fields="parents", supportsAllDrives=True).execute()
    return s.files().update(fileId=file_id, addParents=target,
                            removeParents=",".join(prev.get("parents") or []),
                            fields="id,name", supportsAllDrives=True).execute()


def rename(s, file_id, new_name):
    return s.files().update(fileId=file_id, body={"name": new_name}, fields="id,name",
                            supportsAllDrives=True).execute()


def share(s, file_id, role="reader", email=None, anyone=False, notify=True):
    perm = {"type": "anyone", "role": role} if anyone else {"type": "user", "role": role, "emailAddress": email}
    kw = {} if anyone else {"sendNotificationEmail": notify}
    s.permissions().create(fileId=file_id, body=perm, supportsAllDrives=True, **kw).execute()
    return s.files().get(fileId=file_id, fields="webViewLink", supportsAllDrives=True).execute()["webViewLink"]


def trash(s, file_id):
    return s.files().update(fileId=file_id, body={"trashed": True}, fields="id,name",
                            supportsAllDrives=True).execute()


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
    st = sub.add_parser("stat"); st.add_argument("id"); st.add_argument("--account", required=True)
    lf = sub.add_parser("list-folder"); lf.add_argument("id"); lf.add_argument("--account", required=True)
    dl = sub.add_parser("download"); dl.add_argument("id"); dl.add_argument("--out", required=True)
    dl.add_argument("--account", required=True)
    up = sub.add_parser("upload"); up.add_argument("file"); up.add_argument("--parent", required=True)
    up.add_argument("--name"); up.add_argument("--overwrite", action="store_true"); up.add_argument("--account", required=True)
    mi = sub.add_parser("mirror"); mi.add_argument("localdir"); mi.add_argument("--parent", default="root")
    mi.add_argument("--overwrite", action="store_true"); mi.add_argument("--account", required=True)
    se = sub.add_parser("search"); se.add_argument("query"); se.add_argument("--max", type=int, default=25)
    se.add_argument("--raw", action="store_true", help="QUERY is a Drive query, e.g. \"mimeType='application/pdf'\"")
    se.add_argument("--account", required=True)
    mv = sub.add_parser("move"); mv.add_argument("id"); mv.add_argument("--to", required=True); mv.add_argument("--account", required=True)
    rn = sub.add_parser("rename"); rn.add_argument("id"); rn.add_argument("new_name"); rn.add_argument("--account", required=True)
    sh = sub.add_parser("share"); sh.add_argument("id")
    who = sh.add_mutually_exclusive_group(required=True)
    who.add_argument("--email"); who.add_argument("--anyone", action="store_true", help="anyone with the link")
    sh.add_argument("--role", choices=["reader", "commenter", "writer"], default="reader")
    sh.add_argument("--no-notify", action="store_true"); sh.add_argument("--account", required=True)
    tr = sub.add_parser("trash"); tr.add_argument("id"); tr.add_argument("--account", required=True)
    a = ap.parse_args()
    for attr in ("id", "parent", "to"):
        if getattr(a, attr, None):
            setattr(a, attr, extract_id(getattr(a, attr)))

    if a.cmd == "accounts":
        print("\n".join(list_accounts())); return
    s = svc(a.account)
    if a.cmd == "find-folder":
        print(_find(s, a.name, a.parent, folder_only=True) or "")
    elif a.cmd == "ensure-folder":
        fid = ensure_folder(s, a.name, a.parent); print(fid)
    elif a.cmd == "stat":
        r = stat(s, a.id); print(f"{r['id']}\t{r['name']}\t{r['mimeType']}")
    elif a.cmd == "list-folder":
        for f in list_folder(s, a.id):
            sc = f.get("shortcutDetails") or {}
            tail = f"\t{sc.get('targetId', '')}\t{sc.get('targetMimeType', '')}" if sc else ""
            print(f"{f['id']}\t{f['name']}\t{f['mimeType']}{tail}")
    elif a.cmd == "download":
        download_file(s, a.id, a.out); print(f"saved {a.out}")
    elif a.cmd == "upload":
        fid, wrote = upload_file(s, a.file, a.parent, a.name, a.overwrite)
        print(f"{fid}  {'uploaded' if wrote else 'skipped (exists)'}  https://drive.google.com/file/d/{fid}")
    elif a.cmd == "mirror":
        top = mirror(s, a.localdir, a.parent, a.overwrite); print(f"{top}  {link(top)}")
    elif a.cmd == "search":
        for f in search(s, a.query, a.max, a.raw):
            print(f"{f['id']}\t{f['name']}\t{f['mimeType']}\t{f.get('modifiedTime', '')[:10]}\t{f.get('webViewLink', '')}")
    elif a.cmd == "move":
        r = move(s, a.id, a.to); print(f"moved {r['name']} into {a.to}")
    elif a.cmd == "rename":
        r = rename(s, a.id, a.new_name); print(f"renamed {r['id']} to {r['name']}")
    elif a.cmd == "share":
        url = share(s, a.id, a.role, a.email, a.anyone, not a.no_notify)
        print(f"shared with {'anyone with the link' if a.anyone else a.email} as {a.role}  {url}")
    elif a.cmd == "trash":
        r = trash(s, a.id); print(f"trashed {r['name']} ({r['id']})")


if __name__ == "__main__":
    main()
