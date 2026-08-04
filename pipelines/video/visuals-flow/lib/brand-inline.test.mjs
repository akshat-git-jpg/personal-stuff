import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { injectBrand, loadBrand } from './brand-inline.mjs';

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
