import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Brief, Step } from '../types'
import {
  CLIP_JXA, EMPTY, addLinks, authGroup, authNeed, bar, isCreating, loginFix, mdToHtml, mdToPlain, replyLinks, urlsIn,
} from './lib'

const PANE = 'session-brief'
const PRESENT_MS = 2 * 60 * 1000
const KEEP_SESSIONS = 40
const brief = atom({ plugin: 'session-brief', key: 'brief' } as const, EMPTY)

const BRIEF_TOOL = `Keep the session brief current. The owner leaves sessions running for hours and reads this brief (a side pane, /brief) when he returns, instead of scrolling.
Call it, with only the fields that changed:
- need: BEFORE you stop to ask the owner anything or when blocked on him (approval, decision, missing access). One line saying exactly what he must do.
- resolve: when a need is settled ("all" or its text).
- plan: when a task has 3+ steps, the step titles (max 4 words each). Then done / active / failed as steps move.
- handy: non-link things he will need later (branch, file path, command). Links from gh/Jira/artifact create calls and links you write are collected automatically: do not send them.
Do not call it for short Q&A. Do not mention the brief in replies.`

const DRAFT_TOOL = `File a message the owner will paste somewhere else (Slack, email, Jira comment, PR text). Call it once the draft is final, with the draft as markdown. The mod puts it on his clipboard as rich text when he is at the desk, and always keeps it in his brief with a Copy button. Still show the draft in your reply.`

async function sessionKey($: EngineInterface): Promise<string> {
  return `brief:${await $.session.id()}`
}

async function save($: EngineInterface, fn: (b: Brief) => Brief): Promise<Brief> {
  const next = await update($, brief, b => fn(b ?? EMPTY))
  const key = await sessionKey($)
  await $.store.set(key, next)
  const index = ((await $.store.get('index')) as string[] | undefined) ?? []
  if (index[0] !== key) {
    const kept = [key, ...index.filter(k => k !== key)]
    for (const old of kept.slice(KEEP_SESSIONS)) await $.store.delete(old)
    await $.store.set('index', kept.slice(0, KEEP_SESSIONS))
  }
  return next
}

async function copyRich($: EngineInterface, markdown: string): Promise<boolean> {
  const ran = await $.process
    .run(['osascript', '-l', 'JavaScript', '-e', CLIP_JXA, mdToHtml(markdown), mdToPlain(markdown)], { timeoutMs: 5000 })
    .catch(() => null)
  if (ran?.exitCode === 0) return true
  return (await $.ui.copy({ text: mdToPlain(markdown) })).isCopied
}

function moveSteps(steps: Step[], done: string[], active?: string, failed?: { step: string; note?: string }): Step[] {
  const doneSet = new Set(done.map(s => s.toLowerCase()))
  let out: Step[] = steps.map(s => (doneSet.has(s.title.toLowerCase()) ? { ...s, status: 'done' } : s))
  if (active) {
    const i = out.findIndex(s => s.title.toLowerCase() === active.toLowerCase())
    if (i >= 0) {
      out = out.map((s, j): Step => {
        if (j === i) return { ...s, status: 'active' }
        if (j < i && s.status !== 'failed') return { ...s, status: 'done' }
        return s.status === 'active' ? { ...s, status: 'pending' } : s
      })
    }
  }
  if (failed) out = out.map((s): Step => (s.title.toLowerCase() === failed.step.toLowerCase() ? { ...s, status: 'failed', note: failed.note } : s))
  if (!out.some(s => s.status === 'active')) {
    const first = out.findIndex(s => s.status === 'pending')
    out = out.map((s, j): Step => (j === first ? { ...s, status: 'active' } : s))
  }
  return out
}

export const register: Register = (on, options) => {
  let lastPrompt = 0
  const extraHosts = String((options as Record<string, unknown> | undefined)?.linkHosts ?? '').split(',').map(s => s.trim())

  on('session.start', async ($, e, next) => {
    const stored = (await $.store.get(await sessionKey($))) as Brief | undefined
    if (stored) await update($, brief, () => ({ ...EMPTY, ...stored }))
    await $.command.register({ name: 'brief', description: "Show or hide this session's brief" })
    await $.tool.register({
      name: 'brief',
      description: BRIEF_TOOL,
      isDeferred: false,
      inputSchema: {
        type: 'object',
        properties: {
          need: { type: 'string' },
          resolve: { type: 'string' },
          plan: { type: 'object', properties: { title: { type: 'string' }, steps: { type: 'array', items: { type: 'string' } } }, required: ['title', 'steps'] },
          done: { type: 'array', items: { type: 'string' } },
          active: { type: 'string' },
          failed: { type: 'object', properties: { step: { type: 'string' }, note: { type: 'string' } }, required: ['step'] },
          handy: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' } }, required: ['label', 'value'] } },
        },
      },
    })
    await $.tool.register({
      name: 'copy_draft',
      description: DRAFT_TOOL,
      isDeferred: false,
      inputSchema: {
        type: 'object',
        properties: { title: { type: 'string', description: 'Where it goes, e.g. "Slack to #backend"' }, markdown: { type: 'string' } },
        required: ['title', 'markdown'],
      },
    })
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    lastPrompt = Date.now()
    return next(e)
  })

  on('command.run', { command: 'brief' }, async $ => {
    const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
    if (isOpen) {
      await $.ui.close({ id: PANE })
      return { text: 'Brief hidden.' }
    }
    await save($, b => ({ ...b, seen: b.changes }))
    await $.ui.open({ id: PANE, title: 'Brief', closeOnEscape: true, columns: 46 })
    return { text: 'Brief shown. /brief or Esc hides it.' }
  })

  on('tool.call', { tool: 'mcp__session-brief__brief' }, async ($, e) => {
    const a = e as unknown as {
      need?: string; resolve?: string; plan?: { title: string; steps: string[] }; done?: string[]; active?: string
      failed?: { step: string; note?: string }; handy?: { label: string; value: string }[]
    }
    const now = Date.now()
    const b = await save($, cur => {
      const out = { ...cur }
      if (a.resolve) {
        const r = a.resolve.toLowerCase()
        out.needs = r === 'all' ? [] : out.needs.filter(n => n.id !== a.resolve && !n.text.toLowerCase().includes(r))
      }
      if (a.need && !out.needs.some(n => n.text === a.need)) {
        out.needs = [...out.needs, { id: `n${now}`, text: a.need }]
        out.changes++
      }
      if (a.plan) out.plan = { title: a.plan.title, steps: a.plan.steps.map(t => ({ title: t, status: 'pending' as const })) }
      if (out.plan && (a.plan || a.done || a.active || a.failed)) {
        out.plan = { ...out.plan, steps: moveSteps(out.plan.steps, a.done ?? [], a.active, a.failed) }
      }
      if (a.handy?.length) {
        const items = a.handy.map(h => ({ url: h.value, label: h.label, at: now }))
        out.links = [...items, ...out.links.filter(l => !items.some(i => i.url === l.url))].slice(0, 12)
        out.changes++
      }
      return out
    })
    const steps = b.plan?.steps ?? []
    return { result: `Brief updated. Needs: ${b.needs.length}. Plan: ${steps.filter(s => s.status === 'done').length}/${steps.length}.` }
  })

  on('tool.call', { tool: 'mcp__session-brief__copy_draft' }, async ($, e) => {
    const a = e as unknown as { title: string; markdown: string }
    const now = Date.now()
    await save($, b => ({ ...b, drafts: [{ id: `d${now}`, title: a.title, markdown: a.markdown, at: now }, ...b.drafts].slice(0, 8), changes: b.changes + 1 }))
    // copy only while the owner is at the desk, so parallel sessions never clobber his clipboard
    if (now - lastPrompt < PRESENT_MS && (await copyRich($, a.markdown))) return { result: 'Draft filed in the brief and copied to the clipboard as rich text.' }
    return { result: 'Draft filed in the brief; not copied now since the owner may be away. He copies it from /brief.' }
  })

  // Every other tool: collect links from create calls, file and clear expired logins.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    const tool = String(e.tool)
    if (tool.startsWith('mcp__session-brief__') || ran.deny !== undefined) return ran
    const command = tool === 'Bash' ? String((e as unknown as { command?: string }).command ?? '') : ''
    const text = ran.text ?? ''
    if (ran.isError) {
      const login = authNeed(tool, text, command)
      if (login) {
        await save($, b => (b.needs.some(n => n.login === login) ? b
          : { ...b, needs: [{ id: `l${login}`, login, text: `${login} login expired. ${loginFix(login)}` }, ...b.needs], changes: b.changes + 1 }))
      }
      return ran
    }
    const group = authGroup(tool, command)
    if (group && (await read($, brief)).needs.some(n => n.login === group)) {
      await save($, b => ({ ...b, needs: b.needs.filter(n => n.login !== group) }))
    }
    if (isCreating(tool, command)) {
      const urls = urlsIn(text)
      if (urls.length) await save($, b => ({ ...b, links: addLinks(b.links, urls, Date.now()), changes: b.changes + 1 }))
    }
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const res = await next(e)
    if (e.agentId !== undefined) return res
    const urls = replyLinks(e.answer, extraHosts)
    let b = await read($, brief)
    if (urls.some(u => !b.links.some(l => l.url === u))) {
      b = await save($, cur => ({ ...cur, links: addLinks(cur.links, urls, Date.now()), changes: cur.changes + 1 }))
    }
    const fresh = b.changes - b.seen
    if (b.needs.length === 0 && fresh <= 0) return res
    const parts = [b.needs.length ? `needs you: ${b.needs.length}` : '', fresh > 0 ? `${fresh} new` : ''].filter(Boolean)
    return { ...res, text: `brief · ${parts.join(' · ')} · /brief` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const b = await read($, brief)
    const steps = b.plan?.steps ?? []
    const doneN = steps.filter(s => s.status === 'done').length
    const mark = { done: '✓', active: '●', pending: '○', failed: '✗' } as const
    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold color={b.needs.length ? 'yellow' : undefined}>Needs you</Text>
          {b.needs.length === 0 && <Text dimColor>Nothing</Text>}
          {b.needs.map(n => (
            <Button key={n.id} plain onPress={() => void save($, cur => ({ ...cur, needs: cur.needs.filter(m => m.id !== n.id) }))}>
              • {n.text} <Text dimColor>[done]</Text>
            </Button>
          ))}
        </Box>
        {b.plan && (
          <Box flexDirection="column">
            <Text bold>Plan  {bar(doneN, steps.length)} {doneN}/{steps.length}</Text>
            <Text dimColor>{b.plan.title}</Text>
            {steps.map((s, i) => (
              <Text key={`s${i}`} color={s.status === 'failed' ? 'red' : s.status === 'active' ? 'cyan' : undefined} dimColor={s.status === 'done'}>
                {mark[s.status]} {s.title}{s.note ? ` (${s.note})` : ''}
              </Text>
            ))}
          </Box>
        )}
        {b.drafts.length > 0 && (
          <Box flexDirection="column">
            <Text bold>Drafts</Text>
            {b.drafts.map(d => (
              <Button key={d.id} plain onPress={async () => { $.ui.toast((await copyRich($, d.markdown)) ? `Copied: ${d.title}` : 'Copy failed') }}>
                {d.title} <Text dimColor>[copy]</Text>
              </Button>
            ))}
          </Box>
        )}
        <Box flexDirection="column">
          <Text bold color="green">Keep handy</Text>
          {b.links.length === 0 && <Text dimColor>Nothing yet</Text>}
          {b.links.map(l => (
            <Button key={`k${l.url}`} plain onPress={async p => { await $.ui.copy({ text: l.url, surface: p.surface }); $.ui.toast(`Copied ${l.label}`) }}>
              {l.label} <Text dimColor>{l.url.replace(/^https?:\/\//, '').slice(0, 30)}</Text>
            </Button>
          ))}
        </Box>
        <Text dimColor>Click a row to copy it. Esc or /brief hides.</Text>
      </Box>
    )
  })
}
