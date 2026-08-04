import React, { useEffect, useState, ReactNode, useRef } from 'react';
import './IntroTab.css';
import { fmtClock, fmtClockFrames, clampSeek, frameStep } from '../lib/fcTransport';

export function IntroTab({ video, onMeta, onActions, onSecondary, onRefetch }: {
  video: string;
  onMeta: (meta: ReactNode) => void;
  onActions: (actions: ReactNode) => void;
  onSecondary: (sec: ReactNode) => void;
  onRefetch: () => Promise<void>;
}) {
  const [data, setData] = useState<any>(null);
  const [fcItems, setFcItems] = useState<Record<string, any>>({});
  const [videoMissing, setVideoMissing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [currentPin, setCurrentPin] = useState<{x: number, y: number} | null>(null);

  const loadData = async () => {
    try {
      const res = await fetch(`/api/intro-data?video=${encodeURIComponent(video)}`);
      setData(await res.json());

      const resBd = await fetch(`/api/board-data?video=${encodeURIComponent(video)}`);
      const bd = await resBd.json();
      if (bd.feedback) setFcItems(bd.feedback);

      const resVid = await fetch(`/intro-video?video=${encodeURIComponent(video)}`, { headers: { Range: 'bytes=0-0' } });
      setVideoMissing(resVid.status === 404);
    } catch (e) {
      console.error(e);
      setVideoMissing(true);
    }
  };

  useEffect(() => {
    loadData();
  }, [video]);

  // Video listeners
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const updateTime = () => { if (!scrubbing) setCurrentTime(v.currentTime); };
    const onLoadedMetadata = () => {
      setDuration(v.duration);
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
  }, [scrubbing]);

  const seek = (d: number) => {
    if (videoRef.current) videoRef.current.currentTime = clampSeek(videoRef.current.currentTime, duration, d);
  };
  const stepAFrame = (dir: number) => {
    if (videoRef.current) {
      if (!videoRef.current.paused) videoRef.current.pause();
      videoRef.current.currentTime = frameStep(videoRef.current.currentTime, dir, 30);
    }
  };

  useEffect(() => {
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      
      const doTransport = () => {
        if (e.key === ' ') { e.preventDefault(); paused ? videoRef.current?.play() : videoRef.current?.pause(); return true; }
        if (e.key === 'ArrowLeft') { e.preventDefault(); e.shiftKey ? stepAFrame(-1) : seek(-5); return true; }
        if (e.key === 'ArrowRight') { e.preventDefault(); e.shiftKey ? stepAFrame(1) : seek(5); return true; }
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

  useEffect(() => {
    onMeta(null);
    onSecondary(null);

    if (data?.present) {
      const isApproved = !!data.approved;
      const approve = async () => {
        try {
          const res = await fetch('/approve-intro', { method: 'POST' });
          if (res.ok) await loadData();
        } catch (e) {
          console.error(e);
        }
      };

      onActions(
        <button
          className={`approve intro-approve-btn ${isApproved ? 'approved' : ''}`}
          onClick={approve}
          disabled={isApproved || videoMissing}
          title={videoMissing ? 'render the intro film first' : (isApproved ? 'approved' : undefined)}
          style={{ borderColor: 'var(--ok)', color: 'var(--ok)' }}
        >
          {isApproved ? '✓ intro film approved' : 'Approve intro film'}
        </button>
      );
    } else {
      onActions(null);
    }

    return () => {
      onActions(null);
    };
  }, [data, onActions, onMeta, onSecondary, videoMissing]);

  const submitComment = async () => {
    const text = inputText.trim();
    if (!text) return;
    const t = currentTime;
    const item: any = { text, t, context: 'intro@' + fmtClock(t) };
    if (currentPin) { item.x = currentPin.x; item.y = currentPin.y; }
    const res = await fetch('/feedback-intro', {
      method: 'POST',
      body: JSON.stringify({ item })
    });
    if (res.ok) {
      const resp = await res.json();
      if (resp.key) setFcItems(prev => ({ ...prev, [resp.key]: resp.item }));
      setInputText('');
      setCurrentPin(null);
    } else {
      alert('failed to save');
    }
  };

  const deleteComment = async (k: string) => {
    if (!confirm('Delete comment?')) return;
    const res = await fetch('/feedback-final-delete', {
      method: 'POST',
      body: JSON.stringify({ key: k })
    });
    if (res.ok) {
      const next = { ...fcItems };
      delete next[k];
      setFcItems(next);
    }
  };

  if (!data) return <div className="intro-tab">loading...</div>;

  if (!data.present) {
    return (
      <div className="intro-tab">
        <div style={{ maxWidth: 800, margin: '24px auto', color: 'var(--dim)', fontSize: 13 }}>
          This video does not use the bespoke intro film. Opt in with <code>run.sh &lt;slug&gt; configure --intro film</code>.
        </div>
      </div>
    );
  }

  const errors = data.findings?.filter((f: any) => f.severity === 'error') || [];
  const warns = data.findings?.filter((f: any) => f.severity !== 'error') || [];
  const findings = [...errors, ...warns];

  const comments = Object.entries(fcItems)
    .filter(([k]) => k.startsWith('intro:'))
    .sort(([a], [b]) => {
      const numA = parseInt(a.slice('intro:'.length), 10);
      const numB = parseInt(b.slice('intro:'.length), 10);
      return numA - numB;
    });

  const scrubProg = duration ? (currentTime / duration * 100) : 0;

  return (
    <div className="intro-tab">
      <div className="intro-player-section">
        {videoMissing ? (
          <div className="intro-not-rendered">
            Intro film not rendered yet — run <code>bash run.sh {video} intro-render</code>
          </div>
        ) : (
          <div className="intro-player-container">
            <div className="intro-main">
              <input 
                type="range" 
                className="intro-scrub" 
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
              <div className="intro-transport">
                <button onClick={() => paused ? videoRef.current?.play() : videoRef.current?.pause()}>
                  {paused ? '▶ Play' : '❚❚ Pause'}
                </button>
                <span className="intro-clock">
                  <span className="cur">{fmtClockFrames(currentTime)}</span> / <span>{fmtClock(duration)}</span>
                </span>
                <button onClick={() => seek(-5)}>−5s</button>
                <button onClick={() => seek(5)}>+5s</button>
                <button onClick={() => stepAFrame(-1)}>‹ frame</button>
                <button onClick={() => stepAFrame(1)}>frame ›</button>
              </div>
              
              <div className="intro-video-container">
                <video 
                  className="intro-video"
                  ref={videoRef}
                  src={`/intro-video?video=${encodeURIComponent(video)}`}
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
                    className="intro-pin-marker" 
                    style={{ left: currentPin.x + '%', top: currentPin.y + '%' }}
                  />
                )}
              </div>
              
              <div className="intro-kbd-hint">
                <kbd>Space</kbd> play/pause · <kbd>←</kbd> <kbd>→</kbd> ±5s · <kbd>⇧</kbd>+<kbd>←</kbd> <kbd>→</kbd> step a frame · <strong>just start typing</strong> to note the current moment · <strong>click the frame</strong> to pin a note to that exact spot
              </div>
            </div>

            <div className="intro-panel">
              <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Comments</h3>
              
              <div className="intro-comments">
                {comments.map(([k, it]) => {
                  const hasXy = typeof it.x === 'number' && typeof it.y === 'number';
                  return (
                    <div key={k} className="intro-comment-item">
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
                      </div>
                      {it.text && <div style={{ whiteSpace: 'pre-wrap' }}>{it.text}</div>}
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button className="intro-cbtn" onClick={() => deleteComment(k)}>✕ Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <textarea 
                ref={inputRef}
                className="intro-input"
                rows={4} 
                placeholder={paused ? "Pause video to type comment... (Enter to send · Shift+Enter for newline)" : "Pause video to type comment..."}
                disabled={!paused}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitComment();
                  }
                }}
              />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <button 
                  className="intro-cbtn" 
                  disabled={!paused || !inputText.trim()}
                  onClick={submitComment}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {findings.length > 0 && (
        <div className="intro-findings">
          <h3>Findings</h3>
          {findings.map((f: any, i: number) => (
            <div key={i} className={`intro-finding severity-${f.severity}`}>
              <strong>[{f.severity.toUpperCase()}]</strong> {f.from ? `${f.from} - ` : ''}{f.text || f.message}
            </div>
          ))}
        </div>
      )}

      {data.beats?.map((b: any, i: number) => (
        <div key={i} className="intro-beat">
          <div className="intro-beat-header">
            <strong>{b.id}</strong> · {b.intent} · {b.register} · {b.face}
          </div>
          <div className="intro-beat-clause">“{b.clause}”</div>
          <div className="intro-beat-content">
            <div className="intro-beat-stage">
              {b.stage}
            </div>
            <div className="intro-beat-frames">
              {b.frames?.map((f: string, j: number) => (
                <img key={j} src={`/intro-frame?f=${encodeURIComponent(f)}`} alt={f} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
