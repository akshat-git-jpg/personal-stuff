"""Thin wrappers around the pp-drive CLI (shell-out). Shared by step 010 (create folders)
and step 170 (upload files). No step-specific logic — just resolve the binary and run subcommands.

pp-drive lives in-tree at personal-stuff/tooling/cli/drive/pp-drive (this pipeline is nested
under personal-stuff/pipelines/) and reuses the Google OAuth token cache; every subcommand takes
--account EMAIL.
"""
import shutil, subprocess, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]          # tutorial-pipeline-2/


def resolve_cli(explicit=None):
    """Find pp-drive: explicit flag → PATH → the in-tree personal-stuff tooling."""
    if explicit:
        if not pathlib.Path(explicit).exists():
            raise SystemExit(f"✖ --drive-cli not found: {explicit}")
        return explicit
    on_path = shutil.which("pp-drive")
    if on_path:
        return on_path
    # tutorial-pipeline-2/ → youtube/ → ty/ → personal-stuff/tooling/cli/drive/pp-drive
    guess = ROOT.parents[2] / "tooling/cli/drive/pp-drive"
    if guess.exists():
        return str(guess)
    raise SystemExit("✖ can't find pp-drive — pass --drive-cli /path/to/pp-drive")


def _run(cli, args, capture=True):
    r = subprocess.run([cli, *args], capture_output=capture, text=True)
    if r.returncode != 0:
        msg = (r.stderr or r.stdout or "").strip() if capture else "(see output above)"
        raise SystemExit(f"✖ pp-drive {args[0]} failed:\n{msg}")
    return (r.stdout or "").strip()


def ensure_folder(cli, name, account, parent="root"):
    """Find-or-create a folder; returns its id."""
    fid = _run(cli, ["ensure-folder", name, "--parent", parent, "--account", account])
    if not fid:
        raise SystemExit(f"✖ pp-drive ensure-folder returned no id for {name!r}")
    return fid


def upload(cli, file, parent, account, name=None, overwrite=False):
    """Upload a file into an existing folder id; returns the CLI's status line."""
    args = ["upload", str(file), "--parent", parent, "--account", account]
    if name:
        args += ["--name", name]
    if overwrite:
        args.append("--overwrite")
    return _run(cli, args)


def link(fid):
    return f"https://drive.google.com/drive/folders/{fid}"
