import type {
  ApprovedPlan,
  PlannedKeyMapEntry,
  PlannedJoin,
} from './lib/types.ts';

const TAB = '\t';

function indent(level: number): string {
  return TAB.repeat(level);
}

function quote(s: string): string {
  return `'${s.replace(/'/g, "\\'")}'`;
}

function renderKeyMapEntry(e: PlannedKeyMapEntry): string {
  const lines: string[] = [];
  lines.push(`${indent(1)}${e.field_id}: {`);
  lines.push(`${indent(2)}logical_group: ${quote(e.logical_group)},`);
  lines.push(`${indent(2)}query_type: ${quote(e.query_type)},`);

  if (e.query_type === 'local') {
    if (e.local_field) lines.push(`${indent(2)}local_field: ${quote(e.local_field)},`);
  } else if (e.query_type === 'foreign') {
    if (e.foreign_field) lines.push(`${indent(2)}foreign_field: ${quote(e.foreign_field)},`);
  } else if (e.query_type === 'aggregated') {
    if (e.group_operation) lines.push(`${indent(2)}group_operation: ${quote(e.group_operation)},`);
    if (e.grouped_on) lines.push(`${indent(2)}grouped_on: ${quote(e.grouped_on)},`);
    if (e.time_period) lines.push(`${indent(2)}time_period: ${quote(e.time_period)},`);
  } else if (e.query_type === 'custom') {
    if (e.function_name) {
      // The function is imported at the top of the file; reference it here.
      lines.push(`${indent(2)}// @ts-expect-error fix types`);
      lines.push(`${indent(2)}function: ${e.function_name},`);
    }
  }

  if (e.cast) lines.push(`${indent(2)}cast: ${quote(e.cast)},`);
  if (e.field_is_array) lines.push(`${indent(2)}field_is_array: true,`);
  if (e.default_value !== undefined) {
    const dv =
      typeof e.default_value === 'string'
        ? quote(e.default_value)
        : String(e.default_value);
    lines.push(`${indent(2)}default_value: ${dv},`);
  }
  lines.push(`${indent(2)}as: ${quote(e.as)},`);
  lines.push(`${indent(1)}},`);
  return lines.join('\n');
}

function renderJoinEntry(j: PlannedJoin): string {
  const lines: string[] = [];
  lines.push(`${indent(1)}${j.logical_group}: {`);
  lines.push(`${indent(2)}local_table: ${quote(j.local_table)},`);
  lines.push(`${indent(2)}local_field: ${quote(j.local_field)},`);
  lines.push(`${indent(2)}foreign_table: ${quote(j.foreign_table)},`);
  lines.push(`${indent(2)}foreign_field: ${quote(j.foreign_field)},`);
  if (j.materialized) lines.push(`${indent(2)}materialized: true,`);
  if (j.join_type) lines.push(`${indent(2)}join_type: ${quote(j.join_type)},`);
  lines.push(`${indent(1)}},`);
  return lines.join('\n');
}

export function scaffoldIndexTs(plan: ApprovedPlan): string {
  const importLines = [`import { KeyMapValue, Joins } from '../interfaces';`];
  for (const fn of plan.customFunctions) {
    importLines.push(`import ${fn.name} from './functions/${fn.name}';`);
  }

  const keyMapBody = plan.keyMap.map(renderKeyMapEntry).join('\n');
  const joinsBody = plan.joins.map(renderJoinEntry).join('\n');

  return [
    importLines.join('\n'),
    '',
    'export const key_map: { [key: string]: KeyMapValue } = {',
    keyMapBody,
    '};',
    '',
    'export const joins: { [key: string]: Joins } = {',
    joinsBody,
    '};',
    '',
    `export const main_table = ${quote(plan.mainTable)};`,
    `export const schema = ${quote(plan.schema)};`,
    '',
  ].join('\n');
}

if (process.argv[1] && process.argv[1].endsWith('scaffold-property-file.ts')) {
  // CLI: read JSON plan on stdin, write index.ts text on stdout.
  let buf = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk) => (buf += chunk));
  process.stdin.on('end', () => {
    const plan: ApprovedPlan = JSON.parse(buf);
    process.stdout.write(scaffoldIndexTs(plan));
  });
}
