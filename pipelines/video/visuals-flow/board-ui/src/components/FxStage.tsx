import { useEffect, useState } from 'react';
import { fxContext, fxEventsAt, Fullframe, Span, FxInstance } from '../lib/fxSim';

export function FxStage({
  masterTime,
  isPlaying,
  fullframes,
  spans,
  instances,
  capChunks,
  totalDuration
}: {
  masterTime: number;
  isPlaying: boolean;
  fullframes: Fullframe[];
  spans: Span[];
  instances: FxInstance[];
  capChunks: { start: number; end: number; words: { hl?: boolean; text: string }[] }[];
  totalDuration: number;
}) {
  const [fxClasses, setFxClasses] = useState<string[]>([]);
  const [prevT, setPrevT] = useState(0);

  const t = masterTime;
  const playheadPct = (t / totalDuration) * 100;
  const currentCtx = fxContext(t, fullframes, spans);
  const ctxLabel = currentCtx === 'graphic' 
    ? (fullframes.find(f => t >= f.start && t < f.end)?.id || 'graphic')
    : currentCtx;

  useEffect(() => {
    if (!isPlaying) return;
    const newClasses: string[] = [];
    for (const ev of fxEventsAt(prevT, t, instances)) {
      const cls = ev.type === 'whip' && ev.style === 'flash' ? 'fx-flash'
        : ev.type === 'whip' ? 'fx-whipblur' : 'fx-punch';
      newClasses.push(cls);
    }
    
    if (newClasses.length > 0) {
      setFxClasses(prev => [...prev, ...newClasses]);
      setTimeout(() => {
        setFxClasses(prev => prev.filter(c => !newClasses.includes(c)));
      }, 350);
    }
    setPrevT(t);
  }, [t, isPlaying, prevT, instances]);

  const bubbleInst = instances.find(i => i.type === 'bubble');
  const bubbleOn = !!(bubbleInst && bubbleInst.enabled);

  let capHtml = '';
  const capChunk = capChunks.find(c => t >= c.start && t < c.end);
  if (capChunk && currentCtx === 'screen') {
    const escapeForBanner = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    capHtml = capChunk.words.map(w => w.hl ? `<span class="hl">${escapeForBanner(w.text)}</span>` : escapeForBanner(w.text)).join(' ');
  }

  return (
    <div id="fxStage" className={`${isPlaying ? 'on' : ''} ctx-${currentCtx} ${fxClasses.join(' ')}`} style={{
      position: 'fixed', right: 24, bottom: 24, width: 480, height: 270,
      background: '#141017', border: '1px solid var(--line)', borderRadius: 10,
      overflow: 'hidden', zIndex: 200, display: isPlaying ? 'block' : 'none'
    }}>
      <div className="minimap-fx" style={{ height: 18, position: 'absolute', top: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10 }}>
        {instances.map((inst, i) => {
          if (typeof inst.at !== 'number') return null;
          return (
            <div key={i} className={`fx-marker ${inst.type === 'whip' ? 'fx-whip' : 'fx-beat'} ${inst.enabled ? '' : 'fx-off'}`}
                 style={{ left: (inst.at / totalDuration * 100) + '%' }} />
          );
        })}
        <div id="fxPlayhead" style={{ position: 'absolute', top: -2, bottom: -2, width: 2, background: '#fff', opacity: isPlaying ? 1 : 0, left: playheadPct + '%' }} />
      </div>
      
      <div className="frame" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.3s ease-out' }}>
        <div className="ctx" id="fxCtx" style={{ font: '11px ui-monospace,Menlo,monospace', color: 'var(--dim)' }}>{ctxLabel}</div>
        <div className="flash" style={{ position: 'absolute', inset: 0, background: '#ffd9b0', opacity: 0, pointerEvents: 'none' }} />
        <div className="cap" id="fxCap" style={{ position: 'absolute', left: 8, right: 8, bottom: '10%', textAlign: 'center', fontWeight: 700, fontSize: 16, color: '#fff', textShadow: '0 0 4px #000' }} dangerouslySetInnerHTML={{ __html: capHtml }} />
        <div className={`bubble ${bubbleOn ? 'on' : ''}`} style={{ position: 'absolute', top: 12, right: 12, width: 56, height: 56, borderRadius: '50%', border: '3px solid var(--accent)', background: '#2a1d14', display: bubbleOn && currentCtx === 'screen' ? 'block' : 'none' }} />
      </div>
      
      <div className="note-fixed" style={{ position: 'absolute', top: 22, right: 10, fontSize: 10, color: 'var(--dim)' }}>
        timing preview — final look is the module's
      </div>
    </div>
  );
}
