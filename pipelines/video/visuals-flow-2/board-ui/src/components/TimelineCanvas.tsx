import { useEffect, useRef, useState } from 'react';
import { fitPxps, rulerTicks, blockRect } from '../lib/timelineLayout';

export function TimelineCanvas({
  totalDuration,
  graphicsBlocksHtml,
  avatarBlocksHtml,
  fxChipsHtml,
  fxSpansHtml,
  fxMarksHtml,
  soundInstances,
  effectsEnabled,
  onSeek,
  onReveal,
  masterTime
}: {
  totalDuration: number;
  graphicsBlocksHtml: any[];
  avatarBlocksHtml: any[];
  fxChipsHtml: any[];
  fxSpansHtml: any[];
  fxMarksHtml: any[];
  soundInstances?: any[];
  effectsEnabled?: boolean;
  onSeek: (t: number) => void;
  onReveal: (id: string) => void;
  masterTime: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pxps, setPxps] = useState(1);
  const [pxpsFit, setPxpsFit] = useState(1);
  const [derivativesOpen, setDerivativesOpen] = useState(() => localStorage.getItem('board:tl-derivatives') === 'true');

  useEffect(() => {
    const handleResize = () => {
      if (wrapRef.current) {
        const wrapWidth = wrapRef.current.clientWidth;
        const fit = fitPxps(wrapWidth, totalDuration);
        setPxpsFit(fit);
        setPxps((prev) => {
          // If it was at the fit value before resize, keep it fit
          if (Math.abs(prev - pxpsFit) < 0.01) return fit;
          return prev;
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [totalDuration, pxpsFit]);

  const handleZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPxps(Number(e.target.value));
  };

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek(x / pxps);
  };

  const toggleDerivatives = () => {
    const open = !derivativesOpen;
    setDerivativesOpen(open);
    localStorage.setItem('board:tl-derivatives', String(open));
  };

  const trackWidth = totalDuration * pxps;

  return (
    <div className="tl-canvas-col" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="tl-zoom-row" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 14px', fontSize: 12, color: 'var(--dim)' }}>
        Zoom: <input type="range" min={pxpsFit} max={30} step="0.1" value={pxps} onChange={handleZoom} />
      </div>
      <div className="tl-canvas-wrap" ref={wrapRef} style={{ overflowX: 'auto', flex: 1, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12 }}>
        <div className="tl-canvas" style={{ display: 'flex', minHeight: '100%' }}>
          <div className="tl-labels" style={{ position: 'sticky', left: 0, zIndex: 10, background: 'var(--bg)', borderRight: '1px solid var(--line)', flex: 'none', width: 90 }}>
            <div className="tl-label tl-ruler-spacer" style={{ height: 28, borderBottom: '1px solid var(--line)' }}></div>
            <div className="tl-label" style={{ height: 42, display: 'flex', alignItems: 'center', fontSize: 10, fontWeight: 600, color: 'var(--dim)', padding: '0 8px', borderBottom: '1px solid var(--line)' }}>SCREEN</div>
            <div className="tl-label" style={{ height: 42, display: 'flex', alignItems: 'center', fontSize: 10, fontWeight: 600, color: 'var(--dim)', padding: '0 8px', borderBottom: '1px solid var(--line)' }}>GRAPHICS</div>
            <div className="tl-label" style={{ height: 42, display: 'flex', alignItems: 'center', fontSize: 10, fontWeight: 600, color: 'var(--dim)', padding: '0 8px', borderBottom: '1px solid var(--line)' }}>AVATAR</div>
            <div className="tl-label" style={{ height: 24, borderBottom: '1px solid var(--line)' }}></div>
            <div id="derivativesLabelsBlock" style={{ display: derivativesOpen ? 'block' : 'none' }}>
              <div className="tl-label" style={{ height: 42, display: 'flex', alignItems: 'center', fontSize: 10, fontWeight: 600, color: 'var(--dim)', padding: '0 8px', borderBottom: '1px solid var(--line)' }}>EFFECTS</div>
              {soundInstances && soundInstances.length > 0 && <div className="tl-label" style={{ height: 42, display: 'flex', alignItems: 'center', fontSize: 10, fontWeight: 600, color: 'var(--dim)', padding: '0 8px', borderBottom: '1px solid var(--line)' }}>SOUND</div>}
            </div>
          </div>
          <div className="tl-tracks" id="tlTracks" style={{ position: 'relative', background: '#0a0a0a', paddingBottom: 20 }}>
            <div className="tl-ruler" id="tlRuler" onClick={handleRulerClick} style={{ height: 28, borderBottom: '1px solid var(--line)', position: 'relative', cursor: 'text', width: trackWidth }}>
              {rulerTicks(totalDuration, pxps).map(t => (
                <div key={t.t} className="tl-tick" style={{ position: 'absolute', top: 12, fontSize: 10, color: 'var(--dim)', left: t.t * pxps }}>{t.label}</div>
              ))}
            </div>
            <div className="tl-track" id="tlScreen" style={{ height: 42, borderBottom: '1px solid var(--line)', position: 'relative', width: trackWidth }}>
              <div className="tl-screen-bar" style={{ position: 'absolute', top: 18, bottom: 18, left: 0, right: 0, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}></div>
            </div>
            <div className="tl-track" id="tlGraphics" style={{ height: 42, borderBottom: '1px solid var(--line)', position: 'relative', width: trackWidth }}>
              {graphicsBlocksHtml.map(b => {
                const rect = blockRect(b.start, b.dur, pxps);
                return (
                  <div key={b.id} className="tl-block" data-start={b.start} data-dur={b.dur}
                    onClick={() => onReveal(b.id)}
                    style={{ position: 'absolute', top: 8, bottom: 8, left: rect.left, width: rect.width, background: b.bg || 'var(--panel)', border: '1px solid ' + (b.border || 'var(--line)'), borderRadius: 4, overflow: 'hidden', cursor: 'pointer', fontSize: 11, padding: '0 4px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', color: '#0f0b07' }}
                  >
                    {b.label}
                  </div>
                );
              })}
            </div>
            <div className="tl-track" id="tlAvatar" style={{ height: 42, borderBottom: '1px solid var(--line)', position: 'relative', width: trackWidth }}>
              {avatarBlocksHtml.map(b => {
                const rect = blockRect(b.start, b.dur, pxps);
                return (
                  <div key={b.id} className="tl-block" data-start={b.start} data-dur={b.dur}
                    onClick={() => onReveal(b.id)}
                    style={{ position: 'absolute', top: 8, bottom: 8, left: rect.left, width: rect.width, background: b.bg || 'var(--panel)', border: '1px solid ' + (b.border || 'var(--line)'), borderRadius: 4, overflow: 'hidden', cursor: 'pointer', fontSize: 11, padding: '0 4px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', color: '#0f0b07' }}
                  >
                    {b.label}
                  </div>
                );
              })}
            </div>
            <div className="tl-track tl-derivatives-toggle-track" style={{ height: 24, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', position: 'relative', width: trackWidth }}>
               <button id="derivativesToggle" className="fold-toggle" style={{ marginLeft: 8, margin: '2px 0 2px 8px', background: 'transparent', border: 'none', color: 'var(--dim)', fontSize: 11, cursor: 'pointer' }} onClick={toggleDerivatives}>details {derivativesOpen ? '▾' : '▸'}</button>
               {effectsEnabled && <button id="approveEffectsBtn" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11, background: 'transparent', border: '1px solid var(--ok)', color: 'var(--ok)', borderRadius: 12, cursor: 'pointer' }} onClick={() => fetch('/approve-effects', { method: 'POST' })}>Approve effects</button>}
            </div>
            <div id="derivativesTracksBlock" style={{ display: derivativesOpen ? 'block' : 'none' }}>
              <div className="tl-track" id="tlEffects" style={{ height: 42, borderBottom: '1px solid var(--line)', position: 'relative', width: trackWidth }}>
                {fxSpansHtml.map((s, i) => <div key={'span'+i} className="tl-span" data-start={s.start} data-dur={s.dur} style={{ position: 'absolute', top: 6, height: 6, left: s.start * pxps, width: Math.max(2, s.dur * pxps), background: 'rgba(245,237,226,0.28)', borderRadius: 3 }}></div>)}
                {fxChipsHtml.map((c, i) => <div key={'chip'+i} className="tl-chip" style={{ position: 'absolute', top: 18, left: c.start * pxps, background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>{c.label}</div>)}
                {fxMarksHtml.map((m, i) => <div key={'mark'+i} className="tl-mark" data-start={m.start} style={{ position: 'absolute', top: 2, bottom: 2, width: 3, borderRadius: 1, left: m.start * pxps, background: m.isBeat ? 'var(--ok)' : 'var(--accent)', opacity: m.enabled ? 1 : 0.25 }}></div>)}
              </div>
              {soundInstances && soundInstances.length > 0 && (
                <div className="tl-track" id="tlSound" style={{ height: 42, borderBottom: '1px solid var(--line)', position: 'relative', width: trackWidth }}>
                  {soundInstances.map((inst, i) => {
                    if (typeof inst.at !== 'number') return null;
                    return <div key={'snd'+i} className="tl-mark" data-start={inst.at} title={inst.sample || inst.id} style={{ position: 'absolute', top: 2, bottom: 2, width: 3, borderRadius: 1, left: inst.at * pxps, background: '#fcd34d' }}></div>;
                  })}
                </div>
              )}
            </div>
            <div className="tl-playhead" id="tlPlayhead" style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: 'var(--err)', left: masterTime * pxps, pointerEvents: 'none', zIndex: 5 }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
