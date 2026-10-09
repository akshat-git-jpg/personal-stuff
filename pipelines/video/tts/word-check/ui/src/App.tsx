import { useCallback, useEffect, useRef, useState } from 'react';

type Option = { spelling: string; audio: string; ready: boolean };
type Word = { word: string; approved: string | null; options: Option[] };
type Job = { job: string; words: Word[] };
type View = { jobs: Job[]; pending: number };

// Poll so options added from the terminal show up without a reload.
const POLL_MS = 3000;

export function App() {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState('');
  const audio = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('api/queue');
      setView(await res.json());
      setError('');
    } catch {
      setError('Cannot reach the server. Is it running?');
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  function play(o: Option) {
    audio.current?.pause();
    const a = new Audio(`${o.audio}?t=${Date.now()}`);
    audio.current = a;
    setPlaying(o.audio);
    a.onended = () => setPlaying('');
    a.play().catch(() => setPlaying(''));
  }

  async function approve(word: string, spelling: string) {
    const res = await fetch('api/approve', { method: 'POST', body: JSON.stringify({ word, spelling }) });
    if (res.ok) setView(await res.json());
    else setError((await res.json()).error ?? 'Approve failed');
  }

  if (!view) return <main className="page"><p className="muted">{error || 'Loading…'}</p></main>;

  return (
    <main className="page">
      <header className="top">
        <h1>Word pronunciation check</h1>
        <span className={view.pending ? 'pill wait' : 'pill done'}>
          {view.pending ? `${view.pending} word${view.pending > 1 ? 's' : ''} waiting` : 'All words approved'}
        </span>
      </header>
      <p className="muted">
        Play each option. Approve the one that sounds right. If none is right, say so in the terminal and new options appear here.
      </p>
      {error && <p className="error">{error}</p>}
      {view.jobs.length === 0 && <p className="muted">No words to check yet.</p>}

      {view.jobs.map((j) => (
        <section key={j.job} className="job">
          <h2>{j.job}</h2>
          {j.words.length === 0 && <p className="muted">No risky words in this script.</p>}
          <div className="grid">
            {j.words.map((w) => (
              <article key={w.word} className={w.approved ? 'card ok' : 'card'}>
                <h3>{w.word}</h3>
                {w.approved && <p className="chosen">Approved: <strong>{w.approved}</strong></p>}
                <ul>
                  {w.options.map((o, i) => (
                    <li key={o.spelling} className={w.approved === o.spelling ? 'opt picked' : 'opt'}>
                      <button className="play" disabled={!o.ready} onClick={() => play(o)} aria-label={`Play ${o.spelling}`}>
                        {playing === o.audio ? '■' : '▶'}
                      </button>
                      <span className="spell">
                        {o.spelling}
                        {i === 0 && <em> as written</em>}
                        {!o.ready && <em> making audio…</em>}
                      </span>
                      <button className="approve" disabled={!o.ready || w.approved === o.spelling} onClick={() => approve(w.word, o.spelling)}>
                        {w.approved === o.spelling ? 'Approved' : 'Approve'}
                      </button>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
