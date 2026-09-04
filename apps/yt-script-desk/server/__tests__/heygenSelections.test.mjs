import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fork } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const SERVER = join(HERE, '..', 'local.mjs')

// A helper to start the server on a random port
function startServer(videosRoot) {
  return new Promise((resolve, reject) => {
    const child = fork(SERVER, [], {
      env: { ...process.env, YTS_VIDEOS_ROOT: videosRoot, API_PORT: '0', VREG_PATH: join(videosRoot, 'vreg.json') },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    })
    
    let port = 0
    child.stdout.on('data', (data) => {
      const match = data.toString().match(/http:\/\/localhost:(\d+)/)
      if (match) {
        port = parseInt(match[1], 10)
        resolve({ child, port })
      }
    })
    child.on('error', reject)
  })
}

const mockScriptJsonLocked = {
  sections: [
    { id: 's01', spoken_text: "...", tts: { locked: true, take: null } },
    { id: 's02', spoken_text: "...", tts: { locked: true, take: null } }
  ]
}

const mockScriptJsonUnlocked = {
  sections: [
    { id: 's01', spoken_text: "...", tts: { locked: true, take: null } },
    { id: 's02', spoken_text: "...", tts: { locked: false, take: null } }
  ]
}

const mockVreg = {
  videos: {
    'v123': { channel: 'chan-alpha' }
  }
}

describe('heygen-selections API', () => {
  let root
  let child
  let port

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'heygen-test-'))
    writeFileSync(join(root, 'vreg.json'), JSON.stringify(mockVreg))
    
    // Setup video keys
    const lockedDir = join(root, 'locked-vid')
    mkdirSync(lockedDir, { recursive: true })
    writeFileSync(join(lockedDir, 'script.json'), JSON.stringify(mockScriptJsonLocked))
    
    const unlockedDir = join(root, 'unlocked-vid')
    mkdirSync(unlockedDir, { recursive: true })
    writeFileSync(join(unlockedDir, 'script.json'), JSON.stringify(mockScriptJsonUnlocked))
    
    const vregVid = join(root, 'v123')
    mkdirSync(vregVid, { recursive: true })
    writeFileSync(join(vregVid, 'script.json'), JSON.stringify(mockScriptJsonLocked))
    
    const serverInstance = await startServer(root)
    child = serverInstance.child
    port = serverInstance.port
  })

  afterAll(() => {
    if (child) child.kill()
    if (root) rmSync(root, { recursive: true, force: true })
  })

  const request = async (method, path, body = undefined) => {
    const res = await fetch(`http://localhost:${port}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    })
    const text = await res.text()
    try {
      return { status: res.status, body: JSON.parse(text) }
    } catch {
      return { status: res.status, body: text }
    }
  }

  it('Refuses when VO is not locked', async () => {
    const res = await request('PUT', '/api/heygen-selections?key=unlocked-vid', {
      default_engine: 'heygen4',
      selections: []
    })
    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/VO is not locked/)
  })

  it('Writes with correct shape when locked', async () => {
    const res = await request('PUT', '/api/heygen-selections?key=v123', {
      default_engine: 'heygen4',
      selections: [
        { section_id: 's01', engine: 'heygen4', text: 'hello world' }
      ]
    })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    
    const saved = JSON.parse(readFileSync(join(root, 'v123', 'heygen-selections.json'), 'utf8'))
    expect(saved.version).toBe(1)
    expect(saved.selections[0].id).toBe('sel-01')
    expect(saved.selections[0].text_word_count).toBe(2)
    expect(saved.submitted_at).toMatch(/^\d{4}-/)
    expect(saved.channel).toBe('chan-alpha')
  })

  it('Rejects unknown section_id', async () => {
    const res = await request('PUT', '/api/heygen-selections?key=locked-vid', {
      default_engine: 'heygen4',
      selections: [
        { section_id: 's99', engine: 'heygen4', text: 'hello world' }
      ]
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/unknown section_id s99/)
  })

  it('Rejects invalid engine', async () => {
    const res = await request('PUT', '/api/heygen-selections?key=locked-vid', {
      default_engine: 'heygen4',
      selections: [
        { section_id: 's01', engine: 'heygen5', text: 'hello world' }
      ]
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/selection\.engine invalid/)
  })

  it('GET returns null when file absent, returns file when present', async () => {
    const res1 = await request('GET', '/api/heygen-selections?key=locked-vid')
    expect(res1.status).toBe(200)
    expect(res1.body).toBe(null)

    await request('PUT', '/api/heygen-selections?key=locked-vid', {
      default_engine: 'heygen4',
      selections: [
        { section_id: 's01', engine: 'heygen4', text: 'hello' }
      ]
    })
    
    const res2 = await request('GET', '/api/heygen-selections?key=locked-vid')
    expect(res2.status).toBe(200)
    expect(res2.body.selections[0].text).toBe('hello')
  })
})
