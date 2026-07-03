# SETUP — getting TY running on a fresh Windows PC

## Quick start (with Claude Code)

The easiest way to set this up is to let **Claude Code** do it. Steps:

1. **Install Claude Code** (one-time) — download from https://claude.com/download and run the installer.
2. **Open Claude Code** in any folder (Documents is fine).
3. **Paste this prompt**:

   > Set up the TY repo from https://github.com/akshat-git-jpg/TY. My `.env` and `credentials.json` are in my Downloads folder. Follow the SETUP.md in the repo.

4. **Approve commands as Claude runs them.** Each step asks once before doing anything.

That's it. Claude follows the steps below, asks you anything it needs (mostly: "where are your secret files?"), and runs everything else itself.

> **What you need ready before pasting the prompt:**
> - A working internet connection
> - `.env` and `credentials.json` downloaded from the Google Drive folder Kushal shared (put them anywhere — Downloads is the default)

---

## Steps Claude follows (also the manual fallback)

If you're doing this without Claude Code (or Claude is following these directly), run each block in **PowerShell** from the start menu.

### Step 1 — Install Git, Python 3.12, and Node.js via winget

winget is Windows' built-in package manager (Windows 10 1809+ and Windows 11). Run:

```powershell
winget install --id Git.Git -e --source winget --accept-source-agreements --accept-package-agreements
winget install --id Python.Python.3.12 -e --source winget --accept-source-agreements --accept-package-agreements
winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-source-agreements --accept-package-agreements
```

UAC may prompt — accept.

**Refresh PATH in the current shell** (otherwise the new tools aren't visible until you restart PowerShell):

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

**Verify**:

```powershell
git --version
python --version
node --version
```

All three should print versions. If one doesn't, close PowerShell, open a new window, and re-run the verify lines.

### Step 2 — Allow PowerShell to run local scripts (one-time)

Needed so the Python venv's `Activate.ps1` script can run:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

### Step 3 — Clone the repo

```powershell
cd $HOME\Documents
git clone https://github.com/akshat-git-jpg/TY.git
cd TY
```

### Step 4 — Move the secret files into place

If you (the user) are doing this manually: drag `.env` and `credentials.json` from `Downloads` into the `TY` folder using File Explorer.

If Claude is doing this: ask the user where the files are, then move them:

```powershell
# Default: Downloads. Adjust path if user keeps them elsewhere.
Move-Item $HOME\Downloads\.env .\
Move-Item $HOME\Downloads\credentials.json .\
```

Both files should now sit at the top level of `TY`, next to `CLAUDE.md` and this `SETUP.md`. They're already in `.gitignore` so git will skip them.

### Step 5 — Set up the Python environment

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

The prompt should start with `(venv)` after activation. `pip install` takes a minute or two.

### Step 6 — Verify everything works

```powershell
python youtube\yt-analysis\sync_metadata.py
```

This connects to the Google Sheets and copies newly-uploaded videos from the YT Tracker sheet into the Analysis sheet. If you see a summary like `✓ Synced N rows`, setup is complete.

---

## Day-to-day usage

Every time you open a new PowerShell window:

```powershell
cd $HOME\Documents\TY
.\venv\Scripts\Activate.ps1
```

(Prompt should show `(venv)`.) Then run any script:

| What | Command |
|---|---|
| Process new "To Process" rows in the YT Tracker | `python youtube\yt-analysis\process_yt_tracker.py` |
| Sync views / clicks / rankings (interactive) | `python youtube\yt-analysis\yt_analysis.py` |
| Sync just metadata Tracker → Analysis | `python youtube\yt-analysis\sync_metadata.py` |
| Sync just views | `python youtube\yt-analysis\sync_views.py` |
| Sync just affiliate clicks | `python youtube\yt-analysis\sync_clicks.py` |
| Sync just rankings | `python youtube\yt-analysis\sync_rankings.py` |

For most days, `yt_analysis.py` is the easiest — it asks which sub-syncs to run.

---

## Updating the code later

When Kushal pushes changes:

```powershell
cd $HOME\Documents\TY
git pull
```

If `requirements.txt` changed:

```powershell
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## If something goes wrong

| Problem | Fix |
|---|---|
| `winget` not recognized | Open **Microsoft Store**, search for "App Installer", click Update. Or update Windows itself — winget ships with Windows 10 1809+ and Windows 11. |
| `git` / `python` / `node` not recognized after install | Close PowerShell, open a new window. PATH only refreshes for new shells. Or run the PATH-refresh line from Step 1 in your current shell. |
| Venv activation fails: "running scripts is disabled" | Re-run Step 2: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force` |
| `pip install` errors | Make sure venv is active (prompt shows `(venv)`). Re-run `.\venv\Scripts\Activate.ps1` if not. |
| `credentials.json not found` / `.env not found` | They should be at the top level of `TY`, not in a subfolder. Open File Explorer and move them. |
| Google Sheet "permission denied" | Send Kushal the sheet name. He needs to share it with your Gmail as Editor. |
| Anything else | Paste the error into Claude Code and ask for help, or screenshot it to Kushal. |
