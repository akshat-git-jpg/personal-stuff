import { useEffect, useState, ReactNode } from 'react';
import './IntroTab.css';
import { ReviewSurface, ReviewComment, PlayerApi } from '../components/ReviewSurface';
import { fmtClock } from '../lib/fcTransport';

// Gate 027. The player, comment list and composer come from <ReviewSurface>,
// shared with Final Cut — this file owns only what is specific to reviewing a
// bespoke intro film: the approve action, the check findings, and the beat
// sheet (each beat's stage direction beside the frames it actually produced).

export function IntroTab({ video, onMeta, onActions, onSecondary, onRefetch }: {
  video: string;
  onMeta: (meta: ReactNode) => void;
  onActions: (actions: ReactNode) => void;
  onSecondary: (sec: ReactNode) => void;
  onRefetch: () => Promise<void>;
}) {
  const [data, setData] = useState<any>(null);
  const [fcItems, setFcItems] = useState<Record<string, ReviewComment>>({});
  const [videoMissing, setVideoMissing] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const loadData = async () => {
    // Each fetch gets its own failure. Chained in one try, a board-data 500 both
    // skipped the render probe below AND landed in a catch that set
    // videoMissing — so the tab claimed "Intro film not rendered yet" about a
    // film sitting on disk, and hid the player that would have shown it.
    try {
      const res = await fetch(`/api/intro-data?video=${encodeURIComponent(video)}`);
      setData(await res.json());
    } catch (e) {
      console.error(e);
    }

    try {
      const resBd = await fetch(`/api/board-data?video=${encodeURIComponent(video)}`);
      const bd = await resBd.json();
      if (bd.feedback) setFcItems(bd.feedback);
    } catch (e) {
      console.error(e);   // comments are lost, the player is not
    }

    // The only thing that can prove the film is unrendered.
    try {
      const resVid = await fetch(`/intro-video?video=${encodeURIComponent(video)}`, { headers: { Range: 'bytes=0-0' } });
      setVideoMissing(resVid.status === 404);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [video]);

  useEffect(() => {
    onMeta(null);
    onSecondary(null);

    // No film-approve action while the idea gate (028) is still open — there
    // is no film to approve yet, and showing the button anyway would let the
    // owner approve a film that has not been authored against the chosen idea.
    const ideaOpen = !!(data?.idea && !data.idea.approved);
    if (data?.present && !ideaOpen) {
      const isApproved = !!data.approved;
      onActions(
        <button
          className={`approve intro-approve-btn ${isApproved ? 'approved' : ''}`}
          onClick={async () => {
            try {
              const res = await fetch('/approve-intro', { method: 'POST' });
              if (res.ok) await loadData();
            } catch (e) {
              console.error(e);
            }
          }}
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

    return () => { onActions(null); };
  }, [data, onActions, onMeta, onSecondary, videoMissing]);

  // The wrapper carries no padding any more (it must not squeeze the player),
  // so text states bring their own rather than hugging the window edge.
  if (!data) return <div className="intro-tab" style={{ padding: 24 }}>loading...</div>;

  if (!data.present) {
    return (
      <div className="intro-tab">
        <div style={{ maxWidth: 800, margin: '24px auto', color: 'var(--dim)', fontSize: 13 }}>
          This video does not use the bespoke intro film. Opt in with <code>run.sh &lt;slug&gt; configure --intro film</code>.
        </div>
      </div>
    );
  }

  // Gate 028 — the idea gate, reviewed BEFORE any beat exists. idea.json can
  // be present with no screenplay.json on disk yet; once approved, the tab
  // falls through to the normal film review below. A page of prose is the
  // cheapest rejection in the pipeline (plan 197).
  if (data.idea && !data.idea.approved) {
    const directions = data.idea.directions || [];
    const rejected = data.idea.rejected || [];

    // Round rejected, 110 has not re-run yet: nothing to approve or compare,
    // so no player grid and no approve controls — just what happened and what
    // to run next.
    if (directions.length === 0 && rejected.length > 0) {
      return (
        <div className="intro-tab" style={{ padding: 24 }}>
          <h3>Round {data.idea.round - 1} rejected</h3>
          {rejected.map((r: any, i: number) => (
            <blockquote key={i} className="intro-idea-rejected-note">{r.note}</blockquote>
          ))}
          {data.idea.round > 3 ? (
            <p>Three rounds is the cap. Describe the direction you want directly instead of asking for a fourth set.</p>
          ) : (
            <p>Run <code>bash run.sh {video} intro-idea</code></p>
          )}
        </div>
      );
    }

    // No idea pass output at all yet.
    if (directions.length === 0) {
      return (
        <div className="intro-tab" style={{ padding: 24 }}>
          <p>Run <code>bash run.sh {video} intro-idea</code></p>
        </div>
      );
    }

    const playable = new Set(data.idea.playable || []);

    return (
      <div className="intro-tab" style={{ padding: 24 }}>
        <div className="intro-idea-directions">
          {directions.map((d: any) => {
            const isPlayable = playable.has(d.id);
            return (
              <div key={d.id} className="intro-idea-direction">
                <h3>{d.id} — {d.name}</h3>
                {isPlayable ? (
                  <video
                    className="intro-idea-teaser"
                    src={`/intro-teaser?id=${encodeURIComponent(d.id)}&video=${encodeURIComponent(video)}`}
                    controls
                    loop
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div className="intro-idea-teaser-missing">
                    IDEA-TEASER-NOT-RENDERED — run <code>bash run.sh {video} intro-teasers</code>
                  </div>
                )}
                <div className="intro-idea-field"><strong>Central object:</strong> {d.central_object}</div>
                <ul className="intro-idea-arc">
                  {d.arc?.map((clause: string, i: number) => <li key={i}>{clause}</li>)}
                </ul>
                <div className="intro-idea-field"><strong>Motifs:</strong> {d.motifs?.join(', ')}</div>
                <div className="intro-idea-field"><strong>Enacts through-line:</strong> {d.enacts_throughline}</div>
                <div className="intro-idea-field"><strong>Rejects:</strong> {d.rejects}</div>
                <button
                  className="intro-idea-approve-btn"
                  disabled={!isPlayable}
                  title={!isPlayable ? 'render the teaser first' : undefined}
                  onClick={async () => {
                    try {
                      const res = await fetch('/approve-intro-idea', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ chosen: d.id }),
                      });
                      if (res.ok) await loadData();
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                >
                  Approve direction {d.id}
                </button>
              </div>
            );
          })}
        </div>
        <div className="intro-idea-reject">
          <textarea
            className="intro-idea-reject-note"
            placeholder="What is wrong with all three? Your words go to the next round."
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
          />
          <button
            className="intro-idea-reject-btn"
            disabled={rejectNote.trim().length === 0}
            onClick={async () => {
              try {
                const res = await fetch('/reject-intro-idea', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ note: rejectNote }),
                });
                if (res.ok) {
                  await loadData();
                  setRejectNote('');
                }
              } catch (e) {
                console.error(e);
              }
            }}
          >
            Reject all directions
          </button>
        </div>
      </div>
    );
  }

  const errors = data.findings?.filter((f: any) => f.severity === 'error') || [];
  const warns = data.findings?.filter((f: any) => f.severity !== 'error') || [];
  const findings = [...errors, ...warns];

  // Stage direction beside the frames the beat actually produced. Reading the
  // two against each other is the review: if the text promises the frame goes
  // visibly crooked and the last frame is straight, the film did not do what
  // the screenplay said.
  const beatSheet = (api: PlayerApi) => (
    <>
      {data.beats?.map((b: any, i: number) => (
        <div key={i} className="intro-beat">
          <div className="intro-beat-header">
            {/* Clicking a beat parks the playhead on it. Without this the sheet
                showed WHICH beat changed but gave no way to get there, so the
                owner hunted with the scrubber and kept landing on b01. */}
            <button
              type="button"
              className="intro-beat-jump"
              title={`jump the player to ${b.id}`}
              onClick={() => api.seekTo((b.t_start ?? 0) + 0.4)}
            >
              ▶ {fmtClock(b.t_start ?? 0)}
            </button>
            <strong>{b.id}</strong> · {b.intent} · {b.register} · {b.face}
          </div>
          <div className="intro-beat-clause">“{b.clause}”</div>
          <div className="intro-beat-content">
            <div className="intro-beat-stage">{b.stage}</div>
            <div className="intro-beat-frames">
              {b.frames?.map((f: string, j: number) => (
                <img key={j} src={`/intro-frame?f=${encodeURIComponent(f)}`} alt={f} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </>
  );

  const findingsPanel = findings.length > 0 ? (
    <div className="intro-findings">
      <h3>Findings</h3>
      {findings.map((f: any, i: number) => (
        <div key={i} className={`intro-finding severity-${f.severity}`}>
          <strong>[{f.severity.toUpperCase()}]</strong> {f.from ? `${f.from} - ` : ''}{f.text || f.message}
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div className="intro-tab">
      <ReviewSurface
        src={videoMissing ? '' : `/intro-video?video=${encodeURIComponent(video)}`}
        notReady={<>Intro film not rendered yet — run <code>bash run.sh {video} intro-render</code></>}
        namespace="intro"
        postUrl="/feedback-intro"
        contextPrefix="intro"
        items={fcItems}
        onItemsChange={setFcItems}
        panelTop={findingsPanel}
        belowPlayer={beatSheet}
      />
    </div>
  );
}
