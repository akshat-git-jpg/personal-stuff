import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { injectBrand, loadBrand } from './brand-inline.mjs';

function tmpBrandRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-inline-'));
  fs.writeFileSync(path.join(dir, 'brand.json'), JSON.stringify({ name: 'default', tokens: {} }));
  fs.mkdirSync(path.join(dir, 'brands'));
  fs.writeFileSync(path.join(dir, 'brands', 'custom.json'), JSON.stringify({ name: 'custom', tokens: {} }));
  return dir;
}

test('injectBrand inserts style before </head>', () => {
  const html = `<html><head><style>body { color: red; }</style></head><body></body></html>`;
  const brand = {
    tokens: {
      "--bg-from": "#3a1f08",
      "--bg-to": "#0a0805"
    }
  };
  const result = injectBrand(html, brand);
  assert.ok(result.includes('<style>body { color: red; }</style><style id="brand-tokens">:root{--bg-from:#3a1f08;--bg-to:#0a0805;}</style></head>'));
});

test('loadBrand loads default brand', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const brand = loadBrand(root);
  assert.strictEqual(brand.name, 'default');
  assert.ok(brand.tokens['--bg-from']);
});

test('loadBrand errors on missing brand', () => {
  const root = path.resolve(import.meta.dirname, '..');
  assert.throws(() => {
    loadBrand(root, { brand: 'does-not-exist' });
  }, /brand not found: does-not-exist/);
});

// --- plan 264: brand resolution by channel ---

test('an explicit manifest brand wins over the channel profile', () => {
  const root = tmpBrandRoot();
  // agrollo's profile.brand is "default" — if the override did not win, this
  // would resolve to root/brand.json instead of root/brands/custom.json.
  const brand = loadBrand(root, { brand: 'custom', channel: 'agrollo' });
  assert.strictEqual(brand.name, 'custom');
});

test('a manifest with only a channel resolves through the profile', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const brand = loadBrand(root, { channel: 'agrollo' });
  assert.strictEqual(brand.name, 'default');
});

test('no manifest at all still loads brand.json', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const brand = loadBrand(root);
  assert.strictEqual(brand.name, 'default');
});

test('an unresolvable brand still throws "brand not found:"', () => {
  const root = tmpBrandRoot();
  assert.throws(() => {
    loadBrand(root, { brand: 'nope' });
  }, /brand not found: nope/);
});
