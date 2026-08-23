import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FullScript } from '../FullScript'
import { makeReadBeat, makeWriteBeat } from '../../test/fixtures'
import type { Beat, VideoDoc } from '../../types'

function makeDoc(beats: Beat[], overrides: Partial<VideoDoc> = {}): VideoDoc {
  return {
    key: 'vid',
    title: 'Test video',
    beats,
    draft: {},
    edits: {},
    says: {},
    finished: false,
    ...overrides,
  }
}

function noop() {}

function renderFull(
  doc: VideoDoc | null,
  opts: { loadError?: 'notfound' | 'network' | null; beatLabels?: boolean; onFinish?: () => void; onRetry?: () => void } = {},
) {
  return render(
    <FullScript
      doc={doc}
      loadError={opts.loadError ?? null}
      beatLabels={opts.beatLabels ?? true}
      onRetry={opts.onRetry ?? noop}
      onFinish={opts.onFinish ?? noop}
    />,
  )
}

describe('FullScript', () => {
  it('never puts a beat label inside the prose column', () => {
    const beat = makeReadBeat({ num: '2.4', say: ['A distinctive first sentence right here.'] })
    renderFull(makeDoc([beat]))

    const sentence = screen.getByText('A distinctive first sentence right here.')
    const bd = sentence.closest('.bd')
    expect(bd, 'LABEL_IN_PROSE: expected a .bd ancestor around the beat text').not.toBeNull()
    expect(bd!.textContent, 'LABEL_IN_PROSE: the beat number leaked into the prose column').not.toContain(beat.num)
  })

  it('never renders an instruction field in the full script view', () => {
    const beat = makeWriteBeat({
      show: ['SHOW_MARKER instruction line'],
      edit: ['EDIT_MARKER instruction line'],
      facts: ['FACTS_MARKER instruction line'],
      angle: ['ANGLE_MARKER instruction line'],
      rules: ['RULES_MARKER instruction line'],
    })
    const doc = makeDoc([beat], { draft: { [beat.num]: 'What he actually wrote.' } })
    const { container } = renderFull(doc)

    const text = container.textContent ?? ''
    const instructionStrings = [...beat.show, ...beat.edit, ...beat.facts, ...(beat.angle ?? []), ...beat.rules]
    for (const s of instructionStrings) {
      expect(text.includes(s), `INSTRUCTION_IN_FULL_SCRIPT: found "${s}" in the rendered output`).toBe(false)
    }
  })

  it('renders a written beat and a pre-written beat with identical prose className', () => {
    const readBeat = makeReadBeat({ num: '1.1', say: ['Spoken as written.'] })
    const writeBeat = makeWriteBeat({ num: '2.1' })
    const doc = makeDoc([readBeat, writeBeat], { draft: { [writeBeat.num]: 'What he wrote himself.' } })
    renderFull(doc)

    const spoken = screen.getByText('Spoken as written.')
    const written = screen.getByText('What he wrote himself.')
    expect(written.className).toBe(spoken.className)
  })

  it('empties the label cells when beatLabels is off but keeps the same number of grid children', () => {
    const beats = [makeReadBeat({ num: '1.1' }), makeWriteBeat({ num: '2.1' })]
    const doc = makeDoc(beats, { draft: { '2.1': 'Some words here.' } })
    const { container, rerender } = render(
      <FullScript doc={doc} loadError={null} beatLabels={true} onRetry={noop} onFinish={noop} />,
    )
    const before = container.querySelectorAll('.doc > *').length

    rerender(<FullScript doc={doc} loadError={null} beatLabels={false} onRetry={noop} onFinish={noop} />)
    const after = container.querySelectorAll('.doc > *').length
    expect(after).toBe(before)

    const labelCells = container.querySelectorAll('.mk')
    labelCells.forEach((cell) => expect(cell.textContent).toBe(''))
  })

  it('renders "Not written yet." for an unwritten beat, never its angle', () => {
    const beat = makeWriteBeat({ angle: ['Draft angle instruction text.'] })
    renderFull(makeDoc([beat]))

    expect(screen.getByText('Not written yet.')).toBeTruthy()
    expect(screen.queryByText('Draft angle instruction text.')).toBeNull()
  })

  it('renders a no-beats message when the outline has zero beats', () => {
    renderFull(makeDoc([]))
    expect(screen.getByText('This outline has no beats.')).toBeTruthy()
  })

  it('renders a not-found message on a 404', () => {
    renderFull(null, { loadError: 'notfound' })
    expect(screen.getByText('No outline for this video yet.')).toBeTruthy()
  })

  it('renders a retry message on a network error', () => {
    renderFull(null, { loadError: 'network' })
    expect(screen.getByText('Could not load the script.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
  })

  it('shows the finished chip and no enabled finish button once the script is finished', () => {
    const beat = makeReadBeat()
    const doc = makeDoc([beat], { finished: true })
    renderFull(doc)

    expect(screen.getByText('Script finished')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /mark script finished/i })).toBeNull()
  })

  it('disables the finish button with an explanatory title while any beat is unwritten', () => {
    const written = makeReadBeat({ num: '1.1', say: ['Done.'] })
    const unwritten = makeWriteBeat({ num: '2.1' })
    renderFull(makeDoc([written, unwritten]))

    const button = screen.getByRole('button', { name: /mark script finished/i }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.title).toBe('Every beat needs words before you can finish.')
  })

  it('turns an empty string inside say[] into a second paragraph', () => {
    const beat = makeReadBeat({ say: ['First paragraph.', '', 'Second paragraph.'] })
    renderFull(makeDoc([beat]))

    const bd = screen.getByText('First paragraph.').closest('.bd')
    expect(bd!.querySelectorAll('p').length).toBe(2)
  })

  it('renders a verdict as a paragraph with the same class as the rest', () => {
    const beat = makeReadBeat({ say: ['Spoken line.'], verdict: 'This worked well.' })
    renderFull(makeDoc([beat]))

    const spoken = screen.getByText('Spoken line.')
    const verdict = screen.getByText('This worked well.')
    expect(verdict.className).toBe(spoken.className)
  })
})
