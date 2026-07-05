// stock.mjs — free stock photos from Pexels (portrait orientation, good for 2:3 pins).
// Needs a free PEXELS_API_KEY in the environment. If absent, returns null gracefully.
// CLI:  node lib/stock.mjs "keto breakfast eggs avocado"

export async function pexelsSearch(query, { perPage = 15 } = {}) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const url =
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
    `&orientation=portrait&size=large&per_page=${perPage}`;
  const r = await fetch(url, { headers: { Authorization: key } });
  if (!r.ok) {
    process.stderr.write(`[stock] Pexels ${r.status}\n`);
    return null;
  }
  const j = await r.json();
  return (j.photos || []).map((p) => p.src.large2x || p.src.large || p.src.original);
}

// Allow direct CLI use so Claude can preview candidate photos before choosing one.
if (import.meta.url === `file://${process.argv[1]}`) {
  const q = process.argv.slice(2).join(" ");
  if (!q) {
    console.error('Usage: node lib/stock.mjs "search query"');
    process.exit(1);
  }
  const urls = await pexelsSearch(q);
  if (!urls) {
    console.error("No PEXELS_API_KEY set (or request failed). Stock layer unavailable.");
    process.exit(2);
  }
  urls.forEach((u) => console.log(u));
}
