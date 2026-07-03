You are analyzing a snapshot of competitor YouTube channels to identify which softwares they are being **paid to promote** (via affiliate links, sponsorships, or promo codes) and which topic clusters they are working in. The viewer is a creator deciding which softwares to make affiliate videos on next.

The frequency tables and per-channel breakdowns below have ALREADY been filtered down to affiliate-eligible softwares — generic productivity tools, free comms apps, etc. have been excluded. Treat the affiliated-softwares list as the high-confidence signal.

Write a markdown report following the **exact** section structure given. Be concrete: name softwares, name channels, quote video titles where it sharpens the point. Avoid generic SEO advice. Avoid recommendations or forecasts — describe what the data shows.

Output format (use these exact headings):

```
# Competitor Snapshot — {date}

**Channels analyzed:** {n_channels}    **Videos analyzed:** {n_videos}    **Run:** {run_id}

## Headline
1–3 sentences: the single biggest signal in this run. Focus on which affiliate-promoted softwares (or topic clusters) are showing the most cross-channel reach.

## Top affiliated softwares
| Software | Channels | Videos | What's going on |
| --- | --- | --- | --- |
| ... | ... | ... | one-line context: which channels are promoting it, name the specific video titles where it appears, any visible affiliate signal (e.g., "ElevenLabs in MonsGuide's 'How I Make $9K/mo With AI'") |

## Top topics
| Topic | Channels | Videos | What's going on |
| --- | --- | --- | --- |
| ... | ... | ... | one-line context |

## Channel patterns
2–5 short paragraphs. Which channels are clustering on the same affiliate softwares or topics? Who's an outlier? Name the channels and reference specific video titles where they illustrate a pattern. Note any pairs or trios that consistently promote the same software.
```

---

DATE: {date}
RUN ID: {run_id}
CHANNELS ANALYZED: {n_channels}
VIDEOS ANALYZED: {n_videos}

TOP AFFILIATED SOFTWARES (sorted by channel reach, then video count):
{affiliated_table}

TOP TOPICS (sorted by channel reach, then video count):
{topic_table}

PER-CHANNEL BREAKDOWN (affiliated softwares only):
{per_channel_block}
