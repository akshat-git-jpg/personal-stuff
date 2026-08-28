// Edit mode's contract, from the outside. Every one of these is a thing the
// owner can do by clicking, and the assertion is on the MARKDOWN that comes
// out — not on which elements moved — because the markdown is what gets written
// to script-plan.md and the elements are just how he pointed at it.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { EditView } from '../EditView'
import type { EditModel } from '../../types'

// Two sections, three beats, and a beat carrying every block kind that matters:
// a silent DEMO, two separate VIDEO notes (the case a merged array cannot
// represent), approved spoken copy, and a section-level rules box.
const SRC = [
  '# T', // 0
  '', // 1
  '## 1 · INTRODUCTION', // 2
  '', // 3
  '#### 1.1 · Cold open', // 4
  '', // 5
  '**DEMO**', // 6
  'Shot plays, nobody speaks.', // 7
  '', // 8
  '**VIDEO**', // 9
  'First video note.', // 10
  '', // 11
  '**VIDEO**', // 12
  'Second video note.', // 13
  '', // 14
  '**SAY** — final', // 15
  '> Approved spoken line.', // 16
  '', // 17
  '## 2 · BODY', // 18
  '', // 19
  '### SECTION: Alpha', // 20
  '', // 21
  '> **RULES — WHOLE SECTION**', // 22
  '> - Rule one.', // 23
  '', // 24
  '#### 2.1 · First body beat', // 25
  '', // 26
  '**SAY**', // 27
  '> Cover the thing.', // 28
  '', // 29
  '### SECTION: Beta', // 30
  '', // 31
  '#### 2.2 · Second body beat', // 32
  '', // 33
  '**SAY**', // 34
  '> Cover the other thing.', // 35
  '',
].join('\n')

// Hand-built to match what buildEditModel produces for SRC. Kept literal rather
// than generated so a parser change that shifts ranges shows up here as a
// failing test instead of two wrong things agreeing with each other.
const MODEL: EditModel = {
  parts: [
    { text: '1 · INTRODUCTION', line: 2, endLine: 3 },
    { text: '2 · BODY', line: 18, endLine: 19 },
  ],
  sections: [
    {
      name: 'Alpha',
      part: '2 · BODY',
      line: 20,
      endLine: 29,
      head: { line: 20, endLine: 21 },
      blocks: [
        { t: 'rules', kind: null, note: '', spoken: false, line: 22, endLine: 24, text: '> **RULES — WHOLE SECTION**\n> - Rule one.' },
      ],
      beatNums: ['2.1'],
    },
    {
      name: 'Beta',
      part: '2 · BODY',
      line: 30,
      endLine: 36,
      head: { line: 30, endLine: 31 },
      blocks: [],
      beatNums: ['2.2'],
    },
  ],
  beats: [
    {
      num: '1.1',
      title: 'Cold open',
      part: '1 · INTRODUCTION',
      section: null,
      line: 4,
      endLine: 17,
      head: { line: 4, endLine: 5 },
      blocks: [
        { t: 'lane', kind: 'DEMO', note: '', spoken: false, line: 6, endLine: 8, text: '**DEMO**\nShot plays, nobody speaks.' },
        { t: 'lane', kind: 'VIDEO', note: '', spoken: false, line: 9, endLine: 11, text: '**VIDEO**\nFirst video note.' },
        { t: 'lane', kind: 'VIDEO', note: '', spoken: false, line: 12, endLine: 14, text: '**VIDEO**\nSecond video note.' },
        { t: 'lane', kind: 'SAY', note: 'final', spoken: true, line: 15, endLine: 17, text: '**SAY** — final\n> Approved spoken line.' },
      ],
    },
    {
      num: '2.1',
      title: 'First body beat',
      part: '2 · BODY',
      section: 'Alpha',
      line: 25,
      endLine: 29,
      head: { line: 25, endLine: 26 },
      blocks: [{ t: 'lane', kind: 'SAY', note: '', spoken: true, line: 27, endLine: 29, text: '**SAY**\n> Cover the thing.' }],
    },
    {
      num: '2.2',
      title: 'Second body beat',
      part: '2 · BODY',
      section: 'Beta',
      line: 32,
      endLine: 36,
      head: { line: 32, endLine: 33 },
      blocks: [{ t: 'lane', kind: 'SAY', note: '', spoken: true, line: 34, endLine: 36, text: '**SAY**\n> Cover the other thing.' }],
    },
  ],
}

function setup() {
  const onApply = vi.fn()
  render(<EditView model={MODEL} text={SRC} busy={false} error={null} onApply={onApply} onDismissError={() => {}} />)
  return onApply
}

const applied = (fn: ReturnType<typeof vi.fn>): string => fn.mock.calls[0][0] as string

describe('the editor shows what is actually in the file', () => {
  it('renders one card per source block, not per merged lane', () => {
    setup()
    // Two separate VIDEO notes on beat 1.1 must be two cards. A view built from
    // the merged `video` array would show one, and deleting it would be a guess.
    expect(screen.getAllByText('Video notes')).toHaveLength(2)
    expect(screen.getByText('First video note.')).toBeTruthy()
    expect(screen.getByText('Second video note.')).toBeTruthy()
  })

  it('uses the same block names as the reading view', () => {
    setup()
    expect(screen.getByText('Silent demo')).toBeTruthy()
    expect(screen.getByText('Section rules')).toBeTruthy()
    expect(screen.getAllByText('Spoken').length).toBeGreaterThan(0)
  })

  it('shows every section and every beat', () => {
    setup()
    // By class, not by text: a section's name also appears as an option inside
    // the "Move to" menus, and matching those would pass for the wrong reason.
    const names = Array.from(document.querySelectorAll('.ed-section-name')).map((n) => n.textContent)
    expect(names).toEqual(['Alpha', 'Beta'])
    for (const n of ['1.1', '2.1', '2.2']) expect(screen.getByText(n)).toBeTruthy()
  })
})

describe('deleting', () => {
  it('a note goes immediately and takes only its own lines', () => {
    const onApply = setup()
    fireEvent.click(screen.getAllByLabelText('Delete this note')[0]) // the DEMO
    const out = applied(onApply)
    expect(out).not.toContain('Shot plays, nobody speaks.')
    expect(out).toContain('First video note.')
    expect(out).toContain('Approved spoken line.')
  })

  it('SPOKEN COPY HAS NO DELETE BUTTON — it is approved script', () => {
    setup()
    const spoken = screen.getAllByTestId('ed-block').filter((el) => within(el).queryByText('Spoken'))
    expect(spoken.length).toBeGreaterThan(0)
    for (const card of spoken) {
      const del = within(card).getByLabelText('Delete this note') as HTMLButtonElement
      expect(del.disabled, 'SPOKEN_DELETABLE: one click would drop approved script').toBe(true)
    }
  })

  it('a whole beat ASKS FIRST and does nothing until confirmed', () => {
    const onApply = setup()
    fireEvent.click(screen.getByLabelText('Delete beat 1.1'))
    expect(onApply).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('Delete beat 1.1')

    fireEvent.click(screen.getByText('Keep it'))
    expect(onApply).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('Delete beat 1.1'))
    fireEvent.click(screen.getByText('Delete'))
    const out = applied(onApply)
    expect(out).not.toContain('Cold open')
    expect(out).toContain('First body beat')
  })

  it('a whole section ASKS FIRST and names how many beats go with it', () => {
    const onApply = setup()
    fireEvent.click(screen.getByLabelText('Delete section Alpha'))
    expect(onApply).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('1 beats')

    fireEvent.click(screen.getByText('Delete section'))
    const out = applied(onApply)
    expect(out).not.toContain('SECTION: Alpha')
    expect(out).not.toContain('Cover the thing.')
    expect(out, 'the OTHER section must survive').toContain('SECTION: Beta')
  })
})

describe('moving', () => {
  it('a note moves down past its sibling', () => {
    const onApply = setup()
    // the DEMO card's ↓
    fireEvent.click(screen.getAllByLabelText('Move this note down')[0])
    const out = applied(onApply)
    expect(out.indexOf('First video note.')).toBeLessThan(out.indexOf('Shot plays, nobody speaks.'))
  })

  it('the FIRST note cannot move up and the LAST cannot move down', () => {
    setup()
    const cards = screen.getAllByTestId('ed-block')
    const firstUp = within(cards[0]).getByLabelText('Move this note up') as HTMLButtonElement
    expect(firstUp.disabled).toBe(true)
  })

  it('a whole section moves, carrying its beats', () => {
    const onApply = setup()
    fireEvent.click(screen.getByLabelText('Move section Beta up'))
    const out = applied(onApply)
    expect(out.indexOf('SECTION: Beta')).toBeLessThan(out.indexOf('SECTION: Alpha'))
    expect(out, 'BEAT_LEFT_BEHIND: the section moved without its beat').toContain('Second body beat')
    expect(out.indexOf('Second body beat')).toBeLessThan(out.indexOf('SECTION: Alpha'))
  })

  it('the jump menu moves a section straight to another position', () => {
    const onApply = setup()
    const menu = screen.getByLabelText('Move section Alpha') as HTMLSelectElement
    // only the OTHER section is offered, never its own slot
    const values = Array.from(menu.options).map((o) => o.value).filter(Boolean)
    expect(values).toEqual(['1'])
    fireEvent.change(menu, { target: { value: '1' } })
    const out = applied(onApply)
    expect(out.indexOf('SECTION: Beta')).toBeLessThan(out.indexOf('SECTION: Alpha'))
  })

  it('a beat can be thrown into a different section', () => {
    const onApply = setup()
    const menu = screen.getByLabelText('Move beat 2.1 to another section') as HTMLSelectElement
    fireEvent.change(menu, { target: { value: '0' } }) // the only option: Beta
    const out = applied(onApply)
    expect(out.indexOf('SECTION: Beta')).toBeLessThan(out.indexOf('First body beat'))
  })
})

describe('adding and editing', () => {
  it('adds an empty lane stub at the end of the beat', () => {
    const onApply = setup()
    fireEvent.click(screen.getAllByText('+ Video notes')[0])
    const out = applied(onApply)
    expect(out.split('**VIDEO**').length - 1).toBe(3) // was 2
  })

  it('offers Ask Claude as an addable lane but never Spoken', () => {
    setup()
    expect(screen.getAllByText('+ Ask Claude').length).toBeGreaterThan(0)
    expect(screen.queryByText('+ Spoken')).toBeNull()
  })

  it('clicking a note opens its RAW markdown, and Save rewrites just that block', () => {
    const onApply = setup()
    fireEvent.click(screen.getByText('First video note.'))
    const box = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(box.value, 'the box must hold the lane label too, not just the body').toBe('**VIDEO**\nFirst video note.')

    fireEvent.change(box, { target: { value: '**VIDEO**\nrewritten' } })
    fireEvent.click(screen.getByText('Save'))
    const out = applied(onApply)
    expect(out).toContain('rewritten')
    expect(out).not.toContain('First video note.')
    expect(out, 'the neighbouring note must be untouched').toContain('Second video note.')
  })

  it('Cancel writes nothing at all', () => {
    const onApply = setup()
    fireEvent.click(screen.getByText('First video note.'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '**VIDEO**\nthrown away' } })
    fireEvent.click(screen.getByText('Cancel'))
    expect(onApply).not.toHaveBeenCalled()
  })
})

describe('a refused save', () => {
  it('says so in place instead of failing silently', () => {
    render(
      <EditView
        model={MODEL}
        text={SRC}
        busy={false}
        error="that leaves the plan with no beats at all"
        onApply={vi.fn()}
        onDismissError={() => {}}
      />,
    )
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Not saved')
    expect(alert.textContent).toContain('no beats at all')
  })

  it('disables every control while a save is in flight', () => {
    render(<EditView model={MODEL} text={SRC} busy error={null} onApply={vi.fn()} onDismissError={() => {}} />)
    for (const b of screen.getAllByLabelText('Delete this note')) expect((b as HTMLButtonElement).disabled).toBe(true)
    for (const b of screen.getAllByText('+ Video notes')) expect((b as HTMLButtonElement).disabled).toBe(true)
  })
})
