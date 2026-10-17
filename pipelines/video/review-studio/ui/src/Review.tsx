import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type VideoDetail } from './lib/api';
import { cardAt, clock, comments, groupLines, isOpen, lineAt, partAt, pinNumbers, sayingAt } from './lib/review';
import { Comments, type Draft, type Tab } from './components/Comments';
import { Timeline, type Pin } from './components/Timeline';
import { Brand } from './App';

const SPEEDS = [0.5, 1, 1.5, 2];
const OLD_BOARD: Record<string, (slug: string) => string> = {
  'visuals-flow': (slug) => `http://localhost:4322/?video=${slug}`,
  'animate-flow': () => 'http://localhost:4330/',
};

export function Review({ recipe, slug }: { recipe: string; slug: string }) {
  const [data, setData] = useState<VideoDetail | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState<string | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [tab, setTab] = useState<Tab>('open');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [win, setWin] = useState<[number, number]>([0, 1]);
  const [peaks, setPeaks] = useState<{ perSec: number; data: number[] } | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const scriptRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(() => api.video(recipe, slug).then((d) => { setData(d); return d; }), [recipe, slug]);

  useEffect(() => {
    reload().then((d) => {
      const pick = d.approved?.version && d.versions.some((v) => v.label === d.approved!.version) ? d.approved.version : d.versions.at(-1)?.label ?? null;
      setVersion(pick);
      setWin([0, Math.max(1, d.duration)]);
    }, (e) => setError(String(e.message ?? e)));
  }, [reload]);

  // Picks up comments written by the old board while this page is open.
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden && !draft) void reload().catch(() => {}); }, 5000);
    return () => clearInterval(id);
  }, [reload, draft]);

  useEffect(() => {
    setPeaks(null); setMediaError(false);
    if (version) api.peaks(recipe, slug, version).then(setPeaks, () => setPeaks(null));
  }, [recipe, slug, version]);

  useEffect(() => { if (video.current) video.current.playbackRate = speed; }, [speed, version]);

  // Smooth play head while playing.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => { if (video.current) setT(video.current.currentTime); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const duration = Math.max(data?.duration ?? 0, video.current?.duration || 0, 1);
  const hasVideo = !!version && !mediaError;

  // Keep the play head inside the timeline window while playing.
  useEffect(() => {
    if (!playing) return;
    if (t > win[1] || t < win[0]) {
      const span = win[1] - win[0];
      const a = Math.max(0, Math.min(duration - span, t - span * 0.1));
      setWin([a, a + span]);
    }
  }, [t, playing, win, duration]);

  const seek = useCallback((s: number) => {
    const at = Math.max(0, Math.min(duration, s));
    if (video.current && hasVideo) video.current.currentTime = at;
    setT(at);
  }, [duration, hasVideo]);

  const togglePlay = useCallback(() => {
    const v = video.current;
    if (!v || !hasVideo) return;
    if (v.paused) void v.play(); else v.pause();
  }, [hasVideo]);

  const lines = useMemo(() => groupLines(data?.words ?? []), [data]);
  const list = useMemo(() => comments(data?.items ?? {}), [data]);
  const current = lineAt(lines, t);
  const part = data ? partAt(data.parts, t) : 0;

  useEffect(() => {
    const el = scriptRef.current?.querySelector('[aria-current="true"]');
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]);

  const startComment = useCallback(() => {
    if (!data) return;
    video.current?.pause();
    const card = cardAt(data.cards, t);
    setDraft({ t, saying: sayingAt(data.words, t), part: data.parts[partAt(data.parts, t)]?.name ?? '', card: card ? `${card.id} · ${card.card}` : '' });
    setTab('open');
  }, [data, t]);

  const pinsFor = (version ? list.filter((c) => c.version === version) : list).filter((c) => c.t !== undefined);
  const nums = pinNumbers(list);
  const pins: Pin[] = pinsFor.map((c) => ({ key: c.key, label: String(nums.get(c.key)), t: c.t!, done: !isOpen(c) }));
  if (draft) pins.push({ key: '_draft', label: '+', t: draft.t, done: false, draft: true });

  const jumpPin = useCallback((dir: 1 | -1) => {
    const ts = pins.filter((p) => !p.draft).map((p) => p.t).sort((a, b) => a - b);
    const next = dir > 0 ? ts.find((x) => x > t + 0.3) : [...ts].reverse().find((x) => x < t - 0.3);
    if (next !== undefined) seek(next);
  }, [pins, t, seek]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === ' ') { e.preventDefault(); togglePlay(); }
      else if (k === 'j') seek(t - 5);
      else if (k === 'l') seek(t + 5);
      else if (k === 'arrowleft') seek(t - 1);
      else if (k === 'arrowright') seek(t + 1);
      else if (k === 'c') { e.preventDefault(); startComment(); }
      else if (k === 'f') void video.current?.requestFullscreen?.();
      else if (k === '[') jumpPin(-1);
      else if (k === ']') jumpPin(1);
      else return;
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [togglePlay, seek, t, startComment, jumpPin]);

  if (error) return <div className="home"><Brand /><div className="empty error">Could not open this video: {error}</div></div>;
  if (!data) return <div className="home"><div className="empty">Loading</div></div>;

  const oldBoard = OLD_BOARD[data.recipe]?.(data.slug);
  const selectComment = (key: string) => {
    setSelected(key);
    const c = list.find((x) => x.key === key);
    if (c) setTab(isOpen(c) ? 'open' : 'fixed');
    if (c?.t !== undefined) seek(c.t);
  };

  return (
    <div className="review">
      <header className="topbar">
        <a className="btn" href="#/">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>Videos
        </a>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
          <span className="eyebrow">{data.recipeLabel} · {clock(duration)}</span>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{data.title}</span>
        </div>
        <div className="seg" role="group" aria-label="Version">
          {data.versions.length === 0 && <span className="dim" style={{ padding: '4px 8px', fontSize: 12 }}>No renders</span>}
          {data.versions.map((v) => (
            <button key={v.label} aria-pressed={v.label === version} className="mono" onClick={() => { setVersion(v.label); setPlaying(false); }}>
              {v.label.toUpperCase()}
            </button>
          ))}
        </div>
        {data.approved && <span className="chip ok">Approved{data.approved.version ? ` · ${data.approved.version.toUpperCase()}` : ''}</span>}
        <div className="grow" />
        <span className="dim" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5fd38d' }} />Saves to feedback.json
        </span>
        {oldBoard && <a href={oldBoard} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>Open old board</a>}
      </header>

      <div className="panes">
        <nav className="pane parts" aria-label="Parts">
          <div className="pane-head"><span className="eyebrow">Parts</span></div>
          <div className="pane-body" style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {data.parts.map((p, i) => {
              const end = data.parts[i + 1]?.start ?? duration;
              const open = list.filter((c) => isOpen(c) && c.t !== undefined && c.t >= p.start && c.t < end).length;
              return (
                <button key={i} className="part" aria-current={part === i} onClick={() => seek(p.start + 0.01)}>
                  <span className="mono dim" style={{ fontSize: 11, width: 40 }}>{clock(p.start)}</span>
                  <span style={{ flex: 1 }}>{p.name}</span>
                  {open > 0 && <span className="chip warn mono" style={{ fontSize: 11, padding: '0 6px' }}>{open}</span>}
                </button>
              );
            })}
          </div>
        </nav>

        <section className="pane player" aria-label="Player">
          <div className="stage">
            {hasVideo ? (
              <video
                ref={video}
                src={api.mediaUrl(recipe, slug, version!)}
                preload="metadata"
                onPlay={() => setPlaying(true)}
                onPause={() => { setPlaying(false); setT(video.current?.currentTime ?? t); }}
                onSeeked={() => setT(video.current?.currentTime ?? t)}
                onLoadedMetadata={() => { if (video.current) { video.current.playbackRate = speed; video.current.currentTime = t; } }}
                onError={() => setMediaError(true)}
                onClick={togglePlay}
              />
            ) : (
              <div className="novideo">
                {version ? `The file for ${version.toUpperCase()} is missing on this machine.` : 'No rendered version of this video on this machine.'}
                <br />You can still read the script and the comments, and add notes.
              </div>
            )}
          </div>
          <div className="transport">
            <button className="btn" onClick={() => seek(t - 5)} aria-label="Back 5 seconds">-5s <span className="key">J</span></button>
            <button className="btn" onClick={togglePlay} disabled={!hasVideo} style={{ fontWeight: 600 }}>
              {playing ? 'Pause' : 'Play'} <span className="key">Space</span>
            </button>
            <button className="btn" onClick={() => seek(t + 5)} aria-label="Forward 5 seconds">+5s <span className="key">L</span></button>
            <span className="mono" style={{ fontSize: 13, margin: '0 4px' }}>{clock(t, true)} <span className="dim">/ {clock(duration, true)}</span></span>
            <div className="seg" role="group" aria-label="Speed">
              {SPEEDS.map((s) => <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}x</button>)}
            </div>
            <div className="grow" />
            <button className="btn" disabled={!hasVideo} onClick={() => void video.current?.requestFullscreen?.()}>Full screen <span className="key">F</span></button>
            <button className="btn primary" onClick={startComment}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Comment here <span className="key">C</span>
            </button>
          </div>
        </section>

        <div className="side">
        <section className="pane script" aria-label="Script">
          <div className="pane-head"><span className="eyebrow">Script</span><span className="dim" style={{ fontSize: 11 }}>follows playback</span></div>
          <div className="pane-body" ref={scriptRef} style={{ padding: '0 10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {!lines.length && <div className="dim" style={{ padding: 8 }}>No transcript for this video.</div>}
            {lines.map((l, i) => (
              <button key={i} className="line" aria-current={i === current} onClick={() => seek(l.start)}>
                <span className="at">{clock(l.start)}</span>{l.text}
              </button>
            ))}
          </div>
        </section>

        <Comments
          tab={tab}
          setTab={setTab}
          list={list}
          version={version}
          selected={selected}
          draft={draft}
          onCancelDraft={() => setDraft(null)}
          onSave={async (text, why, images) => {
            if (!draft) return;
            const label = version ?? 'v1';
            const res = await api.addComment(recipe, slug, { label, t: draft.t, text, why, images });
            setDraft(null);
            await reload();
            setSelected(res.key);
          }}
          onSeek={seek}
          onSelect={selectComment}
          onEdit={async (key, text, why) => { await api.editComment(recipe, slug, { key, text, why }); await reload(); }}
          onDelete={async (key) => { await api.deleteComment(recipe, slug, key); await reload(); }}
          imageUrl={(key, n) => api.imageUrl(recipe, slug, key, n)}
          notes={data.notes}
          notesEnabled={data.notesEnabled}
          onNotes={async (text) => { await api.saveNotes(recipe, slug, text); }}
        />
        </div>
      </div>

      <Timeline
        duration={duration}
        t={t}
        win={win}
        setWin={setWin}
        onSeek={seek}
        parts={data.parts}
        cards={data.cards}
        pins={pins}
        onPin={(key) => (key === '_draft' ? setTab('open') : selectComment(key))}
        thumbAt={hasVideo ? (s) => api.thumbUrl(recipe, slug, version!, s) : null}
        peaks={hasVideo ? peaks : null}
      />
    </div>
  );
}
