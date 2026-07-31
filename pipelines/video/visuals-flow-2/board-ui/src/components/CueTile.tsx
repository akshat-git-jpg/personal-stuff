import { useRef } from 'react';
import { useTileSync } from '../lib/tileSync';
import { useOverflowBadge } from '../lib/overflow';
import { FeedbackBox } from './FeedbackBox';
import { ReviewTick } from './ReviewTick';

// Format mm:ss.s
function timecode(sec: number) {
  if (typeof sec !== 'number' || isNaN(sec)) return '0:00.0';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

// Edits live in StoryboardTab's tileEdits store, NOT here — the tile mounts and
// unmounts as the dock reveals blocks, and local state would silently discard
// edits (and Save must see EVERY cue, mounted or not).
export function CueTile({
  seg, cue, resolved, audit, reviewed, onReviewedChange,
  frag, onEdit
}: {
  seg: any;
  cue: any;
  resolved: any;
  audit: any;
  reviewed: boolean;
  onReviewedChange: (v: boolean) => void;
  frag: string;
  // flagged/note carry NO UI (owner removed the controls 2026-07-31); the
  // fields still ride the save payload untouched via buildTileModels so a
  // Save never strips them from cues that already have them.
  onEdit: (patch: { fragJson?: string }) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useTileSync(audioRef, iframeRef);
  const overflow = useOverflowBadge(iframeRef, seg.probeTimes || []);

  const beats = cue?.beats ?? [];
  const fragJson = frag;

  let auditHtml = null;
  if (audit) {
    const color = audit.verdict === 'labelled' ? 'var(--err)' : 'var(--ok)';
    auditHtml = (
      <span className="usage-chip" style={{ borderColor: color, color, marginLeft: 8, cursor: 'default' }} title={audit.fix || ''}>
        {audit.verdict}
      </span>
    );
  }

  const header = resolved
    ? `#${cue.id} · ${timecode(resolved.start)} → ${timecode(resolved.start + resolved.duration)} · ${cue.card} · ${resolved.duration}s · ${resolved.placement}`
    : `#${cue.id} · unresolved · ${cue.card}`;

  const excerptParts = [];
  const highlights = new Set(seg.highlights || []);
  
  let i = 0;
  while (i < (seg.words || []).length) {
    if (highlights.has(i)) {
      let run = [];
      while (i < seg.words.length && highlights.has(i)) {
        run.push(seg.words[i].text);
        i++;
      }
      excerptParts.push(<mark key={`m${i}`}>{run.join(' ')}</mark>);
      if (i < seg.words.length) excerptParts.push(' ');
    } else {
      let run = [];
      while (i < seg.words.length && !highlights.has(i)) {
        run.push(seg.words[i].text);
        i++;
      }
      excerptParts.push(<span key={`s${i}`}>{run.join(' ')}</span>);
      if (i < seg.words.length) excerptParts.push(' ');
    }
  }

  // overflow badge
  let badgeHtml = null;
  if (overflow.times.length > 0) {
    const label = overflow.times.map(x => x.t.toFixed(1) + 's').join(', ');
    const allOffenders = Array.from(new Set(overflow.times.flatMap(x => x.offenders))).slice(0, 5);
    badgeHtml = <span className="overflow-badge">OVERFLOW @ {label} ({allOffenders.join(' ')})</span>;
  }

  return (
    <div
      className={`timeline-block tile reviewable ${cue?.flagged ? 'flagged' : ''} ${seg.inShot ? 'in-shot' : ''} ${reviewed ? 'is-reviewed' : ''}`}
      id={seg.id}
      data-id={cue.id}
      data-rid={`sb:${cue.id}`}
      data-card={cue.card}
      data-lead={cue.lead ?? ''}
      data-start={resolved ? resolved.start : 0}
      onClick={(e) => {
        if (reviewed && (e.target as Element).closest('.rev-head') && !(e.target as Element).closest('.rev')) {
          onReviewedChange(false);
        }
      }}
    >
      <div className="tile-header rev-head">
        {header}
        {auditHtml}
        {badgeHtml}
        <ReviewTick checked={reviewed} onChange={() => onReviewedChange(!reviewed)} />
      </div>

      {seg.words && seg.words.length > 0 && (
        <div className="excerpt">{excerptParts}</div>
      )}

      <div className="anchor"><strong>{cue.anchor ?? ''}</strong></div>
      <ul className="beats">
        {beats.map((b: any, bi: number) => (
          <li key={bi}><strong>{b.reveal?.text ?? ''}</strong> @ "{b.anchor ?? ''}"</li>
        ))}
      </ul>

      {resolved ? (
        <>
          <div className="preview">
            {!reviewed && (
              <iframe ref={iframeRef} loading="lazy" src={`/card/${encodeURIComponent(cue.id)}`} />
            )}
          </div>
          <audio ref={audioRef} className="scrub" controls src={`/slice/${encodeURIComponent(cue.id)}.mp3`} />
        </>
      ) : (
        <div className="unresolved-note">no resolved timing for this cue — fix the anchor and Save</div>
      )}

      <FeedbackBox refKey={cue.id} placeholder="feedback on this graphic — wrong card, wrong timing, wording… (read by the next Claude session)" />

      <textarea className="frag" value={fragJson} onChange={e => onEdit({ fragJson: e.target.value })} />
    </div>
  );
}
