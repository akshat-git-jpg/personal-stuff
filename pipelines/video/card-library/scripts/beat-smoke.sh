#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
BEAT_CARDS=$(node -e "require('./catalog.json').cards.filter(c=>c.kind==='beat').forEach(c=>console.log(c.slug))")
[ "$(echo "$BEAT_CARDS" | wc -l | tr -d ' ')" = "28" ]
# Per-field catalog rules live in check-catalog.mjs (single authority) — this
# script's older inline copy predated beat_source "variables" and wrongly
# required beat_shape/max_reveal_chars on every beat card (stale since 48
# cards; found 2026-07-31 when the count gate finally tripped).
node -e "
const fs=require('fs');const c=require('./catalog.json');
if(c.cards.length!==66)throw new Error('want 66 cards, got '+c.cards.length);
for(const card of c.cards){
  if(!fs.existsSync(card.slug+'/index.html'))throw new Error('missing dir: '+card.slug);
}
"
node scripts/check-catalog.mjs
for c in $BEAT_CARDS; do npx hyperframes@latest lint "$c"; done
TMP=$(mktemp -d)
npx hyperframes@latest render pros-cons/pros-cons \
  --variables '{"title":"Smoke","beats":[{"kind":"pro","text":"A","at":0.5},{"kind":"con","text":"B","at":2.5}]}' \
  -o "$TMP/smoke.mp4" --fps 30 --quality draft --quiet
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/smoke.mp4")
node -e "if(Math.abs(parseFloat('$DUR')-6)>0.15)throw new Error('duration '+'$DUR')"
rm -rf "$TMP"
echo "beat-smoke OK"
