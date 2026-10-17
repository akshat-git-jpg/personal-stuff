import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { authNeed, isCreating, mdToHtml, mdToPlain, replyLinks } from '../hooks/lib'

test('lib: links, creates, auth, markdown', () => {
  expect(replyLinks('see https://github.com/acme/api/pull/42 and https://example.com/x')).toEqual(['https://github.com/acme/api/pull/42'])
  expect(replyLinks('at https://grafana.acme.io/d/1', ['acme.io'])).toEqual(['https://grafana.acme.io/d/1'])
  expect(isCreating('Bash', 'gh pr create --fill')).toBe(true)
  expect(isCreating('Bash', 'gh pr list')).toBe(false)
  expect(isCreating('mcp__claude_ai_Atlassian_2__createJiraIssue')).toBe(true)
  expect(isCreating('mcp__claude_ai_Atlassian_2__getJiraIssue')).toBe(false)
  expect(authNeed('Bash', 'Error: Token has expired and refresh failed', 'aws s3 ls')).toBe('AWS')
  expect(authNeed('Bash', 'expected 401 got 200', 'npm test')).toBe(null)
  expect(authNeed('mcp__claude_ai_Datadog__search', '401 Unauthorized')).toBe('Datadog')
  expect(mdToHtml('Hi **team**\n- one\n- two')).toBe('<p>Hi <b>team</b></p><ul><li>one</li><li>two</li></ul>')
  expect(mdToPlain('**Hi**\n- a')).toBe('Hi\n• a')
})

function base(on: On) {
  mock.store(on)
  on('session.id', () => ({ value: 's1' }))
  on('session.start', () => ({ cwd: '/tmp' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('tool.register', (_$, e) => ({ value: { tool: e.name } }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
}

test('collects a created PR, files an expired login, shows the pending line', async ($, on) => {
  base(on)
  on('tool.call', { tool: 'Bash' }, ($, e) =>
    String((e as { command?: string }).command).startsWith('gh pr create')
      ? { result: { stdout: 'https://github.com/acme/api/pull/7\n', stderr: '', interrupted: false, isImage: false }, text: 'https://github.com/acme/api/pull/7' }
      : { result: { stdout: '', stderr: 'Token has expired and refresh failed', interrupted: false, isImage: false }, isError: true, text: 'Error: Token has expired and refresh failed' })
  await $.session.start({ source: 'startup' } as never)
  await $.tool.call({ tool: 'Bash', command: 'gh pr create --fill', description: 'x' } as never)
  await $.tool.call({ tool: 'Bash', command: 'aws s3 ls --profile p', description: 'x' } as never)
  const done = await $.turn.complete({ answer: 'Raised it.', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as never)
  expect(done.text).toBe('brief · needs you: 1 · 2 new · /brief')
  const pane = await $.ui.mount({ plugin: 'session-brief', surface: 'terminal', component: 'Pane', requestId: 'session-brief', props: {} as never })
  expect((await pane.find({ text: 'PR api#7' }))).toBeTruthy()
  expect((await pane.find({ text: /AWS login expired/ }))).toBeTruthy()
})

test('brief tool moves the plan', async ($, on) => {
  base(on)
  await $.session.start({ source: 'startup' } as never)
  await $.tool.call({ tool: 'mcp__session-brief__brief', plan: { title: 'Fix', steps: ['Code', 'Test', 'PR'] } } as never)
  const r = await $.tool.call({ tool: 'mcp__session-brief__brief', done: ['Code'], need: 'Approve prod query' } as never)
  expect(r.text ?? JSON.stringify(r.result)).toContain('Needs: 1. Plan: 1/3')
  const pane = await $.ui.mount({ plugin: 'session-brief', surface: 'terminal', component: 'Pane', requestId: 'session-brief', props: {} as never })
  expect((await pane.find({ text: '● Test' }))).toBeTruthy()
  expect((await pane.find({ text: /1\/3/ }))).toBeTruthy()
})
