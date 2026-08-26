import { scanFlags } from "./flags.mjs";

export function deriveSpoken(displayText, respellMap = {}) {
  const flags = scanFlags(displayText);
  if (flags.length > 0) {
    throw new Error("Cannot derive spoken text: input contains flag markers");
  }

  let text = displayText;
  const keys = Object.keys(respellMap).sort((a, b) => b.length - a.length);

  for (const key of keys) {
    const value = respellMap[key];
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedKey}\\b`, 'g');
    text = text.replace(regex, value);
  }

  return text;
}
