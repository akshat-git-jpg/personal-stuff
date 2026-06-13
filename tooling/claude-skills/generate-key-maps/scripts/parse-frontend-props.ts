import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import type { FrontendField, FrontendModel } from './lib/types.ts';

/**
 * Parse a frontend property file (either the wrapper `.properties3.js`
 * shape or the v2Table `*-main.properties.js` shape) and return the field
 * list with filter hints.
 *
 * Frontend files declare fields in TWO shapes:
 *   1. Filter-style entries: `{ field_id: 'foo', field_name: '...', filter_type: '...' }`
 *      — typically inside `filter_props` / `filters` arrays.
 *   2. Column-only entries: `{ field_ids: ['foo', 'bar'], ... }`
 *      — typically inside `default_props.columns[*]`. These declare fields
 *      that should appear as table columns but don't have filter UI.
 *
 * The parser collects from both. Fields appearing in both shapes are merged
 * (filter-style metadata wins; column-only contributes the bare field_id).
 *
 * If the file is a thin wrapper that only re-exports key_map/joins from
 * a v2Table file via `require('../v2Table/...')`, this function follows
 * the require to that target and re-runs the parser.
 */
export function parseFrontendProps(filePath: string): FrontendModel {
  const source = fs.readFileSync(filePath, 'utf-8');
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);

  const fields: FrontendField[] = [];
  let wrapperRequirePath: string | null = null;

  /** Read a filter-style object: `{ field_id: '...', filter_type: '...', ... }`. */
  function readField(obj: ts.ObjectLiteralExpression): FrontendField | null {
    const f: Partial<FrontendField> = {};
    for (const prop of obj.properties) {
      if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
      const key = prop.name.text;
      const init = prop.initializer;
      let value: string | undefined;
      if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
        value = init.text;
      }
      if (value === undefined) continue;
      if (key === 'field_id') f.field_id = value;
      else if (key === 'field_name') f.field_name = value;
      else if (key === 'field_type') f.field_type = value;
      else if (key === 'filter_type') f.filter_type = value;
      else if (key === 'entity') f.entity = value;
      else if (key === 'group_name') f.group_name = value;
    }
    return f.field_id ? (f as FrontendField) : null;
  }

  /**
   * Read a column-only object's `field_ids: ['a', 'b', ...]` array.
   * Returns the list of string field IDs, or [] if no such property exists.
   */
  function readFieldIdsArray(obj: ts.ObjectLiteralExpression): string[] {
    const out: string[] = [];
    for (const prop of obj.properties) {
      if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
      if (prop.name.text !== 'field_ids') continue;
      const init = prop.initializer;
      if (!ts.isArrayLiteralExpression(init)) continue;
      for (const el of init.elements) {
        if (ts.isStringLiteral(el) || ts.isNoSubstitutionTemplateLiteral(el)) {
          out.push(el.text);
        }
      }
    }
    return out;
  }

  function visit(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node)) {
      const field = readField(node);
      if (field) fields.push(field);

      // Also collect any `field_ids: [...]` array entries — these are
      // column-only fields that still need key_map entries even though
      // they don't have filter UI.
      const ids = readFieldIdsArray(node);
      for (const id of ids) {
        fields.push({ field_id: id });
      }
    }
    // Detect both CommonJS `require('...')` and ES `import ... from '...'`.
    // TypeScript wrappers like `policy-version-history.properties.ts` use
    // the ES form. Both shapes record the path so we can follow the wrapper
    // if no inline fields are found.
    let wrapperPath: string | null = null;
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      wrapperPath = (node.arguments[0] as ts.StringLiteral).text;
    } else if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      wrapperPath = node.moduleSpecifier.text;
    }
    if (wrapperPath !== null && wrapperRequirePath === null) {
      // Only follow paths that look like a property file.
      if (
        wrapperPath.includes('v2Table') ||
        wrapperPath.includes('properties') ||
        wrapperPath.endsWith('-main.properties')
      ) {
        wrapperRequirePath = wrapperPath;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);

  // If we found nothing AND the file is a thin wrapper, follow the require.
  if (fields.length === 0 && wrapperRequirePath) {
    const dir = path.dirname(filePath);
    const candidate = path.resolve(dir, wrapperRequirePath);
    const tryPaths = [
      candidate,
      `${candidate}.js`,
      `${candidate}.ts`,
      path.join(candidate, 'index.js'),
      path.join(candidate, 'index.ts'),
    ];
    for (const p of tryPaths) {
      if (fs.existsSync(p)) {
        return parseFrontendProps(p);
      }
    }
  }

  // Merge-dedupe: same field_id may appear in both filters and field_ids
  // arrays. Each property prefers the existing (earlier) entry's value;
  // later entries fill in any missing hints. Order-independent.
  function mergeField(prefer: FrontendField, fallback: FrontendField): FrontendField {
    return {
      field_id: prefer.field_id,
      field_name: prefer.field_name ?? fallback.field_name,
      field_type: prefer.field_type ?? fallback.field_type,
      filter_type: prefer.filter_type ?? fallback.filter_type,
      entity: prefer.entity ?? fallback.entity,
      group_name: prefer.group_name ?? fallback.group_name,
    };
  }

  const merged = new Map<string, FrontendField>();
  for (const f of fields) {
    const existing = merged.get(f.field_id);
    merged.set(f.field_id, existing ? mergeField(existing, f) : f);
  }

  return { fields: Array.from(merged.values()), filePath };
}

if (process.argv[1] && process.argv[1].endsWith('parse-frontend-props.ts')) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: parse-frontend-props.ts <fe-properties-file>');
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(parseFrontendProps(arg), null, 2) + '\n');
}
