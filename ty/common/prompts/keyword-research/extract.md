You are extracting structured metadata from a single YouTube video's title + description. The viewer is a creator researching which softwares competitors are getting paid to promote — so they can pick which ones to cover in affiliate-driven videos of their own. Precision on the affiliate signal matters more than recall.

Return JSON only, matching the schema:

- `softwares`: every distinct software/tool/SaaS/AI product/platform mentioned by name. Use canonical product names (e.g., "Higgsfield" not "higgsfield.ai"). Skip generic concepts ("AI", "automation", "no-code"). If none, return an empty array. This list is for completeness — include free tools, productivity apps, anything that's a named software.

- `affiliated_softwares`: a STRICT SUBSET of `softwares` — only the ones the creator is being paid (or compensated in some form) to promote. Look for these signals in the description:
    - **Affiliate-link URL signatures** in description URLs: `?fpr=`, `?ref=`, `?via=`, `?aff=`, `?affid=`, `?affiliate=`, `?partner=`, `?partner_id=`, `?fp_sid=`, `?utm_source=youtube_creator`, `?invite=`, `?source=youtube&affiliate=`. Examples that count: `https://higgsfield.ai?fpr=ai&fp_sid=thomas9`, `https://elevenlabs.io/?via=alfie`.
    - **Explicit affiliate language**: "my affiliate link", "use my link", "partner link", "click below to support the channel", "affiliate disclosure".
    - **Sponsorship language**: "sponsored by X", "this video is sponsored by X", "thanks to X for sponsoring".
    - **Discount / promo code tied to a software**: "use code THOMAS9 for 20% off [SoftwareName]", "get 10% off with my link below".

  Hard rules:
    - Generic free tools (Google Docs, Slack, Telegram, Discord, Instagram, Facebook, Twitter, YouTube itself, Apple/Google/Microsoft built-ins, generic browser extensions) are almost never affiliated. Only include them if there is an explicit affiliate or sponsor signal — not just because they're mentioned.
    - A software being mentioned ≠ being affiliate-promoted. Only include if you see one of the signals above.
    - If a description has zero affiliate links and no sponsor mention, return an empty array even if many softwares are mentioned.
    - When in doubt, exclude.

- `summary`: a single sentence (≤ 25 words), plain language, describing what the video is actually about. Match the vibe of the title. Don't editorialize. Don't start with "This video".

- `topics`: 1–3 short topic tags (2–4 words each, lowercase) describing what the video is about. Choose tags broad enough to cluster across channels (e.g., "ai image gen", "n8n self hosting", "youtube monetization") but specific enough to be useful (avoid bare "ai" or "tutorial").

Return only the JSON object — no commentary, no markdown fences.

---

VIDEO TITLE:
{title}

VIDEO DESCRIPTION:
{description}
