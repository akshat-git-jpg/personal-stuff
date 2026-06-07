// LLM-assisted capture: parse a free-text line into a structured todo.
// Falls back to chrono-node + raw title on ANY failure — capture never blocks.

import * as chrono from 'chrono-node';
import { todayISO } from './dates.js';
import { normalizeTags } from './tags.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function buildTagInstruction(existingTags) {
  const tagList = existingTags && existingTags.length > 0
    ? `Existing tags (prefer reusing these): ${existingTags.join(', ')}.`
    : 'No existing tags yet — invent short ones if appropriate.';
  return `Assign 0–3 short lowercase tags. Reuse an existing tag when it fits; only invent a new short tag if none fit. Tags are like: work, gf, skills, bank, home, health. ${tagList} Return tags as a JSON array of strings.`;
}

function buildSystemPrompt(captureRules, todayStr, tz, existingTags) {
  return `You are a to-do capture parser. Convert the user's single line of input into a structured JSON object.

Today's date is ${todayStr} (timezone: ${tz}). Resolve all relative dates (tomorrow, next Monday, etc.) against this date.

${captureRules ? `## User capture rules\n\n${captureRules}\n\n` : ''}## Tagging
${buildTagInstruction(existingTags)}

## Output format (strict JSON only, no markdown fences, no extra text)

{
  "title": "string — cleaned task title (required)",
  "deadline": "YYYY-MM-DD or null",
  "time_start": "HH:MM (24h) or null",
  "time_end": "HH:MM (24h) or null",
  "area": "string or null",
  "priority": "low | normal | high or null",
  "tags": ["tag1", "tag2"]
}

Rules:
- Respond with ONLY the JSON object. No markdown, no explanation.
- deadline must be YYYY-MM-DD format or null.
- times must be "HH:MM" in 24-hour format or null.
- priority must be exactly "low", "normal", or "high", or null.
- area must be a short lowercase slug (e.g. "home", "zluri", "health") or null.
- tags must be a JSON array of 0–3 lowercase slug strings (e.g. ["work","bank"]) — never null.
- Remove filler words like "remind me to", "don't forget to" from the title.`;
}

// Detect a type from the FIRST WORD so we can route without an LLM classify call.
// No colon needed: "habit drink water", "remember be social", "todo call mom".
// Full words match colon-optional; single letters (t/h/r) require a colon to
// avoid false positives like "t shirt" or "h&m".
const PREFIX_MAP = { todo: 'todo', habit: 'habit', remember: 'remember', rem: 'remember', note: 'note', notes: 'note', t: 'todo', h: 'habit', r: 'remember', n: 'note' };
export function detectPrefix(text) {
  const s = String(text).trim();
  let m = s.match(/^(todo|habit|remember|rem|notes|note)\b[:\-]?\s+(.+)$/is);
  if (m) return { type: PREFIX_MAP[m[1].toLowerCase()], body: m[2].trim() };
  m = s.match(/^(t|h|r|n)\s*[:\-]\s*(.+)$/is);
  if (m) return { type: PREFIX_MAP[m[1].toLowerCase()], body: m[2].trim() };
  return { type: null, body: s };
}

function buildClassifyPrompt(captureRules, todayStr, tz, existingTags) {
  return `You triage a single captured line into one of three types and, for to-dos, extract structured fields.

Today's date is ${todayStr} (timezone: ${tz}). Resolve relative dates against this date.

Types:
- "todo": an actionable task, errand, reminder, or anything with a due time.
- "habit": a recurring thing the user wants to do regularly / keep a streak on (e.g. "drink 4L water every day", "no cigarettes", "gym daily").
- "remember": a mindset note, mantra, or motivational line to resurface (e.g. "be social", "you are the best", "stay patient").

${captureRules ? `## User capture rules (apply to to-dos)\n\n${captureRules}\n\n` : ''}## Tagging
${buildTagInstruction(existingTags)}

## Output (strict JSON only, no markdown fences, no extra text)

{
  "type": "todo | habit | remember",
  "title": "cleaned text (task title, habit name, or the remember line)",
  "deadline": "YYYY-MM-DD or null",
  "time_start": "HH:MM 24h or null",
  "time_end": "HH:MM 24h or null",
  "area": "short lowercase slug or null",
  "priority": "low | normal | high or null",
  "tags": ["tag1", "tag2"]
}

Rules:
- Respond with ONLY the JSON object.
- For habit/remember, set deadline/time/area/priority to null.
- tags must be a JSON array of 0–3 lowercase slug strings — never null.
- Remove filler like "remind me to", "don't forget to" from the title.`;
}

/**
 * classifyCapture(text, {model, key, captureRules, tz, existingTags})
 *   → {type, title, deadline, time_start, time_end, area, priority, tags}
 * One LLM call that classifies AND (for todos) parses. Never throws — on any
 * failure falls back to a todo via chrono.
 */
export async function classifyCapture(text, { model, key, captureRules, tz, existingTags } = {}) {
  const todayStr = todayISO(tz || 'UTC');
  if (!text || !text.trim()) {
    return { type: 'todo', title: '', deadline: null, time_start: null, time_end: null, area: null, priority: null, tags: [] };
  }
  if (!key || !key.trim()) {
    return { type: 'todo', ...chronoFallback(text, tz), tags: [] };
  }
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://personal-dashboard',
      },
      body: JSON.stringify({
        model: model || 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: buildClassifyPrompt(captureRules, todayStr, tz || 'UTC', existingTags || []) },
          { role: 'user', content: text.trim() },
        ],
        temperature: 0,
        max_tokens: 350,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.error('[capture] classify error:', response.status, await response.text());
      return { type: 'todo', ...chronoFallback(text, tz), tags: [] };
    }
    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) return { type: 'todo', ...chronoFallback(text, tz), tags: [] };
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const p = JSON.parse(cleaned);
    const type = ['todo', 'habit', 'remember'].includes(p.type) ? p.type : 'todo';
    const rawTags = Array.isArray(p.tags) ? p.tags : [];
    return {
      type,
      title: p.title || text.trim(),
      deadline: type === 'todo' ? p.deadline || null : null,
      time_start: type === 'todo' ? p.time_start || null : null,
      time_end: type === 'todo' ? p.time_end || null : null,
      area: type === 'todo' ? p.area || null : null,
      priority: type === 'todo' && ['low', 'normal', 'high'].includes(p.priority) ? p.priority : null,
      tags: rawTags,
    };
  } catch (err) {
    console.error('[capture] classify failed, using fallback:', err.message);
    return { type: 'todo', ...chronoFallback(text, tz), tags: [] };
  }
}

function buildHabitPrompt(todayStr, tz, existingTags) {
  return `You convert a captured line into a structured HABIT (a recurring thing to keep a streak on).

Today's date is ${todayStr} (timezone: ${tz}). Resolve durations against this date.

## Tagging
${buildTagInstruction(existingTags)}

## Output (strict JSON only, no markdown fences, no extra text)

{
  "name": "short habit name",
  "weekdays": "comma-separated days 0-6 where 0=Sun..6=Sat (e.g. '1,3,5'); use '0,1,2,3,4,5,6' for daily",
  "mode": "forever | fixed",
  "start_date": "YYYY-MM-DD or null",
  "end_date": "YYYY-MM-DD or null",
  "tags": ["tag1", "tag2"]
}

Rules:
- "daily" / "every day" / no day mentioned => weekdays "0,1,2,3,4,5,6".
- Specific days ("mon wed fri", "weekends", "weekdays") => only those day numbers.
- A duration ("for 30 days", "this month", "in June", "next 2 weeks", "30-day") => mode "fixed", start_date = today (or the stated start), end_date computed accordingly. Otherwise mode "forever" with null dates.
- Strip duration/day words from the name.
- tags must be a JSON array of 0–3 lowercase slug strings — never null.`;
}

/**
 * parseHabit(text, {model, key, tz, existingTags}) → {name, weekdays, mode, start_date, end_date, tags}
 * Never throws. Fallback = daily, forever, name = text, tags = [].
 */
export async function parseHabit(text, { model, key, tz, existingTags } = {}) {
  const todayStr = todayISO(tz || 'UTC');
  const fallback = { name: String(text).trim(), weekdays: '0,1,2,3,4,5,6', mode: 'forever', start_date: null, end_date: null, tags: [] };
  if (!text || !text.trim()) return { ...fallback, name: '' };
  if (!key || !key.trim()) return fallback;
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://personal-dashboard' },
      body: JSON.stringify({
        model: model || 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: buildHabitPrompt(todayStr, tz || 'UTC', existingTags || []) },
          { role: 'user', content: text.trim() },
        ],
        temperature: 0,
        max_tokens: 250,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.error('[capture] parseHabit error:', response.status, await response.text());
      return fallback;
    }
    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) return fallback;
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const p = JSON.parse(cleaned);
    const weekdays = /^[0-6](,[0-6])*$/.test(p.weekdays || '') ? p.weekdays : '0,1,2,3,4,5,6';
    const mode = p.mode === 'fixed' ? 'fixed' : 'forever';
    const rawTags = Array.isArray(p.tags) ? p.tags : [];
    return {
      name: p.name || String(text).trim(),
      weekdays,
      mode,
      start_date: mode === 'fixed' ? p.start_date || todayStr : null,
      end_date: mode === 'fixed' ? p.end_date || null : null,
      tags: rawTags,
    };
  } catch (err) {
    console.error('[capture] parseHabit failed, using fallback:', err.message);
    return fallback;
  }
}

/**
 * parseRemember(text, {model, key, existingTags}) → {text, tags}
 * Distills a rambled thought into a tight, to-the-point line AND assigns tags.
 * Never throws; fallback = {text: trimmed raw, tags: []}.
 */
export async function parseRemember(text, { model, key, existingTags } = {}) {
  const fallbackText = String(text || '').trim();
  if (!fallbackText) return { text: '', tags: [] };
  if (!key || !key.trim()) return { text: fallbackText, tags: [] };
  try {
    const tagInstruction = buildTagInstruction(existingTags || []);
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://personal-dashboard' },
      body: JSON.stringify({
        model: model || 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content:
              `You turn a rambled thought into a single concise "remember" line — a mantra, principle, or reminder to resurface later. Keep the original meaning and voice; cut filler. One short line, no quotes.\n\nAlso assign tags: ${tagInstruction}\n\nRespond as strict JSON only: {"text": "...", "tags": ["tag1"]}`,
          },
          { role: 'user', content: fallbackText },
        ],
        temperature: 0.2,
        max_tokens: 120,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.error('[capture] parseRemember error:', response.status, await response.text());
      return { text: fallbackText, tags: [] };
    }
    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) return { text: fallbackText, tags: [] };
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const p = JSON.parse(cleaned);
    const parsedText = (p.text && String(p.text).trim()) || fallbackText;
    const rawTags = Array.isArray(p.tags) ? p.tags : [];
    return { text: parsedText, tags: rawTags };
  } catch (err) {
    console.error('[capture] parseRemember failed, using fallback:', err.message);
    return { text: fallbackText, tags: [] };
  }
}

function chronoFallback(text, tz) {
  const results = chrono.parse(text, new Date(), { forwardDate: true });
  let deadline = null;
  if (results.length > 0) {
    const d = results[0].start.date();
    deadline = d.toISOString().slice(0, 10);
  }
  const title = text.trim();
  return { title, deadline, time_start: null, time_end: null, area: null, priority: null, tags: [] };
}

/**
 * parseCapture(text, {model, key, captureRules, tz, existingTags})
 *   → {title, deadline, time_start, time_end, area, priority, tags}
 *
 * Never throws. On failure returns at minimum {title: text, ...rest null/[]}.
 */
export async function parseCapture(text, { model, key, captureRules, tz, existingTags } = {}) {
  if (!text || !text.trim()) {
    return { title: '', deadline: null, time_start: null, time_end: null, area: null, priority: null, tags: [] };
  }

  const todayStr = todayISO(tz || 'UTC');

  // No API key — use fallback immediately.
  if (!key || !key.trim()) {
    return chronoFallback(text, tz);
  }

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://personal-dashboard',
      },
      body: JSON.stringify({
        model: model || 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: buildSystemPrompt(captureRules, todayStr, tz || 'UTC', existingTags || []) },
          { role: 'user', content: text.trim() },
        ],
        temperature: 0,
        max_tokens: 350,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error('[capture] OpenRouter error:', response.status, await response.text());
      return chronoFallback(text, tz);
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) return chronoFallback(text, tz);

    // Strip markdown code fences if the model added them despite instructions.
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    const rawTags = Array.isArray(parsed.tags) ? parsed.tags : [];

    return {
      title: parsed.title || text.trim(),
      deadline: parsed.deadline || null,
      time_start: parsed.time_start || null,
      time_end: parsed.time_end || null,
      area: parsed.area || null,
      priority: ['low', 'normal', 'high'].includes(parsed.priority) ? parsed.priority : null,
      tags: rawTags,
    };
  } catch (err) {
    console.error('[capture] parse failed, using fallback:', err.message);
    return chronoFallback(text, tz);
  }
}

/**
 * deriveTags(text, {model, key, captureRules, existingTags})
 *   → string[] of tags (for notes, which are stored verbatim)
 * Non-throwing; returns [] on any failure or no key.
 */
export async function deriveTags(text, { model, key, captureRules, existingTags } = {}) {
  if (!text || !text.trim() || !key || !key.trim()) return [];
  try {
    const tagInstruction = buildTagInstruction(existingTags || []);
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://personal-dashboard',
      },
      body: JSON.stringify({
        model: model || 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `Assign 0–3 short lowercase tags to the given text. ${tagInstruction}${captureRules ? `\n\nContext rules:\n${captureRules}` : ''}\n\nRespond with strict JSON only: {"tags": ["tag1", "tag2"]}`,
          },
          { role: 'user', content: String(text).trim() },
        ],
        temperature: 0,
        max_tokens: 80,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) return [];
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const p = JSON.parse(cleaned);
    return Array.isArray(p.tags) ? p.tags : [];
  } catch {
    return [];
  }
}
