// kb-editor MCP for any session in this repo: runs the app's own stdio shim (installed in its user-data
// folder on first launch) with plain node, and tells it which app `launch_weftcut` starts.
// Mac + Windows; no machine path in git. Detail: README.md next to this file.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const home = os.homedir()
const win = process.platform === 'win32'

export function userDataDir(env = process.env) {
  if (env.WEFTCUT_USERDATA) return env.WEFTCUT_USERDATA
  const appData = win ? env.APPDATA ?? path.join(home, 'AppData', 'Roaming')
    : process.platform === 'darwin' ? path.join(home, 'Library', 'Application Support') : env.XDG_CONFIG_HOME ?? path.join(home, '.config')
  return path.join(appData, 'WeftCut')
}

// The installed app if there is one, else (Mac, Linux) the dev start script beside this file.
export function appToLaunch(env = process.env) {
  if (env.WEFTCUT_APP) return env.WEFTCUT_APP
  const installed = win
    ? [path.join(env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local'), 'Programs', 'kb-editor', 'kb-editor.exe')]
    : ['/Applications/kb-editor.app/Contents/MacOS/kb-editor', path.join(home, 'Applications', 'kb-editor.app', 'Contents', 'MacOS', 'kb-editor')]
  const found = installed.find((p) => fs.existsSync(p))
  if (found) return found
  return win ? null : path.join(import.meta.dirname, 'start-dev.sh')
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const data = userDataDir()
  const shim = path.join(data, 'cli', 'weftcut-mcp.cjs')
  if (!fs.existsSync(shim)) {
    process.stderr.write(`kb-editor MCP: ${shim} not found. Open kb-editor once (it installs the shim), then restart Claude Code.\n`)
    process.exit(1)
  }
  const app = appToLaunch()
  const env = { ...process.env, WEFTCUT_USERDATA: data, ...(app ? { WEFTCUT_APP: app } : {}) }
  const child = spawn(process.execPath, [shim], { stdio: 'inherit', env })
  child.on('exit', (code) => process.exit(code ?? 0))
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig))
}
