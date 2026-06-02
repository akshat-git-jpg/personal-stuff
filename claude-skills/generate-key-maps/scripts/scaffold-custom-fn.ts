import type { CustomFnPlan } from './lib/types.ts';

/**
 * Emit the source text for a custom function file. Two paths:
 *
 *  - brief: null   → TODO scaffold (compiles cleanly, returns NULL of the
 *                    right cast). Developer or follow-up LLM pass fills it in.
 *  - brief: <text> → Same scaffold, but with the brief embedded as a leading
 *                    /* BRIEF: ... *\/ block so a follow-up LLM step can
 *                    translate the brief into a real CTE without losing
 *                    context. The scaffolder itself does not synthesize SQL.
 */
export function scaffoldCustomFn(plan: CustomFnPlan): string {
  const { name, brief, reachable, defaultCast, semanticsHint } = plan;
  const reachableList = reachable.length ? reachable.join(', ') : '(none recorded)';
  const semantics =
    semanticsHint ?? 'This function should compute: <field semantics — fill in>';

  const briefBlock = brief
    ? [
        '/* BRIEF:',
        ...brief.split('\n').map((line) => ` * ${line}`),
        ' *',
        ' * The brief above is the developer-supplied business-logic description.',
        ' * A follow-up LLM step translates it into the with_clause below.',
        ' */',
        '',
      ].join('\n')
    : '';

  return [
    briefBlock,
    "import {",
    "\tKeyMapValueCustomFunctionParameters,",
    "\tKeyMapValueCustomFunctionReturns,",
    "} from '../../../libs/query-builder/interface';",
    '',
    `const ${name} = ({`,
    '\torg_id,',
    '\tlocal_conditions,',
    '\tmain_table,',
    '\tfilters,',
    '}: KeyMapValueCustomFunctionParameters): KeyMapValueCustomFunctionReturns => {',
    `\t// TODO: Implement business logic for ${name}.`,
    `\t// ${semantics}`,
    `\t// Reachable entities (from relation graph): ${reachableList}`,
    '\t// Standard pattern: return a CTE selecting main_table.id AS id and the',
    '\t// computed columns, with main_table org_id/is_deleted defaults applied.',
    '',
    '\tconst with_clause = `',
    '\t\tSELECT ${main_table}.id AS id,',
    `\t\t\tNULL::${defaultCast} AS ${name}`,
    '\t\tFROM zluri_schema.${main_table} ${main_table}',
    "\t\tWHERE ${main_table}.org_id = '${org_id}'",
    '\t\t\tAND ${main_table}.is_deleted = false',
    '\t\t\t${local_conditions ? `AND ${local_conditions}` : \'\'}',
    '\t`;',
    '',
    `\tconst select_clause = '${name}.${name} AS ${name}';`,
    '\treturn { with_clause, select_clause };',
    '};',
    '',
    `export default ${name};`,
    '',
  ].join('\n');
}

if (process.argv[1] && process.argv[1].endsWith('scaffold-custom-fn.ts')) {
  let buf = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk) => (buf += chunk));
  process.stdin.on('end', () => {
    const plan: CustomFnPlan = JSON.parse(buf);
    process.stdout.write(scaffoldCustomFn(plan));
  });
}
