// Pure helpers: no `$`, so tests can call them directly.
import type { Brief, Link } from '../types'

export const EMPTY: Brief = { needs: [], plan: null, drafts: [], links: [], seen: 0, changes: 0 }

const URL_RE = /https?:\/\/[^\s<>"'`)\]}]+/g
// Hosts trusted when Claude writes a link in a reply; create-command output takes any URL.
const REPLY_HOSTS = [
  /^https:\/\/github\.com\/[^/]+\/[^/]+\/(pull|issues)\/\d+/,
  /^https:\/\/[^/]+\.atlassian\.net\/(browse|wiki)\//,
  /^https:\/\/claude\.ai\/(code\/)?artifact\//,
  /^https:\/\/(www\.)?notion\.so\//,
]

export function urlsIn(text: string): string[] {
  return [...new Set((text.match(URL_RE) ?? []).map(u => u.replace(/[.,;:]+$/, '')))]
}

export function replyLinks(text: string, extraHosts: string[] = []): string[] {
  const extra = extraHosts.filter(Boolean).map(h => new RegExp(`^https?://([^/]+\\.)?${h.replace(/\./g, '\\.')}/`))
  return urlsIn(text).filter(u => [...REPLY_HOSTS, ...extra].some(re => re.test(u)))
}

// A call that creates something: its output links are the thing just made.
export function isCreating(tool: string, command = ''): boolean {
  if (tool === 'Bash') return /\bgh\s+(pr|issue|release|gist)\s+create\b|\bgh\s+repo\s+create\b/.test(command)
  if (tool.startsWith('mcp__')) return /(create|publish|new)[A-Z_-]?/i.test(tool.split('__').pop() ?? '')
  return false
}

export function label(url: string): string {
  let m = url.match(/github\.com\/[^/]+\/([^/]+)\/(pull|issues)\/(\d+)/)
  if (m) return `${m[2] === 'pull' ? 'PR' : 'Issue'} ${m[1]}#${m[3]}`
  m = url.match(/atlassian\.net\/browse\/([A-Z][A-Z0-9]+-\d+)/)
  if (m?.[1]) return m[1]
  if (/claude\.ai\/(code\/)?artifact/.test(url)) return 'Artifact'
  return url.replace(/^https?:\/\//, '').slice(0, 40)
}

export function addLinks(list: Link[], urls: string[], at: number, cap = 12): Link[] {
  const fresh = urls.filter(u => !list.some(l => l.url === u)).map(url => ({ url, label: label(url), at }))
  return [...fresh.reverse(), ...list].slice(0, cap)
}

// Same signatures as work-skills/bin/hooks/auth-stop.py.
const AUTH: [string, RegExp][] = [
  ['AWS', /Token has expired and refresh failed|SSO session associated with this profile has expired|Error loading SSO Token|ExpiredToken|UnauthorizedSSOToken/i],
  ['Google', /invalid_grant|RefreshError|Request had invalid authentication credentials|UNAUTHENTICATED/],
  ['GitHub', /Bad credentials/i],
]
const MCP_AUTH = /\b401\b|Unauthorized|invalid_token|token (has )?expired|re-?authenticat|authentication required|invalid_grant|not authenticated/i

// The login a failed call needs, or null.
export function authNeed(tool: string, text: string, command = ''): string | null {
  if (tool.startsWith('mcp__')) {
    if (!MCP_AUTH.test(text)) return null
    return (tool.split('__')[1] ?? 'connector').replace(/^claude_ai_/, '').replace(/_/g, ' ')
  }
  if (tool !== 'Bash') return null
  for (const [name, re] of AUTH) if (re.test(text)) return name
  if (/zargo|argo/i.test(command) && /\b401\b|Unauthorized/i.test(text)) return 'Argo'
  return null
}

export function loginFix(name: string): string {
  if (name === 'AWS') return 'Run `aws sso login --profile <profile>`'
  if (name === 'GitHub') return 'Check the gh account (gh-acct), or run `gh auth login`'
  if (name === 'Argo') return 'Issue a new Argo SA token'
  if (name === 'Google') return 'Re-auth Google for the CLI that failed'
  return `Run /mcp and re-authenticate ${name}`
}

// The connector or CLI a call depends on, so a later success can clear its login item.
export function authGroup(tool: string, command = ''): string | null {
  if (tool.startsWith('mcp__')) return (tool.split('__')[1] ?? '').replace(/^claude_ai_/, '').replace(/_/g, ' ')
  if (/\b(aws|kubectl|zk8s|eksctl)\b/.test(command)) return 'AWS'
  if (/\bgh\b/.test(command)) return 'GitHub'
  if (/zargo|argo/i.test(command)) return 'Argo'
  if (/\b(gcloud|gws|pp-sheets|pp-gmail|pp-drive)\b/.test(command)) return 'Google'
  return null
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function inline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
    .replace(/(^|\W)_([^_]+)_(?=\W|$)/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>')
}

// Markdown subset drafts use -> HTML that Slack and Gmail keep on paste.
export function mdToHtml(md: string): string {
  const out: string[] = []
  let list: 'ul' | 'ol' | null = null
  const close = () => { if (list) out.push(`</${list}>`); list = null }
  for (const raw of md.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd()
    const ul = line.match(/^\s*[-*•]\s+(.*)$/)
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (ul || ol) {
      const kind = ul ? 'ul' : 'ol'
      if (list !== kind) { close(); out.push(`<${kind}>`); list = kind }
      out.push(`<li>${inline((ul ?? ol)?.[1] ?? '')}</li>`)
      continue
    }
    close()
    const head = line.match(/^#{1,6}\s+(.*)$/)
    if (head) out.push(`<p><b>${inline(head[1] ?? '')}</b></p>`)
    else if (line.trim() === '') out.push('<br>')
    else out.push(`<p>${inline(line)}</p>`)
  }
  close()
  return out.join('')
}

// Same draft as readable plain text, for apps that take no HTML.
export function mdToPlain(md: string): string {
  return md
    .replace(/\r/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '$1 ($2)')
}

// JXA: put HTML and plain text on the pasteboard together.
export const CLIP_JXA =
  "ObjC.import('AppKit');function run(a){var p=$.NSPasteboard.generalPasteboard;p.clearContents;" +
  "p.setStringForType($(a[0]),'public.html');p.setStringForType($(a[1]),'public.utf8-plain-text');return 'ok'}"

export function bar(done: number, total: number, width = 12): string {
  const n = total === 0 ? 0 : Math.round((done / total) * width)
  return '█'.repeat(n) + '░'.repeat(width - n)
}
