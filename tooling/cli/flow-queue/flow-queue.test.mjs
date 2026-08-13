import test from 'node:test';
import assert from 'node:assert/strict';
import { flattenPrompt, nameToken, parsePromptFile, pushGroup, payload } from './flow-queue.mjs';

// The extension's queue is ONE PROMPT PER LINE. Everything below exists because
// a real look-preview prompt is a multi-paragraph block, and handing one over
// raw turns a single prompt into ~15 junk queue entries.
test('flattenPrompt collapses a multi-paragraph prompt to one line', () => {
  const out = flattenPrompt('Flat 2D still frame,\n16:9, 1920x1080.\n\nBackground: near-black.');
  assert.equal(out, 'Flat 2D still frame, 16:9, 1920x1080. Background: near-black.');
  assert.ok(!out.includes('\n'), 'a newline here would split one prompt into several');
});

test('flattenPrompt drops the markdown fences a copied template brings along', () => {
  assert.equal(flattenPrompt('```\nFlat 2D still frame.\n```'), 'Flat 2D still frame.');
});

test('a --- rule separates prompts; a leading ## heading is a label, not prompt text', () => {
  const md = `## m1 — at rest
Flat 2D still frame, five pedestals.

---

## m2 — one lit
Flat 2D still frame, one pedestal lit.`;
  const out = parsePromptFile(md, 'promise-shelf');
  assert.equal(out.length, 2);
  assert.equal(out[0].label, 'm1 — at rest');
  assert.equal(out[0].prompt, 'Flat 2D still frame, five pedestals.');
  assert.equal(out[1].prompt, 'Flat 2D still frame, one pedestal lit.');
  for (const p of out) assert.ok(!p.prompt.includes('#'), 'a heading must never reach the generator');
});

// The regression the first fixture caught. An H1 title, a BLANK line, then the
// "## m1" moment heading is the normal shape of these files; testing "have we
// seen any body lines yet" instead of "any non-blank body lines" let that second
// heading through into the prompt, where the generator draws it as a caption.
test('a blank line between an H1 title and the ## moment heading does not leak the heading', () => {
  const md = `# Idea A — the race track

## m1 — the empty track

Flat 2D still frame, an empty track.`;
  const out = parsePromptFile(md, 'intro-idea-a');
  assert.equal(out.length, 1);
  assert.equal(out[0].prompt, 'Flat 2D still frame, an empty track.');
  assert.equal(out[0].label, 'm1 — the empty track', 'the LAST leading heading is the label');
});

// Hex colours appear in every look-preview template (#0d0906 background,
// #fb923c accent). Treating a mid-prompt # as a heading would delete the line
// that defines the palette.
test('a hex colour inside the body survives', () => {
  const out = parsePromptFile('Flat 2D still frame.\nBackground: #0d0906, accent #fb923c.', 'x');
  assert.equal(out.length, 1);
  assert.ok(out[0].prompt.includes('#0d0906'));
  assert.ok(out[0].prompt.includes('#fb923c'));
});

test('nameToken is filesystem-safe and 1-indexed per group', () => {
  assert.equal(nameToken('intro-idea-a', 0), 'intro_idea_a_m1');
  assert.equal(nameToken('card-promise-shelf', 1), 'card_promise_shelf_m2');
  assert.equal(nameToken('Weird  Name!!', 0), 'weird_name_m1');
});

// A producer re-running its step is the common case. Appending would queue the
// same frames twice and burn the owner's generations.
test('re-pushing the same source/group replaces it instead of appending', () => {
  let store = { groups: [] };
  store = pushGroup(store, { source: 'vf', group: 'g1', prompts: [{ name: 'g1_m1', prompt: 'a' }] });
  store = pushGroup(store, { source: 'vf', group: 'g1', prompts: [{ name: 'g1_m1', prompt: 'b' }] });
  assert.equal(store.groups.length, 1, 're-push must replace');
  assert.equal(payload(store).prompts[0], 'b', 'the newer push wins');
});

test('different groups coexist, and a second source does not clobber the first', () => {
  let store = { groups: [] };
  store = pushGroup(store, { source: 'vf', group: 'g1', prompts: [{ name: 'g1_m1', prompt: 'a' }] });
  store = pushGroup(store, { source: 'vf', group: 'g2', prompts: [{ name: 'g2_m1', prompt: 'b' }] });
  store = pushGroup(store, { source: 'other', group: 'g1', prompts: [{ name: 'g1_m1', prompt: 'c' }] });
  assert.equal(store.groups.length, 3);
  assert.equal(payload(store).prompts.length, 3);
});

// prompts[i] and names[i] are what the panel maps to a download filename. If
// they ever drift, every generated frame is saved under the wrong name.
test('payload keeps prompts and names index-aligned', () => {
  let store = { groups: [] };
  store = pushGroup(store, {
    source: 'vf', group: 'g1',
    prompts: [{ name: 'g1_m1', prompt: 'one' }, { name: 'g1_m2', prompt: 'two' }],
  });
  const p = payload(store);
  assert.equal(p.prompts.length, p.names.length);
  assert.deepEqual(p.names, ['g1_m1', 'g1_m2']);
  assert.deepEqual(p.prompts, ['one', 'two']);
});

test('an empty or heading-only file yields no prompts', () => {
  assert.deepEqual(parsePromptFile('', 'x'), []);
  assert.deepEqual(parsePromptFile('## just a heading\n\n---\n\n## another', 'x'), []);
});
