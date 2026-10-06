export const PANELS = ['Diabetes', 'Lipid', 'Thyroid', 'Liver', 'Kidney', 'CBC', 'Vitamins', 'Hormones', 'Other'] as const
export type Panel = (typeof PANELS)[number]
export type Qualifier = '<' | '<=' | '>' | '>=' | null

export interface Point {
  value_num: number | null
  value_text: string
  qualifier: Qualifier
  ref_low: number | null
  ref_high: number | null
  ref_text: string
}
export interface MarkerPoint extends Point {
  report_id: string
  collected_on: string
  unit: string
}
/** points are oldest first */
export interface MarkerSeries {
  key: string
  name: string
  panel: Panel
  unit: string
  points: MarkerPoint[]
}
export interface ReportRow {
  id: string
  collected_on: string
  lab: string
  source_file: string
  verdict: string
  has_pdf: boolean
}
/** reports are newest first */
export interface BloodData {
  reports: ReportRow[]
  markers: MarkerSeries[]
}

export interface IngestResult {
  marker_key: string
  name: string
  panel: Panel
  name_on_report: string
  value_text: string
  value_num: number | null
  qualifier: Qualifier
  unit: string
  ref_text: string
  ref_low: number | null
  ref_high: number | null
}
export interface IngestBody {
  report: { id: string; collected_on: string; lab: string; source_file: string; verdict: string }
  results: IngestResult[]
}
