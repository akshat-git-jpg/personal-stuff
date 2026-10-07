/** D1 reads and writes for salary_months, salary_items and salary_notes. */
import type { Env } from './auth'
import type { Item, Month } from '../shared/salary'
import type { Note, SalaryData } from '../shared/types'
import type { MonthIn, NoteIn } from './validate'

type MonthRow = { month: string; designation: string; gross: number; net: number; deductions: number; pdf_key: string | null }
type ItemRow = Item & { month: string }
type NoteRow = Omit<Note, 'has_pdf'> & { pdf_key: string | null }

export async function read(env: Env): Promise<SalaryData> {
  const [m, i, n] = await env.DB.batch([
    env.DB.prepare('SELECT month, designation, gross, net, deductions, pdf_key FROM salary_months ORDER BY month'),
    env.DB.prepare('SELECT month, label, category, monthly, arrears, total FROM salary_items ORDER BY month, pos'),
    env.DB.prepare('SELECT id, date, title, body, source_url, source_file, pdf_key FROM salary_notes ORDER BY date, id'),
  ])
  const items = new Map<string, Item[]>()
  for (const r of i.results as ItemRow[]) {
    const list = items.get(r.month) ?? []
    list.push({ label: r.label, category: r.category, monthly: r.monthly, arrears: r.arrears, total: r.total })
    items.set(r.month, list)
  }
  const months: Month[] = (m.results as MonthRow[]).map((r) => ({
    month: r.month,
    designation: r.designation,
    gross: r.gross,
    net: r.net,
    deductions: r.deductions,
    items: items.get(r.month) ?? [],
    has_pdf: r.pdf_key !== null,
  }))
  const notes: Note[] = (n.results as NoteRow[]).map(({ pdf_key, ...rest }) => ({ ...rest, has_pdf: pdf_key !== null }))
  return { months, notes }
}

/** Upserts one month and replaces its items. Keeps an uploaded PDF. */
export async function putMonth(env: Env, m: MonthIn): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO salary_months (month, designation, gross, net, deductions, source_file) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(month) DO UPDATE SET designation = excluded.designation, gross = excluded.gross, net = excluded.net,
       deductions = excluded.deductions, source_file = excluded.source_file`,
    ).bind(m.month, m.designation, m.gross, m.net, m.deductions, m.source_file),
    env.DB.prepare('DELETE FROM salary_items WHERE month = ?').bind(m.month),
    ...m.items.map((it, pos) =>
      env.DB.prepare(
        'INSERT INTO salary_items (month, pos, label, category, monthly, arrears, total) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).bind(m.month, pos, it.label, it.category, it.monthly, it.arrears, it.total),
    ),
  ])
}

export async function putNote(env: Env, n: NoteIn): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO salary_notes (id, date, title, body, source_url, source_file) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET date = excluded.date, title = excluded.title, body = excluded.body,
     source_url = excluded.source_url, source_file = excluded.source_file`,
  )
    .bind(n.id, n.date, n.title, n.body, n.source_url, n.source_file)
    .run()
}

export type PdfRef = { pdf_key: string | null; source_file: string }

export const getMonth = (env: Env, month: string) =>
  env.DB.prepare('SELECT pdf_key, source_file FROM salary_months WHERE month = ?').bind(month).first<PdfRef>()
export const getNote = (env: Env, id: string) =>
  env.DB.prepare('SELECT pdf_key, source_file FROM salary_notes WHERE id = ?').bind(id).first<PdfRef>()

export async function setPdf(env: Env, table: 'months' | 'notes', id: string, key: string): Promise<void> {
  const sql =
    table === 'months'
      ? 'UPDATE salary_months SET pdf_key = ? WHERE month = ?'
      : 'UPDATE salary_notes SET pdf_key = ? WHERE id = ?'
  await env.DB.prepare(sql).bind(key, id).run()
}
