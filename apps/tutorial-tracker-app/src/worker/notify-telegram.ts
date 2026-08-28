/** Best-effort Telegram delivery from Worker secrets. */
export interface TelegramEnv { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_CHAT_ID?: string; }
export async function sendTelegram(env: TelegramEnv, text: string): Promise<boolean> {
  const token = env.TELEGRAM_BOT_TOKEN; const chat = env.TELEGRAM_CHAT_ID;
  if (!token || !chat) { console.warn("telegram not configured; message dropped"); return false; }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }) });
    if (!response.ok) console.error("telegram send failed", response.status);
    return response.ok;
  } catch (error) { console.error("telegram send threw", error); return false; }
}
