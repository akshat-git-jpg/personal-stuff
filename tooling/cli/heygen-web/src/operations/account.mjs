import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { call, endpoints } from "../client/endpoints.mjs";
import { USAGE_SNAP } from "../client/http.mjs";

export async function limits(auth) {
  const r = await call(auth, endpoints.videoGenerateLimits);
  const d = r.data || {};
  console.log(JSON.stringify(d, null, 2));
  if (d.unit === "second")
    console.error(`\n→ used ${d.total_consumed}s of ${d.total_limit}s this month — ` +
      `${d.remain}s (~${(d.remain/60).toFixed(1)} min) left. hit_limit=${d.is_hit_monthly_limit}`);
}

export async function usageSnapshot(auth) {
  const lim = (await call(auth, endpoints.videoGenerateLimits))?.data || {};
  const pri = (await call(auth, endpoints.monthlyPriorityCount))?.data || {};
  const ai = (await call(auth, endpoints.aiGenerateElementLimits))?.data || {};
  let credits = null;
  try { credits = (await call(auth, endpoints.migrateToCreditCheck, {}, { body: {} }))?.data?.current_credits; } catch {}
  return {
    ts: new Date().toISOString(),
    credits,
    seconds_consumed: lim.total_consumed,
    seconds_limit: lim.total_limit,
    seconds_remain: lim.remain,
    free_credit_remain: lim.remain_from_free_credit,
    priority_count: pri.count,
    priority_limit: pri.limit,
    ai_image_credits: ai.available_image_credits,
    ai_video_credits: ai.available_video_credits,
    ai_concept_credits: ai.available_concept_engine_credits,
  };
}

export function printUsage(s) {
  console.error(`credits=${s.credits}  seconds=${s.seconds_consumed}/${s.seconds_limit}` +
    `  priority=${s.priority_count}/${s.priority_limit}` +
    `  ai(img/vid/concept)=${s.ai_image_credits}/${s.ai_video_credits}/${s.ai_concept_credits}`);
}

export function diffUsage(prev, cur) {
  const keys = ["credits", "seconds_consumed", "priority_count",
    "ai_image_credits", "ai_video_credits", "ai_concept_credits"];
  const d = Object.fromEntries(keys.map((k) => [k, (cur[k] ?? 0) - (prev[k] ?? 0)]));
  const sign = (n) => (n >= 0 ? "+" : "") + n;
  const spent = d.credits !== 0 || d.seconds_consumed !== 0 ||
    d.ai_image_credits < 0 || d.ai_video_credits < 0 || d.ai_concept_credits < 0;
  console.error(`Δ since ${prev.ts}:`);
  console.error(`  credits ${sign(d.credits)}  seconds ${sign(d.seconds_consumed)}` +
    `  priority ${sign(d.priority_count)}` +
    `  ai img ${sign(d.ai_image_credits)}/vid ${sign(d.ai_video_credits)}/concept ${sign(d.ai_concept_credits)}`);
  console.error(spent
    ? "⚠️  NOT free — a credit/second meter moved. This op is metered."
    : "✓ UNLIMITED confirmed — no credits, seconds, or AI-element credits consumed." +
      (d.priority_count > 0 ? ` (priority slot used: +${d.priority_count}/100 — free, queue only)` : ""));
}

export async function usage(auth, args) {
  const cur = await usageSnapshot(auth);
  console.log(JSON.stringify(cur, null, 2));
  printUsage(cur);
  if (args.includes("--diff") && existsSync(USAGE_SNAP))
    diffUsage(JSON.parse(readFileSync(USAGE_SNAP, "utf8")), cur);
  if (args.includes("--save")) {
    writeFileSync(USAGE_SNAP, JSON.stringify(cur, null, 2));
    console.error(`→ baseline saved to ${USAGE_SNAP}`);
  }
}
