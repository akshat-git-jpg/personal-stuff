// Loose types for the plain-JS d1-stub.mjs, just enough for the worker tests
// to type-check. The stub is a test-only fake; it does not implement the
// full @cloudflare/workers-types D1Database surface, so callers cast to
// D1Database at the boundary where production code expects one.
export function createD1Stub(): D1StubDatabase

export interface D1StubDatabase {
  prepare(sql: string): D1StubStatement
  exec(sql: string): Promise<{ count: number; duration: number }>
  seed(tableName: string, rows: Record<string, unknown>[]): void
  dump(tableName: string): Record<string, unknown>[]
  tableNames(): string[]
}

export interface D1StubStatement {
  bind(...params: unknown[]): D1StubStatement
  first<T = unknown>(): Promise<T | null>
  all<T = unknown>(): Promise<{ results: T[]; success: boolean }>
  run(): Promise<{ success: boolean }>
}
