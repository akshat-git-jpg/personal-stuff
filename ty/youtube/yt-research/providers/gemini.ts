import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";
import { AIProvider } from "./types";

const RETRYABLE = [429, 500, 502, 503, 504];
const MAX_ATTEMPTS = 5;

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return RETRYABLE.some((code) => msg.includes(`[${code} `));
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_ATTEMPTS || !isRetryable(err)) break;
      const backoffMs = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s, 16s
      const reason = err instanceof Error ? err.message.split("\n")[0] : String(err);
      console.warn(`  ${label} retry ${attempt}/${MAX_ATTEMPTS - 1} in ${backoffMs / 1000}s — ${reason}`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastErr;
}

export class GeminiProvider implements AIProvider {
  private model: string;
  private client: GoogleGenerativeAI;

  constructor(model: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set in .env");
    this.model = model;
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async complete(system: string, user: string): Promise<string> {
    return withRetry(async () => {
      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: system,
      });
      const result = await model.generateContent(user);
      const text = result.response.text();
      if (!text) throw new Error("Empty response from Gemini");
      return text;
    }, `gemini:${this.model}`);
  }

  async vision(prompt: string, imagePaths: string[]): Promise<string> {
    const model = this.client.getGenerativeModel({ model: this.model });

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: prompt },
    ];

    for (const imgPath of imagePaths) {
      const ext = path.extname(imgPath).toLowerCase();
      const mimeType =
        ext === ".png" ? "image/png" :
        ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
        ext === ".webp" ? "image/webp" :
        "image/png";

      const data = fs.readFileSync(imgPath);
      parts.push({
        inlineData: {
          mimeType,
          data: data.toString("base64"),
        },
      });
    }

    return withRetry(async () => {
      const result = await model.generateContent(parts);
      const text = result.response.text();
      if (!text) throw new Error("Empty vision response from Gemini");
      return text;
    }, `gemini:${this.model} (vision)`);
  }
}
