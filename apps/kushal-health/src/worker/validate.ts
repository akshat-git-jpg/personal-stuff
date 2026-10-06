import { PANELS, type IngestBody, type IngestResult } from '../shared/types'

const QUALIFIERS = ['<', '<=', '>', '>=']
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const numOrNull = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v))

/** Throws Error(<reason>) on the first problem; returns the body typed. */
export function validateIngest(body: unknown): IngestBody {
  if (!isObj(body) || !isObj(body.report)) throw new Error('bad report')
  const r = body.report
  if (typeof r.id !== 'string' || !/^[a-z0-9-]{3,80}$/.test(r.id)) throw new Error('bad report.id')
  if (typeof r.collected_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.collected_on))
    throw new Error('bad report.collected_on')
  if (!nonEmpty(r.lab)) throw new Error('bad report.lab')
  if (!nonEmpty(r.source_file)) throw new Error('bad report.source_file')
  if (typeof r.verdict !== 'string') throw new Error('bad report.verdict')

  const results = body.results
  if (!Array.isArray(results) || results.length === 0 || results.length > 300)
    throw new Error('results must be a non-empty array')

  const seen = new Set<string>()
  results.forEach((x: unknown, i) => {
    const bad = (f: string) => new Error(`bad results[${i}].${f}`)
    if (!isObj(x)) throw bad('row')
    if (typeof x.marker_key !== 'string' || !/^[a-z0-9_]{1,40}$/.test(x.marker_key)) throw bad('marker_key')
    if (typeof x.panel !== 'string' || !(PANELS as readonly string[]).includes(x.panel)) throw bad('panel')
    for (const f of ['name', 'name_on_report', 'value_text']) if (!nonEmpty(x[f])) throw bad(f)
    if (!numOrNull(x.value_num)) throw bad('value_num')
    if (!(x.qualifier === null || QUALIFIERS.includes(x.qualifier as string))) throw bad('qualifier')
    if (!numOrNull(x.ref_low)) throw bad('ref_low')
    if (!numOrNull(x.ref_high)) throw bad('ref_high')
    if (typeof x.unit !== 'string') throw bad('unit')
    if (typeof x.ref_text !== 'string') throw bad('ref_text')
    if (seen.has(x.marker_key)) throw new Error(`duplicate marker_key ${x.marker_key}`)
    seen.add(x.marker_key)
  })

  return {
    report: {
      id: r.id,
      collected_on: r.collected_on,
      lab: r.lab.trim(),
      source_file: r.source_file.trim(),
      verdict: r.verdict.trim(),
    },
    results: results as IngestResult[],
  }
}
