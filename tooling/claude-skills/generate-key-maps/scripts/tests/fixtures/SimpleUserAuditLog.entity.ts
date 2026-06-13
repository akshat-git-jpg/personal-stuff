/* eslint-disable */
// @ts-nocheck
// Fixture: co-located child whose FK to SimpleUser is declared as a plain
// @PrimaryKey/@Property column, NOT as @ManyToOne. The reverse-discovery
// scan must find it via the column-name heuristic (because the entity
// lives in the same directory as the root).
import { Entity, PrimaryKey, Property } from '@mikro-orm/postgresql';

@Entity({ tableName: 'simple_user_audit_logs', schema: 'test_schema' })
export default class SimpleUserAuditLog {
  @PrimaryKey({ columnType: 'uuid' })
  id!: string;

  // Undecorated FK — name matches `simple_user_id` (root tableName
  // 'simple_users' singularised) but no @ManyToOne decorator.
  @Property({ columnType: 'uuid' })
  simple_user_id!: string;

  @Property({ columnType: 'varchar' })
  action!: string;
}
