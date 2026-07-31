import { useState, useEffect, useRef, ReactNode, ChangeEvent, KeyboardEvent, ClipboardEvent } from 'react';
import './FinalCutTab.css';
import { fmtClock, fmtClockFrames, clampSeek, frameStep, FC_FPS } from '../lib/fcTransport';
import { validateImageFile } from '../lib/feedback';
import { BoardData } from '../lib/api';

type Pin = { x: number; y: number };
type FcItem = { text?: string; t: number; context: string; x?: number; y?: number; status?: string };

export function FinalCutTab({
  video,
  boardData,
  onMeta,
  onActions,
  onSecondary,
  onRefetch
}: {
  video: string;
  boardData: BoardData;
  onMeta: (node: ReactNode) => void;
  onActions: (node: ReactNode) => void;
  onSecondary: (node: ReactNode) => void;
  onRefetch: () => void;
}) {
  const [versions, setVersions] = useState<string[]>([]);
  const [version, setVersion] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState('');
  const [fcItems, setFcItems] = useState<Record<string, FcItem>>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [scrubbing, setScrubbing] = useState(false);
  
  const [currentPin, setCurrentPin] = useState<Pin | null>(null);
  const [inputText, setInputText] = useState('');
  const [pendingImage, setPendingImage] = useState<{ url: string; name: string } | null>(null);
  const [sending, setSending] = useState(false);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Setup header
  useEffect(() => {
    onMeta('final cut review');
    onActions(
      <button 
        className="approve fc-cbtn" 
        disabled={!version}
        style={{ borderColor: 'var(--ok)', color: 'var(--ok)' }}
        onClick={async () => {
          const res = await fetch('/approve-final-cut', {
            method: 'POST',
            body: JSON.stringify({ version })
          });
          if (res.ok) onRefetch();
          else alert('approve failed');
        }}
      >
        Approve final cut
      </button>
    );
    onSecondary(
      // A video with no assembled versions yet must SAY so (legacy behavior) —
      // an empty select reads as broken chrome, not as a degraded state.
      <select id="fc-version" value={version} onChange={e => setVersion(e.target.value)}
        disabled={versions.length === 0}>
        {versions.length === 0
          ? <option value="">No versions available</option>
          : versions.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    );
    return () => {
      onMeta(null);
      onActions(null);
      onSecondary(null);
    };
  }, [version, versions, onMeta, onActions, onSecondary, onRefetch]);

  // Load versions
  useEffect(() => {
    // The server returns { versions: [{ label, file, created, draft }] },
    // oldest first — NOT a bare string[]. Treating it as an array made
    // .reverse() throw and left the tab on "No versions available" forever
    // (owner report 2026-07-31, draft v1 invisible).
    fetch('/versions?video=' + encodeURIComponent(video))
      .then(r => r.json())
      .then((data: { versions?: { label: string }[] }) => {
        const labels = (data.versions ?? []).map(v => v.label).reverse();
        setVersions(labels);
        if (labels.length) setVersion(labels[0]);
      });
  }, [video]);

  // Sync boardData.feedback to fcItems whenever it changes
  useEffect(() => {
    if (boardData.feedback) {
      setFcItems(prev => ({ ...prev, ...boardData.feedback as Record<string, FcItem> }));
    }
  }, [boardData.feedback]);

  // No per-version status poll: the server's /status is the check-off store
  // (claude_status.json) and carries no render status — polling it printed
  // "Status: undefined" under the player.

  // Video listeners
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const updateTime = () => { if (!scrubbing) setCurrentTime(v.currentTime); };
    const onLoadedMetadata = () => {
      setDuration(v.duration);
      v.playbackRate = speed;
      updateTime();
    };
    v.addEventListener('loadedmetadata', onLoadedMetadata);
    v.addEventListener('timeupdate', updateTime);
    v.addEventListener('seeked', updateTime);
    v.addEventListener('play', () => setPaused(false));
    v.addEventListener('pause', () => { setPaused(true); updateTime(); });
    
    return () => {
      v.removeEventListener('loadedmetadata', onLoadedMetadata);
      v.removeEventListener('timeupdate', updateTime);
      v.removeEventListener('seeked', updateTime);
      v.removeEventListener('play', () => setPaused(false));
      v.removeEventListener('pause', () => setPaused(true));
    };
  }, [scrubbing, speed]);

  const seek = (d: number) => {
    if (videoRef.current) videoRef.current.currentTime = clampSeek(videoRef.current.currentTime, duration, d);
  };
  const stepFrame = (dir: number) => {
    if (videoRef.current) {
      if (!videoRef.current.paused) videoRef.current.pause();
      videoRef.current.currentTime = frameStep(videoRef.current.currentTime, dir, FC_FPS);
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

      if (inField) {
        if (t === inputRef.current && inputText === '') doTransport();
        return;
      }
      
      if (doTransport()) return;
      
      if (e.key.length === 1) {
        e.preventDefault();
        if (!paused) videoRef.current?.pause();
        inputRef.current?.focus();
        setInputText(prev => prev + e.key);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [paused, inputText, duration]);

  const handleImageFile = (file?: File) => {
    if (!file) return;
    const err = validateImageFile(file);
    if (err) return alert(err);
    const r = new FileReader();
    r.onload = () => setPendingImage({ url: r.result as string, name: file.name });
    r.readAsDataURL(file);
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    for (const it of Array.from(e.clipboardData.items)) {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        e.preventDefault();
        handleImageFile(it.getAsFile()!);
        return;
      }
    }
  };

  const submitComment = async () => {
    const text = inputText.trim();
    if (!text && !pendingImage) return;
    const t = currentTime;
    const item: FcItem = { text, t, context: 'final@' + fmtClock(t) };
    if (currentPin) {
      item.x = currentPin.x;
      item.y = currentPin.y;
    }
    setSending(true);
    const res = await fetch('/feedback-final', {
      method: 'POST',
      body: JSON.stringify({ label: version, item, image: pendingImage?.url })
    });
    setSending(false);
    if (res.ok) {
      const data = await res.json();
      if (data.key) setFcItems(prev => ({ ...prev, [data.key]: data.item }));
      setInputText('');
      setCurrentPin(null);
      setPendingImage(null);
    } else {
      alert('failed to save');
    }
  };

  const comments = Object.entries(fcItems)
    .filter(([k]) => k.startsWith(`final-${version}:`))
    .sort(([a], [b]) => a.localeCompare(b));

  const scrubProg = duration ? (currentTime / duration * 100) : 0;

  return (
    <div className="fc-container">
      <div className="fc-main">
        <input 
          type="range" 
          className="fc-scrub" 
          id="fc-scrub"
          min="0" 
          max={duration || 0} 
          step="0.01" 
          value={currentTime}
          style={{ '--fc-prog': scrubProg + '%' } as any}
          onInput={e => {
            setScrubbing(true);
            const val = +(e.target as HTMLInputElement).value;
            setCurrentTime(val);
            if (videoRef.current) videoRef.current.currentTime = val;
          }}
          onChange={() => setScrubbing(false)}
        />
        <div className="fc-transport" id="fc-transport">
          <button id="fc-play" onClick={() => paused ? videoRef.current?.play() : videoRef.current?.pause()}>
            {paused ? '▶ Play' : '❚❚ Pause'}
          </button>
          <span className="fc-clock" id="fc-clock">
            <span className="cur">{fmtClockFrames(currentTime)}</span> / <span id="fc-dur">{fmtClock(duration)}</span>
          </span>
          <button onClick={() => seek(-5)} data-seek="-5">−5s</button>
          <button onClick={() => seek(5)} data-seek="5">+5s</button>
          <button onClick={() => stepFrame(-1)} data-frame="-1">‹ frame</button>
          <button onClick={() => stepFrame(1)} data-frame="1">frame ›</button>
          <select id="fc-speed" value={speed} onChange={e => {
            const s = +e.target.value;
            setSpeed(s);
            if (videoRef.current) videoRef.current.playbackRate = s;
          }}>
            <option value="0.5">0.5×</option>
            <option value="0.75">0.75×</option>
            <option value="1">1×</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
          <button id="fc-mute" title="mute/unmute" onClick={() => setMuted(!muted)}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
        
        <div className="fc-video-container" id="fc-video-container">
          <video 
            id="fc-video"
            className="fc-video"
            ref={videoRef}
            src={version ? `/video/${version}` : ''}
            muted={muted}
            onClick={(e) => {
              if (!paused) {
                videoRef.current?.pause();
              } else {
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                setCurrentPin({
                  x: Math.round((e.clientX - rect.left) / rect.width * 1000) / 10,
                  y: Math.round((e.clientY - rect.top) / rect.height * 1000) / 10
                });
              }
            }}
          />
          {currentPin && (
            <div 
              className="fc-pin-marker" 
              id="fc-pin-marker"
              style={{ left: currentPin.x + '%', top: currentPin.y + '%' }}
            />
          )}
        </div>
        
        <div className="fc-kbd-hint" id="fc-kbd-hint">
          <kbd>Space</kbd> play/pause · <kbd>←</kbd> <kbd>→</kbd> ±5s · <kbd>⇧</kbd>+<kbd>←</kbd> <kbd>→</kbd> step a frame · <strong>just start typing</strong> to note the current moment · <strong>click the frame</strong> to pin a note to that exact spot
        </div>
        <div className="fc-msg" id="fc-msg">{statusMsg}</div>
      </div>

      <div className="fc-panel">
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Comments</h3>
        
        <div className="fc-comments" id="fc-comments">
          {comments.map(([k, it]) => {
            const hasXy = typeof it.x === 'number' && typeof it.y === 'number';
            const chipClass = it.status === 'fixed' ? 'fixed' : (it.status === 'question' ? 'question' : (it.status ? 'other' : ''));
            return (
              <div key={k} className="fc-comment-item">
                <div style={{ marginBottom: 4 }}>
                  <a 
                    href="#" 
                    style={{ fontWeight: 'bold', color: 'var(--fg)', textDecoration: 'none' }}
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
                  {it.status && <span className={`fc-chip ${chipClass}`}>{it.status}</span>}
                </div>
                {it.text && <div style={{ whiteSpace: 'pre-wrap' }}>{it.text}</div>}
                {(it as any).image && (
                  <div style={{ marginTop: 8 }}>
                    <img src={`/feedback-image/${k}`} style={{ maxWidth: '100%', borderRadius: 4 }} alt="feedback" />
                  </div>
                )}
                {/* ✎ edit via prompt, ✕ delete via confirm, both blocked for folded - wait, FinalCut comments are not folded in this view (legacy code). */}
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button className="fc-cbtn" onClick={async () => {
                    const nu = prompt('Edit comment:', it.text);
                    if (nu !== null) {
                      const res = await fetch('/save', { method: 'POST', body: JSON.stringify({ items: { [k]: { ...it, text: nu } } }) });
                      if (res.ok) setFcItems(p => ({ ...p, [k]: { ...p[k], text: nu } }));
                    }
                  }}>✎</button>
                  <button className="fc-cbtn" onClick={async () => {
                    if (confirm('Delete comment?')) {
                      const res = await fetch('/save', { method: 'POST', body: JSON.stringify({ items: { [k]: null } }) });
                      if (res.ok) {
                        const next = { ...fcItems };
                        delete next[k];
                        setFcItems(next);
                      }
                    }
                  }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
        
        <textarea 
          ref={inputRef}
          className="fc-input"
          id="fc-input" 
          rows={4} 
          placeholder={paused ? "Pause video to type comment... (Enter to send · Shift+Enter for newline · paste a screenshot to attach)" : "Pause video to type comment..."}
          disabled={!paused || sending}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submitComment();
            }
          }}
        />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <button 
            id="fc-send" 
            className="fc-cbtn" 
            disabled={!paused || sending || (!inputText.trim() && !pendingImage)}
            onClick={submitComment}
          >
            Send
          </button>
          <button 
            id="fc-attach" 
            className="fc-cbtn" 
            disabled={!paused || sending}
            onClick={() => fileRef.current?.click()}
          >
            📎 image
          </button>
          <input 
            type="file" 
            id="fc-file" 
            accept="image/*" 
            hidden 
            ref={fileRef}
            onChange={e => { handleImageFile(e.target.files?.[0]); e.target.value = ''; }}
          />
          {pendingImage && (
            <span id="fc-img-preview" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--dim)' }}>
              <img src={pendingImage.url} style={{ height: 34, borderRadius: 4, border: '1px solid var(--line)' }} alt="preview" />
              {pendingImage.name || 'pasted image'}
              <button className="fc-cbtn" title="remove image" onClick={() => setPendingImage(null)}>✕</button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
