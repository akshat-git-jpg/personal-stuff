# YouTube description link swaps — DONE 2026-08-28

Every published video on Agrollo Reviews now points at `go.agrolloo.com`.
This started life as a manual checklist and was executed via the YouTube Data
API instead. Kept as the record of what changed and how to undo it.

## Result

| | |
|---|---|
| Videos edited | **65** of 68 |
| Description links swapped | **97** |
| Localized description links swapped | **161** |
| Old `agrolloo.com` links remaining | **0** |
| Short links live and returning 302 | **105** |
| Views now covered by click tracking | **170,839** (was ~55k across 3 videos) |

Before this, 3 of 68 videos sent clicks to the redirector. Now all of them do.

## Backup — how to undo any of it

`/Users/kbtg/yt-description-backups/2026-08-28/`

- `snippets.json` — the complete pre-edit `snippet`, `status` and
  `localizations` of all 68 videos, captured before the first write.
- `texts/<videoId>.txt` — the same, human-readable, one file per video.

A restore must send the WHOLE snippet back (`title`, `description`,
`categoryId`, `tags`, `defaultLanguage`, `defaultAudioLanguage`) because
`videos.update` replaces the part rather than patching it.

## What was verified, not assumed

- **Round-trip proof per description and per localization.** After the swap the
  new links were replaced back with the old ones and the result had to equal the
  original byte for byte. 64/64 passed before any write. A failure would have
  skipped the video rather than guessed.
- **Verified by re-reading each video**, never by trusting the update response —
  the response returns tags in a different order, which produced a false
  mismatch during the write probe.
- **Final audit against the backup**, not against expectations: titles, tags,
  categoryId, languages, localization languages and localization titles all
  compared. Descriptions were compared with every URL blanked, so any text drift
  outside a link would have shown.
- **All 105 short links HEAD-probed** — every one returns 302.

## Three things that went wrong, and what they cost

**1. 269 bot clicks (fixed).** The moment the descriptions saved, crawlers
harvested every new URL: 269 GETs in 622 seconds from 143 IPs but only 9
User-Agents, hitting slugs in exactly the order they were saved, most carrying a
spoofed `referer: https://www.google.com/` and **none** from youtube.com. Real
clicks went 57 -> 326. Deleted (backup:
`backup-bot-clicks-2026-08-28.json` in the job scratch dir) and the redirector
now skips logging for robot User-Agents — see `isRobot` in
`apps/redirector/src/index.ts`. Proven live: a Googlebot-UA GET redirects and
records nothing.

**2. `defaultAudioLanguage` changed on 29 videos** — from unset to `en-US`.
YouTube populated it itself on write; it was not sent. Benign (all values are an
English variant, matching the 39 videos that already had one, and it helps
YouTube's translated captions), but it IS a metadata change that was not asked
for. Not reverted: unsetting the field is not reliably supported, and the value
is correct.

**3. One video needed a fallback.** `7eOwVMuEsbk` (Book Bolt) rejected the
localizations payload with `400 invalidVideoMetadata` because its Indonesian
localization has **no title**, and YouTube will not accept a localization entry
without one. Rather than invent a title, the snippet was updated alone —
YouTube then propagated the new link into all 8 localizations anyway.

## Two links deliberately left alone

Neither is an old affiliate link, so both are judgement calls rather than misses:

- `nFEp` — a second, non-affiliate `junglescout.com/pricing` link. Pointing it at
  `go.agrolloo.com/nFEp/junglescout` would start earning on those clicks, but it
  changes where the viewer lands (pricing page vs signup).
- `WOAo` — `revolut.com/en-AU`. The Revolut programme is rejected, so there is
  nothing to earn; swapping would only add tracking.

## Still needs the owner

Five programmes' destinations carry no affiliate code, so their clicks are now
tracked but do not pay. Paste the real URL into Links -> Programs; no further
YouTube edit is needed, because the short link is the indirection.

- **filmora** — approved on Impact, so this is live lost revenue
- **hostinger**
- **d-id**
- **lumen5**
- **mailchimp** — its old link carried someone else's Google Ads `gclid`

## Next

- Watch the Tracking links tab: clicks should now appear per video.
- The WordPress Pretty Links are unused. Leave them alive a few weeks in case an
  old description is cached anywhere, then retire them.
- Pretty Links still holds the historical counts (openart 98, bookbolt 47, ...).
  Those were never per-video, so they were not migrated.
