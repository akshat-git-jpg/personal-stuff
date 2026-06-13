// Generate PWA / apple-touch icons from an inline SVG using rsvg-convert.
// Run: npm run icons   (requires `rsvg-convert`, e.g. `brew install librsvg`)
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A document with a lock badge on a deep indigo gradient.
const svg = (maskable) => {
  const pad = maskable ? 64 : 0; // maskable needs safe-zone padding
  const s = 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1b2336"/>
      <stop offset="1" stop-color="#0b0d12"/>
    </linearGradient>
    <linearGradient id="doc" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eef2ff"/>
      <stop offset="1" stop-color="#c7d2fe"/>
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" rx="${maskable ? 0 : 112}" fill="url(#bg)"/>
  <g transform="translate(${pad},${pad}) scale(${(s - pad * 2) / s})">
    <g transform="translate(140,108)">
      <path d="M0 28 Q0 0 28 0 H150 L232 82 V356 Q232 384 204 384 H28 Q0 384 0 356 Z" fill="url(#doc)"/>
      <path d="M150 0 V60 Q150 82 172 82 H232 Z" fill="#a5b4fc"/>
      <rect x="40" y="150" width="152" height="20" rx="10" fill="#6366f1" opacity="0.55"/>
      <rect x="40" y="196" width="152" height="20" rx="10" fill="#6366f1" opacity="0.4"/>
      <rect x="40" y="242" width="104" height="20" rx="10" fill="#6366f1" opacity="0.3"/>
    </g>
    <g transform="translate(286,250)">
      <circle cx="60" cy="60" r="74" fill="#0b0d12"/>
      <rect x="24" y="58" width="72" height="58" rx="14" fill="#818cf8"/>
      <path d="M36 58 V44 Q36 14 60 14 Q84 14 84 44 V58" fill="none" stroke="#818cf8" stroke-width="14"/>
      <circle cx="60" cy="84" r="9" fill="#0b0d12"/>
    </g>
  </g>
</svg>`;
};

const dir = mkdtempSync(join(tmpdir(), "docicons-"));
const plain = join(dir, "icon.svg");
const mask = join(dir, "icon-maskable.svg");
writeFileSync(plain, svg(false));
writeFileSync(mask, svg(true));

const out = (name) => join("public", name);
const conv = (src, size, name) =>
  execFileSync("rsvg-convert", ["-w", String(size), "-h", String(size), src, "-o", out(name)]);

conv(plain, 192, "icon-192.png");
conv(plain, 512, "icon-512.png");
conv(plain, 180, "icon-180.png");
conv(mask, 512, "icon-512-maskable.png");
console.log("make-icons: wrote icon-192/512/180 + icon-512-maskable to public/");
