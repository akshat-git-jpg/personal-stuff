import { useEffect, useRef, useState, type MouseEvent, type WheelEvent } from 'react';
import type { Card, Part } from '../lib/api';
import { clock, tickStep, zoomWindow } from '../lib/review';

export interface Pin { key: string; label: string; t: number; done: boolean; draft?: boolean }

interface Props {
  duration: number;
  t: number;
  win: [number, number];
  setWin: (w: [number, number]) => void;
  onSeek: (t: number) => void;
  parts: Part[];
  cards: Card[];
  pins: Pin[];
  onPin: (key: string) => void;
  thumbAt: ((t: number) => string) | null;
  peaks: { perSec: number; data: number[] } | null;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function Wave({ peaks, win }: { peaks: Props['peaks']; win: [number, number] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !peaks) return;
    const w = c.clientWidth, h = c.clientHeight, dpr = devicePixelRatio || 1;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#6f6559';
    const span = win[1] - win[0];
    for (let x = 0; x < w; x += 3) {
      const a = Math.floor((win[0] + (x / w) * span) * peaks.perSec);
      const b = Math.max(a + 1, Math.floor((win[0] + ((x + 3) / w) * span) * peaks.perSec));
      let m = 0;
      for (let i = a; i < b && i < peaks.data.length; i++) m = Math.max(m, peaks.data[i]);
      const bh = Math.max(1, (m / 255) * (h - 6));
      g.fillRect(x, (h - bh) / 2, 2, bh);
    }
  }, [peaks, win]);
  return <canvas ref={ref} className="wave" aria-hidden="true" />;
}

export function Timeline({ duration, t, win, setWin, onSeek, parts, cards, pins, onPin, thumbAt, peaks }: Props) {
  const [laneRef, width] = useWidth();
  const span = Math.max(0.001, win[1] - win[0]);
  const x = (s: number) => `${((s - win[0]) / span) * 100}%`;
  const w = (d: number) => `calc(${(d / span) * 100}% - 2px)`;
  const visible = (a: number, b: number) => b >= win[0] && a <= win[1];
  const timeAt = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(duration, win[0] + ((e.clientX - r.left) / r.width) * span));
  };
  const seekLane = (e: MouseEvent<HTMLDivElement>) => onSeek(timeAt(e));
  const zoom = (f: number) => setWin(zoomWindow(win, f, t, duration));
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setWin(zoomWindow(win, e.deltaY > 0 ? 1.25 : 0.8, t, duration));
  };

  const step = tickStep(span, width);
  const ticks: number[] = [];
  for (let s = Math.ceil(win[0] / step) * step; s <= win[1]; s += step) ticks.push(s);

  const partEnds = parts.map((p, i) => ({ ...p, end: parts[i + 1]?.start ?? duration }));
  const frames: number[] = [];
  if (thumbAt) {
    const n = Math.max(1, Math.floor(width / 96));
    const fstep = Math.max(1, Math.round(span / n));
    for (let i = 0; i < n; i++) frames.push(Math.min(duration - 0.5, Math.round((win[0] + (i + 0.5) * (span / n)) / fstep) * fstep));
  }
  const fw = width ? (span / Math.max(1, frames.length)) * 0.94 : 0;

  const playhead = visible(t, t) ? <span className="playhead" style={{ left: x(t) }} /> : null;
  const full = duration || 1;

  return (
    <section className="tl" aria-label="Timeline">
      <div className="tl-bar">
        <span className="eyebrow">Timeline</span>
        <span className="mono dim" style={{ fontSize: 12 }}>showing {clock(win[0])} to {clock(win[1])}</span>
        <div className="grow" />
        <button className="btn small" aria-label="Zoom out" onClick={() => zoom(1.6)}>-</button>
        <button className="btn small" onClick={() => setWin([0, duration])}>Fit</button>
        <button className="btn small" aria-label="Zoom in" onClick={() => zoom(0.6)}>+</button>
        <span className="dim" style={{ fontSize: 11 }}>Ctrl + scroll to zoom</span>
      </div>

      <div className="row" style={{ paddingTop: 10, border: 0 }}>
        <div className="row-name">Whole</div>
        <div className="mini" style={{ marginRight: 16 }} onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const at = ((e.clientX - r.left) / r.width) * duration;
          const half = span / 2;
          const a = Math.max(0, Math.min(duration - span, at - half));
          setWin([a, a + span]);
          onSeek(at);
        }}>
          {partEnds.map((p, i) => (
            <span key={i} title={p.name} style={{ left: `${(p.start / full) * 100}%`, width: `calc(${((p.end - p.start) / full) * 100}% - 2px)`, borderRadius: 2, background: i % 2 ? '#2b251f' : '#3a3129' }} />
          ))}
          {pins.filter((p) => !p.done).map((p) => (
            <span key={p.key} style={{ left: `${(p.t / full) * 100}%`, width: 2, background: 'var(--accent)' }} />
          ))}
          <span style={{ left: `${(win[0] / full) * 100}%`, width: `${(span / full) * 100}%`, top: 0, bottom: 0, border: '1px solid var(--accent)', borderRadius: 3, background: 'rgba(251,146,60,0.15)' }} />
        </div>
      </div>

      <div className="tl-rows" onWheel={onWheel}>
        <div className="row" style={{ height: 22 }}>
          <div className="row-name">Time</div>
          <div className="lane" ref={laneRef} onClick={seekLane}>
            {ticks.map((s) => <span key={s} className="tick" style={{ left: x(s) }}>{clock(s)}</span>)}
          </div>
        </div>
        <div className="row" style={{ height: 30 }}>
          <div className="row-name">Pins</div>
          <div className="lane" onClick={seekLane}>
            {pins.filter((p) => visible(p.t, p.t)).map((p) => (
              <button key={p.key} className={`pin${p.done ? ' done' : ''}`} style={{ left: x(p.t), ...(p.draft ? { background: 'var(--accent-text)' } : {}) }}
                title={p.label} aria-label={`Comment ${p.label} at ${clock(p.t)}`}
                onClick={(e) => { e.stopPropagation(); onPin(p.key); }}>{p.draft ? '+' : p.label}</button>
            ))}
            {playhead}
          </div>
        </div>
        <div className="row" style={{ height: 30 }}>
          <div className="row-name">Parts</div>
          <div className="lane" onClick={seekLane}>
            {partEnds.filter((p) => visible(p.start, p.end)).map((p, i) => (
              <span key={i} className="blk part-blk" style={{ left: x(p.start), width: w(p.end - p.start) }} title={p.name}>{((p.end - p.start) / span) * width > 28 ? p.name : ''}</span>
            ))}
            {playhead}
          </div>
        </div>
        <div className="row" style={{ height: 34 }}>
          <div className="row-name">Cards</div>
          <div className="lane" onClick={seekLane}>
            {cards.filter((c) => visible(c.start, c.start + c.duration)).map((c) => (
              <span key={c.id} className="blk card-blk" style={{ left: x(c.start), width: w(Math.max(c.duration, span / 300)) }} title={`${c.id} · ${c.card}`}>
                {(c.duration / span) * width > 44 ? `${c.id} ${c.card.split('/').pop()}` : ''}
              </span>
            ))}
            {playhead}
          </div>
        </div>
        {thumbAt && (
          <div className="row" style={{ height: 50 }}>
            <div className="row-name">Video</div>
            <div className="lane" onClick={seekLane}>
              {frames.map((s, i) => (
                <img key={`${i}-${s}`} className="frame" alt="" loading="lazy" src={thumbAt(s)} style={{ left: x(win[0] + (i * span) / frames.length), width: w(fw) }} />
              ))}
              {playhead}
            </div>
          </div>
        )}
        {peaks && (
          <div className="row" style={{ height: 46 }}>
            <div className="row-name">Voice</div>
            <div className="lane" onClick={seekLane}>
              <Wave peaks={peaks} win={win} />
              {playhead}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
