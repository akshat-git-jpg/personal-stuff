import { describe, it, expect } from 'vitest';
import { parseEntity } from '../parse-entity.ts';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, 'fixtures');

describe('parseEntity', () => {
  it('extracts className, tableName, schema, primary key, and columns from a mikro-orm entity', () => {
    const model = parseEntity(path.join(fixtureDir, 'SimpleUser.entity.ts'));

    expect(model.className).toBe('SimpleUser');
    expect(model.tableName).toBe('simple_users');
    expect(model.schema).toBe('test_schema');
    expect(model.primaryKey).toBe('id');

    const colNames = model.columns.map((c) => c.name).sort();
    expect(colNames).toEqual(
      ['email', 'id', 'is_archived', 'is_deleted', 'name', 'org_dept_ids', 'org_id'].sort(),
    );

    const email = model.columns.find((c) => c.name === 'email')!;
    expect(email.columnType).toBe('varchar');
    expect(email.nullable).toBe(true);

    const orgId = model.columns.find((c) => c.name === 'org_id')!;
    expect(orgId.columnType).toBe('uuid');
    expect(orgId.nullable).toBe(false);

    const orgDeptIds = model.columns.find((c) => c.name === 'org_dept_ids')!;
    expect(orgDeptIds.columnType).toBe('uuid[]');
  });

  it('extracts ManyToOne relations including self-references', () => {
    const model = parseEntity(path.join(fixtureDir, 'SimpleUser.entity.ts'));
    const m2oRelations = model.relations.filter((r) => r.kind === 'ManyToOne');

    expect(m2oRelations).toHaveLength(2);

    const ownerRel = m2oRelations.find((r) => r.fieldName === 'owner_id')!;
    expect(ownerRel.targetClass).toBe('SimpleUser');
    expect(ownerRel.nullable).toBe(true);

    const deptRel = m2oRelations.find((r) => r.fieldName === 'org_dept_id')!;
    expect(deptRel.targetClass).toBe('SimpleDepartment');
    expect(deptRel.nullable).toBe(true);
  });

  it('extracts OneToOne relations and populates their fieldName (FK-owning side)', () => {
    const model = parseEntity(path.join(fixtureDir, 'SimpleUser.entity.ts'));
    const o2oRelations = model.relations.filter((r) => r.kind === 'OneToOne');

    expect(o2oRelations).toHaveLength(1);
    expect(o2oRelations[0].targetClass).toBe('SimpleDepartment');
    expect(o2oRelations[0].fieldName).toBe('primary_dept_id');
    expect(o2oRelations[0].nullable).toBe(true);
  });
});
