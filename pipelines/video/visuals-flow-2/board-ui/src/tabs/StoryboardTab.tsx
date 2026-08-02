import { useEffect, useState, useRef, useMemo } from 'react';
import { CueTile } from '../components/CueTile';
import { GapBlock } from '../components/GapBlock';
import { ShotBlock } from '../components/ShotBlock';
import { OverviewBlock } from '../components/OverviewBlock';
import { Banner } from '../components/Banner';
import { FeedbackBox } from '../components/FeedbackBox';
import { spliceShotBlocks } from '../lib/splice';
import './StoryboardTab.css';
import { useReviewed } from '../lib/reviewed';
import { useFeedback, savePayloadFeedback } from '../lib/feedback';
import { defaultFrag, buildTileModels, buildSpanModels } from '../lib/collector';
import { TimelineCanvas } from '../components/TimelineCanvas';
import { DetailDock } from '../components/DetailDock';
import { FxStage } from '../components/FxStage';
import { playthroughView } from '../lib/playthrough';

export function StoryboardTab({
  video,
  boardData,
  onMeta,
  onActions,
  onSecondary,
  onRefetch
}: {
  video: string;
  boardData: any;
  onMeta: (node: React.ReactNode) => void;
  onActions: (node: React.ReactNode) => void;
  onSecondary: (node: React.ReactNode) => void;
  onRefetch: () => void;
}) {
  const cues = boardData.cues || [];
  const segments = boardData.segments || [];
  const shots = boardData.shots;
  const effects = boardData.effects;
  const audit = boardData.audit;
  const sound = boardData.sound;

  
  const [banners, setBanners] = useState<{ id: string; html: string; kind: 'ok' | 'err' }[]>([]);

  const addBanner = (html: string, kind: 'ok' | 'err') => {
    setBanners(prev => [...prev, { id: Math.random().toString(), html, kind }]);
  };

  const removeBanner = (id: string) => {
    setBanners(prev => prev.filter(b => b.id !== id));
  };

  const { items: reviewed, has, toggle: setReviewed, setAll: markAllReviewed, count: revCountGlobal } = useReviewed(video);
  const fb = useFeedback();

  // List is the default (owner call 2026-07-31); ?view=timeline|list overrides
  // both the default and the stored preference — used by deep links and the
  // smoke's timeline-mode assertions.
  const [viewMode, setViewMode] = useState<'timeline'|'list'>(() => {
    const forced = new URLSearchParams(location.search).get('view');
    if (forced === 'timeline' || forced === 'list') return forced;
    return (localStorage.getItem('board:sb-view') as 'timeline'|'list') || 'list';
  });

  const [openId, setOpenId] = useState<string | null>(null);
  const [liveTileId, setLiveTileId] = useState<string | null>(null);

  // ---- tile/span edit store -------------------------------------------------
  // Edits are keyed by cue/span id HERE, not in the components: tiles mount and
  // unmount as the dock reveals blocks, so component-local state would discard
  // edits on undock — and Save must send EVERY cue (the server replaces
  // cues.json's list wholesale; sending only mounted tiles destroys the rest).
  const [tileEdits, setTileEdits] = useState<Record<string, { fragJson?: string; flagged?: boolean; note?: string }>>({});
  const [spanEdits, setSpanEdits] = useState<Record<string, string>>({});
  const editTile = (id: string, patch: { fragJson?: string; flagged?: boolean; note?: string }) =>
    setTileEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const editSpan = (id: string, fragJson: string) =>
    setSpanEdits(prev => ({ ...prev, [id]: fragJson }));
  // handleSave lives inside the header-slot effect, whose deps deliberately
  // exclude the edit maps (re-wiring the header per keystroke is waste) — so
  // it must read the CURRENT edits through refs, never the closure.
  const tileEditsRef = useRef(tileEdits); tileEditsRef.current = tileEdits;
  const spanEditsRef = useRef(spanEdits); spanEditsRef.current = spanEdits;

  // Save UX (owner report 2026-07-31: "save button doesn't have any response —
  // no idea whether my feedback got saved"). The button carries the state:
  // unsaved-changes dot + chip while dirty, "Saving…" in flight, "✓ Saved"
  // flash on success — and a clean save now banners instead of staying silent.
  // These are booleans/enums, so the header effect re-wires on TRANSITIONS,
  // not keystrokes (dirty flips once and stays).
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const hasUnsaved = fb.dirty || Object.keys(tileEdits).length > 0 || Object.keys(spanEdits).length > 0;
  const tilePropsFor = (cue: any) => ({
    frag: tileEdits[cue.id]?.fragJson ?? defaultFrag(cue),
    onEdit: (patch: { fragJson?: string }) => editTile(cue.id, patch),
    isLive: liveTileId === cue.id,
    onMakeLive: () => setLiveTileId(cue.id),
  });
  const spanFragFor = (origSpan: any) => spanEdits[origSpan.id] ?? JSON.stringify(origSpan, null, 2);

  // Expose meta & actions
  useEffect(() => {
    const handleSave = async () => {
      if (saveState === 'saving') return;
      // Collect from the edit store over the FULL cue list — never from the
      // DOM. In timeline mode only the docked tile is mounted; a DOM scrape
      // would send that one cue and the server would rewrite cues.json to it.
      const cueTiles = buildTileModels(boardData.cues || [], tileEditsRef.current);

      const { collectCues, collectSpans, buildSavePayload } = await import('../lib/collector');

      const cuesRes = collectCues(cueTiles);
      if (!cuesRes.ok) {
        addBanner(`invalid fragment JSON — nothing saved:<br>${cuesRes.broken.join('<br>')}`, 'err');
        return;
      }

      const fileSpans = shots ? (shots.fileSpans || shots.spans || []) : [];
      const shotModels = buildSpanModels(fileSpans, spanEditsRef.current);
      let spansRes: any = { ok: true, spans: [] };
      if (shotModels.length > 0) {
        spansRes = collectSpans(shotModels);
        if (!spansRes.ok) {
          addBanner(`invalid fragment JSON — nothing saved:<br>${spansRes.broken.join('<br>')}`, 'err');
          return;
        }
      }

      // Feedback comes from the store alone — FeedbackBox is controlled by it,
      // so mounted textareas can never disagree with it.
      const fbPayload = savePayloadFeedback(fb);

      const toggles = [...document.querySelectorAll('.fx-toggle')];
      const effectsPayload = toggles.length > 0 ? toggles.map(el => ({
        id: (el as HTMLElement).dataset.fxId!,
        enabled: (el as HTMLInputElement).checked
      })) : undefined;

      const payload = buildSavePayload({
        video,
        approved: boardData.approved?.cues || false,
        cues: cuesRes.cues,
        feedback: fbPayload.feedback,
        feedbackImages: fbPayload.feedbackImages,
        spans: shots ? spansRes.spans : undefined,
        effects: effectsPayload
      });

      setSaveState('saving');
      let data: any;
      try {
        const res = await fetch('/save', { method: 'POST', body: JSON.stringify(payload) });
        data = await res.json();
      } catch (err: any) {
        // A network failure used to reject silently — the worst "did it save?"
        // outcome of all (owner report 2026-07-31).
        setSaveState('idle');
        addBanner(`save FAILED — nothing written: ${err?.message ?? err}`, 'err');
        return;
      }
      if (!data.ok) {
        setSaveState('idle');
        addBanner(data.errors.join('<br>'), 'err');
      } else {
        fb.markSaved();
        // The refetched boardData now carries the saved values; stale edit
        // overlays would mask any server-side normalization.
        setTileEdits({});
        setSpanEdits({});
        onRefetch();
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2500);
        // Lint WARNINGS are pipeline diagnostics for the LLM passes and the
        // operating sessions — the owner reviews composition, not lint
        // compliance, and a 44-line dump buried the one thing that matters
        // (owner, 2026-07-31). Only ERRORS surface here (an error means the
        // edit didn't validate); warnings stay in the save response, `run.sh
        // resolve`, and check.sh where the sessions read them.
        const e = data.errors || [];
        if (e.length > 0) {
          addBanner(`saved with ${e.length} error(s):<br>` + e.map((x: string) => `error: ${x}`).join('<br>'), 'err');
        } else {
          addBanner('saved ✓ — feedback and edits written', 'ok');
        }
      }
    };

    const handleApprove = async (endpoint: string) => {
      await fetch(endpoint, { method: 'POST' });
      onRefetch();
    };

    // flagged/note have no UI anymore (owner 2026-07-31) — the count would
    // always read a field nobody can set here.
    const m = `${cues.length} graphics`;
    onMeta(m);

    const hasResolved = boardData.hasResolved;

    // Approved = ✓ on the button, disabled until an edit un-approves (the
    // server drops `approved` whenever cues change, so the refetch re-enables
    // it exactly when re-approval is meaningful).
    const cuesApproved = !!boardData.approved?.cues;
    const acts = (
      <>
        <button id="approveBtn" className={cuesApproved ? 'approved' : ''} disabled={!hasResolved || cuesApproved}
          title={!hasResolved ? 'nothing to approve until step 040 resolves the cues'
            : cuesApproved ? 'approved — editing and saving cues re-opens this' : undefined}
          onClick={() => handleApprove('/approve')}>{cuesApproved ? '✓ graphics approved' : 'Approve graphics'}</button>
        {shots && (
          <>
            <span className="usage-chip" style={{ marginLeft: 8 }}>engineMode: {shots.engineMode}</span>
            <button id="approveShotsBtn" className={shots.approved ? 'approved' : ''} disabled={!!shots.approved}
              title={shots.approved ? 'approved — editing spans re-opens this' : undefined}
              onClick={() => handleApprove('/approve-shots')}>{shots.approved ? '✓ shots approved' : 'Approve shots'}</button>
          </>
        )}
        {effects && <button id="approveEffectsBtn" className={effects.approved ? 'approved' : ''} disabled={!!effects.approved}
          title={effects.approved ? 'approved — toggling effects re-opens this' : undefined}
          onClick={() => handleApprove('/approve-effects')}>{effects.approved ? '✓ effects approved' : 'Approve effects'}</button>}
      </>
    );
    onActions(acts);

    const revTotal = cues.length;
    const revCount = Array.from(reviewed).filter(rid => rid.startsWith('sb:')).length;

    const setMode = (mode: 'timeline' | 'list') => {
      setViewMode(mode);
      localStorage.setItem('board:sb-view', mode);
    };

    const sec = (
      <>
        <button id="saveBtn" disabled={saveState === 'saving'}
          style={{
            borderColor: saveState === 'saved' ? '#34d399' : 'var(--accent)',
            color: saveState === 'saved' ? '#34d399' : 'var(--accent)',
            opacity: saveState === 'saving' ? 0.6 : 1,
          }}
          onClick={handleSave}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : hasUnsaved ? 'Save •' : 'Save'}
        </button>
        {hasUnsaved && saveState === 'idle' &&
          <span id="unsavedChip" style={{ marginLeft: 8, fontSize: 12, color: 'var(--accent)' }}>unsaved changes</span>}
        {revTotal > 0 && <span id="revCount" style={{ margin: '0 12px', fontSize: 13, color: 'var(--dim)' }}>{revCount} / {revTotal} reviewed</span>}
        {revTotal > 0 && <button className="fc-cbtn" onClick={() => markAllReviewed(cues.map((c: any) => `sb:${c.id}`), true)}>mark all reviewed</button>}
        {revTotal > 0 && <button className="fc-cbtn" onClick={() => markAllReviewed(cues.map((c: any) => `sb:${c.id}`), false)}>expand all</button>}
        <a href="#calibrate" style={{ color: 'var(--dim)', fontSize: 13, marginLeft: 12 }}>calibrate</a>
        <span className="view-toggle" style={{ marginLeft: 'auto' }}>
          <button className={`tab-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setMode('list')}>List</button>
          <button className={`tab-btn ${viewMode === 'timeline' ? 'active' : ''}`} onClick={() => setMode('timeline')}>Timeline</button>
        </span>
      </>
    );
    onSecondary(sec);

    // Reset the header slots on unmount, like CardPlanTab/FinalCutTab — without
    // this, switching Storyboard → Run leaves Approve/Save stuck in the header.
    return () => { onMeta(null); onActions(null); onSecondary(null); };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video, boardData, revCountGlobal, onMeta, onActions, onSecondary, onRefetch, viewMode, saveState, hasUnsaved]);

  let blocks = useMemo(() => {
    let b = segments.map((seg: any) => ({
      isShot: false,
      start: seg.start,
      id: seg.id,
      kind: seg.kind,
      seg
    }));

    if (shots && shots.spans) {
      const shotSpans = shots.fileSpans || shots.spans;
      b = spliceShotBlocks(b, shotSpans).map((bb: any) => ({
        ...bb,
        kind: bb.isShot ? 'shot' : bb.seg.kind,
        id: bb.isShot ? `shot-${bb.span.id}` : bb.seg.id,
        start: bb.isShot ? bb.span.start : bb.seg.start
      }));
    }
    return b;
  }, [segments, shots]);

  const masterRef = useRef<HTMLAudioElement>(null);
  const [masterTime, setMasterTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const master = masterRef.current;
    if (!master || viewMode !== 'timeline') return;

    let rafId: number;

    const loop = () => {
      const t = master.currentTime;
      setMasterTime(t);

      // playthrough block follow
      const view = playthroughView(blocks, t);
      if (view) {
        setOpenId(prev => {
          if (prev !== view.id) {
            return view.id;
          }
          return prev;
        });
        const tile = document.querySelector('#detail-panel .tile') as HTMLElement;
        if (tile) {
          const iframe = tile.querySelector('iframe');
          const start = parseFloat(tile.dataset.start || '0');
          if (iframe && iframe.contentWindow) {
            try { iframe.contentWindow.postMessage({ t: t - start }, '*'); } catch {}
          }
        }
      }

      if (!master.paused) {
        rafId = requestAnimationFrame(loop);
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
      document.querySelectorAll('.tile audio').forEach((a: any) => {
        if (!a.paused) a.pause();
      });
      rafId = requestAnimationFrame(loop);
    };

    const onPause = () => {
      setIsPlaying(false);
      cancelAnimationFrame(rafId);
      loop();
    };

    const onSeek = () => {
      loop();
    };

    master.addEventListener('play', onPlay);
    master.addEventListener('pause', onPause);
    master.addEventListener('seeked', onSeek);

    return () => {
      master.removeEventListener('play', onPlay);
      master.removeEventListener('pause', onPause);
      master.removeEventListener('seeked', onSeek);
      cancelAnimationFrame(rafId);
    };
  }, [viewMode, blocks]);

  const [sfxPreview, setSfxPreview] = useState(true);

  const handleSfxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSfxPreview(e.target.checked);
  };

  const activeBlock = useMemo(() => {
    if (!openId) return null;
    return blocks.find((b: any) => b.id === openId) || null;
  }, [openId, blocks]);

  // Pre-040 banner
  const pre040Banner = !boardData.hasResolved ? (
    <div className="banner err" style={{ marginBottom: 24 }}>
      no <code>resolved.json</code> yet — you are viewing the raw pre-040 cues. Approve the <a href="/#card-plan" style={{ color: 'inherit', fontWeight: 'bold' }}>#card-plan</a> and run step 040 to generate timings and live previews.
    </div>
  ) : null;

  // Timeline props
  const graphicsBlocksHtml = useMemo(() => {
    if (!boardData.resolved) return [];
    // Legacy color encoding (board.mjs renderTimelinePage): the block's FILL
    // says what it is — flagged --err, fullframe --accent, overlay
    // --overlay-seg — matching the minimap legend. Label is the card basename.
    return boardData.resolved.map((r: any) => {
      const cue = (boardData.cues || []).find((c: any) => c.id === r.id);
      const flagged = Boolean(cue?.flagged);
      const colorVar = flagged ? '--err' : (r.placement === 'fullframe' ? '--accent' : '--overlay-seg');
      return {
        id: r.id,
        start: r.start,
        dur: r.duration,
        bg: `var(${colorVar})`,
        // green ring = audit-accepted (additive signal, on top of the legacy fill)
        border: (audit?.cues?.[r.id]?.accepted) ? 'var(--ok)' : `var(${colorVar})`,
        label: (r.card ?? '').split('/').pop() ?? r.id,
      };
    });
  }, [boardData.resolved, boardData.cues, audit]);

  const avatarBlocksHtml = useMemo(() => {
    if (!shots?.spans) return [];
    return shots.spans.map((s: any) => ({
      id: `shot-${s.id}`,
      start: s.start,
      dur: s.end - s.start,
      bg: 'var(--shot)',
      border: 'var(--shot)',
      label: `${s.id} ${s.mode}`
    }));
  }, [shots]);

  const fxChipsHtml = useMemo(() => {
    if (!effects?.instances) return [];
    return effects.instances.filter((i: any) => i.type === 'bubble').map((i: any) => ({
      start: i.at,
      label: 'bubble'
    }));
  }, [effects]);

  const fxSpansHtml = useMemo(() => {
    if (!effects?.instances) return [];
    return effects.instances.filter((i: any) => i.type === 'caption').map((i: any) => ({
      start: i.start,
      dur: i.end - i.start
    }));
  }, [effects]);

  const fxMarksHtml = useMemo(() => {
    if (!effects?.instances) return [];
    return effects.instances.filter((i: any) => i.type !== 'bubble' && i.type !== 'caption').map((i: any) => ({
      start: i.at,
      isBeat: i.type === 'beat',
      enabled: typeof i.enabled === 'boolean' ? i.enabled : true
    }));
  }, [effects]);

  return (
    <div className="timeline">
      {banners.map(b => <Banner key={b.id} html={b.html} kind={b.kind} onDismiss={() => removeBanner(b.id)} />)}
      
      {/* Approved state lives ON the approve buttons (✓ + disabled), not in
          banners — the "ready for step NNN" halves were pipeline guidance the
          Run tab's `next:` line already gives; the owner only needs the fact
          of approval (owner decluttering ask, 2026-07-31). */}
      {shots?.errors?.length > 0 && <Banner html={`shots: ${shots.errors.join('<br>')}`} kind="err" onDismiss={() => {}} />}

      {pre040Banner}

      {viewMode === 'timeline' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <audio id="master" ref={masterRef} className="scrub" src="/vo.mp3" controls style={{ height: 32 }} />
          {sound?.instances?.length > 0 && (
            <label style={{ fontSize: 13, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" id="sfxToggle" checked={sfxPreview} onChange={handleSfxChange} />
              SFX preview
            </label>
          )}
        </div>
      )}

      {viewMode === 'list' ? (
        <>
          <OverviewBlock boardData={boardData} onEffectToggle={(id, enabled) => {}} />

          <div style={{ maxWidth: 800 }}>
            <FeedbackBox refKey="_global" placeholder="global feedback (read by the next Claude session)" />
          </div>

          {blocks.map((block: any, i: number) => {
            if (block.isShot) {
              return <ShotBlock key={`shot-${i}`} span={block.span} origSpan={block.origSpan}
                fragJson={spanFragFor(block.origSpan)} onEdit={(v) => editSpan(block.origSpan.id, v)} />;
            } else {
              const seg = block.seg;
              if (seg.kind === 'gap') {
                return <GapBlock key={`gap-${i}`} seg={seg} />;
              } else {
                const cue = cues.find((c: any) => c.id === seg.cueId);
                const resolved = boardData.resolved?.find((r: any) => r.id === seg.cueId);
                const aud = audit?.cues?.[seg.cueId];
                return (
                  <CueTile
                    key={seg.id}
                    seg={seg}
                    cue={cue}
                    resolved={resolved}
                    audit={aud}
                    reviewed={has(`sb:${cue.id}`)}
                    onReviewedChange={(v) => {
                      setReviewed(`sb:${cue.id}`);
                    }}
                    {...tilePropsFor(cue)}
                  />
                );
              }
            }
          })}
        </>
      ) : (
        <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
          <TimelineCanvas
            totalDuration={boardData.totalDuration || 0}
            graphicsBlocksHtml={graphicsBlocksHtml}
            avatarBlocksHtml={avatarBlocksHtml}
            fxChipsHtml={fxChipsHtml}
            fxSpansHtml={fxSpansHtml}
            fxMarksHtml={fxMarksHtml}
            soundInstances={sound?.instances}
            effectsEnabled={!!effects}
            onSeek={(t) => {
              if (masterRef.current) masterRef.current.currentTime = t;
            }}
            onReveal={setOpenId}
            masterTime={masterTime}
          />
          <DetailDock
            activeBlock={activeBlock}
            cues={cues}
            audit={audit}
            hasReviewed={(id) => has(id)}
            onReviewedChange={(id, v) => setReviewed(id)}
            tilePropsFor={tilePropsFor}
            spanFragFor={spanFragFor}
            onSpanEdit={editSpan}
          />
          <FxStage
            masterTime={masterTime}
            isPlaying={isPlaying}
            fullframes={boardData.fx?.fullframes || []}
            spans={boardData.fx?.shotSpans || []}
            instances={boardData.effects?.instances || []}
            capChunks={boardData.fx?.capChunks || []}
            totalDuration={boardData.totalDuration || 1}
          />
        </div>
      )}
    </div>
  );
}
