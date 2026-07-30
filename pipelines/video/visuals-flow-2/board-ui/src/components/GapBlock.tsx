import { useState } from 'react';
import { FeedbackBox } from './FeedbackBox';

function timecode(sec: number) {
  if (typeof sec !== 'number' || isNaN(sec)) return '0:00.0';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

export function GapBlock({ seg }: { seg: any }) {
  const [expanded, setExpanded] = useState(false);

  const durSecs = seg.end - seg.start;
  const m = Math.floor(durSecs / 60);
  const s = Math.floor(durSecs % 60);
  const durStr = m > 0 ? `${m}m ${s}s` : `${s}s`;
  
  const words = seg.words || [];
  const allWords = words.map((w: any) => w.text).join(' ');
  const previewWords = words.slice(0, 14).map((w: any) => w.text).join(' ') + (words.length > 14 ? '…' : '');

  return (
    <div className={`timeline-block gap-block ${seg.inShot ? 'in-shot' : ''}`} id={seg.id}>
      <div className="gap-header" onClick={() => setExpanded(!expanded)}>
        <span className="gap-icon" style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}>▸</span> {timecode(seg.start)} &rarr; {timecode(seg.end)} &middot; {durStr} &middot; <span style={{ color: 'var(--dim)' }}>"{previewWords}"</span>
      </div>
      <div className="gap-body" style={{ display: expanded ? 'block' : 'none' }}>
        {allWords}
        <FeedbackBox refKey={`gap-${timecode(seg.start)}`} placeholder="feedback for this stretch (read by the next Claude session)" />
      </div>
    </div>
  );
}
