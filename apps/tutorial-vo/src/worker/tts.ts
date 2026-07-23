import type { Env } from "./types";

// Modal web endpoints answer synchronously only within ~150s; past that they
// return a 303 chain to a result URL that must be GET-polled. A cold GPU start
// (9.5GB model load) regularly blows the window, and the poll can drop the
// input ("Server has lost track of input"). So: follow the 303 chain manually,
// and on a transient failure re-POST — the retry lands on the now-warm
// container and completes synchronously.
const MAX_ATTEMPTS = 3;
const MAX_REDIRECT_HOPS = 40; // each hop long-polls server-side; bounds total wait

export async function synthesize(
  env: Env,
  id: string,
  text: string
): Promise<{ ok: true; bytes: ArrayBuffer } | { ok: false; status: number; error: string }> {
  let lastError = "unknown error";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      let res = await fetch(env.MODAL_TTS_URL, {
        method: "POST",
        headers: {
          authorization: "Bearer " + env.MODAL_TTS_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({ id, text }),
        redirect: "manual",
      });

      let hops = 0;
      while ((res.status === 303 || res.status === 302) && hops < MAX_REDIRECT_HOPS) {
        const loc = res.headers.get("location");
        if (!loc) break;
        res = await fetch(new URL(loc, env.MODAL_TTS_URL).toString(), { redirect: "manual" });
        hops++;
      }

      if (res.ok) {
        return { ok: true, bytes: await res.arrayBuffer() };
      }

      const errText = await res.text().catch(() => "unknown error");
      // Our own endpoint's rejections are final — retrying won't change them.
      if (res.status === 400 || res.status === 401 || res.status === 503) {
        return { ok: false, status: 502, error: errText };
      }
      lastError = `modal ${res.status}: ${errText}`.slice(0, 300);
    } catch (e: any) {
      lastError = e.message;
    }
  }
  return { ok: false, status: 502, error: lastError };
}
