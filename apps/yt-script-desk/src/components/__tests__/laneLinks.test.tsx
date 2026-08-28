// A URL in the instruction track is a clickable link.
//
// Owner, 2026-08-28: *"can we please add reference link wherever possible for my
// freelancer... you said Joseph's list, but I don't think my freelancer is aware
// of Joseph."* A reference he has to select, copy and paste is not a reference.
//
// Bare URLs, deliberately. This track renders text with one custom handler for
// `**bold**` and no markdown parser, so `[Joseph](https://...)` printed its
// brackets. The pipeline-side guard is test/sourceLinks.test.mjs.
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { WriteView } from '../WriteView'
import { makeReadBeat } from '../../test/fixtures'
import type { Prefs } from '../../hooks/usePrefs'

const allOn: Prefs = {
  instructions: true,
  whatToCover: true,
  videoNotes: true,
  generalNotes: true,
  beatLabels: true,
  scriptNotes: false,
}

function noop() {}

function renderWith(facts: string[]) {
  return render(
    <WriteView
      beats={[makeReadBeat({ facts })]}
      prefs={allOn}
      draft={{}}
      edits={{}}
      says={{}}
      onDraftSave={noop}
      onSaySave={noop}
      onSayRestore={noop}
    />,
  )
}

describe('a source URL in an instruction lane', () => {
  it('becomes a real anchor the freelancer can click', () => {
    renderWith(['Who these people are: Joseph https://youtu.be/PaXuebdY75U'])
    const a = document.querySelector('a.lane-link') as HTMLAnchorElement | null
    expect(a, 'LANE_LINK_MISSING: the URL rendered as plain text, so it cannot be opened').not.toBeNull()
    expect(a?.getAttribute('href')).toBe('https://youtu.be/PaXuebdY75U')
  })

  it('opens in a new tab without leaking the referrer', () => {
    renderWith(['See https://youtu.be/edrUbfeSPio'])
    const a = document.querySelector('a.lane-link')
    expect(a?.getAttribute('target'), 'LANE_LINK_SAME_TAB: clicking would lose the desk').toBe('_blank')
    expect(a?.getAttribute('rel') ?? '').toContain('noopener')
  })

  it('leaves a sentence-ending period out of the href', () => {
    renderWith(['The source is https://youtu.be/Jkt4aTOpqpM.'])
    const a = document.querySelector('a.lane-link')
    expect(
      a?.getAttribute('href'),
      'LANE_LINK_ATE_PUNCTUATION: the trailing period went into the URL and the link 404s',
    ).toBe('https://youtu.be/Jkt4aTOpqpM')
  })

  it('still renders bold, and does not break the surrounding words', () => {
    renderWith(['**Thomas Creates** uses VidIQ. Source https://youtu.be/edrUbfeSPio here.'])
    const body = document.body.textContent ?? ''
    expect(document.querySelector('strong')?.textContent).toBe('Thomas Creates')
    expect(body, 'RAW_MARKDOWN_SHOWN: asterisks reached the instruction track').not.toContain('**')
    expect(body).toContain('uses VidIQ.')
    expect(body).toContain('here.')
  })

  it('handles a line with several links', () => {
    renderWith(['A https://youtu.be/aaaaaaaaaaa · B https://youtu.be/bbbbbbbbbbb'])
    const hrefs = [...document.querySelectorAll('a.lane-link')].map((n) => n.getAttribute('href'))
    expect(hrefs, 'LANE_LINK_ONLY_FIRST: only the first URL on the line became a link').toEqual([
      'https://youtu.be/aaaaaaaaaaa',
      'https://youtu.be/bbbbbbbbbbb',
    ])
  })
})
