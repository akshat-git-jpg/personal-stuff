import { describe, it, expect } from 'vitest';
import {
  buildRelationGraph,
  expandGraph,
  renderGraphTree,
  serializeGraph,
} from '../build-relation-graph.ts';
import { parseEntity } from '../parse-entity.ts';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, 'fixtures');

describe('buildRelationGraph', () => {
  it('starts from the root entity and lazily includes targets reachable via @ManyToOne and @OneToOne', () => {
    const root = parseEntity(path.join(fixtureDir, 'SimpleUser.entity.ts'));
    const graph = buildRelationGraph(root, fixtureDir);

    expect(graph.entitiesByTable.has('simple_users')).toBe(true);
    expect(graph.entitiesByTable.has('simple_departments')).toBe(true);

    const edgeTables = graph.edges.map((e) => `${e.fromTable}->${e.toTable}:${e.viaFieldName}`);
    expect(edgeTables).toContain('simple_users->simple_departments:org_dept_id');
    expect(edgeTables).toContain('simple_users->simple_users:owner_id');
    // OneToOne with fieldName: primary_dept_id must produce its own edge.
    expect(edgeTables).toContain('simple_users->simple_departments:primary_dept_id');
  });

  it('discovers reverse children with decorated @ManyToOne back to root', () => {
    const root = parseEntity(path.join(fixtureDir, 'SimpleUser.entity.ts'));
    const graph = buildRelationGraph(root, fixtureDir);

    // SimpleUserSpend FKs to SimpleUser via @ManyToOne, but SimpleUser does
    // NOT declare a @OneToMany pointing back. The reverse-scan pass picks
    // it up via the decorated-FK path.
    expect(graph.entitiesByClass.has('SimpleUserSpend')).toBe(true);
    expect(graph.entitiesByTable.has('simple_user_spends')).toBe(true);

    const edges = graph.edges.filter(
      (e) => e.fromTable === 'simple_users' && e.toTable === 'simple_user_spends',
    );
    expect(edges).toHaveLength(1);
    expect(edges[0].kind).toBe('OneToMany'); // synthetic inverse edge
    expect(edges[0].viaFieldName).toBe('simple_user_id');
  });

  it('walks the outgoing relations of reverse-discovered children too', () => {
    // After being added via the reverse pass, SimpleUserSpend's own
    // @ManyToOne(() => SimpleUser) should also produce an edge — otherwise
    // the rendered tree shows "no outgoing relations" even though the
    // entity file declares them.
    const root = parseEntity(path.join(fixtureDir, 'SimpleUser.entity.ts'));
    const graph = buildRelationGraph(root, fixtureDir);

    const back = graph.edges.filter(
      (e) =>
        e.fromTable === 'simple_user_spends' &&
        e.toTable === 'simple_users' &&
        e.kind === 'ManyToOne',
    );
    expect(back).toHaveLength(1);
    expect(back[0].viaFieldName).toBe('simple_user_id');
  });

  it('discovers reverse children with UNDECORATED FK columns when co-located with the root', () => {
    const root = parseEntity(path.join(fixtureDir, 'SimpleUser.entity.ts'));
    const graph = buildRelationGraph(root, fixtureDir);

    // SimpleUserAuditLog has a `simple_user_id` uuid Property column but no
    // @ManyToOne decorator. Because it lives in the same fixtures directory
    // as SimpleUser, the co-located heuristic should still discover it.
    expect(graph.entitiesByClass.has('SimpleUserAuditLog')).toBe(true);
    expect(graph.entitiesByTable.has('simple_user_audit_logs')).toBe(true);

    const edges = graph.edges.filter(
      (e) => e.fromTable === 'simple_users' && e.toTable === 'simple_user_audit_logs',
    );
    expect(edges).toHaveLength(1);
    expect(edges[0].kind).toBe('OneToMany');
    expect(edges[0].viaFieldName).toBe('simple_user_id');
  });

  it('expandGraph is a no-op for entities already in the graph', () => {
    const root = parseEntity(path.join(fixtureDir, 'SimpleUser.entity.ts'));
    let graph = buildRelationGraph(root, fixtureDir);
    const sizeBefore = graph.entitiesByClass.size;

    graph = expandGraph(graph, 'SimpleDepartment');
    expect(graph.entitiesByClass.size).toBe(sizeBefore);
  });
});

describe('serializeGraph', () => {
  it('flattens entitiesByClass into an array and survives JSON round-trip', () => {
    const root = parseEntity(path.join(fixtureDir, 'SimpleUser.entity.ts'));
    const graph = buildRelationGraph(root, fixtureDir);

    const serialized = serializeGraph(graph);
    expect(serialized.root.className).toBe('SimpleUser');
    // After reverse-discovery the graph has 4 classes:
    //   SimpleUser (root), SimpleDepartment (forward FK target),
    //   SimpleUserSpend (decorated reverse child),
    //   SimpleUserAuditLog (co-located undecorated reverse child).
    const classNames = serialized.entities.map((e) => e.className).sort();
    expect(classNames).toEqual([
      'SimpleDepartment',
      'SimpleUser',
      'SimpleUserAuditLog',
      'SimpleUserSpend',
    ]);

    // Round-trip survives JSON.stringify/parse — the original Maps would not.
    const roundTripped = JSON.parse(JSON.stringify(serialized));
    expect(roundTripped.entities).toHaveLength(serialized.entities.length);
    expect(roundTripped.edges).toEqual(graph.edges);
  });
});

describe('renderGraphTree', () => {
  it('renders the root first with its outgoing edges and labels self-references', () => {
    const root = parseEntity(path.join(fixtureDir, 'SimpleUser.entity.ts'));
    const graph = buildRelationGraph(root, fixtureDir);
    const out = renderGraphTree(graph);

    // Root header
    expect(out).toContain('SimpleUser (simple_users)');
    // Has outgoing edges shown with branch chars and field names
    expect(out).toMatch(/\[org_dept_id\].*ManyToOne.*SimpleDepartment/);
    // Self-reference is marked
    expect(out).toMatch(/\[owner_id\].*SimpleUser.*\(self\)/);
    // Leaf entity gets the no-outgoing-relations note
    expect(out).toContain('SimpleDepartment (simple_departments)');
    expect(out).toContain('(no outgoing relations)');
  });
});
