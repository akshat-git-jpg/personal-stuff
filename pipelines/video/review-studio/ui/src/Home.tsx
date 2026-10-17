import { useEffect, useMemo, useState } from 'react';
import { api, type VideoSummary } from './lib/api';
import { Brand } from './App';

type Filter = 'all' | 'open' | 'approved' | 'nocut' | string;

const FILTERS: [Filter, string, (v: VideoSummary) => boolean][] = [
  ['all', 'All', () => true],
  ['open', 'Open comments', (v) => v.comments.open > 0],
  ['approved', 'Approved', (v) => !!v.approved],
  ['nocut', 'No cut yet', (v) => v.versions.length === 0],
];

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function status(v: VideoSummary) {
  if (v.approved) return <span className="chip ok">Approved{v.approved.version ? ` · ${v.approved.version.toUpperCase()}` : ''}</span>;
  if (!v.versions.length) return <span className="chip plain">No cut yet</span>;
  return <span className="chip warn">In review · {v.versions.at(-1)!.toUpperCase()}</span>;
}

export function Home() {
  const [videos, setVideos] = useState<VideoSummary[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');

  useEffect(() => { api.videos().then(setVideos, (e) => setError(String(e.message ?? e))); }, []);

  const recipes = useMemo(() => [...new Set((videos ?? []).map((v) => v.recipeLabel))], [videos]);
  const filters = useMemo(() => [
    ...FILTERS,
    ...recipes.map((r) => [r, r, (v: VideoSummary) => v.recipeLabel === r] as [Filter, string, (v: VideoSummary) => boolean]),
  ], [recipes]);
  const test = filters.find((f) => f[0] === filter)?.[2] ?? (() => true);
  const needle = q.trim().toLowerCase();
  const shown = (videos ?? []).filter(test).filter((v) => !needle || `${v.title} ${v.slug}`.toLowerCase().includes(needle));

  return (
    <div>
      <header className="topbar">
        <Brand />
        <div className="grow" />
        <label style={{ display: 'flex', flex: '1 1 260px', maxWidth: 420 }}>
          <span className="sr">Search videos</span>
          <input type="search" placeholder="Search videos" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', height: 36 }} />
        </label>
        <div className="grow" />
        <span className="dim" style={{ fontSize: 12 }}>Comments save to each video's feedback.json</span>
      </header>
      <main className="home">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="eyebrow">Videos · newest first</span>
            <h1>Your videos</h1>
          </div>
          <div className="filters" role="group" aria-label="Filter videos">
            {filters.map(([id, label, fn]) => (
              <button key={id} className="filter" aria-pressed={filter === id} onClick={() => setFilter(id)}>
                {label}<span className="mono" style={{ fontSize: 11, opacity: 0.75 }}>{(videos ?? []).filter(fn).length}</span>
              </button>
            ))}
          </div>
        </div>
        {error && <div className="empty error">Could not load videos: {error}</div>}
        {!videos && !error && <div className="empty">Loading videos</div>}
        {videos && !shown.length && <div className="empty">No videos match.</div>}
        <div className="grid">
          {shown.map((v) => {
            const latest = v.approved?.version && v.versions.includes(v.approved.version) ? v.approved.version : v.versions.at(-1);
            return (
              <a key={`${v.recipe}/${v.slug}`} className="card" href={`#/v/${v.recipe}/${v.slug}`}>
                <div className="thumb">
                  {latest
                    ? <img loading="lazy" alt="" src={api.thumbUrl(v.recipe, v.slug, latest, 8)} />
                    : <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#0d0b09" stroke="#2b251f" /><path d="M16 13v14l11-7z" fill="#a39684" /></svg>}
                  <span className="tag">{v.recipeLabel}</span>
                </div>
                <div className="card-body">
                  <div className="card-title">{v.title}</div>
                  <div className="meta">
                    {status(v)}
                    <span className="dim">
                      {v.comments.total ? `${v.comments.total} comments${v.comments.open ? '' : ' · all fixed'}` : 'No comments'}
                    </span>
                    {v.comments.open > 0 && <span className="chip warn">{v.comments.open} open</span>}
                  </div>
                  <div className="mono dim" style={{ fontSize: 11 }}>{v.slug} · updated {day(v.updated)}</div>
                </div>
              </a>
            );
          })}
        </div>
      </main>
    </div>
  );
}
