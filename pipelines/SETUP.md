# Setup on a fresh Windows PC

This gets the Python pipelines under `pipelines/` running: the YouTube tracker syncs, keyword research, and anything else importing `common/`.

Most of the wider repo is macOS-only. See [what does not work on Windows](#what-does-not-work-on-windows) at the bottom before going looking for something that was never going to run.

## Before you start

Two files have to come from Kushal. They hold credentials, so they are gitignored and will not arrive with the clone:

- `.env`
- `credentials.json`

Ask for them over 1Password or a private Drive folder, not chat. Put them in Downloads for now.

He also needs to share the Google Sheets with your Gmail as Editor. Without that, every sync script fails with a permission error no amount of setup will fix.

## Quick start with Claude Code

The fastest route is to let Claude Code do the work:

1. Install Claude Code from https://claude.com/download.
2. Open it in any folder. Documents is fine.
3. Paste this:

   > Set up the personal-stuff Python pipelines from https://github.com/akshat-git-jpg/personal-stuff. My `.env` and `credentials.json` are in my Downloads folder. Follow `pipelines/SETUP.md` in the repo.

4. Approve each command as it asks.

Claude follows the steps below. It will ask where your secret files are and handle the rest.

## Manual steps

Run these in PowerShell. Claude follows the same sequence.

### 1. Set the line-ending rule first

```powershell
git config --global core.autocrlf input
```

Do this before cloning. Git for Windows otherwise rewrites every `.sh` file with Windows line endings, and Git Bash then refuses to run them with `bad interpreter: /usr/bin/env bash^M`. Fixing it after the fact means re-cloning.

### 2. Install the tools

```powershell
winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
winget install --id Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
winget install --id yt-dlp.yt-dlp -e --accept-source-agreements --accept-package-agreements
winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
```

`yt-dlp` and `ffmpeg` are only needed by the competitor-styles and yt-research scripts. Skip them if you are only running the tracker syncs.

Accept the UAC prompts. Then refresh PATH in the current shell, or the new tools stay invisible until you open a new window:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

Check they landed:

```powershell
git --version; python --version; node --version
```

If one of them prints nothing, close PowerShell, open a new window, and try again.

### 3. Allow PowerShell to run local scripts

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

One-time. The Python venv's `Activate.ps1` will not run without it.

### 4. Clone

```powershell
cd $HOME\codebase
git clone https://github.com/akshat-git-jpg/personal-stuff.git
cd personal-stuff
```

The repo is public, so there is no access to request. Create `$HOME\codebase` first if it does not exist.

### 5. Move the secret files into place

Both go in the `pipelines` folder, next to `requirements.txt`. Not the repo root, and not a subfolder deeper.

```powershell
Move-Item $HOME\Downloads\.env .\pipelines\
Move-Item $HOME\Downloads\credentials.json .\pipelines\
```

Adjust the source path if you saved them somewhere other than Downloads. Both filenames are already gitignored, so git will leave them alone.

### 6. Set up Python

```powershell
cd pipelines
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

The prompt should now start with `(venv)`. The install takes a minute or two.

### 7. Check it works

```powershell
python youtube\yt-analysis\sync_metadata.py
```

This reads the YT Tracker sheet and copies newly-uploaded videos into the Analysis sheet. A summary line means setup is done.

## Day to day

Every new PowerShell window:

```powershell
cd $HOME\codebase\personal-stuff\pipelines
.\venv\Scripts\Activate.ps1
```

Then run scripts from that folder:

| What | Command |
|---|---|
| Ask which syncs to run (easiest) | `python youtube\yt-analysis\yt_analysis.py` |
| Process new "To Process" rows in the YT Tracker | `python youtube\yt-analysis\process_yt_tracker.py` |
| Sync metadata, Tracker into Analysis | `python youtube\yt-analysis\sync_metadata.py` |
| Sync views | `python youtube\yt-analysis\sync_views.py` |
| Sync affiliate clicks | `python youtube\yt-analysis\sync_clicks.py` |
| Sync rankings | `python youtube\yt-analysis\sync_rankings.py` |

Run them from `pipelines`, not from `yt-analysis`. The scripts resolve `common/` and `.env` relative to `pipelines`.

## Getting updates

```powershell
cd $HOME\codebase\personal-stuff
git pull
```

If `requirements.txt` changed:

```powershell
cd pipelines
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## What does not work on Windows

Worth knowing so you do not spend an afternoon on something that cannot work:

| Thing | Why |
|---|---|
| Everything in `scripts/` | Bash scripts. Need Git Bash, and `relink.sh` and `link-clis.sh` also need symlink permission (Developer Mode on, or an admin shell) |
| Claude skills, `boss`, `captain`, `wt` | Built around the two-account symlink layout and zsh functions on Kushal's Mac |
| MCP servers | `.mcp.json` is gitignored and holds absolute Mac paths. The DaVinci one also needs Resolve Studio installed |
| The `branch-guard` hook | `.claude/settings.json` points at a Mac path that does not exist here. Override it in `.claude/settings.local.json` or every Bash call errors |
| `pipelines/video/` | Built on ffmpeg, Whisper and DaVinci Resolve as they are set up on the Mac |
| `youtube/tutorial-pipeline-2` | `lib/handoff.py` calls `pbcopy`, which is macOS-only. One-line fix if you need it |

The `local-apps` dashboard does work now. From the repo root:

```powershell
node tooling\cli\local-apps-dashboard\dashboard.mjs
```

Then open http://localhost:4321. Individual apps still need their own setup before they start.

## When something breaks

| Problem | Fix |
|---|---|
| `winget` not recognized | Open Microsoft Store, find "App Installer", update it. Or update Windows. winget ships with Windows 10 1809 and later |
| `git` / `python` / `node` not recognized after install | Open a new PowerShell window. PATH only refreshes for new shells |
| "running scripts is disabled" on venv activation | Re-run step 3 |
| `pip install` errors | Check the prompt shows `(venv)`. Re-run `.\venv\Scripts\Activate.ps1` if not |
| `credentials.json not found` | It belongs in `pipelines\`, not the repo root |
| Sheets "permission denied" | Send Kushal the sheet name. He shares it with your Gmail as Editor |
| `bad interpreter: ...^M` in Git Bash | Line endings. Set `core.autocrlf input` and re-clone |
| Anything else | Paste the error into Claude Code, or send Kushal a screenshot |
