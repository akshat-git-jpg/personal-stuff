// VPS watchdog Worker.
//
// Cron (every 2 min): probe the dashboard. If it fails FAIL_THRESHOLD checks in a
// row, the origin VPS is considered hung — reboot it via the Hostinger API, then
// hold off for COOLDOWN_SECONDS so we don't reboot-loop while it boots back up.
//
// GET /?secret=STATUS_SECRET        → JSON status (what it knows, last event)
// GET /?secret=STATUS_SECRET&dry=1  → run the probe now and report verdict
//                                     WITHOUT rebooting (safe to test)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One probe of the target. Up = HTTP 2xx/3xx from the origin. A hung VPS behind
// Cloudflare surfaces as 52x (or a fetch error), both treated as down.
async function probe(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      cf: { cacheTtl: 0 },
      signal: AbortSignal.timeout(10000),
    });
    const up = res.status < 500; // 2xx/3xx/4xx = server answered; 5xx/52x = down
    return { up, status: res.status };
  } catch (err) {
    return { up: false, status: 0, error: String(err) };
  }
}

// Probe up to `threshold` times (short gaps) — confirm a real outage, not a blip.
async function confirmDown(url, threshold) {
  const attempts = [];
  for (let i = 0; i < threshold; i++) {
    if (i > 0) await sleep(5000);
    const r = await probe(url);
    attempts.push(r);
    if (r.up) return { down: false, attempts }; // any success → not down
  }
  return { down: true, attempts };
}

async function rebootVps(token, vpsId) {
  const res = await fetch(
    `https://developers.hostinger.com/api/vps/v1/virtual-machines/${vpsId}/restart`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  const body = await res.text();
  return { ok: res.ok, status: res.status, body: body.slice(0, 500) };
}

// Fire-and-forget Telegram alert. A reboot the owner never hears about is
// indistinguishable from a healthy day — this closes that gap.
async function sendTelegram(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // alerting must never break the watchdog itself
  }
}

async function runCheck(env, { dryRun = false } = {}) {
  const threshold = parseInt(env.FAIL_THRESHOLD || '3', 10);
  const cooldown = parseInt(env.COOLDOWN_SECONDS || '900', 10);
  const now = Math.floor(Date.now() / 1000);

  const { down, attempts } = await confirmDown(env.TARGET_URL, threshold);
  const result = { ts: now, target: env.TARGET_URL, down, attempts, action: 'none' };

  if (!down) {
    await env.WATCHDOG_KV.put('last_status', JSON.stringify(result));
    return result;
  }

  // Origin is down. Respect cooldown so a rebooting box isn't hit again mid-boot.
  const lastReboot = parseInt((await env.WATCHDOG_KV.get('last_reboot')) || '0', 10);
  const sinceReboot = now - lastReboot;
  if (sinceReboot < cooldown) {
    result.action = 'cooldown';
    result.cooldown_remaining = cooldown - sinceReboot;
    await env.WATCHDOG_KV.put('last_status', JSON.stringify(result));
    return result;
  }

  if (dryRun) {
    result.action = 'would_reboot';
    return result;
  }

  const reboot = await rebootVps(env.HOSTINGER_API_TOKEN, env.VPS_ID);
  result.action = reboot.ok ? 'rebooted' : 'reboot_failed';
  result.reboot = reboot;
  await sendTelegram(
    env,
    `🐕 vps-watchdog: ${reboot.ok ? 'REBOOTED the VPS' : `reboot FAILED (Hostinger API ${reboot.status})`} — ${env.TARGET_URL} failed ${threshold} consecutive probes.`
  );
  if (reboot.ok) await env.WATCHDOG_KV.put('last_reboot', String(now));
  await env.WATCHDOG_KV.put('last_status', JSON.stringify(result));
  await env.WATCHDOG_KV.put(`event:${now}`, JSON.stringify(result), {
    expirationTtl: 60 * 60 * 24 * 30,
  });
  return result;
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCheck(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.searchParams.get('secret') !== env.STATUS_SECRET) {
      return new Response('forbidden', { status: 403 });
    }
    if (url.searchParams.get('dry') === '1') {
      const r = await runCheck(env, { dryRun: true });
      return Response.json(r);
    }
    const last = await env.WATCHDOG_KV.get('last_status');
    const lastReboot = await env.WATCHDOG_KV.get('last_reboot');
    return Response.json({
      target: env.TARGET_URL,
      vps_id: env.VPS_ID,
      fail_threshold: env.FAIL_THRESHOLD,
      cooldown_seconds: env.COOLDOWN_SECONDS,
      last_reboot_epoch: lastReboot ? parseInt(lastReboot, 10) : null,
      last_status: last ? JSON.parse(last) : null,
    });
  },
};
