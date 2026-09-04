import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { AvatarMode } from '../AvatarMode'
import { makeReadBeat } from '../../test/fixtures'
import type { VideoDoc } from '../../types'

function docPayload(voLocked = true, extra: any = {}): VideoDoc {
  return {
    key: 'demo',
    title: 'A hosted script',
    beats: [
      makeReadBeat({ num: '1.1', say: ['Para 1.', '', 'Para 2.'], section: 's01' }),
      makeReadBeat({ num: '2.1', say: ['Para 3.'], section: 's02' })
    ],
    draft: {},
    edits: {},
    says: {},
    finished: false,
    voLocked,
    ...extra
  }
}

describe('AvatarMode Component', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Renders paragraphs from doc.beats', () => {
    const doc = docPayload()
    render(<AvatarMode doc={doc} onSubmitted={() => {}} />)

    const p1 = screen.getByText('Para 1.')
    const p2 = screen.getByText('Para 2.')
    const p3 = screen.getByText('Para 3.')

    expect(p1.getAttribute('data-para-idx')).toBe('0')
    expect(p2.getAttribute('data-para-idx')).toBe('1')
    expect(p3.getAttribute('data-para-idx')).toBe('2')
  })

  it('Rejects cross-paragraph selection', () => {
    const doc = docPayload()
    render(<AvatarMode doc={doc} onSubmitted={() => {}} />)

    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
    
    // Simulate cross-paragraph selection
    const selMock = {
      isCollapsed: false,
      anchorNode: { parentElement: { closest: () => document.createElement('div') } },
      focusNode: { parentElement: { closest: () => document.createElement('div') } },
      removeAllRanges: vi.fn(),
      getRangeAt: vi.fn()
    } as any

    selMock.anchorNode.parentElement.closest = () => { const el = document.createElement('div'); el.setAttribute('data-para-idx', '0'); return el }
    selMock.focusNode.parentElement.closest = () => { const el = document.createElement('div'); el.setAttribute('data-para-idx', '1'); return el }

    vi.spyOn(window, 'getSelection').mockReturnValue(selMock)
    
    const leftCol = screen.getByText('Para 1.').parentElement!
    fireEvent.mouseUp(leftCol)

    expect(alertMock).toHaveBeenCalledWith('highlight one paragraph at a time')
    expect(selMock.removeAllRanges).toHaveBeenCalled()
    expect(screen.queryByText('Para 1.')).toBeTruthy() // ensure UI didn't queue anything
    
    // Total selections text should be 0
    expect(screen.getByText('Total selections: 0')).toBeTruthy()
  })

  it('Default engine dropdown changes new selections engine', () => {
    const doc = docPayload()
    render(<AvatarMode doc={doc} onSubmitted={() => {}} />)
    
    // Queue one selection on heygen4
    const selMock = {
      isCollapsed: false,
      anchorNode: { parentElement: { closest: () => null } },
      focusNode: { parentElement: { closest: () => null } },
      removeAllRanges: vi.fn(),
      getRangeAt: vi.fn().mockReturnValue({
        cloneRange: () => ({ selectNodeContents: vi.fn(), setEnd: vi.fn(), toString: () => '' }),
        toString: () => 'Para 1.',
        startContainer: {},
        startOffset: 0
      })
    } as any
    const p0 = document.createElement('div'); p0.setAttribute('data-para-idx', '0');
    selMock.anchorNode.parentElement.closest = () => p0
    selMock.focusNode.parentElement.closest = () => p0

    vi.spyOn(window, 'getSelection').mockReturnValue(selMock)
    const leftCol = screen.getByText('Para 1.').parentElement!
    fireEvent.mouseUp(leftCol)
    
    expect(screen.getByText('IV')).toBeTruthy() // heygen4
    
    // Change default to heygen3
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'heygen3' } })
    
    // Queue second selection
    const p1 = document.createElement('div'); p1.setAttribute('data-para-idx', '1');
    selMock.anchorNode.parentElement.closest = () => p1
    selMock.focusNode.parentElement.closest = () => p1
    selMock.getRangeAt = vi.fn().mockReturnValue({
      cloneRange: () => ({ selectNodeContents: vi.fn(), setEnd: vi.fn(), toString: () => '' }),
      toString: () => 'Para 2.',
      startContainer: {},
      startOffset: 0
    })
    fireEvent.mouseUp(leftCol)
    
    const toggles = screen.getAllByRole('button', { name: /III|IV/ })
    expect(toggles[0].textContent).toBe('III')
    expect(toggles[1].textContent).toBe('III')
  })

  it('Per-card override', () => {
    const doc = docPayload()
    render(<AvatarMode doc={doc} onSubmitted={() => {}} />)
    
    // Queue one selection
    const selMock = {
      isCollapsed: false,
      anchorNode: { parentElement: { closest: () => null } },
      focusNode: { parentElement: { closest: () => null } },
      removeAllRanges: vi.fn(),
      getRangeAt: vi.fn().mockReturnValue({
        cloneRange: () => ({ selectNodeContents: vi.fn(), setEnd: vi.fn(), toString: () => '' }),
        toString: () => 'Para 1.',
        startContainer: {},
        startOffset: 0
      })
    } as any
    const p0 = document.createElement('div'); p0.setAttribute('data-para-idx', '0');
    selMock.anchorNode.parentElement.closest = () => p0
    selMock.focusNode.parentElement.closest = () => p0
    vi.spyOn(window, 'getSelection').mockReturnValue(selMock)
    
    fireEvent.mouseUp(screen.getByText('Para 1.').parentElement!)
    
    const toggle = screen.getByRole('button', { name: 'IV' })
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'III' })).toBeTruthy()
  })

  it('Submit calls the api function', async () => {
    // We can mock fetch to intercept putHeygenSelections since it calls api.ts -> fetch
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
    )
    vi.stubGlobal('fetch', fetchMock)
    
    const doc = docPayload()
    const onSubmitted = vi.fn()
    render(<AvatarMode doc={doc} onSubmitted={onSubmitted} />)
    
    // Queue one selection
    const selMock = {
      isCollapsed: false,
      anchorNode: { parentElement: { closest: () => null } },
      focusNode: { parentElement: { closest: () => null } },
      removeAllRanges: vi.fn(),
      getRangeAt: vi.fn().mockReturnValue({
        cloneRange: () => ({ selectNodeContents: vi.fn(), setEnd: vi.fn(), toString: () => '' }),
        toString: () => 'Para 1.',
        startContainer: {},
        startOffset: 0
      })
    } as any
    const p0 = document.createElement('div'); p0.setAttribute('data-para-idx', '0');
    selMock.anchorNode.parentElement.closest = () => p0
    selMock.focusNode.parentElement.closest = () => p0
    vi.spyOn(window, 'getSelection').mockReturnValue(selMock)
    fireEvent.mouseUp(screen.getByText('Para 1.').parentElement!)
    
    const submitBtn = screen.getByRole('button', { name: 'Submit' })
    fireEvent.click(submitBtn)
    
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    
    const call = fetchMock.mock.calls.find(c => String(c[0]).includes('/heygen-selections'))
    expect(call).toBeDefined()
    const payload = JSON.parse(call![1].body)
    
    expect(payload).toEqual({
      default_engine: 'heygen4',
      selections: [
        { section_id: 's01', engine: 'heygen4', text: 'Para 1.' }
      ]
    })
    
    expect(onSubmitted).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Saved' })).toBeTruthy()
    
    vi.unstubAllGlobals()
  })
})

describe('App-level gates', () => {
  async function renderApp(pathname: string, search: string, voLocked: boolean) {
    vi.resetModules()
    window.history.replaceState({}, '', pathname + search)
    
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(docPayload(voLocked)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
  
    const { App } = await import('../../App')
    render(<App />)
    return fetchMock
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('App-level gate hides the tab (editor role, but voLocked=false)', async () => {
    const fetchMock = await renderApp('/', '?key=demo&role=editor', false)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Write')).toBeTruthy()) // wait for header to load
    
    expect(screen.queryByRole('tab', { name: /Avatar selection/i })).toBeNull()
  })

  it('App-level gate hides the tab when role missing (voLocked=true)', async () => {
    const fetchMock = await renderApp('/', '?key=demo', true)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Write')).toBeTruthy())
    
    expect(screen.queryByRole('tab', { name: /Avatar selection/i })).toBeNull()
  })

  it('App-level gate SHOWS the tab when role=editor and voLocked=true', async () => {
    const fetchMock = await renderApp('/', '?key=demo&role=editor', true)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Write')).toBeTruthy())
    
    expect(screen.queryByRole('tab', { name: /Avatar selection/i })).toBeTruthy()
  })
})
