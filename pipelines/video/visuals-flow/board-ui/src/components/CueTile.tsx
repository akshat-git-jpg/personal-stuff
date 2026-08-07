import { useEffect, useRef, useState } from 'react';
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
  frag, onEdit, isLive, onMakeLive, hasResolved, planItem
}: {
  seg: any;
  cue: any;
  resolved: any;
  audit: any;
  // Whether resolved.json exists AT ALL, as opposed to this one cue failing to
  // resolve. Without it the tile blamed the anchor for both, and told the owner
  // to "fix the anchor" on all 60 cues of a plan whose anchors were fine.
  hasResolved?: boolean;
  // The card-plan row for this cue: {status: 'existing'|'new', proposal}. The
  // Card Plan tab used to be the only place EXISTING-vs-NEW was shown, and
  // plan 195 deleted it without moving the marker here — so a card that does
  // not exist yet looked identical to one that does, on the very screen where
  // the owner is deciding whether to build it.
  planItem?: { status?: string; proposal?: any } | null;
  reviewed: boolean;
  onReviewedChange: (v: boolean) => void;
  frag: string;
  // flagged/note carry NO UI (owner removed the controls 2026-07-31); the
  // fields still ride the save payload untouched via buildTileModels so a
  // Save never strips them from cues that already have them.
  onEdit: (patch: { fragJson?: string }) => void;
  isLive?: boolean;
  onMakeLive?: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [cardLoaded, setCardLoaded] = useState(false);
  // Posters are cut from renders/<id>.mp4, which step 410 produces — and 410
  // runs AFTER the storyboard gate on purpose. So before a render exists the
  // poster 404s, and a bare <img> renders that as a broken-image icon: the
  // third "not yet" state on this board dressed up as breakage. The live card
  // preview works the whole time; this just makes the affordance visible.
  const [posterFailed, setPosterFailed] = useState(false);
  // Hover-to-play (owner 2026-08-07: "I dont want to click again and again to
  // play motion graphc" / "along with audio obviously"). Pointing at a card
  // plays it against its own slice of voiceover — that pairing IS the review,
  // so hover drives the real audio element and useTileSync follows it, exactly
  // as pressing play does. Only one tile can sound at a time: the audio's own
  // onPlay pauses every other tile.
  const [hoverPlay, setHoverPlay] = useState(false);
  // Browsers refuse programmatic play() until the page has been interacted
  // with. When that happens we still animate, silently, rather than leaving a
  // hovered card dead on screen.
  const [silentFallback, setSilentFallback] = useState(false);
  const hoverTimer = useRef<number | null>(null);

  useTileSync(audioRef, iframeRef, isLive && cardLoaded);

  // 200ms of intent before committing — a cursor crossing the list on its way
  // somewhere else should not mount an iframe per tile it passes over.
  const onPreviewEnter = () => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      hoverTimer.current = null;
      setHoverPlay(true);
      if (!isLive) onMakeLive?.();
    }, 200);
  };
  const onPreviewLeave = () => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setHoverPlay(false);
    setSilentFallback(false);
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }
  };
  useEffect(() => () => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
  }, []);
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

  // A card seeked to 0 shows its EMPTY state — stat-hit renders "0", a beat
  // card renders no beats. The poster endpoint already picks a representative
  // frame; the live preview should land on the same one.
  const previewTime = (() => {
    if (!resolved) return 0;
    const b = resolved.beats;
    if (Array.isArray(b) && b.length) return b[b.length - 1].at + 0.35;
    return (resolved.duration ?? 5) * 0.6;
  })();

  // Hover starts the slice from the top. useTileSync is already wired by the
  // time the card has loaded, so the audio's clock drives the animation and
  // nothing else has to.
  useEffect(() => {
    if (!hoverPlay || !isLive || !cardLoaded) return;
    const audio = audioRef.current;
    if (!audio) return;
    let cancelled = false;
    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => { if (!cancelled) setSilentFallback(true); });
    }
    return () => { cancelled = true; };
  }, [hoverPlay, isLive, cardLoaded]);

  // Only runs when the browser refused the audio.
  useEffect(() => {
    if (!silentFallback || !hoverPlay || !isLive || !cardLoaded) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const dur = resolved?.duration || 5;
    let raf = 0;
    const t0 = performance.now();
    const post = (t: number) => {
      try { iframe.contentWindow?.postMessage({ t }, '*'); } catch { /* unloading */ }
    };
    const loop = () => {
      post(((performance.now() - t0) / 1000) % dur);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      post(previewTime); // settle back on the representative frame
    };
  }, [silentFallback, hoverPlay, isLive, cardLoaded, resolved, previewTime]);

  const isNew = planItem?.status === 'new';
  const proposal = planItem?.proposal ?? null;
  const newBadge = isNew ? (
    <span className="usage-chip"
      style={{ borderColor: 'var(--accent)', color: 'var(--accent)', marginLeft: 8, cursor: 'default', fontWeight: 700 }}
      title="this card does not exist yet — step 240 builds it after you approve the look">
      NEW · to build
    </span>
  ) : null;

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
  if (!isLive) {
    badgeHtml = <span className="overflow-badge" style={{ color: 'var(--dim)', borderColor: 'var(--dim)' }}>not measured</span>;
  } else if (overflow.times.length > 0) {
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
        {newBadge}
        {auditHtml}
        {badgeHtml}
        <ReviewTick checked={reviewed} onChange={() => onReviewedChange(!reviewed)} />
      </div>

      {seg.words && seg.words.length > 0 && (
        <div className="excerpt">{excerptParts}</div>
      )}

      {proposal && (
        <div className="proposal-note" style={{
          margin: '8px 0', padding: '10px 12px', border: '1px solid var(--accent)',
          borderRadius: 8, background: 'rgba(251,146,60,0.06)', fontSize: 13, lineHeight: 1.5
        }}>
          <div><strong style={{ color: 'var(--accent)' }}>proposed card — nothing built yet</strong></div>
          <div style={{ marginTop: 4 }}>{proposal.does}</div>
          <div style={{ marginTop: 4, opacity: 0.75 }}>
            {[proposal.kind, proposal.placement,
              proposal.beats ? `${proposal.beats} beats` : null].filter(Boolean).join(' · ')}
            {Array.isArray(proposal.variables) && proposal.variables.length > 0
              ? ` · varies: ${proposal.variables.join(', ')}` : ''}
          </div>
        </div>
      )}

      <div className="anchor"><strong>{cue.anchor ?? ''}</strong></div>
      <ul className="beats">
        {beats.map((b: any, bi: number) => (
          <li key={bi}><strong>{b.reveal?.text ?? ''}</strong> @ "{b.anchor ?? ''}"</li>
        ))}
      </ul>

      {resolved ? (
        <>
          <div className="preview" onMouseEnter={onPreviewEnter} onMouseLeave={onPreviewLeave}>
            {/* shimmer until the card iframe fires load — a black box while a
                card loads reads as broken (owner report 2026-07-31) */}
            {!reviewed && !isLive && !posterFailed && (
              <img 
                src={`/poster/${encodeURIComponent(cue.id)}.jpg`} 
                loading="lazy" 
                onClick={(e) => { e.stopPropagation(); onMakeLive?.(); }}
                onError={() => setPosterFailed(true)}
                style={{ width: '100%', height: 'auto', cursor: 'pointer', display: 'block' }}
                alt="poster"
              />
            )}
            {!reviewed && !isLive && posterFailed && (
              <div
                className="preview-placeholder"
                onClick={(e) => { e.stopPropagation(); onMakeLive?.(); }}
                title="hover to play this card against its own slice of voiceover"
                style={{
                  width: '100%', aspectRatio: '16 / 9', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
                  border: '1px dashed var(--line)', borderRadius: 8, color: 'var(--text-dim)',
                  fontSize: 14, textAlign: 'center', padding: 12,
                }}
              >
                <strong style={{ color: 'var(--accent)' }}>hover to play this card with its voiceover</strong>
                <span>no still yet — stills are cut from the renders step 410 makes, which runs after you approve the storyboard</span>
              </div>
            )}
            {!reviewed && isLive && !cardLoaded && <div className="preview-loading">loading card…</div>}
            {!reviewed && isLive && (
              <iframe ref={iframeRef} loading="lazy" src={`/card/${encodeURIComponent(cue.id)}?static=1`}
                onLoad={(e) => {
                  setCardLoaded(true);
                  // Seek off frame 0 as soon as it loads, so a clicked card
                  // shows its content rather than its empty state.
                  try {
                    const el = e.currentTarget as HTMLIFrameElement;
                    const audio = audioRef.current;
                    const t = audio && !audio.paused ? audio.currentTime : previewTime;
                    el.contentWindow?.postMessage({ t }, '*');
                  } catch { /* iframe unloading */ }
                }} />
            )}
          </div>
          {/* preload="none": slices are cut server-side on first request —
              30+ tiles preloading at once would queue 30+ ffmpeg cuts */}
          <audio ref={audioRef} className="scrub" controls preload="none"
            onPlay={() => { if (!isLive) onMakeLive?.(); }}
            src={`/slice/${encodeURIComponent(cue.id)}.mp3`} />
        </>
      ) : (
        <div className="unresolved-note">{hasResolved
          ? 'no resolved timing for this cue — fix the anchor and Save'
          : 'not resolved yet — nothing is wrong with this cue; the whole plan is waiting on step 310'}</div>
      )}

      <FeedbackBox refKey={cue.id} placeholder="feedback on this graphic — wrong card, wrong timing, wording… (read by the next Claude session)" />

      <textarea className="frag" value={fragJson} onChange={e => onEdit({ fragJson: e.target.value })} />
    </div>
  );
}
