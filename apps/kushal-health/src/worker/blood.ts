import type { Env } from './auth'
import { PANELS, type BloodData, type IngestBody, type MarkerSeries, type Panel, type Qualifier } from '../shared/types'

/** Upsert one report and replace all its results. Re-sending an id replaces it; the PDF key is kept. */
export async function ingest(env: Env, body: IngestBody) {
  const { report: r, results } = body
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO reports (id, collected_on, lab, source_file, verdict) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET collected_on=excluded.collected_on, lab=excluded.lab,
         source_file=excluded.source_file, verdict=excluded.verdict`,
    ).bind(r.id, r.collected_on, r.lab, r.source_file, r.verdict),
  ]
  for (const x of results) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO markers (key, name, panel, unit) VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET name=excluded.name, panel=excluded.panel, unit=excluded.unit`,
      ).bind(x.marker_key, x.name, x.panel, x.unit),
    )
  }
  stmts.push(env.DB.prepare('DELETE FROM results WHERE report_id = ?').bind(r.id))
  for (const x of results) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO results (report_id, marker_key, name_on_report, value_text, value_num, qualifier, unit, ref_text, ref_low, ref_high)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        r.id, x.marker_key, x.name_on_report, x.value_text, x.value_num, x.qualifier,
        x.unit, x.ref_text, x.ref_low, x.ref_high,
      ),
    )
  }
  await env.DB.batch(stmts)
  return { report_id: r.id, results: results.length }
}

type ReportDb = { id: string; collected_on: string; lab: string; source_file: string; verdict: string; pdf_key: string | null }
type PointDb = {
  key: string
  name: string
  panel: string
  marker_unit: string
  report_id: string
  collected_on: string
  value_text: string
  value_num: number | null
  qualifier: string | null
  unit: string
  ref_text: string
  ref_low: number | null
  ref_high: number | null
}

export async function read(env: Env): Promise<BloodData> {
  const reports = await env.DB.prepare(
    'SELECT id, collected_on, lab, source_file, verdict, pdf_key FROM reports ORDER BY collected_on DESC, id',
  ).all<ReportDb>()
  const rows = await env.DB.prepare(
    `SELECT m.key, m.name, m.panel, m.unit AS marker_unit, r.report_id, p.collected_on, r.value_text, r.value_num,
            r.qualifier, r.unit, r.ref_text, r.ref_low, r.ref_high
       FROM results r JOIN markers m ON m.key = r.marker_key JOIN reports p ON p.id = r.report_id
      ORDER BY p.collected_on ASC, r.report_id`,
  ).all<PointDb>()

  const byKey = new Map<string, MarkerSeries>()
  for (const x of rows.results) {
    let s = byKey.get(x.key)
    if (!s) {
      s = { key: x.key, name: x.name, panel: x.panel as Panel, unit: x.marker_unit, points: [] }
      byKey.set(x.key, s)
    }
    s.points.push({
      report_id: x.report_id,
      collected_on: x.collected_on,
      value_text: x.value_text,
      value_num: x.value_num,
      qualifier: x.qualifier as Qualifier,
      unit: x.unit,
      ref_text: x.ref_text,
      ref_low: x.ref_low,
      ref_high: x.ref_high,
    })
  }
  const rank = (p: string) => {
    const i = (PANELS as readonly string[]).indexOf(p)
    return i < 0 ? PANELS.length : i
  }
  const markers = [...byKey.values()].sort((a, b) => rank(a.panel) - rank(b.panel) || a.name.localeCompare(b.name))

  return {
    reports: reports.results.map((r) => ({
      id: r.id,
      collected_on: r.collected_on,
      lab: r.lab,
      source_file: r.source_file,
      verdict: r.verdict,
      has_pdf: r.pdf_key !== null,
    })),
    markers,
  }
}

export async function getReport(env: Env, id: string) {
  return env.DB.prepare('SELECT id, source_file, pdf_key FROM reports WHERE id = ?')
    .bind(id)
    .first<{ id: string; source_file: string; pdf_key: string | null }>()
}

export async function setPdf(env: Env, id: string, key: string) {
  await env.DB.prepare('UPDATE reports SET pdf_key = ? WHERE id = ?').bind(key, id).run()
}
