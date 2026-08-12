#!/usr/bin/env node
// Render a script.md into a standalone script.html (+ PDF), styled to match
// render-outline.mjs's outline PDFs. script.md's format differs from
// outline.md (Voiceover/Notes instead of SAY/SHOW/EDIT lanes, numbered
// sections instead of SECTION:/beat headings), so this is a separate, simpler
// parser rather than reusing outline.md's lane grammar.
//
//   node render-script.mjs <slug>              # videos/<slug>/script.md -> script.html + .pdf
//   node render-script.mjs path/to/file.md
//   node render-script.mjs <slug> --no-pdf      # HTML only
//
// Recognised markdown:
//   # Title                       document title
//   ## PART A — INTRODUCTION      top-level part
//   ### 1. Cold Open              numbered section
//   **Voiceover** / **Notes** /   any bold label alone on its line becomes a
//   **Transition** / etc.         chip. Voiceover/Transition read amber+serif
//                                  (spoken); everything else reads teal+sans
//                                  (instruction). Followed by a blockquote
//                                  (spoken) or plain lines (instruction).
//   > **Verdict:** ...            slate verdict block
//   a pipe table                  a real scrollable table
//   plain paragraph               prose

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, '$1<em>$2</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')

const SPOKEN_LABELS = /^(voiceover|transition)\b/i

function parse(md) {
  const lines = md.split(/\r?\n/)
  const blocks = []
  let i = 0

  const flushQuote = () => {
    const quoted = []
    while (i < lines.length && /^>\s?/.test(lines[i])) {
      quoted.push(lines[i].replace(/^>\s?/, ''))
      i++
    }
    return quoted
  }

  while (i < lines.length) {
    const line = lines[i]

    if (/^#\s+/.test(line)) {
      blocks.push({ t: 'title', text: line.replace(/^#\s+/, '').trim() })
      i++
      continue
    }
    if (/^##\s+(?!#)/.test(line)) {
      blocks.push({ t: 'part', text: line.replace(/^##\s+/, '').trim() })
      i++
      continue
    }
    if (/^###\s+(?!#)/.test(line)) {
      blocks.push({ t: 'section', text: line.replace(/^###\s+/, '').trim() })
      i++
      continue
    }

    // Blockquote — verdict or plain standalone quote.
    if (/^>\s?/.test(line)) {
      const quoted = flushQuote()
      const head = quoted[0] ?? ''
      if (/^\*\*Verdict/i.test(head)) {
        blocks.push({
          t: 'verdict',
          text: quoted.join(' ').replace(/^\*\*Verdict:?\*\*:?\s*/i, '').trim(),
        })
      } else {
        blocks.push({ t: 'quote', paras: splitParas(quoted) })
      }
      continue
    }

    // A bold label alone on its line -> a lane.
    const label = line.trim().match(/^\*\*(.+?)\*\*$/)
    if (label) {
      const text = label[1].trim()
      const spoken = SPOKEN_LABELS.test(text)
      i++
      while (i < lines.length && lines[i].trim() === '') i++

      if (i < lines.length && /^>\s?/.test(lines[i])) {
        blocks.push({ t: 'lane', label: text, paras: splitParas(flushQuote()), spoken: true })
      } else {
        const body = []
        while (
          i < lines.length &&
          lines[i].trim() !== '' &&
          !/^#{1,3}\s/.test(lines[i]) &&
          !/^>\s?/.test(lines[i]) &&
          !/^\*\*(.+?)\*\*$/.test(lines[i].trim()) &&
          !/^\|/.test(lines[i]) &&
          !/^---\s*$/.test(lines[i])
        ) {
          body.push(lines[i])
          i++
        }
        blocks.push({ t: 'lane', label: text, paras: splitParas(body), spoken })
      }
      continue
    }

    // Pipe table.
    if (/^\|/.test(line)) {
      const rows = []
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(lines[i])
        i++
      }
      blocks.push({ t: 'table', rows })
      continue
    }

    if (/^---\s*$/.test(line) || line.trim() === '') {
      i++
      continue
    }

    const para = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !/^>/.test(lines[i]) &&
      !/^\|/.test(lines[i]) &&
      !/^\*\*(.+?)\*\*$/.test(lines[i].trim())
    ) {
      para.push(lines[i])
      i++
    }
    if (para.length) blocks.push({ t: 'prose', text: para.join(' ') })
  }

  return blocks
}

function splitParas(lines) {
  const out = []
  let cur = []
  for (const l of lines) {
    if (l.trim() === '') {
      if (cur.length) out.push(cur.join(' '))
      cur = []
    } else cur.push(l.trim())
  }
  if (cur.length) out.push(cur.join(' '))
  return out
}

function renderTable(rows) {
  const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
  const body = rows.filter((r) => !/^\|[\s:|-]+\|?$/.test(r))
  if (!body.length) return ''
  const head = cells(body[0])
  const rest = body.slice(1).map(cells)
  return `<div class="tbl-wrap"><table class="tbl">
<thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead>
<tbody>${rest
    .map((r) => `<tr>${r.map((c, n) => `<t${n === 0 ? 'h' : 'd'}>${inline(c)}</t${n === 0 ? 'h' : 'd'}>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`
}

function labelKey(text) {
  return SPOKEN_LABELS.test(text) ? 'say' : 'show'
}

function toHtml(blocks) {
  const out = []
  let title = 'Script'
  let seenPart = false

  for (const b of blocks) {
    switch (b.t) {
      case 'title':
        title = b.text
        out.push(`<h1>${inline(b.text)}</h1>`)
        break
      case 'part':
        out.push(`<h2 class="part${seenPart ? '' : ' first-part'}">${inline(b.text)}</h2>`)
        seenPart = true
        break
      case 'section':
        out.push(`<h3 class="section">${inline(b.text)}</h3>`)
        break
      case 'verdict':
        out.push(`<p class="verdict"><span>Verdict</span>${inline(b.text)}</p>`)
        break
      case 'lane': {
        const key = labelKey(b.label)
        out.push(
          `<div class="lane lane-${key}"><div class="lane-tag"><span class="chip chip-${key}">${inline(b.label)}</span></div>` +
            `<div class="lane-body ${b.spoken ? 'spoken' : 'instr'}">${b.paras
              .map((p) => `<p>${inline(p)}</p>`)
              .join('')}</div></div>`
        )
        break
      }
      case 'quote':
        out.push(
          `<div class="standalone-quote">${b.paras.map((p) => `<p>${inline(p)}</p>`).join('')}</div>`
        )
        break
      case 'table':
        out.push(renderTable(b.rows))
        break
      case 'prose':
        out.push(`<p class="prose">${inline(b.text)}</p>`)
        break
    }
  }
  return { title, body: out.join('\n') }
}

const CSS = `
:root{
--ground:#f6f7f8;--surface:#fff;--surface-2:#eef0f2;--ink:#14171a;--ink-2:#4a5560;--ink-3:#79848f;
--rule:#dde1e5;--rule-2:#c7ced4;--slate:#3e5c76;
--say:#8a5a0a;--say-bg:#fdf4e3;--say-rail:#d9a441;
--show:#0d6068;--show-bg:#e4f4f4;--show-rail:#3fa3ab;
--serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
--sans:"Avenir Next","Segoe UI",Roboto,-apple-system,BlinkMacSystemFont,sans-serif;
--mono:ui-monospace,"SF Mono",SFMono-Regular,"Cascadia Mono",Menlo,Consolas,monospace;
}
:root[data-theme=dark]{
--ground:#14171a;--surface:#1c2024;--surface-2:#24292e;--ink:#e6e9ec;--ink-2:#a8b2bb;--ink-3:#78838d;
--rule:#2c3238;--rule-2:#3d454d;--slate:#8fb0cd;
--say:#e0b263;--say-bg:#2a2416;--say-rail:#a8802f;
--show:#63c2c9;--show-bg:#14282a;--show-rail:#2f7d84;}
*{box-sizing:border-box}
body{background:var(--ground);color:var(--ink);font-family:var(--sans);line-height:1.6;margin:0;padding:0 1.25rem 6rem;-webkit-font-smoothing:antialiased}
.wrap{max-width:56rem;margin:0 auto}
h1{font-size:clamp(1.7rem,4vw,2.5rem);line-height:1.15;letter-spacing:-.02em;margin:3rem 0 .5rem;text-wrap:balance;font-weight:650}
h2.part{font-family:var(--mono);font-size:.9rem;letter-spacing:.14em;text-transform:uppercase;margin:3.5rem 0 1.25rem;padding-bottom:.5rem;border-bottom:2px solid var(--ink);font-weight:600}
h3.section{font-size:1.25rem;letter-spacing:-.01em;margin:2.75rem 0 1rem;padding-bottom:.4rem;border-bottom:1px solid var(--rule-2);font-weight:620}
.lane{display:grid;grid-template-columns:7rem 1fr;gap:.75rem;align-items:start;margin-bottom:1.1rem}
.lane-tag{display:flex;flex-direction:column;gap:.25rem;align-items:flex-start;padding-top:.15rem}
.chip{font-family:var(--mono);font-size:.6rem;font-weight:700;letter-spacing:.08em;padding:.2rem .45rem;border-radius:2px;white-space:normal;line-height:1.3}
.chip-say{color:var(--say);background:var(--say-bg)}
.chip-show{color:var(--show);background:var(--show-bg)}
.lane-body{border-left:2px solid var(--rule);padding-left:.85rem}
.lane-say .lane-body{border-left-color:var(--say-rail)}
.lane-show .lane-body{border-left-color:var(--show-rail)}
.lane-body p{margin:0 0 .5rem}
.lane-body p:last-child{margin-bottom:0}
.spoken{font-family:var(--serif);font-size:1.04rem;color:var(--ink)}
.instr{font-size:.88rem;color:var(--ink-2)}
.standalone-quote{font-family:var(--serif);font-size:1.06rem;border-left:2px solid var(--say-rail);padding-left:1rem;margin:0 0 1.1rem;color:var(--ink)}
.standalone-quote p{margin:0 0 .7rem}
.prose{font-family:var(--serif);font-size:1rem;max-width:62ch;color:var(--ink-2)}
.verdict{background:var(--surface-2);border-left:3px solid var(--slate);padding:.7rem 1rem;margin:.9rem 0 1.6rem;font-size:.94rem;color:var(--ink)}
.verdict span{font-family:var(--mono);font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;color:var(--slate);font-weight:700;display:block;margin-bottom:.25rem}
.tbl-wrap{overflow-x:auto;border:1px solid var(--rule);background:var(--surface);margin:0 0 1.4rem}
.tbl{border-collapse:collapse;width:100%;min-width:34rem;font-size:.86rem}
.tbl th,.tbl td{padding:.5rem .75rem;text-align:left;border-bottom:1px solid var(--rule)}
.tbl thead th{font-family:var(--mono);font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);border-bottom:2px solid var(--ink)}
.tbl tbody th{font-weight:600;color:var(--ink)}
.tbl td{color:var(--ink-2);font-variant-numeric:tabular-nums;text-align:center}
@media (max-width:34rem){.lane{grid-template-columns:1fr;gap:.3rem}}
@media print{
:root,:root[data-theme=dark],:root[data-theme=light]{
--ground:#14171a;--surface:#1c2024;--surface-2:#22272c;--ink:#e8ebee;--ink-2:#aab4bd;--ink-3:#7a858f;
--rule:#2f353b;--rule-2:#414a52;--slate:#93b4d0;
--say:#e3b667;--say-bg:#2c2617;--say-rail:#a8802f;
--show:#68c7ce;--show-bg:#152a2c;--show-rail:#2f7d84}
*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
@page{margin:0}
html,body{background:var(--ground)}
body{padding:0;font-size:10.5pt}
.wrap{max-width:none;padding:13mm 12mm}
h1{margin-top:0;font-size:20pt}
h2.part{break-after:avoid}
h3.section{break-after:avoid;margin-top:1.3rem}
.lane,.verdict,.tbl-wrap{break-inside:avoid}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`

const CHROMES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]

function toPdf(htmlPath) {
  const chrome = CHROMES.find((p) => existsSync(p))
  if (!chrome) {
    console.error(
      'No Chrome/Edge/Chromium found for PDF export.\n' +
        `Open ${htmlPath} in a browser and print to PDF instead (Cmd-P).`
    )
    return null
  }
  const pdfPath = htmlPath.replace(/\.html$/, '.pdf')
  execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-pdf-header-footer',
      `--print-to-pdf=${pdfPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: 'ignore' }
  )
  return pdfPath
}

function main() {
  const args = process.argv.slice(2)
  const wantsHtmlOnly = args.includes('--no-pdf')
  const arg = args.find((a) => !a.startsWith('--'))
  if (!arg) {
    console.error('usage: node render-script.mjs <slug|path-to-script.md> [--no-pdf]')
    process.exit(1)
  }
  const src = arg.endsWith('.md')
    ? resolve(arg)
    : join(HERE, 'videos', arg, 'script.md')
  if (!existsSync(src)) {
    console.error(`not found: ${src}`)
    process.exit(1)
  }
  const { title, body } = toHtml(parse(readFileSync(src, 'utf8')))
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}</style></head>
<body><div class="wrap">${body}</div></body></html>`
  const dest = src.replace(/\.md$/, '.html')
  writeFileSync(dest, html)
  console.log(dest)

  if (!wantsHtmlOnly) {
    const pdf = toPdf(dest)
    if (pdf) console.log(pdf)
  }
}

main()
