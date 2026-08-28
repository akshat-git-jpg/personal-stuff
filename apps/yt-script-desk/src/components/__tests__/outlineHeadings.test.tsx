// A beat is labelled by the OUTLINE'S heading, never by a title invented for the
// beat.
//
// Owner, 2026-08-27, reading beats called "Cold open — a finished Vox shot, no
// logos, no UI" and "Reveal, who this is for, and credibility": *"I don't like
// it. These are too confusing. I prefer that this heading should be the actual
// outline headings... you can keep that as intro as a heading and then you can
// just make it intro 1.1 intro 1.2."*
//
// The underlying defect was worse than the titles: the desk rendered
// `beat.title` and never rendered `beat.section` at all, so the eleven section
// names approved at gate 040 were invisible in the tool built to review them.
// `beat.title` is still parsed and still in the data — it is simply not what
// labels a beat. These tests exist because "show the title, it's right there in
// the model" is the obvious thing for a later refactor to do.
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { WriteView } from '../WriteView'
import { FullScript } from '../FullScript'
import { makeReadBeat, makeWriteBeat } from '../../test/fixtures'
import type { Prefs } from '../../hooks/usePrefs'
import type { VideoDoc } from '../../types'

const allOnPrefs: Prefs = {
  instructions: true,
  whatToCover: true,
  videoNotes: true,
  generalNotes: true,
  beatLabels: true,
  scriptNotes: false,
}

function noop() {}

const CONFUSING_TITLE = 'Cold open — a finished Vox shot, no logos, no UI'

function renderView(beats: ReturnType<typeof makeReadBeat>[]) {
  return render(
    <WriteView
      beats={beats}
      prefs={allOnPrefs}
      draft={{}}
      edits={{}}
      says={{}}
      onDraftSave={noop}
      onSaySave={noop}
      onSayRestore={noop}
    />,
  )
}

function docOf(beats: ReturnType<typeof makeReadBeat>[]): VideoDoc {
  return { key: 'k', title: 'T', beats, draft: {}, edits: {}, says: {}, finished: false }
}

describe('a beat is labelled by the outline heading', () => {
  it('never prints the invented beat title', () => {
    renderView([makeReadBeat({ title: CONFUSING_TITLE })])
    expect(
      document.body.textContent ?? '',
      'INVENTED_TITLE_SHOWN: the beat title is back in the left track — the outline section is the heading',
    ).not.toContain(CONFUSING_TITLE)
  })

  // The name lives in the section header, ONCE, and the beat carries only its
  // number. It used to be repeated into every beat label too ("WHAT MAKES IT
  // LOOK LIKE VOX 2.1" in uppercase mono, directly under a header saying the
  // same words) — owner, 2026-08-27: *"Can you make the UI better It looks bad,
  // for all the section titles which you are adding"*.
  it('shows the outline section name in the section header', () => {
    renderView([makeWriteBeat({ section: 'Locking the look', title: 'some invented prose' })])
    const head = document.querySelector('[data-testid="group-head"]')?.textContent ?? ''
    expect(head, 'SECTION_NOT_SHOWN: the outline section the owner approved is missing').toContain(
      'Locking the look',
    )
  })

  // REVERSED 2026-08-28. This test used to assert the OPPOSITE — that the beat
  // label carried its number ALONE — written during the header polish, when the
  // section name was rendering in uppercase mono under a header saying the same
  // words. The owner had asked for "intro 1.1, intro 1.2" from the start and
  // asked again after the polish: *"make these changes such that the heading
  // also the subheadings also contains the heading main heading for example 1.1
  // introduction 1.2 introduction"*. The duplication was never the complaint;
  // the SHOUTING was. So the name belongs in the label, in sentence case, and
  // this test now guards that instead of guarding its absence.
  it('labels the beat with its number AND its section', () => {
    renderView([makeWriteBeat({ section: 'Locking the look', title: 'some invented prose' })])
    const label = document.querySelector('.beat-num')?.textContent ?? ''
    expect(label, 'BEAT_NUM_MISSING: the beat lost its number').toContain('2.4')
    expect(
      label,
      'BEAT_SECTION_MISSING: the beat label no longer names its section, so a beat read on its own says nothing about where it sits',
    ).toContain('Locking the look')
  })

  it('never SHOUTS the section name in the beat label', () => {
    renderView([makeWriteBeat({ section: 'Locking the look' })])
    const el = document.querySelector('.beat-num-sec')
    expect(el, 'BEAT_SECTION_MISSING: no section element in the beat label').not.toBeNull()
    expect(
      el?.textContent ?? '',
      'SECTION_SHOUTED: the section name is uppercased in the beat label — that is what the owner called bad the first time',
    ).not.toBe((el?.textContent ?? '').toUpperCase())
  })

  it('falls back to the part name for intro and conclusion, which have no section', () => {
    renderView([makeReadBeat({ section: null, part: '1 · INTRODUCTION', partKind: 'intro' })])
    const head = document.querySelector('[data-testid="group-head"]')?.textContent ?? ''
    expect(head, 'PART_FALLBACK_MISSING: an intro beat lost its heading entirely').toContain('Introduction')
    expect(head, 'PART_NUMBER_LEAKED: the "1 ·" prefix belongs to the document, not the heading').not.toContain(
      '1 · INTRODUCTION',
    )
  })

  it('prints the outline heading once per section, not once per beat', () => {
    renderView([
      makeWriteBeat({ num: '2.1', section: 'Adding the motion' }),
      makeWriteBeat({ num: '2.2', section: 'Adding the motion' }),
      makeWriteBeat({ num: '2.3', section: 'Putting it all together' }),
    ])
    const heads = [...document.querySelectorAll('[data-testid="group-head"]')].map((n) => n.textContent)
    expect(
      heads,
      'GROUP_HEAD_PER_BEAT: a section header rendered for every beat instead of once per section',
    ).toEqual(['Adding the motion', 'Putting it all together'])
  })
})

describe('the full script margin uses the outline heading too', () => {
  it('does not print the invented title in the margin', () => {
    render(
      <FullScript
        doc={docOf([makeReadBeat({ title: CONFUSING_TITLE, section: 'Writing the script' })])}
        loadError={null}
        beatLabels
        onRetry={noop}
        onFinish={noop}
      />,
    )
    const body = document.body.textContent ?? ''
    expect(body, 'INVENTED_TITLE_IN_MARGIN: the read-through margin still shows beat titles').not.toContain(
      CONFUSING_TITLE,
    )
    expect(body, 'SECTION_NOT_IN_MARGIN: the outline heading is missing from the margin').toContain(
      'Writing the script',
    )
  })
})
