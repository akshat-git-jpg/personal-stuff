import type { Env } from "./types";

export async function synthesize(
  env: Env,
  id: string,
  text: string
): Promise<{ ok: true; bytes: ArrayBuffer } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetch(env.MODAL_TTS_URL, {
      method: "POST",
      headers: {
        authorization: "Bearer " + env.MODAL_TTS_TOKEN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ id, text }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown error");
      return { ok: false, status: 502, error: errText };
    }

    const bytes = await res.arrayBuffer();
    return { ok: true, bytes };
  } catch (e: any) {
    return { ok: false, status: 502, error: e.message };
  }
}
