/** Shape checks for the two ingest bodies. Each throws Error('bad <field>'), which the route returns as a 400. */
import type { Category, Item } from '../shared/salary'

export type MonthIn = {
  month: string
  designation: string
  gross: number
  net: number
  deductions: number
  source_file: string
  items: Item[]
}
export type NoteIn = { id: string; date: string; title: string; body: string; source_url: string; source_file: string }

const MAX = 100_000_000
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function str(v: unknown, field: string, max: number, required = true): string {
  if (v === undefined && !required) return ''
  if (typeof v !== 'string' || v.length > max || (required && v.trim() === '')) throw new Error(`bad ${field}`)
  return v
}
function int(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > MAX) throw new Error(`bad ${field}`)
  return v
}

export function validateMonth(body: unknown): MonthIn {
  if (!isObj(body)) throw new Error('bad body')
  const month = str(body.month, 'month', 7)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('bad month')
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 40) throw new Error('bad items')
  const items = body.items.map((raw: unknown, i: number): Item => {
    if (!isObj(raw)) throw new Error(`bad items[${i}]`)
    const category = raw.category
    if (category !== 'fixed' && category !== 'variable') throw new Error(`bad items[${i}].category`)
    return {
      label: str(raw.label, `items[${i}].label`, 200),
      category: category as Category,
      monthly: int(raw.monthly, `items[${i}].monthly`),
      arrears: int(raw.arrears ?? 0, `items[${i}].arrears`),
      total: int(raw.total, `items[${i}].total`),
    }
  })
  return {
    month,
    designation: str(body.designation, 'designation', 200),
    gross: int(body.gross, 'gross'),
    net: int(body.net, 'net'),
    deductions: int(body.deductions, 'deductions'),
    source_file: str(body.source_file, 'source_file', 200),
    items,
  }
}

export function validateNote(body: unknown): NoteIn {
  if (!isObj(body)) throw new Error('bad body')
  const id = str(body.id, 'id', 80)
  if (!/^[a-z0-9-]{1,80}$/.test(id)) throw new Error('bad id')
  const date = str(body.date, 'date', 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('bad date')
  const source_url = str(body.source_url, 'source_url', 500, false)
  if (source_url && !source_url.startsWith('https://')) throw new Error('bad source_url')
  return {
    id,
    date,
    title: str(body.title, 'title', 200),
    body: str(body.body, 'body', 600, false),
    source_url,
    source_file: str(body.source_file, 'source_file', 200, false),
  }
}
