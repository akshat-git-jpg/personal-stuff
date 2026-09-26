// Pure helpers for pp-splitwise: money in paise, equal splits, and ledger-to-Splitwise matching.

export const paise = (v) => Math.round(Number(v) * 100);
export const rupees = (p) => (p / 100).toFixed(2);

/** Split `total` paise into `n` shares that add up exactly; the first shares take the spare paise. */
export function splitEqual(total, n) {
  const base = Math.floor(total / n), extra = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Form fields for create_expense: `payer` pays it all, it is split equally over `members` (ids). */
export function expenseBody({ cost, desc, date, groupId, currency, notes, payer, members }) {
  const total = paise(cost);
  const body = { cost: rupees(total), description: desc, currency_code: currency, group_id: groupId ?? 0 };
  if (date) body.date = `${date}T12:00:00Z`;
  if (notes) body.details = notes;
  const ids = members.includes(payer) ? members : [payer, ...members];
  const shares = splitEqual(total, ids.length);
  ids.forEach((id, i) => {
    body[`users__${i}__user_id`] = id;
    body[`users__${i}__paid_share`] = rupees(id === payer ? total : 0);
    body[`users__${i}__owed_share`] = rupees(shares[i]);
  });
  return body;
}

/** Resolve "Anusha,Rahul" (first name, full name or email, any case) to member ids. */
export function pickMembers(members, names) {
  return names.map((n) => {
    const k = n.trim().toLowerCase();
    const hits = members.filter((m) => [m.first_name, `${m.first_name} ${m.last_name ?? ""}`.trim(), m.email]
      .some((x) => (x ?? "").toLowerCase() === k));
    if (hits.length !== 1) throw new Error(`"${n}" matches ${hits.length} members of the group`);
    return hits[0].id;
  });
}

/**
 * Payments with no Splitwise expense yet. A payment is on Splitwise when an expense has the
 * same cost (±₹1) within `days` days. Each expense covers one payment only.
 */
export function missing(payments, expenses, days = 3) {
  const day = (s) => Date.parse(s.slice(0, 10)) / 864e5;
  const free = expenses.filter((e) => !e.deleted_at).map((e) => ({ d: day(e.date), c: paise(e.cost) }));
  const out = [];
  for (const p of [...payments].sort((a, b) => a.date.localeCompare(b.date))) {
    const c = paise(Math.abs(p.amount)), d = day(p.date);
    const i = free.findIndex((e) => Math.abs(e.c - c) <= 100 && Math.abs(e.d - d) <= days);
    if (i >= 0) free.splice(i, 1);
    else out.push(p);
  }
  return out;
}
