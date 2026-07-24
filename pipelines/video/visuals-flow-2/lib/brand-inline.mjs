import fs from 'node:fs';
import path from 'node:path';

export function loadBrand(root, videoManifest = {}) {
  const brandName = videoManifest.brand || 'default';
  const brandPath = brandName === 'default' 
    ? path.join(root, 'brand.json')
    : path.join(root, 'brands', `${brandName}.json`);

  if (!fs.existsSync(brandPath)) {
    throw new Error(`brand not found: ${brandName}`);
  }
  
  return JSON.parse(fs.readFileSync(brandPath, 'utf8'));
}

export function injectBrand(html, brand) {
  if (!brand || !brand.tokens) return html;
  
  const rules = Object.entries(brand.tokens)
    .map(([k, v]) => `${k}:${v};`)
    .join('');
  const styleTag = `<style id="brand-tokens">:root{${rules}}</style>`;
  
  return html.replace('</head>', `${styleTag}</head>`);
}
