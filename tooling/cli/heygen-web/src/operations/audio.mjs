import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { call, endpoints } from "../client/endpoints.mjs";
import { BASE, headers, die } from "../client/http.mjs";

export async function fastAsrWithRetry(auth, url, tries = 8, gapMs = 3000) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${BASE}/v1/audio/fast_asr`, {
      method: "POST", headers: headers(auth), body: JSON.stringify({ url }),
    });
    const text = await res.text();
    if (res.status === 403 || /cloudflare|just a moment/i.test(text))
      die(`403 / Cloudflare — session cookie likely expired.\nRecapture a fresh cURL.`);
    let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (res.ok) return json;
    if (res.status === 404 && i < tries - 1) {
      await new Promise((r) => setTimeout(r, gapMs));
      continue;
    }
    die(`HTTP ${res.status} POST /v1/audio/fast_asr\n${text.slice(0, 500)}`);
  }
}

export async function uploadAudio(auth, audioPath) {
  const bytes = readFileSync(audioPath);
  const base = basename(audioPath).replace(/\.[^.]+$/, "");
  const ct = audioPath.toLowerCase().endsWith(".mp3") ? "audio/mpeg" : "audio/wav";

  const presign = await call(auth, endpoints.fileUrlGet, { base, ct });
  const { id: fileId, url: putUrl, download_url } = presign?.data || {};
  if (!fileId || !putUrl) die("file/url.get failed: " + JSON.stringify(presign));

  const put = await fetch(putUrl, {
    method: "PUT",
    headers: { "content-type": ct, "x-amz-server-side-encryption": "AES256" },
    body: bytes,
  });
  if (!put.ok) die(`S3 audio upload failed: HTTP ${put.status}\n${(await put.text()).slice(0, 300)}`);

  const finalize = await call(auth, endpoints.fileUpload, {}, {
    body: { name: `${base}.wav`, id: fileId, file_type: "audio", content_type: ct,
            filename: `${base}.wav`, properties: { audio_source: "voice_recording" } },
  });
  if (!finalize?.data?.id) die("file.upload failed: " + JSON.stringify(finalize));

  const transcodeUrl = `${download_url.replace(/original\.\w+$/, "transcode.mp3")}` +
    `?response-content-disposition=attachment%3B+filename%2A%3DUTF-8%27%27${encodeURIComponent(base)}.mp3%3B`;

  const asr = await fastAsrWithRetry(auth, transcodeUrl);
  const asrData = asr?.data?.data;
  if (!asrData?.words) die("fast_asr failed: " + JSON.stringify(asr));
  return { transcodeUrl, text: asrData.text, words: asrData.words, duration: asrData.duration };
}

export const RESOLUTIONS = {
  landscape: { width: 1920, height: 1080, scale: 0.703125 },
  portrait: { width: 1080, height: 1920, scale: 0.8 },
};
