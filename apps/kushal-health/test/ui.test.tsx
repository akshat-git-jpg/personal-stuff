// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import BloodTab from '../src/client/BloodTab'
import Detail from '../src/client/Detail'
import { fixture } from './fixtures/blood'

afterEach(cleanup)

const home = () => render(<BloodTab data={fixture} />)
const rowNames = () =>
  [...within(screen.getByTestId('tests')).getAllByRole('link')].map((a) => a.querySelector('.row-name')?.textContent)

describe('BloodTab (home)', () => {
  it('shows the empty state with no reports', () => {
    render(<BloodTab data={{ reports: [], markers: [] }} />)
    expect(screen.getByText('No blood reports yet.')).toBeTruthy()
  })

  it('heads the summary with the latest date and the three counts', () => {
    home()
    const card = screen.getByTestId('verdict')
    expect(card.textContent).toContain('Latest report · 15 Jan 2025')
    const nums = [...card.querySelectorAll('.count')].map((c) => c.textContent)
    expect(nums).toEqual(['2out of range', '1near edge', '3normal'])
  })

  it('shows the written verdict', () => {
    home()
    expect(screen.getByText('Mostly normal. LDL is high.')).toBeTruthy()
  })

  it('lists every test date, newest first', () => {
    home()
    const chips = [...screen.getByTestId('test-dates').querySelectorAll('.date-chip')].map((c) => c.textContent)
    expect(chips).toEqual(['15 Jan 2025', '10 Jun 2024'])
  })

  it('puts only out-of-range tests that got worse in "Getting worse"', () => {
    home()
    const w = screen.getByTestId('worries')
    expect(within(w).getByTestId('worry-ldl')).toBeTruthy()
    expect(within(w).queryByTestId('worry-vit_d')).toBeNull()
    expect(within(w).queryByTestId('worry-tsh')).toBeNull()
  })

  it('labels the dates under the worry chart points', () => {
    home()
    const card = screen.getByTestId('worry-ldl')
    const dates = [...card.querySelectorAll('.lc-date')].map((t) => t.textContent)
    expect(dates).toEqual(['Jun 24', 'Jan 25'])
    expect(card.textContent).toContain('140 → 162 · 2 tests, Jun 24 – Jan 25')
  })

  it('sorts the test list worst first', () => {
    home()
    expect(rowNames()).toEqual(['LDL Cholesterol', 'Vitamin D', 'HbA1c', 'Anti Thyroglobulin', 'HBsAg', 'TSH'])
  })

  it('filters the list by body part and can show all again', () => {
    home()
    fireEvent.click(screen.getByTestId('part-thyroid'))
    expect(screen.getByText('Thyroid tests')).toBeTruthy()
    expect(rowNames()).toEqual(['Anti Thyroglobulin', 'TSH'])
    fireEvent.click(screen.getByText('Show all'))
    expect(rowNames()).toHaveLength(6)
  })

  it('shows body part status on the map', () => {
    home()
    expect(screen.getByTestId('part-heart').textContent).toContain('1 of 1 out')
    expect(screen.getByTestId('part-thyroid').textContent).toContain('all normal')
    expect((screen.getByTestId('part-liver') as HTMLButtonElement).disabled).toBe(true)
  })

  it('links each row to its detail screen and shows its date span', () => {
    home()
    const row = screen.getByTestId('marker-ldl')
    expect(row.getAttribute('href')).toBe('#/m/ldl')
    expect(row.textContent).toContain('2 tests · Jun 24 – Jan 25 · high')
    expect(screen.getByTestId('marker-vit_d').textContent).toContain('1 test · Jan 25 · low')
  })

  it('draws no sparkline or range bar for a qualitative test', () => {
    home()
    const row = screen.getByTestId('marker-hbsag')
    expect(row.querySelector('svg')).toBeNull()
    expect(row.querySelector('.rb')).toBeNull()
  })

  it('puts every test date in the sparkline hover title', () => {
    home()
    const title = screen.getByTestId('marker-tsh').querySelector('svg title')
    expect(title?.textContent).toBe('10 Jun 2024: 3.2\n15 Jan 2025: 2.1')
  })

  it('links only stored PDFs in the reports list', () => {
    home()
    const links = within(screen.getByTestId('reports')).getAllByRole('link', { name: 'Open PDF' })
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe('/api/reports/2025-01-15-test-lab-b/pdf')
  })
})

describe('What this means', () => {
  it('groups out-of-range tests by body area, worst first', () => {
    home()
    const cards = [...screen.getByTestId('insights').querySelectorAll('article')].map((a) => a.getAttribute('data-testid'))
    expect(cards).toEqual(['insight-heart', 'insight-vitamins'])
  })

  it('explains what the test is, why it matters and what to do', () => {
    home()
    const card = screen.getByTestId('insight-heart')
    expect(card.textContent).toContain('"bad" cholesterol')
    expect(card.textContent).toContain('heart attack and stroke')
    expect(card.textContent).toContain('Eat more fibre')
    expect(card.textContent).toContain('up from 140 (worse)')
  })

  it('uses the low-side meaning for a low result', () => {
    home()
    const card = screen.getByTestId('insight-vitamins')
    expect(card.textContent).toContain('weaken bones')
    expect(card.textContent).toContain('midday sun')
    expect(card.textContent).toContain('first time tested')
  })
})

describe('Detail', () => {
  const detail = (key: string) => render(<Detail data={fixture} markerKey={key} />)

  it('explains an out-of-range test with next steps', () => {
    detail('ldl')
    const about = screen.getByTestId('about')
    expect(about.textContent).toContain('What it is')
    expect(about.textContent).toContain('Why it matters')
    expect(about.textContent).toContain('What you can do')
  })

  it('explains a normal test without alarm', () => {
    detail('tsh')
    const about = screen.getByTestId('about')
    expect(about.textContent).toContain('If it goes high')
    expect(about.textContent).not.toContain('What you can do')
  })

  it('shows the latest value, status and change since the last test', () => {
    detail('ldl')
    const d = screen.getByTestId('detail')
    expect(d.textContent).toContain('LDL Cholesterol')
    expect(d.textContent).toContain('High · 1.6× the limit')
    expect(d.textContent).toContain('+22')
    expect(d.textContent).toContain('from 140, 10 Jun 2024')
  })

  it('shows a tooltip with the date, value and lab when a chart point is hovered', () => {
    detail('ldl')
    expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.mouseEnter(screen.getByLabelText('10 Jun 2024: 140 mg/dL'))
    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toContain('10 Jun 2024')
    expect(tip.textContent).toContain('140')
    expect(tip.textContent).toContain('High')
    expect(tip.textContent).toContain('Test Lab')
  })

  it('shows the tooltip on tap, keeps it after hover+click, and closes on a tap outside', () => {
    detail('ldl')
    const pt = screen.getByLabelText('15 Jan 2025: 162 mg/dL')
    fireEvent.mouseEnter(pt)
    fireEvent.click(pt)
    expect(screen.getByRole('tooltip').textContent).toContain('15 Jan 2025')
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('lists readings newest first with a PDF link only where stored', () => {
    detail('ldl')
    const rows = [...screen.getByTestId('readings').querySelectorAll('.reading')]
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('15 Jan 2025')
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/api/reports/2025-01-15-test-lab-b/pdf')
    expect(rows[1].querySelector('a')).toBeNull()
  })

  it('shows readings but no chart for a qualitative test', () => {
    detail('hbsag')
    expect(screen.getByTestId('detail').querySelector('.lc')).toBeNull()
    expect(screen.getByTestId('readings').textContent).toContain('Non Reactive')
  })

  it('says so when the test key is unknown', () => {
    detail('nope')
    expect(screen.getByText('This test is not in your reports.')).toBeTruthy()
  })
})
