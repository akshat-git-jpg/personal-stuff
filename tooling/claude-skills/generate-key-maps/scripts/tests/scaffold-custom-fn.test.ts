import { describe, it, expect } from 'vitest';
import { scaffoldCustomFn } from '../scaffold-custom-fn.ts';

describe('scaffoldCustomFn', () => {
  it('produces a TODO scaffold with the standard signature when brief is null', () => {
    const out = scaffoldCustomFn({
      name: 'user_role',
      brief: null,
      reachable: ['org_users', 'user_role'],
      defaultCast: 'varchar',
      semanticsHint: 'Role of the user from a denormalised role table',
    });

    expect(out).toContain("import {");
    expect(out).toContain("KeyMapValueCustomFunctionParameters");
    expect(out).toContain("KeyMapValueCustomFunctionReturns");
    expect(out).toContain("from '../../../libs/query-builder/interface'");

    expect(out).toContain("const user_role = ({");
    expect(out).toContain("// TODO: Implement business logic for user_role.");
    expect(out).toContain("Role of the user from a denormalised role table");
    expect(out).toContain("Reachable entities (from relation graph): org_users, user_role");
    expect(out).toContain("NULL::varchar AS user_role");

    expect(out).toContain("export default user_role;");
  });

  it('emits a brief block when brief is provided (LLM fills the SQL later)', () => {
    const out = scaffoldCustomFn({
      name: 'managed_user_app_count',
      brief:
        'count of org_user_applications joined to org_applications where ' +
        "application_state in ('centrally managed','team managed') " +
        "and org_user_applications.status = 'active'",
      reachable: ['org_users', 'org_user_applications', 'org_applications'],
      defaultCast: 'integer',
    });

    // Path B — brief stored verbatim as a comment so a follow-up LLM pass
    // can translate it. (Translation itself is not the helper's job.)
    expect(out).toContain("/* BRIEF:");
    expect(out).toContain("count of org_user_applications");
    expect(out).toContain("const managed_user_app_count = ({");
  });
});
