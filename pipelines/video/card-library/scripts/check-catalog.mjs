import fs from 'node:fs';
import { validateVariable } from '../../visuals-flow/lib/resolve.mjs';

const ROLES = ['heading', 'sentence', 'label', 'descriptor', 'value', 'logo_slug', 'icon_name', 'free'];
const catalog = JSON.parse(fs.readFileSync('catalog.json', 'utf8'));

let failed = false;
function err(msg) {
  console.error(msg);
  failed = true;
}

function checkSpec(spec, path) {
  if (typeof spec === 'string') {
    err(`FAIL: ${path} is still a string: "${spec}"`);
    return;
  }
  if (!spec.type) {
    err(`FAIL: ${path} missing type`);
    return;
  }
  if (spec.type === 'string') {
    if (!spec.role) err(`FAIL: ${path} missing role`);
    else if (!ROLES.includes(spec.role)) err(`FAIL: ${path} has invalid role "${spec.role}"`);
    
    if (spec.example === undefined) err(`FAIL: ${path} missing example`);
    else {
      const errs = validateVariable(path + '.example', spec.example, spec);
      if (errs.length) err(`FAIL: ${path} example failed validation:\n  ${errs.join('\n  ')}`);
    }
  }
  if (spec.type === 'object' && spec.shape) {
    for (const [k, v] of Object.entries(spec.shape)) checkSpec(v, `${path}.${k}`);
  }
  if (spec.type === 'array' && spec.item_shape) {
    for (const [k, v] of Object.entries(spec.item_shape)) {
      checkSpec(v, `${path}[].${k}`);
    }
  }
}

for (const card of catalog.cards) {
  for (const [k, spec] of Object.entries(card.variables ?? {})) {
    checkSpec(spec, `${card.slug}.variables.${k}`);
  }
  for (const [k, spec] of Object.entries(card.beat_shape ?? {})) {
    checkSpec(spec, `${card.slug}.beat_shape.${k}`);
  }
  if (card.register !== undefined) {
    if (!Array.isArray(card.register)) err(`FAIL: ${card.slug}.register must be an array`);
    else if (!card.register.every(r => r === 'dark' || r === 'light')) err(`FAIL: ${card.slug}.register must be array subset of ["dark","light"]`);
  }
  if (card.marker !== undefined && typeof card.marker !== 'boolean') err(`FAIL: ${card.slug}.marker must be boolean`);
  if (card.intent !== undefined) {
    if (typeof card.intent !== 'string') err(`FAIL: ${card.slug}.intent must be string`);
    else if (card.intent.includes('\n')) err(`FAIL: ${card.slug}.intent must be one line`);
  }
  if (card.anti_intent !== undefined) {
    if (typeof card.anti_intent !== 'string') err(`FAIL: ${card.slug}.anti_intent must be string`);
    else if (card.anti_intent.includes('\n')) err(`FAIL: ${card.slug}.anti_intent must be one line`);
  }
  if (card.variants !== undefined) {
    if (!Array.isArray(card.variants)) err(`FAIL: ${card.slug}.variants must be an array`);
    else if (!card.variants.every(v => typeof v === 'string')) err(`FAIL: ${card.slug}.variants must be array of strings`);
  }
  if (card.continuity !== undefined && typeof card.continuity !== 'boolean') err(`FAIL: ${card.slug}.continuity must be boolean`);
}

if (failed) process.exit(1);
console.log('catalog ok');
