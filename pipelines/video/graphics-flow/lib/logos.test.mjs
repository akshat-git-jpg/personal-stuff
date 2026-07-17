import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { enrichLogos } from './logos-inline.mjs';
import { validateCues } from './resolve.mjs';

test('enrichLogos handles variables and missing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'logos-test-'));
  try {
    const logosDir = path.join(tmp, 'logos');
    fs.mkdirSync(logosDir);
    const pngPath = path.join(logosDir, 'tiny.png');
    fs.writeFileSync(pngPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'));
    
    fs.writeFileSync(path.join(logosDir, 'registry.json'), JSON.stringify({
      known: { file: 'tiny.png' },
      badfile: { file: 'missing.png' },
      nullfile: { file: null }
    }));
    
    const b64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    const input = {
      logo: 'known',
      productLogos: ['known', 'unknown'],
      beats: [{ logo: 'known' }, { logo: 'badfile' }, { logo: 'nullfile' }, {}]
    };
    
    const { variables, missing } = enrichLogos(input, tmp);
    
    assert.deepStrictEqual(missing.sort(), ['badfile', 'nullfile', 'unknown']);
    assert.strictEqual(variables.__logos.known, b64);
    assert.strictEqual(variables.__logos.unknown, undefined);
    
    const empty = { text: 'hello' };
    const { variables: emptyVars, missing: emptyMissing } = enrichLogos(empty, tmp);
    assert.strictEqual(emptyMissing.length, 0);
    assert.strictEqual(emptyVars.__logos, undefined);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('validateCues handles logo slugs', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'logos-test-val-'));
  try {
    const logosDir = path.join(tmp, 'logos');
    fs.mkdirSync(logosDir);
    fs.writeFileSync(path.join(logosDir, 'registry.json'), JSON.stringify({
      known: { file: 'known.png' },
      nullfile: { file: null }
    }));
    
    const catalog = {
      cards: [
        { slug: 'some/card', variables: { logo: 'string' } }
      ]
    };
    
    const cues = [
      { id: 'c1', card: 'some/card', variables: { logo: 'known' } },
      { id: 'c2', card: 'some/card', variables: { logo: 'unknown' } },
      { id: 'c3', card: 'some/card', variables: { logo: 'nullfile' } },
    ];
    
    const errors = validateCues(cues, catalog, tmp);
    assert.strictEqual(errors.length, 2);
    assert.ok(errors[0].includes('c2: unknown logo slug "unknown"'));
    assert.ok(errors[1].includes('c3: unknown logo slug "nullfile"'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
