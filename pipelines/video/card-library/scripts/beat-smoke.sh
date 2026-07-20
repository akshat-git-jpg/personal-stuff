#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
BEAT_CARDS=$(node -e "require('./catalog.json').cards.filter(c=>c.kind==='beat').forEach(c=>console.log(c.slug))")
[ "$(echo "$BEAT_CARDS" | wc -l | tr -d ' ')" = "15" ]
node -e "
const fs=require('fs');const c=require('./catalog.json');
if(c.cards.length!==47)throw new Error('want 47 cards, got '+c.cards.length);
for(const card of c.cards){
  if(!fs.existsSync(card.slug+'/index.html'))throw new Error('missing dir: '+card.slug);
  if(!['beat','single'].includes(card.kind))throw new Error('bad kind: '+card.slug);
  if(!['fullframe','overlay'].includes(card.placement))throw new Error('bad placement: '+card.slug);
  if(card.kind==='beat'&&!card.beat_shape)throw new Error('beat card missing beat_shape: '+card.slug);
  if(card.kind==='beat'&&!(card.max_beats>0))throw new Error('beat card missing max_beats: '+card.slug);
  if(card.kind==='beat'&&!(card.max_reveal_chars>0))throw new Error('beat card missing max_reveal_chars: '+card.slug);
  if(typeof card.default_duration!=='number')throw new Error('bad default_duration: '+card.slug);
}
console.log('catalog ok');
"
for c in $BEAT_CARDS; do npx hyperframes@latest lint "$c"; done
TMP=$(mktemp -d)
npx hyperframes@latest render pros-cons/pros-cons \
  --variables '{"title":"Smoke","beats":[{"kind":"pro","text":"A","at":0.5},{"kind":"con","text":"B","at":2.5}]}' \
  -o "$TMP/smoke.mp4" --fps 30 --quality draft --quiet
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/smoke.mp4")
node -e "if(Math.abs(parseFloat('$DUR')-6)>0.15)throw new Error('duration '+'$DUR')"
rm -rf "$TMP"
echo "beat-smoke OK"
