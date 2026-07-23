import type { Env } from "./types";

export async function notifyCapHit(env: Env, slug: string, id: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: `tutorial-vo: ${slug}/${id} hit the TTS take cap (4)`,
      }),
    });
  } catch (e) {
    // swallow errors
  }
}
