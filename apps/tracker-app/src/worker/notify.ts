/**
 * notify.ts
 * Best-effort email notifications for the Tutorials Tracker, sent via Resend.
 *
 * All public functions are fire-and-forget safe: errors are caught and
 * console.warn'd — they NEVER propagate to the caller so a failed email
 * never breaks a user action.
 */

// ---------------------------------------------------------------------------
// Env subset (Resend-related fields)
// ---------------------------------------------------------------------------

export interface NotifyEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;        // e.g. "Tutorials Tracker <noreply@notifications.agrolloo.com>"
  NOTIFY_REDIRECT?: string;    // dev/test: route all mail to one address
  APP_URL?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "Tutorials Tracker <onboarding@resend.dev>";

// ---------------------------------------------------------------------------
// sendEmail — best-effort
// ---------------------------------------------------------------------------

export async function sendEmail(
  env: NotifyEnv,
  opts: { to: string; subject: string; text: string },
): Promise<void> {
  if (!env.RESEND_API_KEY) return; // not configured — silent no-op
  if (!opts.to) return;

  try {
    const redirect = env.NOTIFY_REDIRECT ?? "";
    const recipient = redirect || opts.to;
    const subject =
      redirect && redirect !== opts.to
        ? `[→ ${opts.to}] ${opts.subject}`
        : opts.subject;

    const resp = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM || DEFAULT_FROM,
        to: recipient,
        subject,
        text: opts.text,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.warn(`[notify] Resend send failed (${resp.status}): ${text}`);
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
