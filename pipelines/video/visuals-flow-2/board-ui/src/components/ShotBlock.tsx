import { FeedbackBox } from './FeedbackBox';

function timecode(sec: number) {
  if (typeof sec !== 'number' || isNaN(sec)) return '0:00.0';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

// Edits live in StoryboardTab's spanEdits store, NOT here — same reason as
// CueTile: the block unmounts with the dock, and Save must see every span.
export function ShotBlock({ span, origSpan, fragJson, onEdit }: {
  span: any; origSpan: any; fragJson: string; onEdit: (fragJson: string) => void;
}) {

  const label = origSpan.mode === 'panel' ? '[P]' : (origSpan.mode === 'side' ? '[S]' : '[A]');
  const noteHtml = span.note ? ` — ${span.note}` : '';

  return (
    <div className="timeline-block shot-block" id={`shot-${span.id}`}>
      <div className="shot-header">
        🧍 <b>{span.id}</b> {label} &middot; {timecode(span.start)} &rarr; {timecode(span.start + span.duration)} &middot; {span.duration}s{noteHtml}
      </div>
      <textarea className="shot-frag" value={fragJson} onChange={e => onEdit(e.target.value)} />
      <FeedbackBox refKey={span.id} placeholder="feedback on this shot span (read by the next Claude session)" />
    </div>
  );
}
