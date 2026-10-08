export type VersionStatus = 'uploading' | 'ready' | 'removed'

export type Note = { id: string; version_id: string; t: number; x: number; y: number; text: string; created_at: number }

export type Version = {
  id: string
  name: string
  size: number
  duration: number
  width: number
  height: number
  status: VersionStatus
  created_at: number
  notes: Note[]
}

export type Project = {
  id: string
  title: string
  token: string
  final_version_id: string | null
  final_at: number | null
  created_at: number
}

export type ProjectView = { project: Project; versions: Version[]; owner: boolean; part_size: number }

export type ProjectSummary = Project & { versions: number; last_upload: number | null }

export type HomeView = { projects: ProjectSummary[]; used_bytes: number; stop_bytes: number }
