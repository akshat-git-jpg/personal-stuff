import { describe, it, expect } from 'vitest';
import { parseFrontendProps } from '../parse-frontend-props.ts';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, 'fixtures');

describe('parseFrontendProps', () => {
  it('extracts the full field_id list — both filter-style entries AND column-only field_ids arrays', () => {
    const model = parseFrontendProps(path.join(fixtureDir, 'simple-users.properties.js'));

    // 5 from `filters` + 2 column-only from `columns[1].field_ids`
    // (user_status, user_archive). The 3 IDs in BOTH shapes
    // (user_name, user_email, user_department_name) dedupe to one entry each.
    expect(model.fields.map((f) => f.field_id).sort()).toEqual([
      'user_archive',
      'user_department_id',
      'user_department_name',
      'user_email',
      'user_name',
      'user_owner_id',
      'user_status',
    ]);

    const deptFilter = model.fields.find((f) => f.field_id === 'user_department_id')!;
    expect(deptFilter.filter_type).toBe('objectId');
    expect(deptFilter.entity).toBe('department');
    expect(deptFilter.field_type).toBe('dynamic_filter');

    const ownerFilter = model.fields.find((f) => f.field_id === 'user_owner_id')!;
    expect(ownerFilter.entity).toBe('simple_users');
  });

  it('captures column-only fields (in field_ids arrays but not in filters) with no filter hints', () => {
    const model = parseFrontendProps(path.join(fixtureDir, 'simple-users.properties.js'));

    const status = model.fields.find((f) => f.field_id === 'user_status');
    expect(status).toBeDefined();
    expect(status!.filter_type).toBeUndefined();
    expect(status!.field_type).toBeUndefined();
    expect(status!.entity).toBeUndefined();

    const archive = model.fields.find((f) => f.field_id === 'user_archive');
    expect(archive).toBeDefined();
    expect(archive!.filter_type).toBeUndefined();
  });

  it('merges metadata when a field_id appears in both filters AND a field_ids array (filter hints win)', () => {
    const model = parseFrontendProps(path.join(fixtureDir, 'simple-users.properties.js'));

    // user_name is in both `filters` (with filter_type, group_name) and
    // `columns[0].field_ids`. Filter hints must survive the merge.
    const userName = model.fields.find((f) => f.field_id === 'user_name')!;
    expect(userName.filter_type).toBe('search_in_string');
    expect(userName.field_name).toBe('User Name');
    expect(userName.group_name).toBe('User');
  });

  it('records the source filePath on the model', () => {
    const fp = path.join(fixtureDir, 'simple-users.properties.js');
    const model = parseFrontendProps(fp);
    expect(model.filePath).toBe(fp);
  });

  it('follows ES `import` wrappers (TypeScript shape used by *.properties.ts files)', () => {
    // wrapper-users.properties.ts is empty of its own field declarations —
    // it just re-exports filters/columns from simple-users.properties.js
    // via `import x from './simple-users.properties'`. The parser should
    // detect the import, follow it, and return the wrapped file's fields.
    const wrapperFp = path.join(fixtureDir, 'wrapper-users.properties.ts');
    const wrappedFp = path.join(fixtureDir, 'simple-users.properties.js');
    const model = parseFrontendProps(wrapperFp);

    // Should match what the wrapped file produces directly.
    const direct = parseFrontendProps(wrappedFp);
    expect(model.fields.map((f) => f.field_id).sort()).toEqual(
      direct.fields.map((f) => f.field_id).sort(),
    );
    // filePath should point at the wrapped file (parseFrontendProps re-runs
    // on the resolved target, so the returned model carries the target's path).
    expect(model.filePath).toBe(wrappedFp);
  });
});
