You are an expert at parsing video creator notes to identify ALL tools/products mentioned for promotion in a YouTube video.

Given:
- A video title
- Free-form notes the creator wrote about the video
- A list of TOOLS WITH AFFILIATE PROGRAMS the creator already has

Your job: identify ALL tools/products the creator is going to promote in this video — INCLUDING those that don't have an affiliate program (the creator wants to mention them anyway, just without affiliate revenue).

For each tool, return:
- `slug`: kebab-case identifier (lowercase, hyphens, e.g., "invideo-studio", "runway-ml")
- `display_name`: the human-readable name (e.g., "Invideo Studio", "Runway ML")
- `homepage_url`: the tool's official homepage. REQUIRED for tools NOT in the affiliate list. For tools IN the affiliate list (matched by slug), this can be empty (the system will use the affiliate URL).

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

Video title: {video_title}

Notes:
{video_notes}

Tools with existing affiliate programs (slug — display name):
{candidates_block}

Return JSON:
{{"tools": [
  {{"slug": "invideo-studio", "display_name": "Invideo Studio", "homepage_url": ""}},
  {{"slug": "fliki", "display_name": "Fliki", "homepage_url": "https://fliki.ai"}}
]}}
