import type { D1Database, R2Bucket, Fetcher } from "@cloudflare/workers-types";

export type Env = {
  DB: D1Database;
  AUDIO: R2Bucket;
  ASSETS: Fetcher;
  ADMIN_TOKEN: string;
  LINK_SECRET: string;
  MODAL_TTS_URL: string;
  MODAL_TTS_TOKEN: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
};

export type SectionRow = {
  slug: string;
  id: string;
  version: number;
  demo: number;
  spoken_text: string;
  takes_used: number;
  locked: number;
  take_key: string | null;
  updated_at: string;
};

export type PublishBody = {
  script: any;
  drive_url?: string;
};
