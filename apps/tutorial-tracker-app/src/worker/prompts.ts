/** Canonical prompt templates (ported from common/prompts/tracker/). */

export function detectToolsPrompt(videoTitle: string, videoNotes: string, candidatesBlock: string): string {
  return `You are an expert at parsing video creator notes to identify ALL tools/products mentioned for promotion in a YouTube video.

Given:
- A video title
- Free-form notes the creator wrote about the video
- A list of TOOLS WITH AFFILIATE PROGRAMS the creator already has

Your job: identify ALL tools/products the creator is going to promote in this video — INCLUDING those that don't have an affiliate program (the creator wants to mention them anyway, just without affiliate revenue).

For each tool, return:
- \`slug\`: kebab-case identifier (lowercase, hyphens, e.g., "invideo-studio", "runway-ml")
- \`display_name\`: the human-readable name (e.g., "Invideo Studio", "Runway ML")
- \`homepage_url\`: the tool's official homepage. REQUIRED for tools NOT in the affiliate list. For tools IN the affiliate list (matched by slug), this can be empty (the system will use the affiliate URL).

Match conservatively — only include tools clearly intended for promotion (mentioned by name, compared, demoed, recommended). Do NOT include tools mentioned only as competitors that the creator is NOT going to link to.

For the slug:
- Lowercase only
- Replace spaces and special chars with hyphens
- Be consistent: if a tool is "Invideo Studio" in display name, slug is "invideo-studio"
- If a tool's slug matches one from the affiliate list below, the system will treat it as affiliate

For the homepage_url:
- Use https:// always
- Use the canonical homepage (e.g., "https://fliki.ai", "https://runwayml.com")
- For affiliate-list tools, leave as empty string ""

---

Video title: ${videoTitle}

Notes:
${videoNotes}

Tools with existing affiliate programs (slug — display name):
${candidatesBlock}

Return JSON:
{"tools": [
  {"slug": "invideo-studio", "display_name": "Invideo Studio", "homepage_url": ""},
  {"slug": "fliki", "display_name": "Fliki", "homepage_url": "https://fliki.ai"}
]}`;
}

export function describePrompt(videoTitle: string, videoNotes: string, linksBlock: string): string {
  return `You are writing the YouTube video description for a creator's affiliate-focused tutorial/comparison video. Generate a clear, engaging description that:

- Opens with a 1-2 line hook summarizing what the video covers
- Lists each tool/product mentioned with the affiliate short URL alongside its name (use the exact short URL provided)
- Mentions any coupon codes inline next to the relevant tool
- Closes with a brief CTA (e.g., "Subscribe for more comparisons", "Drop a comment if you've tried these")
- Sounds like a real creator wrote it — friendly, not corporate

Format the description with line breaks for readability. No hashtags. No emojis unless they fit naturally.

---

Video title: ${videoTitle}

Creator's notes:
${videoNotes}

Tools to feature (link → short URL → coupon if any):
${linksBlock}

Output the description text only. No preamble, no markdown headers, no quoting.`;
}
