import React from 'react';

function timecode(sec: number) {
  if (typeof sec !== 'number' || isNaN(sec)) return '0:00.0';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

export function GraphicsMinimap({ segments, cues }: { segments: any[]; cues: any[] }) {
  const unresolvedSegs = segments.filter(s => s.unresolved).length;
  return (
    <div className="minimap">
      {segments.filter(s => !s.unresolved).map((seg, i) => {
        const duration = Math.max(0.1, seg.end - seg.start);
        let colorVar = '--line';
        let title = `${timecode(seg.start)} · gap`;
        if (seg.kind === 'cue') {
          title = `${timecode(seg.start)} · ${seg.cueId}`;
          const c = cues.find(c => c.id === seg.cueId);
          if (c) {
            title = `${timecode(seg.start)} · ${c.card}`;
            if (c.flagged) {
              colorVar = '--err';
            } else if (c.placement === 'fullframe') {
              colorVar = '--accent';
            } else {
              colorVar = '--overlay-seg';
            }
          }
        }
        return (
          <div
            key={i}
            className="minimap-seg"
            title={title}
            style={{ flexGrow: duration, background: `var(${colorVar})` }}
            onClick={() => document.getElementById(seg.id)?.scrollIntoView({ behavior: 'smooth' })}
          />
        );
      })}
    </div>
  );
}

export function AvatarMinimap({ spans, totalDuration }: { spans: any[]; totalDuration: number }) {
  const items = [];
  const sorted = [...(spans || [])].sort((a, b) => a.start - b.start);
  let t = 0;
  sorted.forEach((span, i) => {
    if (span.start > t) {
      items.push(<div key={`g${i}`} className="minimap-seg" style={{ flexGrow: span.start - t, background: 'var(--line)' }} />);
    }
    const label = span.mode === 'panel' ? '[P]' : (span.mode === 'side' ? '[S]' : '[A]');
    items.push(
      <div
        key={`s${i}`}
        className="minimap-seg"
        title={`${timecode(span.start)} · ${span.id} · ${label}`}
        style={{ flexGrow: span.duration, background: 'var(--shot)' }}
        onClick={() => document.getElementById(`shot-${span.id}`)?.scrollIntoView({ behavior: 'smooth' })}
      />
    );
    t = span.start + span.duration;
  });
  if (t < totalDuration) {
    items.push(<div key="gend" className="minimap-seg" style={{ flexGrow: totalDuration - t, background: 'var(--line)' }} />);
  }
  return <div className="minimap minimap-shots">{items}</div>;
}

export function EffectsMinimap({ instances, totalDuration }: { instances: any[]; totalDuration: number }) {
  const fxPoint = instances.filter(i => i.type === 'whip' || i.type === 'beat');
  const fxSpan = instances.filter(i => typeof i.start === 'number' && typeof i.end === 'number' && !['captions', 'bubble'].includes(i.type));

  return (
    <div className="minimap minimap-fx" style={{ position: 'relative', background: 'transparent' }}>
      {fxSpan.map((i, idx) => (
        <div
          key={`span${idx}`}
          className={`fx-span ${i.enabled ? '' : 'fx-off'}`}
          title={i.id}
          style={{ left: `${(i.start / totalDuration) * 100}%`, width: `${((i.end - i.start) / totalDuration) * 100}%` }}
        />
      ))}
      {fxPoint.map((i, idx) => (
        <div
          key={`pt${idx}`}
          className={`fx-marker fx-${i.type} ${i.enabled ? '' : 'fx-off'}`}
          title={`${i.id}${i.style ? ' · ' + i.style : ''}`}
          style={{ left: `${(i.at / totalDuration) * 100}%` }}
        />
      ))}
      <div id="fxPlayhead"></div>
    </div>
  );
}

export function SoundMinimap({ instances, totalDuration }: { instances: any[]; totalDuration: number }) {
  return (
    <div className="minimap minimap-fx" style={{ position: 'relative', background: 'transparent' }}>
      {instances.map((inst, idx) => {
        if (typeof inst.at !== 'number') return null;
        return (
          <div
            key={idx}
            className={`tl-mark ${inst.enabled === false ? 'fx-off' : ''}`}
            title={`${inst.sample || inst.id} @ ${timecode(inst.at)}`}
            style={{ left: `${(inst.at / totalDuration) * 100}%`, background: '#fcd34d', position: 'absolute', width: 4, height: '100%' }}
          />
        );
      })}
    </div>
  );
}
