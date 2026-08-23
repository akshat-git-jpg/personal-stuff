// A hosted link must render the desk, not "no ?key= in the URL".
//
// api.ts already resolved hosted mode correctly, but App.tsx derived its video
// key from ?key= alone and returned the error screen before any fetch ran. So
// the worker was right, the API was right, and every freelancer link still
// showed an error page. Shipped and only caught by opening a real link
// (2026-08-23). The whole point of the hosted mode is that there is NO ?key=.
//
// These tests set window.location BEFORE importing, because api.ts reads the
// pathname once at module load.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { makeReadBeat, makeWriteBeat } from '../../test/fixtures'

const NO_KEY = /no \?key= in the URL/

function docPayload() {
  return {
    key: 'demo',
    title: 'A hosted script',
    beats: [makeReadBeat({ num: '1' }), makeWriteBeat({ num: '2.1' })],
    draft: {},
    edits: {},
    says: {},
    finished: false,
  }
}

async function renderAt(pathname: string, search: string) {
  vi.resetModules()
  window.history.replaceState({}, '', pathname + search)

  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify(docPayload()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchMock)

  const { App } = await import('../../App')
  render(<App />)
  return fetchMock
}

describe('how the app identifies which video it is showing', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('renders the desk for a hosted /d/:token link that has no ?key=', async () => {
    const fetchMock = await renderAt('/d/sometoken123', '')

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(
      screen.queryByText(NO_KEY),
      'HOSTED_LINK_DEAD: a /d/:token link rendered the no-key error instead of the desk',
    ).toBeNull()
    await waitFor(() => expect(screen.getByText('A hosted script')).toBeTruthy())
  })

  it('asks the token-scoped API and never sends a ?key= in hosted mode', async () => {
    const fetchMock = await renderAt('/d/sometoken123', '')

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('/api/d/sometoken123/video')
    expect(url).not.toContain('?key=')
  })

  it('still renders the desk for a local ?key= link', async () => {
    const fetchMock = await renderAt('/', '?key=demo')

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByText(NO_KEY)).toBeNull()
    expect(String(fetchMock.mock.calls[0][0])).toContain('?key=demo')
  })

  it('still complains when there is neither a token nor a ?key=', async () => {
    await renderAt('/', '')
    expect(screen.getByText(NO_KEY)).toBeTruthy()
  })
  it('shows a dead-link message and no chrome when the token resolves to nothing', async () => {
    vi.resetModules()
    window.history.replaceState({}, '', '/d/staletoken')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ error: 'not found' }), { status: 404 }),
      ),
    )
    const { App } = await import('../../App')
    render(<App />)

    await waitFor(() => expect(screen.getByText(/link isn.t valid any more/)).toBeTruthy())
    expect(
      screen.queryByText(/voiceover script/),
      'DEAD_LINK_CHROME: a dead link rendered the header, so it reads as an empty script',
    ).toBeNull()
    expect(screen.queryByText('Full script')).toBeNull()
  })
})
