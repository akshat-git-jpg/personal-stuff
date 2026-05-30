/**
 * notify.ts
 * Best-effort Gmail notifications for the Tutorials Tracker.
 *
 * All public functions are fire-and-forget safe: errors are caught and
 * console.warn'd — they NEVER propagate to the caller so a failed email
 * never breaks a user action.
 */

// (no imports from google-jwt needed — using inline btoa encoding below)

// ---------------------------------------------------------------------------
// Env subset (only the Gmail-related fields)
// ---------------------------------------------------------------------------

export interface NotifyEnv {
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
  GMAIL_REFRESH_TOKEN?: string;
  GMAIL_SENDER_EMAIL?: string;
  NOTIFY_REDIRECT?: string;
  APP_URL?: string;
}

// ---------------------------------------------------------------------------
// Gmail token cache (module-level, one per Worker isolate)
// ---------------------------------------------------------------------------

interface GmailTokenCache {
  accessToken: string;
  expiresAt: number; // ms epoch
}

let _gmailTokenCache: GmailTokenCache | null = null;

export async function getGmailToken(env: NotifyEnv): Promise<string> {
  const now = Date.now();
  if (_gmailTokenCache && _gmailTokenCache.expiresAt - now > 60_000) {
    return _gmailTokenCache.accessToken;
  }

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     env.GMAIL_CLIENT_ID ?? "",
      client_secret: env.GMAIL_CLIENT_SECRET ?? "",
      refresh_token: env.GMAIL_REFRESH_TOKEN ?? "",
      grant_type:    "refresh_token",
    }).toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gmail token refresh failed (${resp.status}): ${text}`);
  }

  const json = (await resp.json()) as { access_token: string; expires_in: number };
  _gmailTokenCache = {
    accessToken: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };
  return _gmailTokenCache.accessToken;
}

// ---------------------------------------------------------------------------
// base64url encode a UTF-8 string (for RFC-822 raw message)
// ---------------------------------------------------------------------------

function base64urlFromString(str: string): string {
  // TextEncoder → Uint8Array → base64url via the helper in google-jwt
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// sendEmail — best-effort
// ---------------------------------------------------------------------------

export async function sendEmail(
  env: NotifyEnv,
  opts: { to: string; subject: string; text: string },
): Promise<void> {
  if (!env.GMAIL_REFRESH_TOKEN) return; // not configured — silent no-op

  try {
    const token = await getGmailToken(env);

    const redirect = env.NOTIFY_REDIRECT ?? "";
    const recipient = redirect || opts.to;
    const subject =
      redirect && redirect !== opts.to
        ? `[→ ${opts.to}] ${opts.subject}`
        : opts.subject;

    const lines = [
      `From: Tutorials Tracker <${env.GMAIL_SENDER_EMAIL ?? ""}>`,
      `To: ${recipient}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      opts.text,
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

    if (!sendResp.ok) {
      const text = await sendResp.text();
      console.warn(`[notify] Gmail send failed (${sendResp.status}): ${text}`);
    }
  } catch (err) {
    console.warn("[notify] sendEmail error:", err);
  }
}

// ---------------------------------------------------------------------------
// notify — thin public wrapper
// ---------------------------------------------------------------------------

export async function notify(
  env: NotifyEnv,
  opts: { to: string; subject: string; text: string },
): Promise<void> {
  await sendEmail(env, opts);
}
