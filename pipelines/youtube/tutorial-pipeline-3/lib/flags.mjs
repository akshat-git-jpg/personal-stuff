const FLAG_RE = /\[(VERIFY|FILL):\s*([^\]]+)\]/g;

export function scanFlags(text) {
  const out = [];
  for (const m of String(text).matchAll(FLAG_RE)) {
    out.push({ kind: m[1], note: m[2].trim(), raw: m[0] });
  }
  return out;
}

export function stripFlags(text) {
  return String(text).replace(FLAG_RE, "").replace(/\s{2,}/g, " ").trim();
}
