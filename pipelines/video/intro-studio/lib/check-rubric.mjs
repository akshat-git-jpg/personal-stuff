import fs from 'node:fs';

const rubric = fs.readFileSync('steps/050-critique-llm/INTRO-BAR.md', 'utf8');

const missing = [];
if (!rubric.includes('## How to use this')) missing.push('## How to use this');
if (!rubric.includes('## The bar')) missing.push('## The bar');
if (!rubric.includes('## Verdict')) missing.push('## Verdict');

const lines = [
  '**Continuity**',
  '**Register**',
  '**Motion**',
  '**The face lands early**',
  '**Typography**',
  '**The hand-off**',
  '**Not a slideshow**'
];
for (const line of lines) {
  if (!rubric.includes(line)) missing.push(`Bar item: ${line}`);
}

if (missing.length > 0) {
  console.error('Rubric missing sections:\n' + missing.join('\n'));
  process.exit(1);
}
console.log('rubric OK');
