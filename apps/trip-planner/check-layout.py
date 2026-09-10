#!/usr/bin/env python3
"""Build a file:// layout harness for the trip-planner PWA and measure it.

Why this shape:
- Headless Chrome ignores --window-size for the layout viewport here, so the
  page is loaded inside an iframe of an exact pixel width. The iframe gives
  the inner document a real viewport of that width.
- localhost is blocked in this sandbox, so no proxy. Instead the live HTML is
  saved to disk and its `fetch` is stubbed to return the real trip JSON, which
  is downloaded once up front. The CSS and markup stay byte-identical to
  production, which is the part being tested.

Run:  python3 build_harness.py            # builds, measures, prints problems
"""
import html
import json
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(os.environ.get("TMPDIR", "/tmp")) / "trip-planner-layout"
HERE.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get("TRIP_PLANNER_URL", "https://trips.agrolloo.com")
SLUG = "varkala-sep-2026"
WIDTHS = [320, 360, 390, 430]
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

MEASURE = r"""
<script>
window.__measure = function(){
  const ids=['hud','top','search-wrap','chips','sheets','card','places','route',
             'plan','plan-head','plan-body'];
  const out={viewport:{w:innerWidth,h:innerHeight},els:{},chips:[],problems:[]};
  for(const id of ids){
    const el=document.getElementById(id);
    if(!el){out.els[id]=null;continue;}
    const r=el.getBoundingClientRect();
    out.els[id]={x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),
                 right:Math.round(r.right),bottom:Math.round(r.bottom),hidden:!!el.hidden,
                 scrollW:el.scrollWidth,clientW:el.clientWidth};
  }
  document.querySelectorAll('#chips .chip').forEach(c=>{
    const r=c.getBoundingClientRect();
    out.chips.push({t:c.textContent.trim(),x:Math.round(r.x),right:Math.round(r.right),
                    visible:r.left>=-0.5 && r.right<=innerWidth+0.5});
  });
  // Any control that pokes out past either edge of the screen.
  document.querySelectorAll('#hud button,#hud select,#hud input,#hud .chip,#sheets button,#sheets a').forEach(el=>{
    const r=el.getBoundingClientRect();
    if(r.width===0) return;
    if(r.right>innerWidth+0.5||r.left<-0.5)
      out.problems.push('OVERFLOW '+(el.id||el.className||el.tagName)+' ['+el.textContent.trim().slice(0,14)+'] left='+Math.round(r.left)+' right='+Math.round(r.right)+' vw='+innerWidth);
  });
  // Rows that must never sit on top of each other.
  for(const [a,b] of [['top','search-wrap'],['search-wrap','chips'],['top','chips']]){
    const A=out.els[a],B=out.els[b];
    if(!A||!B) continue;
    const ov=Math.min(A.bottom,B.bottom)-Math.max(A.y,B.y);
    if(ov>1) out.problems.push('OVERLAP '+a+'/'+b+' by '+Math.round(ov)+'px');
  }
  // The HUD must not swallow the whole screen.
  const hud=out.els['hud'];
  if(hud && hud.h > innerHeight*0.35) out.problems.push('HUD too tall: '+hud.h+'px of '+innerHeight);
  // Open sheets must fit on screen and not collide with the HUD.
  const sh=out.els['sheets'];
  if(sh && sh.h>0 && hud && sh.y < hud.bottom) out.problems.push('OVERLAP hud/sheets');
  // A sheet whose content is wider than the sheet itself scrolls sideways,
  // which on a phone reads as broken. Caught the Places filter input.
  document.querySelectorAll('#sheets .sheet').forEach(el=>{
    if(el.hidden) return;
    if(el.scrollWidth > el.clientWidth + 0.5)
      out.problems.push('HSCROLL '+el.id+' content='+el.scrollWidth+' box='+el.clientWidth);
  });
  // Plan view: nothing may sit outside the screen and no block may scroll
  // sideways. Its day rows are a CSS grid, which is exactly where one long
  // unbroken word widens the whole track instead of wrapping.
  const plan=document.getElementById('plan');
  if(plan && !plan.hidden){
    if(plan.scrollWidth > plan.clientWidth + 0.5)
      out.problems.push('HSCROLL plan content='+plan.scrollWidth+' box='+plan.clientWidth);
    plan.querySelectorAll('button,a,.pstop,.pdoc,.pdl,.pflag').forEach(el=>{
      const r=el.getBoundingClientRect();
      if(r.width===0) return;
      if(r.right>innerWidth+0.5||r.left<-0.5)
        out.problems.push('OVERFLOW plan '+(el.id||el.className)+' ['+el.textContent.trim().slice(0,14)+'] left='+Math.round(r.left)+' right='+Math.round(r.right)+' vw='+innerWidth);
    });
    // An empty plan means the render broke, which no box measurement catches.
    if(!plan.querySelectorAll('.pstop').length)
      out.problems.push('PLAN EMPTY: no day rows rendered');
  }
  const attr=document.querySelector('.maplibregl-ctrl-attrib');
  if(attr){const r=attr.getBoundingClientRect();
    if(r.right>innerWidth+0.5) out.problems.push('OVERFLOW attribution right='+Math.round(r.right));}
  return out;
};
</script>
"""


def stub(index_json: str, trip_json: str, mode: str) -> str:
    """Replace fetch with canned responses, then drive the page into `mode`.

    Modes: 'map' (nothing open), 'sheets' (route + places + a pin card all
    open at once), 'plan' (the Plan view open over the map).
    """
    extra = ""
    if mode == "plan":
        # Open the second view the way a thumb does, once the pins exist so the
        # trip JSON has certainly been applied.
        extra = """
  window.__opened=false;
  (function waitPins(n){
    n=n||0;
    if(document.querySelectorAll('.pin').length){
      document.getElementById('plan-btn').click();
      window.__opened=true;
      return;
    }
    if(n>60) { window.__opened=true; return; }
    setTimeout(function(){waitPins(n+1)},200);
  })();
"""
    if mode == "sheets":
        # Worst case for the bottom stack: route panel open AND a pin card open
        # AND the places list open. Driven by real clicks so it exercises the
        # same code path a thumb would.
        extra = """
  window.__opened=false;
  (function waitPins(n){
    n=n||0;
    var m=document.querySelectorAll('.pin');
    if(m.length){
      document.getElementById('route-btn').click();
      m[0].click();
      document.getElementById('places-btn').click();
      m[1] && m[1].click();
      window.__opened=true;
      return;
    }
    if(n>60) { window.__opened=true; return; }
    setTimeout(function(){waitPins(n+1)},200);
  })();
"""
    return f"""
<script>
(function(){{
  const INDEX={index_json};
  const TRIP={trip_json};
  const real=window.fetch;
  window.fetch=function(u,o){{
    const s=String(u);
    const body = s.indexOf('/api/trips/')>=0 && s.indexOf('{SLUG}')>=0 ? TRIP
               : s.indexOf('/api/trips')>=0 ? INDEX : null;
    if(body===null) return real(u,o);
    return Promise.resolve(new Response(JSON.stringify(body),
      {{status:200,headers:{{'content-type':'application/json'}}}}));
  }};
  // Geolocation never resolves in headless; stub it so the code path runs.
  if(navigator.geolocation) navigator.geolocation.getCurrentPosition=function(cb){{
    cb({{coords:{{latitude:8.7307,longitude:76.7105,accuracy:20}}}});
  }};
{extra}
}})();
</script>
"""


def fetch(url: str) -> str:
    r = subprocess.run(["curl", "-sS", url], capture_output=True, timeout=60)
    if r.returncode != 0:
        raise SystemExit(f"curl failed for {url}: {r.stderr.decode()[:200]}")
    return r.stdout.decode("utf-8")


def build(mode: str) -> Path:
    page = fetch(f"{BASE}/")
    index_json = fetch(f"{BASE}/api/trips")
    trip_json = fetch(f"{BASE}/api/trips/{SLUG}")
    json.loads(index_json), json.loads(trip_json)  # fail loudly on bad JSON
    inner = page.replace("</head>", MEASURE + stub(index_json, trip_json, mode) + "</head>", 1)
    name = f"inner_{mode}.html"
    (HERE / name).write_text(inner, encoding="utf-8")
    return HERE / name


def outer(inner: Path, w: int) -> Path:
    p = HERE / f"outer_{w}_{inner.stem}.html"
    p.write_text(f"""<!doctype html><meta charset=utf-8>
<style>html,body{{margin:0;background:#222}}iframe{{border:0;display:block}}</style>
<iframe id="f" src="{inner.name}" style="width:{w}px;height:844px"></iframe>
<script>
(function poll(n){{
  n=n||0;
  var win=document.getElementById('f').contentWindow;
  var ready = win && win.__measure && win.document.querySelectorAll('#chips .chip').length
             && (win.__opened===undefined || win.__opened===true);
  if(ready){{
    var pre=document.createElement('pre');pre.id='__measure';
    pre.textContent=JSON.stringify(win.__measure());
    document.body.appendChild(pre);return;
  }}
  if(n>70){{var e=document.createElement('pre');e.id='__measure';
    e.textContent=JSON.stringify({{error:'timeout'}});document.body.appendChild(e);return;}}
  setTimeout(function(){{poll(n+1)}},200);
}})();
</script>""", encoding="utf-8")
    return p


def measure(page: Path) -> dict | None:
    r = subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--enable-unsafe-swiftshader",
         "--use-gl=angle", "--use-angle=swiftshader", "--hide-scrollbars", "--no-sandbox",
         "--allow-file-access-from-files", "--virtual-time-budget=20000",
         "--dump-dom", page.as_uri()],
        capture_output=True, timeout=180,
    )
    m = re.search(r'<pre id="__measure">(.*?)</pre>', r.stdout.decode("utf-8", "replace"), re.S)
    return json.loads(html.unescape(m.group(1))) if m else None


def report(label: str, d: dict | None) -> int:
    print(f"--- {label}")
    if not d or d.get("error"):
        print("    NO MEASUREMENT")
        return 1
    for k, v in d["els"].items():
        if v and v["w"]:
            print(f"    {k:12} y={v['y']:4} h={v['h']:3} w={v['w']:4} right={v['right']:4}"
                  f" scrollW={v['scrollW']:4} clientW={v['clientW']:4}")
    off = [c["t"] for c in d["chips"] if not c["visible"]]
    print(f"    chips: {len(d['chips'])} shown, {len(off)} off-screen" + (f" -> {off}" if off else ""))
    for p in d["problems"]:
        print(f"    PROBLEM: {p}")
    if not d["problems"]:
        print("    PROBLEM: none")
    return len(d["problems"])


MODES = {"map": "map only", "sheets": "sheets open", "plan": "plan open"}


def main() -> int:
    total = 0
    for mode, tag in MODES.items():
        inner = build(mode)
        for w in WIDTHS:
            total += report(f"{w}px, {tag}", measure(outer(inner, w)))
    print(f"\nTOTAL PROBLEMS: {total}")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
