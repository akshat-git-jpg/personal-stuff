export function checkPool(selections, sectionDurations, usage) {
  // Only Avatar IV selections draw from the pool. III is unlimited.
  // For each IV selection, we don't know the exact seconds until the runner
  // slices. So we UPPER-BOUND by the source section's duration — if all IV
  // selections together fit within seconds_remain, we can start.
  //
  // This is intentionally conservative: sums never exceed reality. The
  // final per-submit meter check (`usage --diff`) is the authoritative gate.
  //
  // Refuse silently downgrading IV to III. If ivSum > poolRemain, we STOP.
  const ivSelections = selections.filter((s) => s.engine === 'heygen4')
  const requestedIvSec = ivSelections.reduce((n, s) => {
    const d = sectionDurations.get(s.section_id) ?? 0
    return n + d
  }, 0)
  const poolRemain = usage?.seconds_remain ?? 0
  const ok = requestedIvSec <= poolRemain
  return {
    ok,
    requestedIvSec,
    poolRemain,
    reason: ok ? null : `Requested ~${requestedIvSec}s of Avatar IV but pool has ${poolRemain}s left. Refusing to submit. Reduce IV selections or wait for next month.`,
  }
}

export function readUsageSnapshot(execFn) {
  const stdout = execFn('node', ['tooling/cli/heygen-web/heygen-web.mjs', 'usage'])
  return JSON.parse(stdout)
}
