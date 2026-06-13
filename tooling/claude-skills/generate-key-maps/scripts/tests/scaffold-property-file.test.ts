import { describe, it, expect } from 'vitest';
import { scaffoldIndexTs } from '../scaffold-property-file.ts';
import type { ApprovedPlan } from '../lib/types.ts';

describe('scaffoldIndexTs', () => {
  const minimalPlan: ApprovedPlan = {
    mainTable: 'simple_users',
    schema: 'test_schema',
    entityShortName: 'simple_user',
    outputDir: '/tmp/out',
    keyMap: [
      {
        field_id: '_id',
        query_type: 'local',
        logical_group: 'local',
        local_field: 'id',
        cast: 'objectId',
        as: '_id',
      },
      {
        field_id: 'user_name',
        query_type: 'local',
        logical_group: 'local',
        local_field: 'name',
        cast: 'varchar',
        as: 'user_name',
      },
      {
        field_id: 'user_department_name',
        query_type: 'foreign',
        logical_group: 'user_department_details',
        foreign_field: 'name',
        cast: 'varchar',
        as: 'user_department_name',
      },
    ],
    joins: [
      {
        logical_group: 'user_department_details',
        local_table: 'simple_users',
        local_field: 'org_dept_id',
        foreign_table: 'simple_departments',
        foreign_field: 'id',
      },
    ],
    customFunctions: [],
  };

  it('emits canonical interface imports and main_table/schema exports', () => {
    const out = scaffoldIndexTs(minimalPlan);

    expect(out).toContain("import { KeyMapValue, Joins } from '../interfaces';");
    expect(out).toContain("export const main_table = 'simple_users';");
    expect(out).toContain("export const schema = 'test_schema';");
  });

  it('emits a key_map entry for every field with query_type-specific properties', () => {
    const out = scaffoldIndexTs(minimalPlan);

    expect(out).toContain("_id: {");
    expect(out).toContain("logical_group: 'local'");
    expect(out).toContain("local_field: 'id'");
    expect(out).toContain("cast: 'objectId'");

    expect(out).toContain("user_name: {");
    expect(out).toContain("local_field: 'name'");

    expect(out).toContain("user_department_name: {");
    expect(out).toContain("query_type: 'foreign'");
    expect(out).toContain("foreign_field: 'name'");
  });

  it('emits a joins entry for every non-local logical_group', () => {
    const out = scaffoldIndexTs(minimalPlan);

    expect(out).toContain("user_department_details: {");
    expect(out).toContain("local_table: 'simple_users'");
    expect(out).toContain("foreign_table: 'simple_departments'");
    expect(out).toContain("local_field: 'org_dept_id'");
    expect(out).toContain("foreign_field: 'id'");
  });

  it('emits import lines for custom functions when present', () => {
    const planWithCustom: ApprovedPlan = {
      ...minimalPlan,
      keyMap: [
        ...minimalPlan.keyMap,
        {
          field_id: 'managed_user_app_count',
          query_type: 'custom',
          logical_group: 'managed_user_app_count',
          function_name: 'managed_user_app_count',
          cast: 'integer',
          as: 'managed_user_app_count',
          default_value: 0,
        },
      ],
      customFunctions: [
        {
          name: 'managed_user_app_count',
          brief: null,
          reachable: ['simple_users', 'simple_user_applications'],
          defaultCast: 'integer',
        },
      ],
    };
    const out = scaffoldIndexTs(planWithCustom);

    expect(out).toContain(
      "import managed_user_app_count from './functions/managed_user_app_count';",
    );
    expect(out).toContain("function: managed_user_app_count");
  });
});
