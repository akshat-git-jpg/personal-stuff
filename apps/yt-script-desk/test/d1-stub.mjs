// A tiny in-memory D1 stub. NOT a SQL engine — a hand-rolled matcher over the
// handful of statement shapes src/worker/{auth,db}.ts actually issue: a plain
// SELECT with an equality WHERE (and an optional LIMIT), an upsert INSERT ...
// ON CONFLICT(...) DO UPDATE SET, a single-table UPDATE, and a DELETE. Do not
// pull in a real SQLite dependency for this — see plan 234 step 7.
//
//   const db = createD1Stub()
//   await db.exec(migrationSql)         // registers tables from CREATE TABLE
//   db.seed('videos', [{ key: 'v1', token: '...', ... }])
//   await db.prepare('SELECT ...').bind(x).first()

function normalize(sql) {
  return sql.replace(/\s+/g, ' ').trim()
}

// `col = ?` / `col=?` -> 'col', consuming one bound param per column in order.
function whereColumns(whereClause) {
  return whereClause.split(/\s+AND\s+/i).map((c) => c.replace(/=\s*\?\s*$/, '').trim())
}

export function createD1Stub() {
  const tables = new Map()

  function table(name) {
    if (!tables.has(name)) tables.set(name, [])
    return tables.get(name)
  }

  function parseSelect(sql) {
    const m = sql.match(/^SELECT (.+?) FROM (\w+)(?: WHERE (.+?))?(?: LIMIT (\d+))?$/i)
    if (!m) throw new Error(`d1-stub: unsupported SELECT: ${sql}`)
    return {
      cols: m[1].split(',').map((c) => c.trim()),
      tableName: m[2],
      whereCols: m[3] ? whereColumns(m[3]) : [],
      limit: m[4] ? Number(m[4]) : undefined,
    }
  }

  function projectRow(row, cols) {
    if (cols.length === 1 && cols[0] === '*') return { ...row }
    const out = {}
    for (const c of cols) out[c] = row[c]
    return out
  }

  function execSelect(sql, params) {
    const { cols, tableName, whereCols, limit } = parseSelect(sql)
    let rows = table(tableName).filter((row) => whereCols.every((col, i) => row[col] === params[i]))
    if (limit !== undefined) rows = rows.slice(0, limit)
    return rows.map((row) => projectRow(row, cols))
  }

  function execInsert(sql, params) {
    const m = sql.match(
      /^INSERT INTO (\w+) \((.+?)\) VALUES \((.+?)\)(?: ON CONFLICT\((.+?)\) DO UPDATE SET (.+))?$/i,
    )
    if (!m) throw new Error(`d1-stub: unsupported INSERT: ${sql}`)
    const [, tableName, colsStr, valuesStr, pkColsStr, setClauseStr] = m
    const cols = colsStr.split(',').map((c) => c.trim())
    const placeholders = valuesStr.split(',').map((v) => v.trim())
    let paramIdx = 0
    const values = placeholders.map((ph) => (ph === '?' ? params[paramIdx++] : Number(ph)))
    const newRow = Object.fromEntries(cols.map((c, i) => [c, values[i]]))

    const rows = table(tableName)
    if (pkColsStr) {
      const pkCols = pkColsStr.split(',').map((c) => c.trim())
      const existing = rows.find((r) => pkCols.every((c) => r[c] === newRow[c]))
      if (existing) {
        for (const assignment of setClauseStr.split(',')) {
          const [col, rhs] = assignment.split('=').map((s) => s.trim())
          const excluded = rhs.match(/^excluded\.(\w+)$/i)
          existing[col] = excluded ? newRow[excluded[1]] : rhs
        }
        return
      }
    }
    rows.push(newRow)
  }

  function execUpdate(sql, params) {
    const m = sql.match(/^UPDATE (\w+) SET (.+?) WHERE (.+)$/i)
    if (!m) throw new Error(`d1-stub: unsupported UPDATE: ${sql}`)
    const [, tableName, setStr, whereStr] = m
    let paramIdx = 0
    const setOps = setStr.split(',').map((part) => {
      const [col, rhs] = part.split('=').map((s) => s.trim())
      return { col, value: rhs === '?' ? params[paramIdx++] : Number(rhs) }
    })
    const whereCols = whereColumns(whereStr)
    const whereValues = whereCols.map(() => params[paramIdx++])
    for (const row of table(tableName)) {
      if (whereCols.every((col, i) => row[col] === whereValues[i])) {
        for (const { col, value } of setOps) row[col] = value
      }
    }
  }

  function execDelete(sql, params) {
    const m = sql.match(/^DELETE FROM (\w+) WHERE (.+)$/i)
    if (!m) throw new Error(`d1-stub: unsupported DELETE: ${sql}`)
    const [, tableName, whereStr] = m
    const whereCols = whereColumns(whereStr)
    const remaining = table(tableName).filter((row) => !whereCols.every((col, i) => row[col] === params[i]))
    tables.set(tableName, remaining)
  }

  function execWrite(sql, params) {
    if (/^INSERT/i.test(sql)) return execInsert(sql, params)
    if (/^UPDATE/i.test(sql)) return execUpdate(sql, params)
    if (/^DELETE/i.test(sql)) return execDelete(sql, params)
    throw new Error(`d1-stub: unsupported write: ${sql}`)
  }

  function statement(sql, params) {
    return {
      bind: (...p) => statement(sql, p),
      async first() {
        const rows = execSelect(sql, params)
        return rows[0] ?? null
      },
      async all() {
        return { results: execSelect(sql, params), success: true }
      },
      async run() {
        execWrite(sql, params)
        return { success: true }
      },
    }
  }

  return {
    prepare(sql) {
      return statement(normalize(sql), [])
    },
    // Mirrors D1Database#exec: registers any CREATE TABLE named in `sql` so
    // "does the migration create every table" tests can run against this
    // stub without a real SQLite engine.
    async exec(sql) {
      const stmts = sql
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
      for (const stmt of stmts) {
        const m = stmt.match(/CREATE TABLE(?: IF NOT EXISTS)?\s+(\w+)/i)
        if (m) table(m[1])
      }
      return { count: stmts.length, duration: 0 }
    },
    // Test-only helpers — not part of the D1Database surface.
    seed(tableName, rows) {
      table(tableName).push(...rows.map((r) => ({ ...r })))
    },
    dump(tableName) {
      return table(tableName).map((r) => ({ ...r }))
    },
    tableNames() {
      return [...tables.keys()]
    },
  }
}
