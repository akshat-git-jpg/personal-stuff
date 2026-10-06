// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import BloodTab from '../src/client/BloodTab'
import { fixture } from './fixtures/blood'

afterEach(cleanup)

const show = () => render(<BloodTab data={fixture} />)

describe('BloodTab', () => {
  it('shows the empty state with no reports', () => {
    render(<BloodTab data={{ reports: [], markers: [] }} />)
    expect(screen.getByText('No blood reports yet.')).toBeTruthy()
  })

  it('heads the verdict card with the latest date and counts', () => {
    show()
    const card = screen.getByTestId('verdict')
    expect(card.textContent).toContain('Latest report · 15 Jan 2025')
    expect(card.textContent).toContain('2 out of range · 1 near edge · 3 normal')
  })

  it('shows the written verdict', () => {
    show()
    expect(screen.getByText('Mostly normal. LDL is high.')).toBeTruthy()
  })

  it('orders needs-attention by severity then name', () => {
    show()
    const items = within(screen.getByTestId('attention')).getAllByRole('listitem')
    expect(items.map((li) => li.querySelector('.marker-name')?.textContent)).toEqual([
      'LDL Cholesterol',
      'Vitamin D',
      'HbA1c',
    ])
  })

  it('marks rising LDL as high and worse', () => {
    show()
    const row = screen.getByTestId('marker-ldl')
    expect(row.textContent).toContain('High')
    expect(row.textContent).toContain('▲ worse')
  })

  it('marks falling TSH toward the midpoint as better', () => {
    show()
    const row = screen.getByTestId('marker-tsh')
    expect(row.textContent).toContain('Normal')
    expect(row.textContent).toContain('▼ better')
  })

  it('labels a single reading as first reading', () => {
    show()
    expect(screen.getByTestId('marker-vit_d').textContent).toContain('first reading')
  })

  it('draws no chart for a qualitative marker', () => {
    show()
    expect(screen.getByTestId('marker-hbsag').querySelector('svg')).toBeNull()
  })

  it('shows near edge for HbA1c at the top of its range', () => {
    show()
    expect(screen.getByTestId('marker-hba1c').textContent).toContain('Near edge')
  })

  it('expands a marker into a readings table, newest first', () => {
    show()
    fireEvent.click(screen.getByTestId('marker-ldl'))
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('15 Jan 2025')
  })

  it('links only stored PDFs', () => {
    show()
    const links = within(screen.getByTestId('reports')).getAllByRole('link', { name: 'Open PDF' })
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe('/api/reports/2025-01-15-test-lab-b/pdf')
  })

  it('orders panels by the fixed panel list', () => {
    show()
    const titles = [...document.querySelectorAll('.panel-title')].map((h) => h.textContent)
    expect(titles).toEqual(['Diabetes', 'Lipid', 'Thyroid', 'Vitamins', 'Other'])
  })
})
