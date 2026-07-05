// ai-image.mjs — free, keyless AI image backdrops via Pollinations.ai.
// Best for backgrounds / mood / abstract. Avoid for close-up dishes (AI food looks fake).
// CLI:  node lib/ai-image.mjs "overhead flat-lay of keto breakfast, soft natural light"

export function pollinationsUrl(prompt, { width = 1000, height = 1500, seed } = {}) {
  const q = encodeURIComponent(prompt || "soft abstract food background");
  const s = seed != null ? `&seed=${seed}` : "";
  // model=flux gives the nicest results; nologo strips the watermark.
  return `https://image.pollinations.ai/prompt/${q}?width=${width}&height=${height}&nologo=true&model=flux${s}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const p = process.argv.slice(2).join(" ");
  if (!p) {
    console.error('Usage: node lib/ai-image.mjs "image prompt"');
    process.exit(1);
  }
  console.log(pollinationsUrl(p));
}
