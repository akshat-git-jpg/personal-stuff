/* eslint-disable */
// @ts-nocheck
// Fixture only — never executed. Parsed via TypeScript Compiler API.
import {
  Entity,
  ManyToOne,
  OneToOne,
  OneToMany,
  PrimaryKey,
  Property,
  Collection,
  Ref,
} from '@mikro-orm/postgresql';
import SimpleDepartment from './SimpleDepartment.entity';

@Entity({ tableName: 'simple_users', schema: 'test_schema' })
export default class SimpleUser {
  @PrimaryKey({ columnType: 'uuid' })
  id!: string;

  @Property({ columnType: 'uuid' })
  org_id!: string;

  @Property({ columnType: 'varchar' })
  name!: string;

  @Property({ columnType: 'varchar', nullable: true })
  email?: string;

  @Property({ columnType: 'boolean', default: false })
  is_deleted: boolean = false;

  @Property({ columnType: 'boolean', default: false })
  is_archived: boolean = false;

  @Property({ columnType: 'uuid[]', nullable: true })
  org_dept_ids?: string[];

  @ManyToOne(() => SimpleDepartment, { fieldName: 'org_dept_id', nullable: true })
  org_dept?: Ref<SimpleDepartment>;

  @ManyToOne(() => SimpleUser, { fieldName: 'owner_id', nullable: true })
  owner?: Ref<SimpleUser> | null;

  // OneToOne owns a FK column too — covers the gap where mikro-orm files
  // declare profile-style relations as @OneToOne(target, { fieldName }).
  @OneToOne(() => SimpleDepartment, { fieldName: 'primary_dept_id', nullable: true })
  primary_dept?: Ref<SimpleDepartment>;
}
