import type { Month } from './salary'

export type Note = {
  id: string
  date: string // YYYY-MM-DD
  title: string
  body: string
  source_url: string
  source_file: string
  has_pdf: boolean
}

export type SalaryData = { months: Month[]; notes: Note[] }
