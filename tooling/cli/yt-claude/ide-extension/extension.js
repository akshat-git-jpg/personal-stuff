// YT → Claude — VS Code-family editor extension (Antigravity, VS Code, Cursor…).
//
// Watches ~/yt-claude/pending/ for job files dropped by the relay (relay.py,
// run with YT_CLAUDE_TARGET set to an IDE name, e.g. antigravity). For each job
// it opens a new integrated terminal tab, cd'd to the video dir, running `claude`.
//
// Multi-window: every editor window runs its own copy of this extension, so
// without coordination a batch SPLITS across windows. Two layers fix that:
//   1. A pinned target (~/yt-claude/.target). Run "YT→Claude: Open videos in
//      THIS window" in the workspace you want — only that window then opens
//      tabs. This is the reliable way when you keep many windows open.
//   2. If nothing is pinned, fall back to electing the focused window.
// Job files are claimed atomically (rename → .taken) so nothing opens twice.

const vscode = require("vscode");
const fs = require("fs");
const os = require("os");
const path = require("path");

const DIR = process.env.YT_CLAUDE_DIR || path.join(os.homedir(), "yt-claude");
const PENDING = path.join(DIR, "pending");
const OWNER = path.join(DIR, ".owner.json");   // focus-election heartbeat
const TARGET = path.join(DIR, ".target");        // pinned workspace key
const CMD_FILE = path.join(DIR, ".claude-cmd"); // active account override
const LOGF = path.join(DIR, "extension.log");
const STALE_MS = 3000;
const POLL_MS = 700;
const WIN_ID = Math.random().toString(36).slice(2, 8);

const ACCOUNTS = ["claude-personal", "claude-work", "claude"];

let statusBar;

function readCmdOverride() {
  try { return fs.readFileSync(CMD_FILE, "utf8").trim() || null; } catch (e) { return null; }
}

function writeCmdOverride(cmd) {
  fs.writeFileSync(CMD_FILE, cmd);
}

function activeClaudeCmd() {
  return (
    readCmdOverride() ||
    vscode.workspace.getConfiguration("ytClaude").get("claudeCommand", "claude")
  );
}

function updateStatusBar() {
  if (!statusBar) return;
  const cmd = activeClaudeCmd();
  const pinnedHere = readTarget() === wsKey();
  const icon = pinnedHere ? "$(check)" : "$(circle-outline)";
  statusBar.text = icon + " YT→" + cmd;
  statusBar.tooltip = pinnedHere
    ? "YT→Claude: videos open HERE as " + cmd + "\nClick to change account / re-pin"
    : "YT→Claude: this window is NOT receiving videos\nClick to pick account + open videos here";
}

function log(msg) {
  try {
    fs.appendFileSync(LOGF, new Date().toISOString() + " [" + WIN_ID + "] " + msg + "\n");
  } catch (e) {}
}

// Stable identifier for this window's workspace (survives reloads).
function wsKey() {
  try {
    if (vscode.workspace.workspaceFile) return vscode.workspace.workspaceFile.fsPath;
    const fld = vscode.workspace.workspaceFolders;
    if (fld && fld.length) return fld[0].uri.fsPath;
    return vscode.workspace.name || "no-workspace";
  } catch (e) {
    return "unknown";
  }
}

function readTarget() {
  try { return fs.readFileSync(TARGET, "utf8").trim(); } catch (e) { return ""; }
}

function readOwner() {
  try { return JSON.parse(fs.readFileSync(OWNER, "utf8")); } catch (e) { return null; }
}

function claimOwner() {
  const tmp = OWNER + "." + WIN_ID + ".tmp";
  try {
    fs.writeFileSync(tmp, JSON.stringify({ id: WIN_ID, ts: Date.now() }));
    fs.renameSync(tmp, OWNER);
  } catch (e) {}
}

// Focus-election fallback (used only when no window is pinned).
function amElectedOwner() {
  const now = Date.now();
  const o = readOwner();
  let focused = false;
  try { focused = vscode.window.state.focused; } catch (e) {}
  const stale = !o || now - o.ts > STALE_MS;
  if (focused || stale || (o && o.id === WIN_ID)) {
    claimOwner();
    const o2 = readOwner();
    return !!o2 && o2.id === WIN_ID;
  }
  return false;
}

function shouldProcess() {
  const target = readTarget();
  if (target) return target === wsKey(); // a window is pinned → only it acts
  return amElectedOwner();                // else fall back to focused window
}

function poll() {
  if (!shouldProcess()) return;
  let files;
  try {
    files = fs.readdirSync(PENDING).filter((f) => f.endsWith(".json"));
  } catch (e) {
    return;
  }
  for (const f of files) {
    const src = path.join(PENDING, f);
    const taken = src + ".taken";
    try {
      fs.renameSync(src, taken); // atomic claim; loser gets ENOENT → skip
    } catch (e) {
      continue;
    }
    let job;
    try {
      job = JSON.parse(fs.readFileSync(taken, "utf8"));
    } catch (e) {
      log("bad json " + f + ": " + e.message);
      try { fs.unlinkSync(taken); } catch (_) {}
      continue;
    }
    try {
      const claudeCmd = activeClaudeCmd();
      const cmd = job.cmd.replace(/^claude\b/, claudeCmd);
      const term = vscode.window.createTerminal({ name: job.name || "yt", cwd: job.cwd });
      term.show(false); // reveal panel without stealing editor focus
      term.sendText(cmd);
      log("opened " + job.id + "  " + (job.name || "") + "  cmd=" + claudeCmd);
    } catch (e) {
      log("ERROR opening " + job.id + ": " + (e && e.message));
    }
    try { fs.unlinkSync(taken); } catch (e) {}
  }
}

function activate(context) {
  try { fs.mkdirSync(PENDING, { recursive: true }); } catch (e) {}
  log("activated  ws=" + wsKey());

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
  statusBar.command = "ytClaude.startHere";
  updateStatusBar();
  statusBar.show();
  context.subscriptions.push(statusBar);

  const timer = setInterval(() => { poll(); updateStatusBar(); }, POLL_MS);
  context.subscriptions.push({ dispose: () => clearInterval(timer) });

  context.subscriptions.push(
    // One-click setup: pick the account AND pin this window to receive videos.
    vscode.commands.registerCommand("ytClaude.startHere", async () => {
      const current = activeClaudeCmd();
      const items = ACCOUNTS.map((a) => ({
        label: a,
        description: a === current ? "● current" : "",
      }));
      const pick = await vscode.window.showQuickPick(items, {
        placeHolder: "Open YouTube videos in THIS window using which Claude account?",
      });
      if (!pick) return;
      writeCmdOverride(pick.label);
      try { fs.writeFileSync(TARGET, wsKey()); } catch (e) {}
      updateStatusBar();
      log("startHere: account=" + pick.label + " pinned=" + wsKey());
      vscode.window.showInformationMessage(
        "YT→Claude: videos will open HERE as " + pick.label + "."
      );
    }),
    vscode.commands.registerCommand("ytClaude.switchAccount", async () => {
      const current = activeClaudeCmd();
      const items = ACCOUNTS.map((a) => ({
        label: a,
        description: a === current ? "● active" : "",
      }));
      const pick = await vscode.window.showQuickPick(items, {
        placeHolder: "Select Claude account for video tabs",
      });
      if (!pick) return;
      writeCmdOverride(pick.label);
      updateStatusBar();
      log("switched account to " + pick.label);
      vscode.window.showInformationMessage("YT→Claude: using " + pick.label);
    }),
    vscode.commands.registerCommand("ytClaude.poll", poll),
    vscode.commands.registerCommand("ytClaude.claimHere", () => {
      try {
        fs.writeFileSync(TARGET, wsKey());
        vscode.window.showInformationMessage(
          "yt-claude: video tabs will now open in this window (" +
            (vscode.workspace.name || wsKey()) + ")."
        );
        log("pinned to this window");
      } catch (e) {
        vscode.window.showErrorMessage("yt-claude: could not pin — " + e.message);
      }
    }),
    vscode.commands.registerCommand("ytClaude.release", () => {
      try { fs.unlinkSync(TARGET); } catch (e) {}
      vscode.window.showInformationMessage("yt-claude: window pin cleared (falls back to focused window).");
      log("unpinned");
    })
  );

  poll();
}

function deactivate() {}

module.exports = { activate, deactivate };
