// Email check shared by the Team form and /api/team. Catches malformed addresses
// and near-misses of common providers ("gamail.com"), which can never log in.

const COMMON = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"];
// Real providers that sit one or two letters from a common one.
const REAL_LOOKALIKES = new Set(["mail.com", "gmx.com", "ymail.com", "yahoo.co.in", "yahoo.in", "outlook.in", "hotmail.co.uk"]);

const SHAPE = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** null when the email looks real; otherwise a sentence saying what is wrong. */
export function emailProblem(raw: string): string | null {
  const email = (raw ?? "").trim().toLowerCase();
  if (!SHAPE.test(email)) return "That doesn't look like an email address.";
  const domain = email.split("@")[1];
  if (COMMON.includes(domain) || REAL_LOOKALIKES.has(domain)) return null;
  const near = COMMON.find((c) => distance(domain, c) <= 2);
  return near ? `Check the spelling: did you mean @${near}?` : null;
}
