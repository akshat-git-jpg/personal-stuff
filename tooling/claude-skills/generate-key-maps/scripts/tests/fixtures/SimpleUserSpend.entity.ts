/* eslint-disable */
// @ts-nocheck
// Fixture only — never executed.
// Reverse-children fixture: this entity FKs *back* to SimpleUser, but
// SimpleUser does NOT declare a @OneToMany pointing here. The graph walker
// must discover this entity via the reverse-scan pass.
import { Entity, ManyToOne, PrimaryKey, Property, Ref } from '@mikro-orm/postgresql';
import SimpleUser from './SimpleUser.entity';

@Entity({ tableName: 'simple_user_spends', schema: 'test_schema' })
export default class SimpleUserSpend {
  @PrimaryKey({ columnType: 'uuid' })
  id!: string;

  @ManyToOne(() => SimpleUser, { fieldName: 'simple_user_id' })
  user!: Ref<SimpleUser>;

  @Property({ columnType: 'numeric' })
  spend!: number;

  @Property({ columnType: 'integer' })
  month!: number;
}
