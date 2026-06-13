import { execSync } from 'node:child_process';
import type { ApprovedPlan } from './lib/types.ts';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

/** Pure JS structural checks — no external commands. */
export function validateStructural(
  plan: ApprovedPlan,
  expectedFieldIds: string[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const seenAs = new Set<string>();
  for (const e of plan.keyMap) {
    if (seenAs.has(e.as)) {
      errors.push(`duplicate \`as\` alias: ${e.as}`);
    }
    seenAs.add(e.as);
  }

  const joinGroups = new Set(plan.joins.map((j) => j.logical_group));
  for (const e of plan.keyMap) {
    if (e.logical_group !== 'local' && !joinGroups.has(e.logical_group)) {
      errors.push(
        `key_map entry \`${e.field_id}\` references logical_group \`${e.logical_group}\` ` +
          `but no matching joins entry exists`,
      );
    }
  }

  const planFieldIds = new Set(plan.keyMap.map((e) => e.field_id));
  for (const fid of expectedFieldIds) {
    if (!planFieldIds.has(fid)) {
      errors.push(
        `frontend property file expects \`${fid}\` but the plan has no key_map entry for it`,
      );
    }
  }

  const customNames = new Set(plan.customFunctions.map((c) => c.name));
  for (const e of plan.keyMap) {
    if (e.query_type === 'custom') {
      if (!e.function_name) {
        errors.push(`custom key_map entry \`${e.field_id}\` is missing function_name`);
      } else if (!customNames.has(e.function_name)) {
        errors.push(
          `custom key_map entry \`${e.field_id}\` references function \`${e.function_name}\` ` +
            `but no matching customFunctions entry exists`,
        );
      }
    }
  }

  return { errors, warnings };
}

/**
 * Run `tsc --noEmit` against a generated module's directory using the
 * surrounding project's tsconfig. Returns errors as a string array.
 *
 * Note: requires the dashboard-api project's deps to be installed.
 */
export function runTsc(targetDir: string): ValidationResult {
  try {
    execSync(`npx tsc --noEmit -p ${targetDir}/tsconfig.json`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return { errors: [], warnings: [] };
  } catch (e) {
    const out = (e as { stdout?: string; stderr?: string }).stdout ?? '';
    return {
      errors: out.split('\n').filter((l) => l.includes('error')),
      warnings: [],
    };
  }
}

if (process.argv[1] && process.argv[1].endsWith('validate.ts')) {
  // CLI: takes JSON { plan, expectedFieldIds } on stdin, writes ValidationResult on stdout.
  let buf = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (c) => (buf += c));
  process.stdin.on('end', () => {
    const { plan, expectedFieldIds } = JSON.parse(buf);
    const result = validateStructural(plan, expectedFieldIds);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  });
}
