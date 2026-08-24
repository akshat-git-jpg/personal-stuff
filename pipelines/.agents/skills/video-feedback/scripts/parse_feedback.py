#!/usr/bin/env python3
"""Parse the reviewer's exported feedback into structured, actionable notes.
Usage: parse_feedback.py [feedback.txt]   (or pipe the pasted text on stdin)
Feedback lines look like:  [1:23.4] pos 31%,62% — comment text     (pos is optional)
Outputs JSON: [{"t": seconds, "mmss": "1:23.4", "x": 0.31, "y": 0.62, "text": "..."}]"""
import sys, re, json

def secs(mmss):
    m,s=mmss.split(':'); return round(int(m)*60+float(s),2)

def parse(text):
    notes=[]
    # [M:SS.s] [optional: pos X%,Y%] (— or -) comment
    pat=re.compile(r'^\[(\d+:\d+(?:\.\d+)?)\]\s*(?:pos\s+(\d+)%\s*,\s*(\d+)%)?\s*[—-]\s*(.+)$')
    for ln in text.splitlines():
        ln=ln.rstrip()
        m=pat.match(ln.strip())
        if not m: continue
        mmss,x,y,txt=m.groups()
        notes.append({"t":secs(mmss),"mmss":mmss,
                      "x":(int(x)/100 if x else None),"y":(int(y)/100 if y else None),
                      "text":txt.strip()})
    notes.sort(key=lambda n:n["t"])
    return notes

if __name__=="__main__":
    raw=open(sys.argv[1], encoding="utf-8").read() if len(sys.argv)>1 else sys.stdin.read()
    notes=parse(raw)
    print(json.dumps(notes,indent=1,ensure_ascii=False))
    print(f"\n# {len(notes)} notes parsed",file=sys.stderr)
