import fs from 'node:fs';
import path from 'node:path';
import { parseEntity } from './parse-entity.ts';
import type { EntityModel, RelationGraph, RelationKind } from './lib/types.ts';

/**
 * Find the entity file whose class is `className` somewhere under `searchDir`.
 * Tries common filename variants because dashboard-api is inconsistent about
 * singular vs plural and import-name vs class-name (e.g. OrgVendors.entity.ts
 * is imported as OrgVendor; OrgIntegration.entity.ts declares
 * `class OrgIntegrations`).
 *
 * Variants tried, in order:
 *   1. `${className}.entity.ts`         (exact match)
 *   2. `${className}s.entity.ts`        (singular → plural)
 *   3. `${className-without-trailing-s}.entity.ts`  (plural → singular)
 *
 * The search is recursive but bounded — we skip node_modules/dist/dotfiles.
 */
function findEntityFileByClass(searchDir: string, className: string): string | null {
  const candidates = new Set<string>([
    `${className}.entity.ts`,
    `${className}s.entity.ts`,
  ]);
  if (className.endsWith('s')) {
    candidates.add(`${className.slice(0, -1)}.entity.ts`);
  }
  const stack = [searchDir];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
        stack.push(full);
      } else if (e.isFile() && candidates.has(e.name)) {
        return full;
      }
    }
  }
  return null;
}

/**
 * Find reverse children of the root entity. Two paths:
 *
 *   1. **Decorated FK** — any entity (anywhere under searchDir) whose
 *      @ManyToOne or @OneToOne explicitly targets the root class.
 *
 *   2. **Co-located heuristic** — any entity in the SAME DIRECTORY as the
 *      root that mentions a column matching the root's tableName (with
 *      common variants like `org_costcenter_id` ↔ `org_cost_center_id`).
 *      This catches metric/child tables whose FK is declared as a plain
 *      @Property or @PrimaryKey rather than a relation decorator
 *      (e.g. `OrgCostCenterSpend.org_costcenter_id`).
 *
 * Each match returns `{ entity, fkColumn }` — fkColumn is the column on
 * the child that points back at the root.
 */
function findReverseChildren(
  searchDir: string,
  rootEntity: EntityModel,
): Array<{ entity: EntityModel; fkColumn: string }> {
  const parentClassName = rootEntity.className;
  const rootDir = path.dirname(rootEntity.filePath);

  // Generate a small set of plausible FK column names for the root.
  // tableName 'org_cost_centers' → fk candidates:
  //   'org_cost_centers_id', 'org_cost_center_id', 'org_costcenter_id',
  //   'cost_center_id', 'costcenter_id', plus the de-pluralised forms.
  const rootFkCandidates = generateRootFkCandidates(rootEntity.tableName);

  const found: Array<{ entity: EntityModel; fkColumn: string }> = [];
  const seenClasses = new Set<string>([parentClassName]);

  function collect(file: string, allowCoLocated: boolean): void {
    let model: EntityModel;
    try {
      model = parseEntity(file);
    } catch {
      return;
    }
    if (seenClasses.has(model.className)) return;

    // Path 1: decorated FK
    const decoratedRel = model.relations.find(
      (rel) =>
        (rel.kind === 'ManyToOne' || rel.kind === 'OneToOne') &&
        rel.targetClass === parentClassName,
    );
    if (decoratedRel) {
      seenClasses.add(model.className);
      found.push({ entity: model, fkColumn: decoratedRel.fieldName ?? '' });
      return;
    }

    // Path 2: co-located undecorated FK column. Only honor for entities in
    // the same directory as the root — too aggressive otherwise.
    if (allowCoLocated) {
      const fkCol = model.columns.find((c) => rootFkCandidates.has(c.name));
      if (fkCol) {
        seenClasses.add(model.className);
        found.push({ entity: model, fkColumn: fkCol.name });
      }
    }
  }

  // Walk the whole searchDir for decorated FKs. Track which directories
  // are inside rootDir for the co-located heuristic.
  const stack = [searchDir];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    const inRootDir = dir === rootDir;
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
        stack.push(full);
      } else if (e.isFile() && e.name.endsWith('.entity.ts')) {
        collect(full, inRootDir);
      }
    }
  }
  return found;
}

/**
 * Build the set of plausible FK column names for a root tableName. Handles
 * the snake-case / squashed-name variants seen in the dashboard-api codebase
 * — e.g. `org_cost_centers` → all of `org_cost_centers_id`, `org_cost_center_id`,
 * `org_costcenter_id`, `cost_centers_id`, `cost_center_id`, `costcenter_id`.
 *
 * The squashing only collapses underscores in the entity-name segments
 * (after the optional leading `org_`), preserving the structural prefix.
 */
function generateRootFkCandidates(tableName: string): Set<string> {
  const out = new Set<string>();

  /** Collapse internal underscores after an optional `org_` prefix. */
  const squash = (name: string): string => {
    if (name.startsWith('org_')) return 'org_' + name.slice(4).replace(/_/g, '');
    return name.replace(/_/g, '');
  };

  const variants = new Set<string>([tableName, squash(tableName)]);
  // Singularised forms (drop trailing 's')
  if (tableName.endsWith('s')) {
    const singular = tableName.slice(0, -1);
    variants.add(singular);
    variants.add(squash(singular));
  }
  // Short variants (drop the leading `org_`)
  for (const v of [...variants]) {
    if (v.startsWith('org_')) variants.add(v.slice(4));
  }
  for (const v of variants) {
    out.add(`${v}_id`);
  }
  return out;
}

export function buildRelationGraph(root: EntityModel, searchDir: string): RelationGraph {
  const entitiesByTable = new Map<string, EntityModel>();
  const entitiesByClass = new Map<string, EntityModel>();
  const edges: RelationGraph['edges'] = [];

  entitiesByTable.set(root.tableName, root);
  entitiesByClass.set(root.className, root);

  // Process a queue of entities, loading each related target exactly once
  // and emitting one edge per relation. Used by both the forward walk and
  // the post-reverse-discovery pass so reverse-discovered children get
  // their own outgoing relations turned into edges too.
  const queue: EntityModel[] = [root];
  const visited = new Set<string>([root.className]);

  function processEntity(current: EntityModel): void {
    for (const rel of current.relations) {
      if (!rel.targetClass) continue;
      // OneToMany is the inverse side (uses mappedBy). ManyToOne and
      // OneToOne both own a FK column (use fieldName).
      const fieldName =
        rel.kind === 'OneToMany' ? rel.mappedBy ?? '' : rel.fieldName ?? '';

      // Resolve target entity, loading it if we haven't seen it yet.
      let target = entitiesByClass.get(rel.targetClass);
      if (!target && !visited.has(rel.targetClass)) {
        visited.add(rel.targetClass);
        const filePath = findEntityFileByClass(searchDir, rel.targetClass);
        if (filePath) {
          target = parseEntity(filePath);
          entitiesByClass.set(target.className, target);
          entitiesByTable.set(target.tableName, target);
          // Also alias under the import-name we used to find this entity,
          // so later relations referring to the same target by that name
          // resolve correctly. Handles the case where filename / import
          // name / class declaration disagree.
          if (rel.targetClass !== target.className) {
            entitiesByClass.set(rel.targetClass, target);
          }
          queue.push(target);
        }
      }

      if (target) {
        edges.push({
          fromTable: current.tableName,
          toTable: target.tableName,
          viaFieldName: fieldName,
          kind: rel.kind as RelationKind,
        });
      }
    }
  }

  // Forward walk from the root.
  while (queue.length) processEntity(queue.shift()!);

  // Reverse-children pass: pull in entities that FK back to the root.
  // Two sources: explicit @ManyToOne/@OneToOne targeting root, plus
  // co-located entities with an undecorated FK column. Emit synthetic
  // OneToMany edges from root to each, then process each child so its
  // own outgoing relations become edges (and any new targets get loaded).
  for (const { entity: child, fkColumn } of findReverseChildren(searchDir, root)) {
    if (entitiesByClass.has(child.className)) continue;
    entitiesByClass.set(child.className, child);
    entitiesByTable.set(child.tableName, child);
    visited.add(child.className);
    edges.push({
      fromTable: root.tableName,
      toTable: child.tableName,
      viaFieldName: fkColumn,
      kind: 'OneToMany',
    });
    queue.push(child);
  }

  // Walk reverse-children's outgoing relations (and any newly discovered
  // targets recursively).
  while (queue.length) processEntity(queue.shift()!);

  return { root, entitiesByTable, entitiesByClass, edges };
}

export function expandGraph(graph: RelationGraph, additionalEntityClass: string): RelationGraph {
  if (graph.entitiesByClass.has(additionalEntityClass)) return graph;

  const searchDir = path.dirname(graph.root.filePath);
  const filePath = findEntityFileByClass(searchDir, additionalEntityClass);
  if (!filePath) return graph;

  const added = parseEntity(filePath);
  graph.entitiesByClass.set(added.className, added);
  graph.entitiesByTable.set(added.tableName, added);

  for (const rel of added.relations) {
    if (!rel.targetClass) continue;
    const target = graph.entitiesByClass.get(rel.targetClass);
    if (target) {
      graph.edges.push({
        fromTable: added.tableName,
        toTable: target.tableName,
        viaFieldName:
          rel.kind === 'ManyToOne' ? rel.fieldName ?? '' : rel.mappedBy ?? '',
        kind: rel.kind,
      });
    }
  }
  return graph;
}

/**
 * Convert a RelationGraph to a JSON-serializable shape. Maps don't survive
 * JSON.stringify, so we flatten entitiesByClass into an array. Root and edges
 * pass through unchanged.
 */
export function serializeGraph(graph: RelationGraph): {
  root: EntityModel;
  entities: EntityModel[];
  edges: RelationGraph['edges'];
} {
  return {
    root: graph.root,
    entities: Array.from(graph.entitiesByClass.values()),
    edges: graph.edges,
  };
}

/**
 * Render the graph as a human-readable ASCII tree. One block per entity:
 * the class name, table name, and outgoing edges. Root entity comes first;
 * remaining entities follow in graph-discovery order. Self-references show
 * `(self)` next to the target.
 */
export function renderGraphTree(graph: RelationGraph): string {
  const lines: string[] = [];
  const entities = Array.from(graph.entitiesByClass.values());

  // Pull root to the front, then preserve discovery order for the rest.
  const ordered = [graph.root, ...entities.filter((e) => e !== graph.root)];

  for (const entity of ordered) {
    lines.push(`${entity.className} (${entity.tableName})`);
    const outgoing = graph.edges.filter((e) => e.fromTable === entity.tableName);
    if (outgoing.length === 0) {
      lines.push('  (no outgoing relations)');
    } else {
      outgoing.forEach((edge, i) => {
        const isLast = i === outgoing.length - 1;
        const branch = isLast ? '└─' : '├─';
        const targetEntity = graph.entitiesByTable.get(edge.toTable);
        const targetLabel = targetEntity
          ? `${targetEntity.className} (${edge.toTable})`
          : edge.toTable;
        const isSelf = edge.fromTable === edge.toTable;
        const selfMark = isSelf ? ' (self)' : '';
        lines.push(`  ${branch}[${edge.viaFieldName}] ──(${edge.kind})──► ${targetLabel}${selfMark}`);
      });
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

if (process.argv[1] && process.argv[1].endsWith('build-relation-graph.ts')) {
  // CLI: takes <entity-path> <search-dir> [--format=json|tree]
  // Default format is json (matches other helpers' output style).
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const flags = Object.fromEntries(
    args.filter((a) => a.startsWith('--')).map((a) => {
      const [k, v = 'true'] = a.replace(/^--/, '').split('=');
      return [k, v];
    }),
  );

  const [entityPath, searchDir] = positional;
  if (!entityPath || !searchDir) {
    console.error('usage: build-relation-graph.ts <entity-path> <search-dir> [--format=json|tree]');
    process.exit(1);
  }

  const root = parseEntity(entityPath);
  const graph = buildRelationGraph(root, searchDir);

  if (flags.format === 'tree') {
    process.stdout.write(renderGraphTree(graph));
  } else {
    process.stdout.write(JSON.stringify(serializeGraph(graph), null, 2) + '\n');
  }
}
