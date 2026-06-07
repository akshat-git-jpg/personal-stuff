// Timezone-aware date helpers. We store dates as YYYY-MM-DD strings and
// datetimes as ISO. "Today" is computed in the user's configured timezone.

// Returns YYYY-MM-DD for "now" in the given IANA timezone.
export function todayISO(tz) {
  return ymdInTz(new Date(), tz);
}

// Format any Date as YYYY-MM-DD in the given timezone.
export function ymdInTz(date, tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year').value;
  const m = parts.find((p) => p.type === 'month').value;
  const d = parts.find((p) => p.type === 'day').value;
  return `${y}-${m}-${d}`;
}

// Weekday 0-6 (0=Sun..6=Sat) for "today" in tz.
export function weekdayInTz(tz, date = new Date()) {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

// Extract the date portion (YYYY-MM-DD) from a stored deadline (date or datetime).
export function datePart(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

// Is the deadline strictly before today (overdue)? Equal-to-today is NOT overdue.
export function isOverdue(deadline, tz) {
  const d = datePart(deadline);
  if (!d) return false;
  return d < todayISO(tz);
}

// Add N days to a YYYY-MM-DD string, returning YYYY-MM-DD.
export function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// Add N months to a YYYY-MM-DD string (clamps to end of month).
export function addMonths(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(d, lastDay));
  return base.toISOString().slice(0, 10);
}

// All YYYY-MM-DD between start and end inclusive.
export function datesBetween(startYmd, endYmd) {
  const out = [];
  let cur = startYmd;
  while (cur <= endYmd) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}
