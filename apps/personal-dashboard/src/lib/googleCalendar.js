// Google Calendar integration (read-only).
//
// Two ways to connect, checked in this order:
//   1. SHARED TOKEN FILE (preferred here): env GOOGLE_TOKEN_FILE points at an
//      existing authorized-user token JSON (the personal-stuff google-shared
//      token for kushalbakliwal25). It already carries client_id/secret +
//      refresh_token with calendar scope, so no OAuth consent flow is needed.
//   2. In-app OAuth: tokens stored in the app config row (getAuthUrl/handleCallback).

import { readFileSync, existsSync } from 'node:fs';
import { google } from 'googleapis';
import { getConfig, updateConfig } from '../config.js';
import { todayISO } from './dates.js';

function sharedTokenFile() {
  return process.env.GOOGLE_TOKEN_FILE || '';
}

function hasSharedToken() {
  const f = sharedTokenFile();
  return !!f && existsSync(f);
}

function loadSharedToken() {
  return JSON.parse(readFileSync(sharedTokenFile(), 'utf8'));
}

function oauthCredentials() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  };
}

export function getOAuthClient() {
  // Shared token file mode — build the client straight from the token JSON.
  if (hasSharedToken()) {
    const t = loadSharedToken();
    const client = new google.auth.OAuth2(t.client_id, t.client_secret);
    client.setCredentials({
      refresh_token: t.refresh_token,
      access_token: t.token,
      expiry_date: t.expiry ? Date.parse(t.expiry) : undefined,
    });
    return client;
  }

  // In-app OAuth mode.
  const { clientId, clientSecret, redirectUri } = oauthCredentials();
  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const cfg = getConfig();
  if (cfg.google_tokens) {
    try {
      client.setCredentials(JSON.parse(cfg.google_tokens));
      client.on('tokens', (newTokens) => {
        const existing = cfg.google_tokens ? JSON.parse(cfg.google_tokens) : {};
        updateConfig({ google_tokens: JSON.stringify({ ...existing, ...newTokens }) });
      });
    } catch {
      // Bad stored tokens — ignore; isConnected() will return false.
    }
  }
  return client;
}

export function getAuthUrl() {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.readonly'],
  });
}

export async function handleCallback(code) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  updateConfig({ google_tokens: JSON.stringify(tokens) });
  return tokens;
}

export function isConnected() {
  if (hasSharedToken()) {
    try {
      return !!loadSharedToken().refresh_token;
    } catch {
      return false;
    }
  }
  const cfg = getConfig();
  if (!cfg.google_tokens) return false;
  try {
    const tokens = JSON.parse(cfg.google_tokens);
    return !!(tokens.access_token || tokens.refresh_token);
  } catch {
    return false;
  }
}

export function status() {
  const cfg = getConfig();
  return {
    connected: isConnected(),
    mode: hasSharedToken() ? 'shared-token' : 'oauth',
    account: hasSharedToken() ? safeAccount() : null,
    lastSynced: cfg.calendar_last_synced || null,
  };
}

function safeAccount() {
  try {
    return loadSharedToken().account || null;
  } catch {
    return null;
  }
}

// Compute the UTC instant for a wall-clock time (HH:MM:SS) on a given
// YYYY-MM-DD in an IANA timezone. (IST has no DST, so this is exact for us.)
function wallToUtc(ymd, hms, tz) {
  const guess = new Date(`${ymd}T${hms}Z`); // treat wall time as if UTC
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p = dtf.formatToParts(guess).reduce((a, x) => ((a[x.type] = x.value), a), {});
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour === '24' ? 0 : p.hour, p.minute, p.second);
  const offset = asUTC - guess.getTime();
  return new Date(guess.getTime() - offset);
}

/**
 * getTodayEvents(tz) → [{summary, start, end, allDay}] sorted by start.
 * Returns [] if not connected or on error.
 */
export async function getTodayEvents(tz) {
  if (!isConnected()) return [];

  try {
    const client = getOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth: client });
    const today = todayISO(tz);

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: wallToUtc(today, '00:00:00', tz).toISOString(),
      timeMax: wallToUtc(today, '23:59:59', tz).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });

    const items = res.data.items || [];
    return items.map((ev) => ({
      summary: ev.summary || '(no title)',
      start: ev.start.dateTime || ev.start.date,
      end: ev.end.dateTime || ev.end.date,
      allDay: !!ev.start.date,
    }));
  } catch (err) {
    console.error('[googleCalendar] getTodayEvents error:', err.message);
    return [];
  }
}
