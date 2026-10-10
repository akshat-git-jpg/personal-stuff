// Box geometry of a hyperframes composition at chosen times: every visible text box and graphic box, its opacity,
// and whether a short tween is moving it. Measurement only; a recipe decides what the numbers mean.
// Runs the page in hyperframes' own headless Chrome with --dump-dom, so it needs no package.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { HYPERFRAMES, npxArgs, npxSpawnOpts } from './hyperframes.mjs';

let chromePath = process.env.HYPERFRAMES_CHROME || null;
export function hyperframesChrome() {
  if (chromePath) return chromePath;
  const r = spawnSync('npx', npxArgs(['-y', HYPERFRAMES, 'browser', 'path']), npxSpawnOpts({ encoding: 'utf8' }));
  const p = String(r.stdout ?? '').trim().split('\n').pop();
  if (r.status !== 0 || !p || !fs.existsSync(p)) throw new Error(`cannot find hyperframes' Chrome (npx ${HYPERFRAMES} browser path): ${r.stderr}`);
  chromePath = p;
  return p;
}

// Injected into a copy of the page. Seeks the registered timeline and records boxes per time.
function probeSource(times) {
  return `<script>(function(){
var TIMES=${JSON.stringify(times)};
var REVEAL=['opacity','autoAlpha','scale','scaleX','scaleY','clipPath','width','height','text','filter','strokeDashoffset','drawSVG'];
function sel(e){if(e.id)return '#'+e.id;var c=(e.getAttribute('class')||'').trim().split(/\\s+/)[0];return e.tagName.toLowerCase()+(c?'.'+c:'');}
function box(r,R){return {x0:+(r.left-R.left).toFixed(1),y0:+(r.top-R.top).toFixed(1),x1:+(r.right-R.left).toFixed(1),y1:+(r.bottom-R.top).toFixed(1)};}
function opac(e,root){var o=1;for(var n=e;n&&n.nodeType===1;n=n.parentElement){var s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden')return 0;o*=+s.opacity;if(n===root)break;}return +o.toFixed(3);}
function tweens(root){var out=[];var T=window.__timelines||{};var tl=T[root.getAttribute('data-composition-id')]||T[Object.keys(T)[0]];if(!tl)return {tl:null,list:out};
 (function walk(t,off){t.getChildren(false,true,true).forEach(function(c){var st=off+c.startTime();if(c.getChildren)walk(c,st);else out.push({st:st,en:st+c.totalDuration(),targets:c.targets(),props:Object.keys(c.vars||{})});});})(tl,0);
 return {tl:tl,list:out};}
function clips(root,t){root.querySelectorAll('.clip[data-start]').forEach(function(e){var s=+e.getAttribute('data-start'),d=+(e.getAttribute('data-duration')||1e9);e.style.visibility=(t>=s-1e-6&&t<s+d-1e-6)?'':'hidden';});}
function directText(e){for(var n=e.firstChild;n;n=n.nextSibling)if(n.nodeType===3&&n.textContent.trim())return true;return false;}
function textBox(e,R){var rg=document.createRange(),x0=1e9,y0=1e9,x1=-1e9,y1=-1e9,txt='';for(var n=e.firstChild;n;n=n.nextSibling){if(n.nodeType!==3||!n.textContent.trim())continue;txt+=n.textContent;rg.selectNodeContents(n);var rs=rg.getClientRects();for(var i=0;i<rs.length;i++){var r=rs[i];if(r.width<1||r.height<1)continue;x0=Math.min(x0,r.left);y0=Math.min(y0,r.top);x1=Math.max(x1,r.right);y1=Math.max(y1,r.bottom);}}
 if(x1<x0)return null;return {b:box({left:x0,top:y0,right:x1,bottom:y1},R),text:txt.trim().replace(/\\s+/g,' ').slice(0,60)};}
function painted(s){var bg=s.backgroundColor,m=/rgba?\\(([^)]+)\\)/.exec(bg),a=m?(m[1].split(',')[3]===undefined?1:+m[1].split(',')[3]):0;
 return a>0.05||(s.backgroundImage&&s.backgroundImage!=='none')||(parseFloat(s.borderTopWidth)>0&&s.borderTopStyle!=='none')||(parseFloat(s.outlineWidth)>0&&s.outlineStyle!=='none')||(s.boxShadow&&s.boxShadow!=='none');}
// An svg's drawn shapes, not its viewport (a big viewBox around a small drawing is mostly empty), clipped to the viewport.
function ink(svg,root){var x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;svg.querySelectorAll('path,line,circle,rect,ellipse,polygon,polyline,text,image,use').forEach(function(n){if(n.closest('defs,clipPath,mask,pattern,symbol,marker'))return;if(opac(n,root)<0.02)return;var r=n.getBoundingClientRect();if(r.width<0.5&&r.height<0.5)return;x0=Math.min(x0,r.left);y0=Math.min(y0,r.top);x1=Math.max(x1,r.right);y1=Math.max(y1,r.bottom);});
 if(x1<x0)return null;if(getComputedStyle(svg).overflow!=='visible'){var v=svg.getBoundingClientRect();x0=Math.max(x0,v.left);y0=Math.max(y0,v.top);x1=Math.min(x1,v.right);y1=Math.min(y1,v.bottom);if(x1<=x0||y1<=y0)return null;}
 return {left:x0,top:y0,right:x1,bottom:y1,width:x1-x0,height:y1-y0};}
function measure(root,tw,t){var R=root.getBoundingClientRect(),texts=[],graphics=[];
 var all=root.querySelectorAll('*');for(var i=0;i<all.length;i++){var e=all[i];var tag=e.tagName.toLowerCase();if(tag==='script'||tag==='style')continue;
  var inSvg=e.ownerSVGElement&&tag!=='svg';
  if(directText(e)){var tb=textBox(e,R);if(!tb)continue;var op=opac(e,root);if(op<0.02)continue;var fs=parseFloat(getComputedStyle(e).fontSize)||0;
   var anc=[];for(var a=e;a&&a!==root;a=a.parentElement)anc.push(a);
   var mid=[];tw.list.forEach(function(w){if(w.en-w.st<=2.5&&t>w.st+1e-3&&t<w.en-1e-3&&w.targets.some(function(x){return anc.indexOf(x)>=0;}))w.props.forEach(function(p){if(REVEAL.indexOf(p)>=0&&mid.indexOf(p)<0)mid.push(p);});});
   texts.push({sel:sel(e),text:tb.text,box:tb.b,font:fs,op:op,mid:mid});continue;}
  if(inSvg)continue;
  var s=getComputedStyle(e);var g=tag==='svg'||tag==='img'||tag==='canvas'||painted(s);if(!g)continue;
  var op2=opac(e,root);if(op2<0.02)continue;var r=e.getBoundingClientRect();if(tag==='svg'){var ik=ink(e,root);if(!ik)continue;r=ik;}if(r.width<2||r.height<2)continue;
  graphics.push({sel:sel(e),tag:tag,box:box(r,R),op:op2,flagged:e.hasAttribute('data-layout-allow-overflow')});}
 return {t:t,texts:texts,graphics:graphics};}
async function run(){var out={ok:false};try{await document.fonts.ready;var root=document.querySelector('[data-composition-id]');var tw=tweens(root);
 out={ok:true,w:+root.getAttribute('data-width'),h:+root.getAttribute('data-height'),duration:+root.getAttribute('data-duration'),timeline:!!tw.tl,samples:[]};
 for(var k=0;k<TIMES.length;k++){var t=TIMES[k];clips(root,t);if(tw.tl)tw.tl.seek(t,false);out.samples.push(measure(root,tw,t));}}catch(e){out={ok:false,error:String(e&&e.stack||e)};}
 var p=document.createElement('script');p.type='application/json';p.id='__probe';p.textContent='PRO'+'BE>>'+JSON.stringify(out)+'<<PRO'+'BE';document.body.appendChild(p);}
if(document.readyState==='complete')run();else window.addEventListener('load',run);
})();</script>`;
}

export function parseProbeOutput(dom) {
  const m = /PROBE>>([\s\S]*?)<<PROBE/.exec(String(dom));
  if (!m) throw new Error('the composition probe wrote no result');
  return JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
}

// dir: a composition folder with index.html. times: seconds on its own clock.
export function probeComposition(dir, times, { chrome = hyperframesChrome(), budgetMs = 4000 } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-probe-'));
  try {
    fs.cpSync(dir, tmp, { recursive: true });
    const html = path.join(tmp, 'index.html');
    const src = fs.readFileSync(html, 'utf8');
    const inject = probeSource(times);
    fs.writeFileSync(html, src.includes('</body>') ? src.replace(/<\/body>(?![\s\S]*<\/body>)/, `${inject}</body>`) : src + inject);
    const w = Number((/data-width="(\d+)"/.exec(src) ?? [])[1]) || 1920, h = Number((/data-height="(\d+)"/.exec(src) ?? [])[1]) || 1080;
    const r = spawnSync(chrome, ['--headless', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', `--window-size=${w},${h}`,
      `--virtual-time-budget=${budgetMs}`, '--dump-dom', pathToFileURL(html).href], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 120000 });
    if (r.status !== 0) throw new Error(`probe Chrome exited ${r.status}: ${String(r.stderr).slice(-600)}`);
    const out = parseProbeOutput(r.stdout);
    if (!out.ok) throw new Error(`probe failed in the page: ${out.error}`);
    return out;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// A still of a page at its own size, transparent where the page paints nothing (for compositing over footage).
export function screenshotPage(html, out, { w, h, chrome = hyperframesChrome(), budgetMs = 8000 } = {}) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = spawnSync(chrome, ['--headless', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', `--window-size=${w},${h}`,
    '--default-background-color=00000000', `--virtual-time-budget=${budgetMs}`, `--screenshot=${out}`, pathToFileURL(html).href], { encoding: 'utf8', timeout: 120000 });
  if (r.status !== 0 || !fs.existsSync(out)) throw new Error(`screenshot failed for ${html}: ${String(r.stderr).slice(-600)}`);
  return out;
}
