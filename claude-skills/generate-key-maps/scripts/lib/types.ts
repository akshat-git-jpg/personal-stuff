export type ColumnType =
  | 'uuid'
  | 'uuid[]'
  | 'varchar'
  | 'character varying'
  | 'string'
  | 'boolean'
  | 'integer'
  | 'timestamptz'
  | 'timestamp with time zone'
  | 'numeric'
  | 'jsonb'
  | string; // tolerant fallback for org-defined enum types like 'user_status'

export interface Column {
  name: string;
  columnType: ColumnType;
  nullable: boolean;
  hasDefault: boolean;
}

export type RelationKind = 'ManyToOne' | 'OneToMany' | 'OneToOne';

export interface Relation {
  kind: RelationKind;
  /** Class name of the related entity, e.g. 'OrgDepartment'. */
  targetClass: string;
  /** Foreign-key column name on this entity (set for ManyToOne and the FK-owning side of OneToOne). */
  fieldName?: string;
  /** Inverse-side property name (only set for OneToMany). */
  mappedBy?: string;
  nullable: boolean;
}

export interface EntityModel {
  className: string;
  filePath: string;
  tableName: string;
  schema?: string;
  primaryKey: string;
  columns: Column[];
  relations: Relation[];
}

export interface FrontendField {
  field_id: string;
  field_name?: string;
  field_type?: string;
  filter_type?: string;
  entity?: string;
  group_name?: string;
}

export interface FrontendModel {
  fields: FrontendField[];
  filePath: string;
}

export interface RelationGraph {
  root: EntityModel;
  /** Map keyed by tableName (NOT className) for FK-driven lookup. */
  entitiesByTable: Map<string, EntityModel>;
  /** Map keyed by className for relation-target lookup. */
  entitiesByClass: Map<string, EntityModel>;
  edges: Array<{
    fromTable: string;
    toTable: string;
    viaFieldName: string;
    kind: RelationKind;
  }>;
}

export type QueryType = 'local' | 'foreign' | 'aggregated' | 'custom';

export type Cast =
  | 'varchar'
  | 'integer'
  | 'boolean'
  | 'objectId'
  | 'uuid'
  | 'uuid[]'
  | 'TEXT[]'
  | 'TIMESTAMP WITH TIME ZONE'
  | 'numeric(20,4)'
  | string;

export interface PlannedKeyMapEntry {
  field_id: string;
  query_type: QueryType;
  logical_group: string; // 'local' for local fields, otherwise the joins-key
  as: string;
  cast?: Cast;
  // local
  local_field?: string;
  // foreign
  foreign_field?: string;
  // aggregated
  group_operation?: string;
  grouped_on?: string;
  time_period?: string;
  default_value?: string | number | boolean;
  field_is_array?: boolean;
  // custom
  function_name?: string; // import name in functions/<name>.ts
}

export interface PlannedJoin {
  logical_group: string;
  local_table: string;
  local_field: string;
  foreign_table: string;
  foreign_field: string;
  materialized?: boolean;
  join_type?: string;
}

export interface CustomFnPlan {
  /** filename / function name, e.g. 'managed_user_app_count' */
  name: string;
  /** Natural-language brief from the developer, or null for a TODO scaffold. */
  brief: string | null;
  /** Tables reachable from the relation graph that this function may need. */
  reachable: string[];
  /** Default cast used by the scaffold's NULL placeholder. */
  defaultCast: Cast;
  /** Suggested semantics (used in the // comment for scaffold path). */
  semanticsHint?: string;
}

export interface ApprovedPlan {
  mainTable: string;
  schema: string;
  entityShortName: string; // e.g. 'user' for 'org_users'
  outputDir: string;       // absolute path
  keyMap: PlannedKeyMapEntry[];
  joins: PlannedJoin[];
  customFunctions: CustomFnPlan[];
}
