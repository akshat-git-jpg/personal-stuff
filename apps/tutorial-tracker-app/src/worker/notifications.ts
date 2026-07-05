// ===========================================================================
// NOTIFICATIONS — one table of email templates keyed by event. To add or reword
// a notification, edit a template here; the routes just resolve recipients and
// call sendNotification(). Recipient resolution stays at the call site because
// it needs row/team context (the reviewer vs the assignee vs a new assignee).
// ===========================================================================
import { notify } from "./notify";
import type { Env } from "./auth";

export interface NotifyContext {
  title: string;                // video title
  appUrl: string;               // link back to the tracker
  stageLabel?: string;          // e.g. "Script" — or the role, for "assigned"
  actorName?: string;           // who triggered it (the submitter)
  recipientName?: string;       // the assignee being notified
  feedback?: string;            // send-back note
}

export type NotificationEvent = "submitted" | "assigned" | "approved" | "sentBack";

type Template = (c: NotifyContext) => { subject: string; text: string };

export const NOTIFICATIONS: Record<NotificationEvent, Template> = {
  submitted: (c) => ({
    subject: `🔔 ${c.stageLabel} submitted for review: ${c.title}`,
    text: `${c.actorName} submitted the ${c.stageLabel} for "${c.title}" for your review.\n\nOpen the tracker: ${c.appUrl}`,
  }),
  assigned: (c) => ({
    subject: `📋 You've been assigned: ${c.title}`,
    text: `You've been assigned to "${c.title}" as ${c.stageLabel}.\n\nOpen the tracker: ${c.appUrl}`,
  }),
  approved: (c) => ({
    subject: `✅ Approved: ${c.title}`,
    text: `Hi ${c.recipientName},\n\nYour ${c.stageLabel} for "${c.title}" was approved.\n\n${c.appUrl}`,
  }),
  sentBack: (c) => ({
    subject: `✏️ Changes requested: ${c.title}`,
    text: `Hi ${c.recipientName},\n\nYour ${c.stageLabel} for "${c.title}" needs changes:\n\n"${c.feedback}"\n\nOpen the tracker to revise: ${c.appUrl}`,
  }),
};

/** Render the template for `event` and send to one or more recipients (deduped,
 *  blanks dropped). Best-effort — mirrors notify()'s never-throw contract. */
export async function sendNotification(
  env: Env,
  event: NotificationEvent,
  to: string | string[],
  ctx: NotifyContext,
): Promise<void> {
  const { subject, text } = NOTIFICATIONS[event](ctx);
  const recipients = [...new Set((Array.isArray(to) ? to : [to]).map((t) => t.trim()).filter(Boolean))];
  for (const recipient of recipients) {
    await notify(env, { to: recipient, subject, text });
  }
}
