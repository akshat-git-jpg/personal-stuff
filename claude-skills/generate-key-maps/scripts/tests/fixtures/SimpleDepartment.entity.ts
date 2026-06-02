/* eslint-disable */
// @ts-nocheck
// Fixture only — never executed.
import { Entity, PrimaryKey, Property } from '@mikro-orm/postgresql';

@Entity({ tableName: 'simple_departments', schema: 'test_schema' })
export default class SimpleDepartment {
  @PrimaryKey({ columnType: 'uuid' })
  id!: string;

  @Property({ columnType: 'uuid' })
  org_id!: string;

  @Property({ columnType: 'varchar' })
  name!: string;

  @Property({ columnType: 'boolean', default: false })
  is_deleted: boolean = false;
}
