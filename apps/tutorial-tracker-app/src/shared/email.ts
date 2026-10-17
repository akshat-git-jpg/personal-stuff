// Email check shared by the Team form and /api/team. Catches malformed addresses
// and near-misses of common providers ("gamail.com"), which can never log in.

const COMMON = ["gmail", "yahoo", "hotmail", "outlook", "icloud"];
// Real providers whose name sits one or two letters from a common one.
const REAL_LOOKALIKES = new Set(["mail.com", "email.com", "gmx.com", "ymail.com", "rocketmail.com"]);
// What ".com" turns into under a slipped finger.
const COM_TYPOS = new Set(["con", "cm", "om", "co", "comm", "cpm", "vom", "xom", "c0m"]);

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
  if (REAL_LOOKALIKES.has(domain)) return null;
  const [name, ...rest] = domain.split(".");
  const tld = rest.join(".");
  // Only .com is guessed at: yahoo.de, hotmail.fr and co. are real.
  if (COMMON.includes(name)) return COM_TYPOS.has(tld) ? `Check the spelling: did you mean @${name}.com?` : null;
  const near = tld === "com" ? COMMON.find((c) => distance(name, c) <= 2) : undefined;
  return near ? `Check the spelling: did you mean @${near}.com?` : null;
}
