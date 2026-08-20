import {
  useState, useEffect, useRef, useCallback, ReactNode, ClipboardEvent,
} from 'react';
import './ReviewSurface.css';
import { fmtClock, fmtClockFrames, clampSeek, frameStep } from '../lib/fcTransport';
import { validateImageFile } from '../lib/feedback';
import { installPlayerDiag } from '../lib/playerDiag';

// THE review surface for any step that wants "watch it, pause, comment on a
// moment". Final Cut (gate 120) and Intro (gate 027) both mount this.
//
// It exists because they used to be two 400-line near-copies sharing only the
// time math, so every fix had to be made twice and in practice was made once —
// Intro shipped without attach or edit, and Final Cut's edit silently wrote to
// cues.json instead of feedback.json for months. Parity is now structural.
//
// A NEW STEP NEEDS NO CHANGES HERE. Mount it with your own namespace and post
// URL, and pass step-specific chrome in via the slots (belowPlayer, panelTop,
// panelBottom). Nothing in this file may branch on which step is using it — if
// you find yourself adding `if (namespace === ...)`, add a prop instead.

export type ReviewComment = {
  text?: string;
  t: number;
  context?: string;
  x?: number;
  y?: number;
  status?: string;
  folded?: boolean;
  image?: string;      // pre-2026-08-06 single screenshot, still rendered
  images?: string[];   // canonical: a comment may carry several
};

// What a step's own chrome can do to the player. A slot may be plain nodes, or
// a function that receives this — so a beat list, a shot list or a chapter
// index can drive the transport WITHOUT this component knowing what a beat is.
// Without it the Intro tab's beat sheet was inert: the owner could see that b04
// changed but had no way to get the playhead there except hunting with the
// scrubber, and kept landing back on b01 (owner report 2026-08-06).
export type PlayerApi = {
  seekTo: (t: number) => void;   // pauses, so the moment holds still
  pause: () => void;
};

type Slot = ReactNode | ((api: PlayerApi) => ReactNode);

export type ReviewSurfaceProps = {
  /** Video URL. Empty string means there is nothing to play yet. */
  src: string;
  /** Shown in place of the player when `src` is empty. */
  notReady?: ReactNode;
  /** Comment key namespace: 'intro' or `final-${version}`. Keys are `${namespace}:${n}`. */
  namespace: string;
  /** Where a new comment is POSTed. */
  postUrl: string;
  /** Extra fields merged into the POST body (e.g. { label: version }). */
  postBody?: Record<string, unknown>;
  /** Prefix for a comment's `context` string, e.g. 'intro@00:12'. Defaults to the namespace. */
  contextPrefix?: string;
  /** Controlled comment store, keyed as `${namespace}:${n}`. */
  items: Record<string, ReviewComment>;
  onItemsChange: (next: Record<string, ReviewComment>) => void;
  /** Frame rate used by the frame-step buttons. */
  fps?: number;
  /** Optional transport controls. Omit for a minimal transport. */
  showSpeed?: boolean;
  showMute?: boolean;
  /** Sidebar heading. */
  panelTitle?: string;
  /** Slots for step-specific chrome. */
  belowPlayer?: Slot;
  panelTop?: Slot;
  panelBottom?: Slot;
  /** Status line under the player. */
  message?: ReactNode;
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** Every screenshot on a comment, old single-field and new array alike. */
export function commentImageCount(it: ReviewComment): number {
  if (Array.isArray(it.images)) return it.images.length;
  return it.image ? 1 : 0;
}

export function ReviewSurface({
  src,
  notReady,
  namespace,
  postUrl,
  postBody,
  contextPrefix,
  items,
  onItemsChange,
  fps = 30,
  showSpeed = false,
  showMute = false,
  panelTitle = 'Comments',
  belowPlayer,
  panelTop,
  panelBottom,
  message,
}: ReviewSurfaceProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // The <video> can mount LATE (a tab that renders a loading state first), and
  // an effect keyed on anything else would read a null ref and never
  // re-subscribe — that is what left the Intro transport dead with the clock
  // frozen at 00:00:00. Track the node itself so the effect runs when it exists.
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setVideoEl(node);
  }, []);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Set when a keystroke has been diverted into the composer. The composer is
  // disabled until `paused` is true, and at the instant that keystroke is
  // handled it is still false — so focus() lands on a disabled element and
  // silently does nothing. The film stopped, the character vanished into a box
  // on the other side of the screen, and nothing had focus: the owner read that
  // as the video pausing on its own (report 2026-08-20). Focus it once it is
  // really enabled, so a diverted keystroke is always VISIBLE where it went.
  const wantComposerFocus = useRef(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  // A media element that runs out of bytes just stops, silently, on whatever
  // frame it reached — no error, no spinner, and the Pause button still reads
  // "Pause" because the element believes it is playing. That is precisely what
  // the owner saw when the board server died underneath it (report 2026-08-20):
  // a cut frozen at 04:08 and a Play button that did nothing, with nothing on
  // screen to say the video was waiting rather than broken.
  const [stalled, setStalled] = useState(false);
  // Chrome's HARDWARE decoder can give up mid-file (MEDIA_ERR_DECODE). When it
  // does, the browser pauses the film itself — no app code called pause() — and
  // the element is then dead: play() resolves, 'playing' fires, and the clock
  // never moves. Reloading the page was the only cure, which is exactly what the
  // owner was doing all afternoon (report 2026-08-20, decoder died at t=2111.8
  // on every approach to that frame). Reproduced only with the GPU enabled —
  // every headless repro passed because --disable-gpu decodes in software.
  const [decodeLost, setDecodeLost] = useState(false);
  const [decodeGaveUp, setDecodeGaveUp] = useState(false);
  const wasPlayingRef = useRef(false);
  const decodeRetriesRef = useRef(0);
  const decodeDiedAtRef = useRef(-Infinity);
  // A ref, not state: the timeupdate handler only reads it, and holding it in
  // state made every scrub tear down and re-attach the media listeners.
  const scrubbingRef = useRef(false);

  const [currentPin, setCurrentPin] = useState<{ x: number; y: number } | null>(null);
  const [inputText, setInputText] = useState('');
  const [pendingImages, setPendingImages] = useState<{ url: string; name: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    const v = videoEl;
    if (!v) return;
    const updateTime = () => {
      if (!scrubbingRef.current) setCurrentTime(v.currentTime);
      // Getting CLEAR of the bad frame is what proves the decoder recovered.
      // 'playing' does not: a reloaded element fires it and then dies again on
      // the same frame, which turned the retry budget into an infinite loop.
      if (v.currentTime > decodeDiedAtRef.current + 2) {
        decodeRetriesRef.current = 0;
        decodeDiedAtRef.current = -Infinity;
        setDecodeGaveUp(false);
      }
    };
    const onLoadedMetadata = () => { setDuration(v.duration); v.playbackRate = speed; updateTime(); };
    const onDurationChange = () => setDuration(v.duration);
    const onPlay = () => { setPaused(false); wasPlayingRef.current = true; };
    const onWaiting = () => setStalled(true);
    const onFlowing = () => setStalled(false);
    const onPause = () => {
      setPaused(true);
      // Do NOT clear the play intent when the browser paused us because the
      // decoder died — that intent is what tells recovery to resume.
      if (!v.error) wasPlayingRef.current = false;
      updateTime();
    };

    const onDecodeError = () => {
      const err = v.error;
      if (!err || err.code !== 3 /* MEDIA_ERR_DECODE */) return;
      // Three strikes, then stop and SAY so. Never silently seek past the bad
      // frame: this is a review surface, and skipping footage without telling
      // the reviewer is worse than stopping.
      if (decodeRetriesRef.current >= 3) { setDecodeLost(false); setDecodeGaveUp(true); return; }
      decodeRetriesRef.current += 1;
      decodeDiedAtRef.current = v.currentTime;
      const at = v.currentTime;
      const resume = wasPlayingRef.current;
      setDecodeLost(true);
      const onReady = () => {
        v.removeEventListener('loadedmetadata', onReady);
        try { v.currentTime = at; } catch { /* a reloaded element may refuse a seek */ }
        setDecodeLost(false);
        if (resume) v.play().catch(() => { /* recovery is best-effort */ });
      };
      v.addEventListener('loadedmetadata', onReady);
      v.load();   // rebuild the decode pipeline the GPU just killed
    };

    // Metadata can already be there when this runs (a cached video is ready
    // immediately) and loadedmetadata will not fire again. Seed from the element.
    if (Number.isFinite(v.duration) && v.duration > 0) setDuration(v.duration);
    setPaused(v.paused);
    updateTime();

    // Flight recorder. Keyed on the same node as the listeners below, so it
    // lives exactly as long as the element does.
    const stopDiag = installPlayerDiag(v, namespace);

    v.addEventListener('loadedmetadata', onLoadedMetadata);
    v.addEventListener('durationchange', onDurationChange);
    v.addEventListener('timeupdate', updateTime);
    v.addEventListener('seeked', updateTime);
    v.addEventListener('error', onDecodeError);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('stalled', onWaiting);
    v.addEventListener('playing', onFlowing);
    v.addEventListener('canplay', onFlowing);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      stopDiag();
      v.removeEventListener('loadedmetadata', onLoadedMetadata);
      v.removeEventListener('durationchange', onDurationChange);
      v.removeEventListener('timeupdate', updateTime);
      v.removeEventListener('seeked', updateTime);
      // Named handlers, so these actually detach — arrow functions passed
      // straight to removeEventListener match nothing and leak on every re-run.
      v.removeEventListener('error', onDecodeError);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('stalled', onWaiting);
      v.removeEventListener('playing', onFlowing);
      v.removeEventListener('canplay', onFlowing);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
    // `speed` only seeds playbackRate on load; the picker sets it directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoEl]);

  const seek = (d: number) => {
    if (videoRef.current) videoRef.current.currentTime = clampSeek(videoRef.current.currentTime, duration, d);
  };
  const stepFrame = (dir: number) => {
    if (videoRef.current) {
      if (!videoRef.current.paused) videoRef.current.pause();
      videoRef.current.currentTime = frameStep(videoRef.current.currentTime, dir, fps);
    }
  };

  useEffect(() => {
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

      const doTransport = () => {
        if (e.key === ' ') { e.preventDefault(); paused ? videoRef.current?.play() : videoRef.current?.pause(); return true; }
        if (e.key === 'ArrowLeft') { e.preventDefault(); e.shiftKey ? stepFrame(-1) : seek(-5); return true; }
        if (e.key === 'ArrowRight') { e.preventDefault(); e.shiftKey ? stepFrame(1) : seek(5); return true; }
        return false;
      };

      // Escape is the way back to the player. Without it a composer holding text
      // is a ONE-WAY DOOR: Space types into it instead of resuming, and clicking
      // the frame pins instead of resuming, so the only ways out are the Play
      // button or reloading the whole page — which is what the owner was reduced
      // to doing (report 2026-08-20).
      if (e.key === 'Escape' && inField && t === inputRef.current) {
        e.preventDefault();
        if (inputText.trim() === '') setInputText('');
        inputRef.current?.blur();
        return;
      }

      if (inField) {
        // trim(), not === '': a box holding only spaces is not a note. Pressing
        // Space against one used to add ANOTHER space, so the owner could press
        // it four times, watch the film stay frozen, and never suspect his
        // keystrokes were being eaten by a text box he had not chosen to enter.
        if (t === inputRef.current && inputText.trim() === '') doTransport();
        return;
      }
      if (doTransport()) return;

      if (e.key.length === 1) {
        e.preventDefault();
        if (!paused) videoRef.current?.pause();
        wantComposerFocus.current = true;
        inputRef.current?.focus();
        setInputText((prev) => prev + e.key);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [paused, inputText, duration]);

  const addImageFile = (file?: File) => {
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { alert(err); return; }
    const r = new FileReader();
    // Append, never replace: pasting a second screenshot used to overwrite the
    // first with no sign it had happened (owner report 2026-08-06).
    r.onload = () => setPendingImages((prev) => [...prev, { url: r.result as string, name: file.name || 'pasted image' }]);
    r.readAsDataURL(file);
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData?.items ?? [])
      .filter((it) => it.kind === 'file' && it.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    for (const it of files) addImageFile(it.getAsFile()!);
  };

  const submitComment = async () => {
    const text = inputText.trim();
    // A screenshot on its own is a real note — "look at this frame".
    if (!text && !pendingImages.length) return;
    const t = currentTime;
    const item: ReviewComment = { text, t, context: `${contextPrefix ?? namespace}@${fmtClock(t)}` };
    if (currentPin) { item.x = currentPin.x; item.y = currentPin.y; }
    setSending(true);
    let res: Response;
    try {
      res = await fetch(postUrl, {
        method: 'POST',
        body: JSON.stringify({ ...postBody, item, images: pendingImages.map((p) => p.url) }),
      });
    } finally {
      setSending(false);
    }
    if (res.ok) {
      const data = await res.json();
      if (data.key) onItemsChange({ ...items, [data.key]: data.item });
      setInputText('');
      setCurrentPin(null);
      setPendingImages([]);
    } else {
      alert('failed to save');
    }
  };

  const editComment = async (k: string, current: string) => {
    const next = prompt('Edit comment:', current);
    if (next === null) return;
    if (!next.trim()) { alert('empty comment'); return; }
    const res = await fetch('/feedback-edit', { method: 'POST', body: JSON.stringify({ key: k, text: next.trim() }) });
    if (res.ok) onItemsChange({ ...items, [k]: { ...items[k], text: next.trim() } });
    else alert((await res.json().catch(() => ({}))).error ?? 'failed to edit');
  };

  const deleteComment = async (k: string) => {
    if (!confirm('Delete comment?')) return;
    const res = await fetch('/feedback-delete', { method: 'POST', body: JSON.stringify({ key: k }) });
    if (res.ok) {
      const next = { ...items };
      delete next[k];
      onItemsChange(next);
    } else {
      alert((await res.json().catch(() => ({}))).error ?? 'failed to delete');
    }
  };

  // A comment carries a timestamp into a video. With nothing loaded there is no
  // timestamp to carry, and a note filed at t=0 against a cut that does not
  // exist yet lands under a key nothing will ever show it under.
  const canComment = !!src && paused && !sending;

  // Deliver the focus the keydown handler could not. It fires while the composer
  // is still disabled (`paused` has not landed yet), so its focus() is a no-op —
  // which left the film stopped, nothing focused, and the diverted character
  // sitting unseen in a box across the screen.
  useEffect(() => {
    if (wantComposerFocus.current && canComment) {
      inputRef.current?.focus();
      wantComposerFocus.current = false;
    }
  }, [canComment]);

  const playerApi: PlayerApi = {
    seekTo: (t) => {
      const v = videoRef.current;
      if (!v) return;
      v.pause();
      v.currentTime = t;
      setCurrentTime(t);
    },
    pause: () => videoRef.current?.pause(),
  };
  const slot = (s: Slot) => (typeof s === 'function' ? s(playerApi) : s);

  const comments = Object.entries(items)
    .filter(([k]) => k.startsWith(`${namespace}:`))
    .sort(([a], [b]) => {
      const n = (s: string) => parseInt(s.slice(namespace.length + 1), 10);
      return n(a) - n(b);
    });

  return (
    <div className="rs-container">
      <div className="rs-main">
        {!src ? (
          <div className="rs-empty">{notReady ?? 'Nothing to review yet.'}</div>
        ) : (
          <>
            <input
              type="range"
              className="rs-scrub"
              min="0"
              max={duration || 0}
              step="0.01"
              value={currentTime}
              onInput={(e) => {
                scrubbingRef.current = true;
                const val = +(e.target as HTMLInputElement).value;
                setCurrentTime(val);
                if (videoRef.current) videoRef.current.currentTime = val;
              }}
              onChange={() => { scrubbingRef.current = false; }}
            />
            <div className="rs-transport">
              <button onClick={() => (paused ? videoRef.current?.play() : videoRef.current?.pause())}>
                {paused ? '▶ Play' : '❚❚ Pause'}
              </button>
              <span className="rs-clock">
                <span className="cur">{fmtClockFrames(currentTime)}</span> / <span>{fmtClock(duration)}</span>
              </span>
              <button onClick={() => seek(-5)} data-seek="-5">−5s</button>
              <button onClick={() => seek(5)} data-seek="5">+5s</button>
              <button onClick={() => stepFrame(-1)} data-frame="-1">‹ frame</button>
              <button onClick={() => stepFrame(1)} data-frame="1">frame ›</button>
              {showSpeed && (
                <select
                  value={speed}
                  onChange={(e) => {
                    const s = +e.target.value;
                    setSpeed(s);
                    if (videoRef.current) videoRef.current.playbackRate = s;
                  }}
                >
                  {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
                </select>
              )}
              {showMute && (
                <button title="mute/unmute" onClick={() => setMuted(!muted)}>{muted ? '🔇' : '🔊'}</button>
              )}
            </div>

            <div className="rs-video-container">
              <video
                className="rs-video"
                ref={attachVideo}
                src={src}
                muted={muted}
                onClick={(e) => {
                  if (!paused) {
                    videoRef.current?.pause();
                  } else {
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    setCurrentPin({
                      x: Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10,
                      y: Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10,
                    });
                  }
                }}
              />
              {currentPin && (
                <div className="rs-pin-marker" style={{ left: `${currentPin.x}%`, top: `${currentPin.y}%` }} />
              )}
            </div>

            <div className="rs-kbd-hint">
              <kbd>Space</kbd> play/pause · <kbd>Esc</kbd> back to the player · <kbd>←</kbd> <kbd>→</kbd> ±5s · <kbd>⇧</kbd>+<kbd>←</kbd> <kbd>→</kbd> step a frame
              · <strong>just start typing</strong> to note the current moment · <strong>click the frame</strong> to pin a note
              to that exact spot · <strong>paste screenshots</strong> to attach them
            </div>
            {decodeLost && (
              <div className="rs-stall">Video decoder dropped out — restoring your place…</div>
            )}
            {decodeGaveUp && (
              <div className="rs-decode-dead">
                Chrome's video decoder keeps failing at this point. This is a graphics-driver
                fault, not the cut. Turn off <strong>Settings → System → “Use graphics
                acceleration when available”</strong> in Chrome and reload.
              </div>
            )}
            {stalled && !paused && (
              // Only while it BELIEVES it is playing. A paused player is not
              // waiting for anything, and a badge that shows whenever bytes are
              // in flight is noise the owner learns to ignore. If the server is
              // gone the red banner above already says so — this line must not
              // repeat it, it only says the frame is waiting, not broken.
              <div className="rs-stall">Waiting for video data…</div>
            )}
            {message && <div className="rs-msg">{message}</div>}
          </>
        )}
        {slot(belowPlayer)}
      </div>

      <div className="rs-panel">
        <h3 className="rs-panel-title">{panelTitle}</h3>
        {slot(panelTop)}

        <div className="rs-comments">
          {comments.map(([k, it]) => {
            const hasXy = typeof it.x === 'number' && typeof it.y === 'number';
            const chipClass = it.status === 'fixed' ? 'fixed' : (it.status === 'question' ? 'question' : (it.status ? 'other' : ''));
            const shots = commentImageCount(it);
            return (
              <div key={k} className="rs-comment-item">
                <div className="rs-comment-head">
                  <a
                    href="#"
                    className="rs-comment-jump"
                    onClick={(e) => {
                      e.preventDefault();
                      if (videoRef.current) {
                        videoRef.current.currentTime = it.t;
                        videoRef.current.pause();
                        if (hasXy) setCurrentPin({ x: it.x!, y: it.y! });
                      }
                    }}
                  >
                    {fmtClock(it.t)} {hasXy ? '📌' : ''}
                  </a>
                  {it.status && <span className={`rs-chip ${chipClass}`}>{it.status}</span>}
                </div>
                {it.text && <div className="rs-comment-text">{it.text}</div>}
                {shots > 0 && (
                  <div className="rs-shots">
                    {Array.from({ length: shots }, (_, i) => {
                      const url = `/feedback-image/${k}/${i}`;
                      return (
                        <img
                          key={i}
                          src={url}
                          className={shots === 1 ? 'rs-shot rs-shot-full' : 'rs-shot'}
                          style={shots === 1 ? undefined : { height: 72 }}
                          alt={`screenshot ${i + 1} of ${shots}`}
                          onClick={() => setLightbox(url)}
                        />
                      );
                    })}
                  </div>
                )}
                <div className="rs-comment-actions">
                  <button className="rs-cbtn" title="edit" onClick={() => editComment(k, it.text ?? '')}>✎ Edit</button>
                  <button className="rs-cbtn" title="delete" onClick={() => deleteComment(k)}>✕ Delete</button>
                </div>
              </div>
            );
          })}
        </div>

        <textarea
          ref={inputRef}
          className="rs-input"
          rows={4}
          placeholder={!src
            ? 'Nothing to comment on yet.'
            : (paused
              ? 'Pause video to type comment... (Enter to send · Shift+Enter for newline · paste screenshots to attach)'
              : 'Pause video to type comment...')}
          disabled={!canComment}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onPaste={onPaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submitComment();
            }
          }}
        />

        {pendingImages.length > 0 && (
          <div className="rs-pending">
            {pendingImages.map((p, i) => (
              <span key={i} className="rs-pending-item">
                <img src={p.url} alt={`attachment ${i + 1}`} />
                {p.name}
                <button
                  className="rs-cbtn"
                  title="remove this screenshot"
                  onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                >✕</button>
              </span>
            ))}
          </div>
        )}

        <div className="rs-compose-actions">
          <button
            className="rs-cbtn"
            disabled={!canComment || (!inputText.trim() && !pendingImages.length)}
            onClick={submitComment}
          >
            Send
          </button>
          <button className="rs-cbtn" disabled={!canComment} onClick={() => fileRef.current?.click()}>
            📎 image
          </button>
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            ref={fileRef}
            onChange={(e) => { Array.from(e.target.files ?? []).forEach(addImageFile); e.target.value = ''; }}
          />
        </div>
        {slot(panelBottom)}
      </div>

      {lightbox && (
        <div className="rs-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="screenshot" />
        </div>
      )}
    </div>
  );
}
