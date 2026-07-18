import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_SECTIONS = [
  '## Inputs and outputs',
  '## Cue density',
  '## Choosing a card',
  '## Anchors',
  '## Beats',
  '## Variables',
  '## Worked example',
  '## Novel cards (flagged cues)',
  '## Rubric',
];

function fail(message) {
  console.error(`rulebook FAIL: ${message}`);
  process.exit(1);
}

function main() {
  const cardLibraryRoot = path.resolve(import.meta.dirname, '..', '..', 'card-library');
  const cuePassStepDir = path.resolve(import.meta.dirname, '..', 'steps', '020-cue-pass-llm');
  const rulebookPath = path.join(cuePassStepDir, 'RULEBOOK.md');
  const promptPath = path.join(cuePassStepDir, 'cue-pass-prompt.md');
  const catalogPath = path.join(cardLibraryRoot, 'catalog.json');

  if (!fs.existsSync(rulebookPath)) fail('steps/020-cue-pass-llm/RULEBOOK.md missing');
  if (!fs.existsSync(promptPath)) fail('steps/020-cue-pass-llm/cue-pass-prompt.md missing');
  if (!fs.existsSync(catalogPath)) fail('catalog.json missing (plan 062 not landed)');

  const rulebook = fs.readFileSync(rulebookPath, 'utf8');
  const prompt = fs.readFileSync(promptPath, 'utf8');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  for (const section of REQUIRED_SECTIONS) {
    if (!rulebook.includes(section)) fail(`RULEBOOK.md missing section: ${section}`);
  }

  if (!prompt.includes('{{CATALOG}}')) fail('cue-pass-prompt.md missing {{CATALOG}} placeholder');
  if (!prompt.includes('{{TRANSCRIPT}}')) fail('cue-pass-prompt.md missing {{TRANSCRIPT}} placeholder');
  if (!prompt.includes('raw JSON')) fail('cue-pass-prompt.md missing "raw JSON" output rule');

  const workedExampleIdx = rulebook.indexOf('## Worked example');
  const nextSectionIdx = rulebook.indexOf('\n## ', workedExampleIdx + 1);
  const workedExampleSection = rulebook.slice(
    workedExampleIdx,
    nextSectionIdx === -1 ? rulebook.length : nextSectionIdx,
  );

  const jsonBlockMatch = workedExampleSection.match(/```json\n([\s\S]*?)```/);
  if (!jsonBlockMatch) fail('no fenced json block in the Worked example section');

  let workedExample;
  try {
    workedExample = JSON.parse(jsonBlockMatch[1]);
  } catch (err) {
    fail(`worked example JSON does not parse: ${err.message}`);
  }

  if (!Array.isArray(workedExample.cues) || workedExample.cues.length === 0) {
    fail('worked example has no cues');
  }

  const catalogSlugs = new Set(catalog.cards.map((card) => card.slug));

  for (const cue of workedExample.cues) {
    if (!cue.id) fail(`worked example cue missing id: ${JSON.stringify(cue)}`);
    if (!cue.card) fail(`worked example cue ${cue.id} missing card`);
    if (!cue.anchor) fail(`worked example cue ${cue.id} missing anchor`);
    if (!catalogSlugs.has(cue.card)) fail(`worked example cue ${cue.id} uses unknown card slug: ${cue.card}`);
    for (const beat of cue.beats ?? []) {
      if (!beat.reveal) fail(`worked example cue ${cue.id} has a beat missing reveal`);
      if (!beat.anchor) fail(`worked example cue ${cue.id} has a beat missing anchor`);
    }
  }

  console.log('rulebook ok');
}

main();
