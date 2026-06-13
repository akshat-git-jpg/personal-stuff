import { describe, it, expect } from 'vitest';
import { validateStructural } from '../validate.ts';
import type { ApprovedPlan } from '../lib/types.ts';

const basePlan: ApprovedPlan = {
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
  ],
  joins: [],
  customFunctions: [],
};

describe('validateStructural', () => {
  it('passes a clean minimal plan', () => {
    const result = validateStructural(basePlan, ['_id']);
    expect(result.errors).toEqual([]);
  });

  it('flags duplicate `as` aliases', () => {
    const plan: ApprovedPlan = {
      ...basePlan,
      keyMap: [
        ...basePlan.keyMap,
        {
          field_id: 'user_name',
          query_type: 'local',
          logical_group: 'local',
          local_field: 'name',
          cast: 'varchar',
          as: '_id',
        },
      ],
    };
    const result = validateStructural(plan, ['_id', 'user_name']);
    expect(result.errors.some((e) => e.includes('duplicate'))).toBe(true);
  });

  it('flags a non-local logical_group with no matching join entry', () => {
    const plan: ApprovedPlan = {
      ...basePlan,
      keyMap: [
        ...basePlan.keyMap,
        {
          field_id: 'user_dept_name',
          query_type: 'foreign',
          logical_group: 'user_department_details',
          foreign_field: 'name',
          cast: 'varchar',
          as: 'user_dept_name',
        },
      ],
    };
    const result = validateStructural(plan, ['_id', 'user_dept_name']);
    expect(
      result.errors.some((e) => e.includes("user_department_details")),
    ).toBe(true);
  });

  it('flags missing FE field_ids (FE expects a key the plan does not have)', () => {
    const result = validateStructural(basePlan, ['_id', 'user_name']);
    expect(result.errors.some((e) => e.includes('user_name'))).toBe(true);
  });
});
