const fs = require('fs');
const path = require('path');

const updates = {
  'comparison/feature-matrix': { size: 36, target: ['.hcell { font-size: 30px', '.val { justify-content: center; font-size: 30px'] },
  'comparison/head-to-head': { size: 56, target: ['.name { font-size: 56px'] },
  'comparison/pricing-tiers': { size: 56, target: ['.price { font-size: 56px'] },
  'comparison/savings-stacker': { size: 56, target: ['#title { font-size: 56px'] },
  'comparison/summary-table': { size: 36, target: ['.hcell { font-size: 28px', '.val { font-size: 28px'] },
  'pros-cons/pros-cons': { size: 40, target: ['.colHead { font-size: 40px'] },
  'section/key-takeaways': { size: 48, target: ['.label { font-size: 48px'] },
  'title/title-aurora-wave': { size: 36, target: ['.chip.text { font-size: 30px'] },
  'title/title-versus': { size: 56, target: ['.product-name { font-size: 56px'] },
  'verdict/verdict-report-card': { size: 56, target: ['.winnerName { font-size: 48px'] },
  'section/tool-intro': { size: 40, target: ['.tagline { font-size: 32px'] },
  'verdict/persona-match': { size: 36, target: ['.persona { font-size: 31px'] },
  'enacted/fill-gauge': { size: 42, target: ['.chip .value { font-size: 42px'] },
  'enacted/counter-tally': { size: 70, target: ['.suffix { font-size: 52px'] },
  'enacted/terminal-enact': { size: 40, target: ['#promptLine { font-size: 40px'] },
  'enacted/promise-split': { size: 44, target: ['.tile .fallback { font-size: 44px'] },
};

for (const [slug, conf] of Object.entries(updates)) {
  const file = path.join('./pipelines/video/card-library', slug, 'index.html');
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, 'utf8');
  
  if (!html.includes('--body-size')) {
    html = html.replace(/(--hero-size:[^;]+;)/, `$1\n        --body-size: ${conf.size}px;`);
  } else {
    html = html.replace(/--body-size:\s*\d+px;/, `--body-size: ${conf.size}px;`);
  }

  for (const t of conf.target) {
    const orig = t;
    const replacement = t.replace(/\d+px/, 'var(--body-size)');
    html = html.replace(orig, replacement);
  }
  
  fs.writeFileSync(file, html);
}

// Special case for verdict-badges: reduce distinct sizes to 2
const vbFile = path.join('./pipelines/video/card-library/verdict/verdict-badges/index.html');
if (fs.existsSync(vbFile)) {
  let vbHtml = fs.readFileSync(vbFile, 'utf8');
  vbHtml = vbHtml.replace(/#winner \.eyebrow \{ font-size: 24px/, '#winner .eyebrow { font-size: 22px');
  vbHtml = vbHtml.replace(/#winner \.reason \{ font-size: 20px/, '#winner .reason { font-size: 22px');
  fs.writeFileSync(vbFile, vbHtml);
}
