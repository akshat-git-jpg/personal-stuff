export const VARIABLE_RE: RegExp
export type ParsedItem = { label: string; monthly: number; arrears: number; total: number; category: 'fixed' | 'variable' }
export function parseSlipText(text: string): {
  month: string
  designation: string
  gross: number
  net: number
  deductions: number
  items: ParsedItem[]
  checks: string[]
}
