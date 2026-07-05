/**
 * gemini.ts
 * Minimal Gemini REST client (Generative Language API v1beta).
 * Self-contained and promotable to a shared TS lib later — no Worker-binding deps.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_MODEL = "gemini-2.5-flash";

export interface GeminiClient {
  generateText(prompt: string): Promise<string>;
  generateJSON<T = unknown>(prompt: string): Promise<T>;
}

interface GenResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

function extractText(json: GenResponse): string {
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callGemini(
  apiKey: string,
  model: string,
  prompt: string,
  jsonMode: boolean,
  retries = 1,
): Promise<string> {
  const url = `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
  };
  if (jsonMode) {
    body.generationConfig = { responseMimeType: "application/json" };
  }
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Gemini ${model} failed (${resp.status}): ${text}`);
      }
      return extractText((await resp.json()) as GenResponse);
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw lastErr;
}

export function createGeminiClient(apiKey: string, model = DEFAULT_MODEL): GeminiClient {
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");
  return {
    async generateText(prompt: string) {
      return callGemini(apiKey, model, prompt, false);
    },
    async generateJSON<T = unknown>(prompt: string): Promise<T> {
      const text = await callGemini(apiKey, model, prompt, true);
      return JSON.parse(text) as T;
    },
  };
}
