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
  screenRecording: true,
  generalNotes: true,
  videoEditor: true,
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

  it('shows the outline section name for a body beat', () => {
    renderView([makeWriteBeat({ section: 'Locking the look', title: 'some invented prose' })])
    const left = document.querySelector('[data-testid="left-cell"]')?.textContent ?? ''
    expect(left, 'SECTION_NOT_SHOWN: the outline section the owner approved is missing').toContain(
      'Locking the look',
    )
    expect(left).toContain('2.4')
  })

  it('falls back to the part name for intro and conclusion, which have no section', () => {
    renderView([makeReadBeat({ section: null, part: '1 · INTRODUCTION', partKind: 'intro' })])
    const left = document.querySelector('[data-testid="left-cell"]')?.textContent ?? ''
    expect(left, 'PART_FALLBACK_MISSING: an intro beat lost its heading entirely').toContain('Introduction')
    expect(left, 'PART_NUMBER_LEAKED: the "1 ·" prefix belongs to the document, not the label').not.toContain(
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
