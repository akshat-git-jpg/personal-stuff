/**
 * smoke-notify.ts — smoke test for the Gmail notification logic.
 *
 * Loads Gmail credentials from the gitignored .dev.vars file and sends a
 * single test email using the same logic as src/worker/notify.ts.
 *
 * Run with:   npx tsx scripts/smoke-notify.ts
 *
 * Node 20+ has globalThis.fetch + btoa, so Worker-standard code runs as-is.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEV_VARS_PATH = resolve(__dirname, "../.dev.vars");

// ---------------------------------------------------------------------------
// Parse .dev.vars (KEY=VALUE pairs, one per line, no quotes needed)
// ---------------------------------------------------------------------------

function parseDevVars(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    result[key] = value;
  }
  return result;
}

const vars = parseDevVars(readFileSync(DEV_VARS_PATH, "utf-8"));

const env = {
  GMAIL_CLIENT_ID:     vars.GMAIL_CLIENT_ID ?? "",
  GMAIL_CLIENT_SECRET: vars.GMAIL_CLIENT_SECRET ?? "",
  GMAIL_REFRESH_TOKEN: vars.GMAIL_REFRESH_TOKEN ?? "",
  GMAIL_SENDER_EMAIL:  vars.GMAIL_SENDER_EMAIL ?? "",
  NOTIFY_REDIRECT:     vars.NOTIFY_REDIRECT ?? "",
  APP_URL:             vars.APP_URL ?? "",
};

// ---------------------------------------------------------------------------
// Inline Gmail token + send logic (mirrors src/worker/notify.ts exactly)
// ---------------------------------------------------------------------------

async function getGmailToken(): Promise<string> {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      refresh_token: env.GMAIL_REFRESH_TOKEN,
      grant_type:    "refresh_token",
    }).toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gmail token refresh failed (${resp.status}): ${text}`);
  }

  const json = (await resp.json()) as { access_token: string; expires_in: number };
  return json.access_token;
}

function base64urlFromString(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendEmail(to: string, subject: string, text: string): Promise<{ status: number; id: string }> {
  const token = await getGmailToken();

  const redirect = env.NOTIFY_REDIRECT ?? "";
  const recipient = redirect || to;
  const finalSubject = redirect && redirect !== to ? `[→ ${to}] ${subject}` : subject;

  const lines = [
    `From: Tutorials Tracker <${env.GMAIL_SENDER_EMAIL}>`,
    `To: ${recipient}`,
    `Subject: ${finalSubject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    text,
  ];
  const raw = base64urlFromString(lines.join("\r\n"));

  const sendResp = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );

  const body = (await sendResp.json()) as { id?: string; error?: unknown };
  return { status: sendResp.status, id: body.id ?? "(none)" };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Smoke Test: Gmail Notifications ===\n");

  if (!env.GMAIL_REFRESH_TOKEN) {
    throw new Error("GMAIL_REFRESH_TOKEN not found in .dev.vars");
  }

  console.log(`Sender:    ${env.GMAIL_SENDER_EMAIL}`);
  console.log(`Redirect:  ${env.NOTIFY_REDIRECT || "(none — will send direct)"}`);
  console.log();

  console.log("Sending test email…");
  const { status, id } = await sendEmail(
    "test@example.com",
    "Tracker notify smoke test",
    "This is a smoke test from the Tutorials Tracker notification system.\n\nIf you received this, Gmail notifications are working correctly.",
  );

  console.log(`Gmail API response status: ${status}`);
  console.log(`Message ID: ${id}`);

  if (status !== 200) {
    throw new Error(`Expected status 200, got ${status}`);
  }

  console.log("\n=== SMOKE TEST PASSED ===");
}

main().catch((err) => {
  console.error("\nSMOKE TEST FAILED:", err);
  process.exit(1);
});
