import { execFileSync } from 'node:child_process'

export function ensureFolderChain(names, { account, execFn, ppDriveBin = 'pp-drive' }) {
  // names: ['HeyGen batches', channel, videoKey, timestamp]
  // Creates each folder inside its parent, returns the deepest folder id.
  let parent = 'root'
  const execute = execFn ?? execFileSync
  for (const name of names) {
    const stdout = execute(ppDriveBin, ['ensure-folder', name, '--parent', parent, '--account', account])
    // The stdout is typically something like "id123". Ensure we only get the ID.
    const newParent = typeof stdout === 'string' ? stdout.trim().split(/\s+/)[0] : stdout.toString().trim().split(/\s+/)[0]
    parent = newParent
    if (!parent) throw new Error(`drive: ensure-folder returned no id for "${name}"`)
  }
  return parent
}

export function uploadFile(filePath, folderId, { account, execFn, ppDriveBin = 'pp-drive' }) {
  const execute = execFn ?? execFileSync
  const stdout = execute(ppDriveBin, ['upload', filePath, '--parent', folderId, '--overwrite', '--account', account])
  return typeof stdout === 'string' ? stdout.trim() : stdout.toString().trim()
}

export function folderShareLink(folderId) {
  return `https://drive.google.com/drive/folders/${folderId}`
}
