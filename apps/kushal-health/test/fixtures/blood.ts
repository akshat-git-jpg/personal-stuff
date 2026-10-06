// SYNTHETIC data only. Never put a real report value in this repo.
import type { BloodData, IngestBody, MarkerPoint, MarkerSeries, Panel, Qualifier } from '../../src/shared/types'

const A = { report_id: '2024-06-10-test-lab-a', collected_on: '2024-06-10' }
const B = { report_id: '2025-01-15-test-lab-b', collected_on: '2025-01-15' }

type Row = {
  key: string
  name: string
  panel: Panel
  unit: string
  ref_text: string
  ref_low: number | null
  ref_high: number | null
  a?: [string, number | null, Qualifier]
  b: [string, number | null, Qualifier]
}

const ROWS: Row[] = [
  { key: 'hba1c', name: 'HbA1c', panel: 'Diabetes', unit: '%', ref_text: '4.0 - 5.6', ref_low: 4.0, ref_high: 5.6, b: ['5.6', 5.6, null] },
  { key: 'ldl', name: 'LDL Cholesterol', panel: 'Lipid', unit: 'mg/dL', ref_text: '<100', ref_low: null, ref_high: 100, a: ['140', 140, null], b: ['162', 162, null] },
  { key: 'tsh', name: 'TSH', panel: 'Thyroid', unit: 'µIU/mL', ref_text: '0.4 - 4.0', ref_low: 0.4, ref_high: 4.0, a: ['3.2', 3.2, null], b: ['2.1', 2.1, null] },
  { key: 'anti_tg', name: 'Anti Thyroglobulin', panel: 'Thyroid', unit: 'IU/mL', ref_text: '<4.00', ref_low: null, ref_high: 4.0, b: ['<1.3', 1.3, '<'] },
  { key: 'vit_d', name: 'Vitamin D', panel: 'Vitamins', unit: 'ng/mL', ref_text: '30 - 100', ref_low: 30, ref_high: 100, b: ['18', 18, null] },
  { key: 'hbsag', name: 'HBsAg', panel: 'Other', unit: '', ref_text: 'Non Reactive', ref_low: null, ref_high: null, b: ['Non Reactive', null, null] },
]

const point = (r: Row, at: typeof A, v: [string, number | null, Qualifier]): MarkerPoint => ({
  ...at,
  value_text: v[0],
  value_num: v[1],
  qualifier: v[2],
  unit: r.unit,
  ref_text: r.ref_text,
  ref_low: r.ref_low,
  ref_high: r.ref_high,
})

export const fixture: BloodData = {
  reports: [
    { id: B.report_id, collected_on: B.collected_on, lab: 'Test Lab', source_file: 'report-b.pdf', verdict: 'Mostly normal. LDL is high.', has_pdf: true },
    { id: A.report_id, collected_on: A.collected_on, lab: 'Test Lab', source_file: 'report-a.pdf', verdict: 'Older report.', has_pdf: false },
  ],
  markers: ROWS.map(
    (r): MarkerSeries => ({
      key: r.key,
      name: r.name,
      panel: r.panel,
      unit: r.unit,
      points: [...(r.a ? [point(r, A, r.a)] : []), point(r, B, r.b)],
    }),
  ),
}

const ingestFor = (at: typeof A, verdict: string, source_file: string, pick: (r: Row) => Row['b'] | undefined): IngestBody => ({
  report: { id: at.report_id, collected_on: at.collected_on, lab: 'Test Lab', source_file, verdict },
  results: ROWS.filter((r) => pick(r)).map((r) => {
    const v = pick(r) as Row['b']
    return {
      marker_key: r.key,
      name: r.name,
      panel: r.panel,
      name_on_report: r.name.toUpperCase(),
      value_text: v[0],
      value_num: v[1],
      qualifier: v[2],
      unit: r.unit,
      ref_text: r.ref_text,
      ref_low: r.ref_low,
      ref_high: r.ref_high,
    }
  }),
})

export const fixtureIngest = ingestFor(B, 'Mostly normal. LDL is high.', 'report-b.pdf', (r) => r.b)
export const fixtureIngestOlder = ingestFor(A, 'Older report.', 'report-a.pdf', (r) => r.a)
