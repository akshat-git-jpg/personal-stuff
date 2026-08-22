import { useEffect, useState, ReactNode } from 'react';
import './IntroTab.css';
import { ReviewSurface, ReviewComment, PlayerApi } from '../components/ReviewSurface';
import { FeedbackBox } from '../components/FeedbackBox';
import { fmtClock } from '../lib/fcTransport';
import { DEFAULT_FRAME_ZOOM, canZoom, stepZoom, zoomLabel, zoomSpan } from '../lib/frameZoom';

// Gate 027. The player, comment list and composer come from <ReviewSurface>,
// shared with Final Cut — this file owns only what is specific to reviewing a
// bespoke intro film: the approve action, the check findings, and the beat
// sheet (each beat's stage direction beside the frames it actually produced).

// One frame of the beat sheet, with its own zoom bar directly beneath it. The
// stepping rules live in lib/frameZoom.ts so they are unit-testable — this file
// only wires them.
function BeatFrame({ file, zoom, onZoom }: { file: string; zoom: number; onZoom: (z: number) => void }) {
  return (
    <div className="intro-frame" style={{ gridColumn: `span ${zoomSpan(zoom)}` }}>
      <img
        src={`/intro-frame?f=${encodeURIComponent(file)}`}
        alt={file}
        style={zoom < 1 ? { width: '50%' } : undefined}
      />
      <div className="intro-frame-zoom">
        <button type="button" title="zoom out" disabled={!canZoom(zoom, -1)} onClick={() => onZoom(stepZoom(zoom, -1))}>−</button>
        <span className="intro-frame-zoom-level">{zoomLabel(zoom)}</span>
        <button type="button" title="zoom in" disabled={!canZoom(zoom, 1)} onClick={() => onZoom(stepZoom(zoom, 1))}>+</button>
      </div>
    </div>
  );
}

// Gate 125 (the simple flow, plan 220/221). A locked-kit beat carries its
// on-screen words in one of three shapes depending on which card it fills —
// this is the ONE thing the owner reads per row, so it has to work for all
// three or a row renders blank.
function simpleBeatText(b: any): string {
  const vars = b?.vars || {};
  if (typeof vars.text === 'string') return vars.text;
  if (Array.isArray(vars.rows)) {
    return vars.rows.map((r: any) => r?.label ?? r?.text ?? '').filter(Boolean).join(', ');
  }
  if (typeof vars.appName === 'string') return vars.appName;
  return '';
}

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
  // Zoom level per frame FILE, not per index: a beat's frame list is rebuilt on
  // every poll, so an index-keyed map would move a reader's zoom onto whatever
  // frame slid into that slot. File names are unique across the review dir.
  const [frameZoom, setFrameZoom] = useState<Record<string, number>>({});

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
    // Nor while the simple gate (125) owns the screen — its own inline Approve
    // button is the "one Approve button" the plan calls for; this header
    // button would otherwise double up once intro-film/out/intro.mp4 exists
    // but the cut list is still unapproved.
    const simpleGateOpen = data?.mode === 'simple' && !!data?.cutlist && !data.cutlist.approved;
    if (data?.present && !ideaOpen && !simpleGateOpen) {
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

  // Gate 125 — the simple intro. One surface: watch the cut, read the beat table,
  // approve. There is no idea gate and no frame contact sheet in this flow, because
  // there is no bespoke composition to review — the cards are locked (plan 219).
  // Taken FIRST and by `data.mode`, never by guessing from which files exist: a
  // half-built complex video and a simple video both lack a screenplay.json.
  if (data.mode === 'simple' && data.cutlist && !data.cutlist.approved) {
    const beats = data.cutlist.beats || [];
    const pacing = data.pacing || { avatarShare: 0, cuts: beats.length, longestAvatarHold: 0 };
    const renderCmd = `run.sh ${video} intro-simple-render`;

    return (
      <div className="intro-tab intro-simple-tab" style={{ padding: 24 }}>
        <div className="intro-simple-player">
          {videoMissing ? (
            <div className="intro-simple-player-missing">
              Not rendered yet — run <code>bash {renderCmd}</code>
            </div>
          ) : (
            <video
              className="intro-simple-video"
              src={`/intro-video?video=${encodeURIComponent(video)}`}
              controls
            />
          )}
        </div>

        {/* The pacing strip: the same S1/S2 numbers the lint enforces, each with
            its limit beside it, so a figure near the edge is visible without
            arithmetic. */}
        <div className="intro-simple-pacing">
          <div className="intro-simple-pacing-figure">
            <span className="intro-simple-pacing-value">{Math.round(pacing.avatarShare * 100)}%</span>
            <span className="intro-simple-pacing-label">
              avatar share <span className="intro-simple-pacing-limit">≤ 55%</span>
            </span>
          </div>
          <div className="intro-simple-pacing-figure">
            <span className="intro-simple-pacing-value">{pacing.cuts}</span>
            <span className="intro-simple-pacing-label">cuts</span>
          </div>
          <div className="intro-simple-pacing-figure">
            <span className="intro-simple-pacing-value">{pacing.longestAvatarHold.toFixed(1)}s</span>
            <span className="intro-simple-pacing-label">
              longest hold <span className="intro-simple-pacing-limit">≤ 5.0s</span>
            </span>
          </div>
        </div>

        <table className="intro-simple-beats">
          <thead>
            <tr>
              <th>#</th><th>kind</th><th>card</th><th>start</th><th>length</th><th>text</th>
            </tr>
          </thead>
          <tbody>
            {beats.map((b: any, i: number) => (
              <tr
                key={b.id}
                className={`intro-simple-beat-row${b.kind === 'overlay' ? ' intro-simple-beat-overlay' : ''}`}
              >
                <td>{i + 1}</td>
                <td>{b.kind}</td>
                <td>{b.card ?? '—'}</td>
                <td>{fmtClock(b.t_start ?? 0)}</td>
                <td>{((b.t_end ?? 0) - (b.t_start ?? 0)).toFixed(1)}s</td>
                <td>{simpleBeatText(b)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Per-beat comments — the same autosaved FeedbackBox the complex flow's
            beat sheet already uses (this file's only comment store). No second
            store, no player-tied composer: the player above carries none. */}
        <div className="intro-simple-beat-feedback-list">
          {beats.map((b: any) => (
            <div key={b.id} className="intro-simple-beat-feedback">
              <FeedbackBox
                refKey={`intro-${b.id}`}
                placeholder={`feedback on ${b.id} — staging, timing, wording… (read by the next Claude session)`}
              />
            </div>
          ))}
        </div>

        {/* No Reject button. The fix path for a simple intro is edit the cut
            list and re-render — a session action, not a board round-trip (plan
            221 STOP condition). Do not add one for symmetry with the idea gate. */}
        <button
          type="button"
          className="intro-simple-approve-btn"
          disabled={videoMissing}
          title={videoMissing ? `render the intro first: ${renderCmd}` : undefined}
          onClick={async () => {
            try {
              const res = await fetch('/approve-intro', { method: 'POST' });
              if (res.ok) {
                await loadData();
                await onRefetch();
              }
            } catch (e) {
              console.error(e);
            }
          }}
        >
          Approve intro
        </button>
      </div>
    );
  }

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
        {/* The idea gate is a review too, and rejecting a direction is worth a
            sentence saying why — same autosaved box the film review uses. */}
        <div className="intro-global-feedback" style={{ maxWidth: 800, marginTop: 24 }}>
          <FeedbackBox
            refKey="intro-global"
            placeholder="feedback on these directions (read by the next Claude session)"
          />
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
              {b.frames?.map((f: string) => (
                <BeatFrame
                  key={f}
                  file={f}
                  zoom={frameZoom[f] ?? DEFAULT_FRAME_ZOOM}
                  onZoom={(z) => setFrameZoom((prev) => ({ ...prev, [f]: z }))}
                />
              ))}
            </div>
          </div>
          {/* Per-beat notes, exactly like a storyboard cue tile: autosaved to
              feedback.json, no player involved. The beat sheet is the only part
              of this tab that works before the film is rendered, so it is where
              the review actually happens on a fresh intro. */}
          <div className="intro-beat-feedback">
            <FeedbackBox
              refKey={`intro-${b.id}`}
              placeholder={`feedback on ${b.id} — staging, timing, wording… (read by the next Claude session)`}
            />
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

  // The collective box. The comment composer below it is timestamped, so it is
  // dead until out/intro.mp4 exists — which is most of gate 027, and left the
  // owner with a review surface that took no feedback at all (owner report
  // 2026-08-13). This one is the storyboard's autosaved box: no player, no
  // timestamp, works from the moment the screenplay does.
  const panelTop = (
    <>
      <div className="intro-global-feedback">
        <FeedbackBox
          refKey="intro-global"
          placeholder="overall feedback on the intro film (read by the next Claude session)"
        />
        {videoMissing && (
          <div className="intro-feedback-hint">
            Not rendered yet — timestamped comments need the film. Use this box and the
            per-beat boxes under the beat sheet; both autosave.
          </div>
        )}
      </div>
      {findingsPanel}
    </>
  );

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
        panelTop={panelTop}
        belowPlayer={beatSheet}
      />
    </div>
  );
}
