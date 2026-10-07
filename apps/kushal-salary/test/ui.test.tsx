// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import MonthsTab from '../src/client/MonthsTab'
import TimelineTab from '../src/client/TimelineTab'
import { fixture, note } from './fixtures/salary'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const kpi = (i: number) => screen.getByTestId('kpis').querySelectorAll('b')[i].textContent

describe('Every month tab', () => {
  it('shows the empty state with no payslips', () => {
    render(<MonthsTab months={[]} />)
    expect(screen.getByText('No payslips yet.')).toBeTruthy()
    expect(screen.queryByTestId('month-chart')).toBeNull()
  })

  it('heads with growth and the event counts', () => {
    render(<MonthsTab months={fixture} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Monthly pay up 1.6× since Jan 2024')
    expect(screen.getByTestId('sub').textContent).toContain('1 promotion · 1 hike · 3 payouts')
  })

  it('defaults to net', () => {
    render(<MonthsTab months={fixture} />)
    expect(kpi(0)).toBe('₹1.41L')
    expect(screen.getByRole('button', { name: 'Net' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('switches to gross and remembers it', () => {
    render(<MonthsTab months={fixture} />)
    fireEvent.click(screen.getByRole('button', { name: 'Gross' }))
    expect(kpi(0)).toBe('₹1.61L')
    expect(screen.getByRole('button', { name: 'Gross' }).getAttribute('aria-pressed')).toBe('true')
    expect(localStorage.getItem('ksalary.mode')).toBe('gross')
  })

  it('draws one bar per month and one payout bar per payout month', () => {
    render(<MonthsTab months={fixture} />)
    const chart = screen.getByTestId('month-chart')
    expect(within(chart as unknown as HTMLElement).getAllByTestId('base-bar')).toHaveLength(9)
    expect(within(chart as unknown as HTMLElement).getAllByTestId('payout-bar')).toHaveLength(3)
  })

  it('labels a payout with its amount', () => {
    render(<MonthsTab months={fixture} />)
    expect(screen.getByTestId('month-chart').textContent).toContain('+₹60k')
  })

  it('marks the promotion and the hike on the chart', () => {
    render(<MonthsTab months={fixture} />)
    const text = screen.getByTestId('month-chart').textContent
    expect(text).toContain('+33% · Senior Engineer')
    expect(text).toContain('+20% hike')
  })

  it('links the last 6 months to their payslips, newest first', () => {
    render(<MonthsTab months={fixture} />)
    const links = within(screen.getByTestId('recent')).getAllByRole('link')
    expect(links).toHaveLength(6)
    expect(links[0].getAttribute('href')).toBe('/api/months/2025-06/pdf')
  })
})

describe('Timeline tab', () => {
  it('shows the empty state with no payslips', () => {
    render(<TimelineTab months={[]} notes={[note]} />)
    expect(screen.getByText('No payslips yet.')).toBeTruthy()
  })

  it('lists events newest first, promotion before payout in the same month', () => {
    render(<TimelineTab months={fixture} notes={[]} />)
    const kinds = [...screen.getByTestId('timeline').querySelectorAll('li')].map((li) => li.dataset.kind)
    expect(kinds).toEqual(['promotion', 'payout', 'payout', 'hike', 'payout', 'start'])
  })

  it('puts a mail note in date order with its links', () => {
    render(<TimelineTab months={fixture} notes={[note]} />)
    const first = screen.getByTestId('timeline').querySelector('li')!
    expect(first.dataset.kind).toBe('note')
    expect(within(first).getByRole('link', { name: 'Letter' }).getAttribute('href')).toBe('/api/notes/2025-05-02-letter/pdf')
    expect(within(first).getByRole('link', { name: 'Mail' }).getAttribute('href')).toBe('https://mail.google.com/x')
  })

  it('says who the promotion was from', () => {
    render(<TimelineTab months={fixture} notes={[]} />)
    expect(screen.getByText(/Promotion from Engineer/)).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Senior Engineer')
  })
})
