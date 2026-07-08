"""Thin wrappers around the pp-drive CLI (shell-out) for tutorial-pipeline-1.
Read-side operations (stat/list-folder/download) this pipeline needs, on top of the same
find-or-create/upload pattern tutorial-pipeline-2/lib/drive.py already uses.
"""
import shutil, subprocess, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]           # tutorial-pipeline-1/


def resolve_cli(explicit=None):
    if explicit:
        if not pathlib.Path(explicit).exists():
            raise SystemExit(f"✖ --drive-cli not found: {explicit}")
        return explicit
    on_path = shutil.which("pp-drive")
    if on_path:
        return on_path
    guess = ROOT.parents[2] / "tooling/cli/drive/pp-drive"
    if guess.exists():
        return str(guess)
    raise SystemExit("✖ can't find pp-drive — pass --drive-cli /path/to/pp-drive")


def _run(cli, args):
    r = subprocess.run([cli, *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"✖ pp-drive {args[0]} failed:\n{(r.stderr or r.stdout).strip()}")
    return (r.stdout or "").strip()


def stat(cli, file_id, account):
    """Returns (id, name, mimeType) for any file/folder id."""
    fid, name, mime = _run(cli, ["stat", file_id, "--account", account]).split("\t")
    return fid, name, mime


def list_folder(cli, folder_id, account):
    """Returns [{"id":..., "name":..., "mimeType":...}] for a folder's immediate children."""
    out = _run(cli, ["list-folder", folder_id, "--account", account])
    children = []
    for line in out.splitlines():
        fid, name, mime = line.split("\t")
        children.append({"id": fid, "name": name, "mimeType": mime})
    return children


def download(cli, file_id, account, dest):
    _run(cli, ["download", file_id, "--out", str(dest), "--account", account])
    return dest


def find_child_folder(cli, parent, name, account):
    """Return the id of an immediate child folder named `name` (case-insensitive), or None."""
    for c in list_folder(cli, parent, account):
        if c["mimeType"] == "application/vnd.google-apps.folder" and c["name"].lower() == name.lower():
            return c["id"]
    return None


def ensure_folder(cli, name, parent, account):
    """Find-or-create a child folder; returns its id. Uses pp-drive's existing ensure-folder."""
    return _run(cli, ["ensure-folder", name, "--parent", parent, "--account", account])


def upload(cli, file, parent, account, name=None, overwrite=True):
    args = ["upload", str(file), "--parent", parent, "--account", account]
    if name:
        args += ["--name", name]
    if overwrite:
        args.append("--overwrite")
    return _run(cli, args)


def link(fid):
    return f"https://drive.google.com/drive/folders/{fid}"
