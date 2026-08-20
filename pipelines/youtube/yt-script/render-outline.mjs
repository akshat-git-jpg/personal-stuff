#!/usr/bin/env node
// Render an outline.md into a standalone, self-contained outline.html.
//
//   node render-outline.mjs <slug>          # videos/<slug>/outline.md -> outline.html
//   node render-outline.mjs path/to/file.md
//
// The HTML is what the tutorial maker receives: no previewer, no account, no
// build step. Open it and read it. The markdown stays the source of truth.
//
// Recognised markdown (all of it valid markdown, so the raw file still renders
// acceptably in any previewer):
//
//   # Title                        document title
//   ## 1 · INTRODUCTION            top-level part
//   ### SECTION: Live Demo         section inside the body
//   #### 2.3 · HeyGen              a beat
//   **SAY** / **SHOW** / **EDIT**  a lane label, alone on its line
//   > "spoken copy"                blockquote under SAY = the line to read
//   > **RULES — ...**              blockquote opening in bold RULES = rules box
//   > **VERDICT:** ...             blockquote opening in bold VERDICT = verdict
//   ---                            beat separator (ignored, beats self-delimit)

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))

const LANES = {
  SAY: { key: 'say', label: 'SAY' },
  SHOW: { key: 'show', label: 'SHOW' },
  EDIT: { key: 'edit', label: 'EDIT' },
}

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Minimal inline markdown: **bold**, *italic*, `code`. Applied after escaping.
const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, '$1<em>$2</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')

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
      blocks.push({
        t: 'section',
        text: line.replace(/^###\s+/, '').replace(/^SECTION:\s*/i, '').trim(),
      })
      i++
      continue
    }
    if (/^####\s+/.test(line)) {
      blocks.push({ t: 'beat', text: line.replace(/^####\s+/, '').trim() })
      i++
      continue
    }

    // Blockquote — rules box, verdict, or plain spoken copy.
    if (/^>\s?/.test(line)) {
      const quoted = flushQuote()
      const head = quoted[0] ?? ''
      if (/^\*\*RULES\b/i.test(head)) {
        const items = quoted
          .slice(1)
          .filter((l) => /^[-*•]\s+/.test(l))
          .map((l) => l.replace(/^[-*•]\s+/, ''))
        blocks.push({ t: 'rules', items })
      } else if (/^\*\*VERDICT/i.test(head)) {
        blocks.push({
          t: 'verdict',
          text: quoted.join(' ').replace(/^\*\*VERDICT:?\*\*:?\s*/i, '').trim(),
        })
      } else {
        blocks.push({ t: 'quote', paras: splitParas(quoted) })
      }
      continue
    }

    // A lane label alone on its line.
    const lane = line.trim().match(/^\*\*(SAY|SHOW|EDIT)\*\*(?:\s*[—-]\s*(.*))?$/i)
    if (lane) {
      const kind = lane[1].toUpperCase()
      const note = (lane[2] || '').trim()
      i++
      // Skip blank lines between the label and its content.
      while (i < lines.length && lines[i].trim() === '') i++

      if (i < lines.length && /^>\s?/.test(lines[i])) {
        blocks.push({ t: 'lane', kind, note, paras: splitParas(flushQuote()), spoken: true })
      } else {
        const body = []
        while (
          i < lines.length &&
          lines[i].trim() !== '' &&
          !/^#{1,4}\s/.test(lines[i]) &&
          !/^>\s?/.test(lines[i]) &&
          !/^\*\*(SAY|SHOW|EDIT)\*\*/i.test(lines[i].trim()) &&
          !/^---\s*$/.test(lines[i])
        ) {
          body.push(lines[i])
          i++
        }
        blocks.push({ t: 'lane', kind, note, paras: splitParas(body), spoken: false })
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

    // Anything else is prose (intro / conclusion body).
    const para = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,4}\s/.test(lines[i]) &&
      !/^>/.test(lines[i]) &&
      !/^\|/.test(lines[i])
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
  const cells = (r) =>
    r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
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

function toHtml(blocks) {
  const out = []
  let title = 'Outline'
  let openBeat = false
  let seenPart = false
  const closeBeat = () => {
    if (openBeat) {
      out.push('</div>')
      openBeat = false
    }
  }

  for (const b of blocks) {
    switch (b.t) {
      case 'title':
        title = b.text
        closeBeat()
        out.push(`<h1>${inline(b.text)}</h1>`)
        break
      case 'part':
        closeBeat()
        out.push(
          `<h2 class="part${seenPart ? '' : ' first-part'}">${inline(b.text)}</h2>`
        )
        seenPart = true
        break
      case 'section':
        closeBeat()
        out.push(`<h3 class="section">${inline(b.text)}</h3>`)
        break
      case 'beat':
        closeBeat()
        out.push(`<div class="beat"><p class="beat-id">${inline(b.text)}</p>`)
        openBeat = true
        break
      case 'rules':
        out.push(
          `<aside class="rules"><p class="rules-label">Rules — whole section</p><ul>${b.items
            .map((x) => `<li>${inline(x)}</li>`)
            .join('')}</ul></aside>`
        )
        break
      case 'verdict':
        out.push(`<p class="verdict"><span>Verdict</span>${inline(b.text)}</p>`)
        break
      case 'lane': {
        const l = LANES[b.kind]
        const note = b.note ? `<span class="lane-note">${inline(b.note)}</span>` : ''
        out.push(
          `<div class="lane lane-${l.key}"><div class="lane-tag"><span class="chip chip-${l.key}">${l.label}</span>${note}</div>` +
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
  closeBeat()
  return { title, body: out.join('\n') }
}

const CSS = `
:root{
--ground:#f6f7f8;--surface:#fff;--surface-2:#eef0f2;--ink:#14171a;--ink-2:#4a5560;--ink-3:#79848f;
--rule:#dde1e5;--rule-2:#c7ced4;--slate:#3e5c76;
--say:#8a5a0a;--say-bg:#fdf4e3;--say-rail:#d9a441;
--show:#0d6068;--show-bg:#e4f4f4;--show-rail:#3fa3ab;
--edit:#8e3155;--edit-bg:#fbebf1;--edit-rail:#c9799a;
--alert:#a33a2a;--alert-bg:#fceeeb;
--serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
--sans:"Avenir Next","Segoe UI",Roboto,-apple-system,BlinkMacSystemFont,sans-serif;
--mono:ui-monospace,"SF Mono",SFMono-Regular,"Cascadia Mono",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){:root{
--ground:#14171a;--surface:#1c2024;--surface-2:#24292e;--ink:#e6e9ec;--ink-2:#a8b2bb;--ink-3:#78838d;
--rule:#2c3238;--rule-2:#3d454d;--slate:#8fb0cd;
--say:#e0b263;--say-bg:#2a2416;--say-rail:#a8802f;
--show:#63c2c9;--show-bg:#14282a;--show-rail:#2f7d84;
--edit:#e08aa9;--edit-bg:#2b1b22;--edit-rail:#964d69;
--alert:#e8836e;--alert-bg:#2e1c18;}}
:root[data-theme=dark]{
--ground:#14171a;--surface:#1c2024;--surface-2:#24292e;--ink:#e6e9ec;--ink-2:#a8b2bb;--ink-3:#78838d;
--rule:#2c3238;--rule-2:#3d454d;--slate:#8fb0cd;
--say:#e0b263;--say-bg:#2a2416;--say-rail:#a8802f;
--show:#63c2c9;--show-bg:#14282a;--show-rail:#2f7d84;
--edit:#e08aa9;--edit-bg:#2b1b22;--edit-rail:#964d69;
--alert:#e8836e;--alert-bg:#2e1c18;}
:root[data-theme=light]{
--ground:#f6f7f8;--surface:#fff;--surface-2:#eef0f2;--ink:#14171a;--ink-2:#4a5560;--ink-3:#79848f;
--rule:#dde1e5;--rule-2:#c7ced4;--slate:#3e5c76;
--say:#8a5a0a;--say-bg:#fdf4e3;--say-rail:#d9a441;
--show:#0d6068;--show-bg:#e4f4f4;--show-rail:#3fa3ab;
--edit:#8e3155;--edit-bg:#fbebf1;--edit-rail:#c9799a;
--alert:#a33a2a;--alert-bg:#fceeeb;}

*{box-sizing:border-box}
body{background:var(--ground);color:var(--ink);font-family:var(--sans);line-height:1.6;margin:0;padding:0 1.25rem 6rem;-webkit-font-smoothing:antialiased}
.wrap{max-width:56rem;margin:0 auto}
h1{font-size:clamp(1.7rem,4vw,2.5rem);line-height:1.15;letter-spacing:-.02em;margin:3rem 0 .5rem;text-wrap:balance;font-weight:650}
.legend{display:flex;flex-wrap:wrap;gap:.5rem 1.4rem;padding:.9rem 1.1rem;background:var(--surface-2);border:1px solid var(--rule);margin:0 0 2.5rem;font-size:.85rem;color:var(--ink-2)}
.legend b{color:var(--ink)}
h2.part{font-family:var(--mono);font-size:.9rem;letter-spacing:.14em;text-transform:uppercase;margin:3.5rem 0 1.25rem;padding-bottom:.5rem;border-bottom:2px solid var(--ink);font-weight:600}
h3.section{font-size:1.25rem;letter-spacing:-.01em;margin:2.75rem 0 1rem;padding-bottom:.4rem;border-bottom:1px solid var(--rule-2);font-weight:620}
.beat{margin:0 0 1.6rem;padding-top:.2rem}
.beat-id{font-family:var(--mono);font-size:.82rem;font-weight:600;letter-spacing:.02em;margin:0 0 .55rem;color:var(--ink)}
.lane{display:grid;grid-template-columns:5rem 1fr;gap:.75rem;align-items:start;margin-bottom:.5rem}
.lane-tag{display:flex;flex-direction:column;gap:.25rem;align-items:flex-start;padding-top:.15rem}
.lane-note{font-family:var(--mono);font-size:.6rem;color:var(--ink-3);letter-spacing:.04em}
.chip{font-family:var(--mono);font-size:.62rem;font-weight:700;letter-spacing:.13em;padding:.2rem .45rem;border-radius:2px;white-space:nowrap}
.chip-say{color:var(--say);background:var(--say-bg)}
.chip-show{color:var(--show);background:var(--show-bg)}
.chip-edit{color:var(--edit);background:var(--edit-bg)}
.lane-body{border-left:2px solid var(--rule);padding-left:.85rem}
.lane-say .lane-body{border-left-color:var(--say-rail)}
.lane-show .lane-body{border-left-color:var(--show-rail)}
.lane-edit .lane-body{border-left-color:var(--edit-rail)}
.lane-body p{margin:0 0 .5rem}
.lane-body p:last-child{margin-bottom:0}
.spoken{font-family:var(--serif);font-size:1.04rem;color:var(--ink)}
.instr{font-size:.9rem;color:var(--ink-2)}
.standalone-quote{font-family:var(--serif);font-size:1.06rem;border-left:2px solid var(--say-rail);padding-left:1rem;margin:0 0 1.1rem;color:var(--ink)}
.standalone-quote p{margin:0 0 .7rem}
.standalone-quote p:last-child{margin-bottom:0}
.prose{font-family:var(--serif);font-size:1.04rem;max-width:62ch}
.rules{background:var(--alert-bg);border-left:4px solid var(--alert);padding:.85rem 1.1rem;margin:0 0 1.5rem}
.rules-label{font-family:var(--mono);font-size:.64rem;letter-spacing:.14em;text-transform:uppercase;color:var(--alert);font-weight:700;margin:0 0 .45rem}
.rules ul{margin:0;padding-left:1.15rem}
.rules li{font-size:.9rem;margin-bottom:.22rem}
.rules li:last-child{margin-bottom:0}
.verdict{background:var(--surface-2);border-left:3px solid var(--slate);padding:.7rem 1rem;margin:.9rem 0 1.6rem;font-size:.94rem;color:var(--ink)}
.verdict span{font-family:var(--mono);font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;color:var(--slate);font-weight:700;display:block;margin-bottom:.25rem}
.tbl-wrap{overflow-x:auto;border:1px solid var(--rule);background:var(--surface);margin:0 0 1.4rem}
.tbl{border-collapse:collapse;width:100%;min-width:34rem;font-size:.88rem}
.tbl th,.tbl td{padding:.55rem .8rem;text-align:left;border-bottom:1px solid var(--rule)}
.tbl thead th{font-family:var(--mono);font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);border-bottom:2px solid var(--ink)}
.tbl tbody th{font-weight:600;color:var(--ink)}
.tbl td{color:var(--ink-2);font-variant-numeric:tabular-nums;text-align:center}
.tbl tbody tr:last-child th,.tbl tbody tr:last-child td{border-bottom:none}
@media (max-width:34rem){.lane{grid-template-columns:1fr;gap:.3rem}.lane-tag{flex-direction:row;align-items:baseline;gap:.5rem}}
@media print{
/* The PDF is read on a screen, not printed, so it stays dark. The selector
   list is deliberate — it has to out-specify :root[data-theme=light]. */
:root,:root[data-theme=dark],:root[data-theme=light]{
--ground:#14171a;--surface:#1c2024;--surface-2:#22272c;--ink:#e8ebee;--ink-2:#aab4bd;--ink-3:#7a858f;
--rule:#2f353b;--rule-2:#414a52;--slate:#93b4d0;
--say:#e3b667;--say-bg:#2c2617;--say-rail:#a8802f;
--show:#68c7ce;--show-bg:#152a2c;--show-rail:#2f7d84;
--edit:#e590ad;--edit-bg:#2d1d24;--edit-rail:#964d69;
--alert:#ec8a74;--alert-bg:#321e19}
/* Without this every chip and rules box prints as a grey rectangle, the page
   comes out white, and the whole colour-coded lane system stops working. */
*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
/* Zero page margin + padding on .wrap is what makes the dark ground reach the
   paper edge. With a normal @page margin the background stops short and every
   page gets a white border. */
@page{margin:0}
html,body{background:var(--ground)}
body{padding:0;font-size:10.5pt}
.wrap{max-width:none;padding:13mm 12mm}
h1{margin-top:0;font-size:20pt}
/* Deliberately NO break-before:page on parts. This PDF is scrolled on screen,
   and forcing each part to a fresh page left pages ~70% empty, which reads as
   a bug rather than as structure. Add break-before:page here if it is ever
   printed and bound. */
h2.part{break-after:avoid}
h3.section{break-after:avoid;margin-top:1.3rem}
.beat-id{break-after:avoid}
.legend,.rules,.beat,.lane,.verdict,.tbl-wrap{break-inside:avoid}
.rules{break-after:avoid}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`

const LEGEND = `<div class="legend">
<span><b>Indented text</b> = read it out loud</span>
<span><b class="chip chip-say" style="font-size:.6rem">SAY</b> what you say</span>
<span><b class="chip chip-show" style="font-size:.6rem">SHOW</b> what's on screen</span>
<span><b class="chip chip-edit" style="font-size:.6rem">EDIT</b> cutting note</span>
<span><b>Red box</b> = rules for the whole section, read first</span>
</div>`

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
    console.error(
      'usage: node render-outline.mjs <slug|path-to-outline.md> [--no-pdf]'
    )
    process.exit(1)
  }
  const src = arg.endsWith('.md')
    ? resolve(arg)
    : join(HERE, 'videos', arg, 'outline.md')
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
<body><div class="wrap">${body.replace('</h1>', '</h1>' + LEGEND)}</div></body></html>`
  const dest = src.replace(/\.md$/, '.html')
  writeFileSync(dest, html)
  console.log(dest)

  if (!wantsHtmlOnly) {
    const pdf = toPdf(dest)
    if (pdf) console.log(pdf)
  }
}

main()
