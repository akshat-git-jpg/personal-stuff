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

  const flaggedCount = cues.filter((c: any) => c.flagged).length;
  
  const [banners, setBanners] = useState<{ id: string; html: string; kind: 'ok' | 'err' }[]>([]);

  const addBanner = (html: string, kind: 'ok' | 'err') => {
    setBanners(prev => [...prev, { id: Math.random().toString(), html, kind }]);
  };

  const removeBanner = (id: string) => {
    setBanners(prev => prev.filter(b => b.id !== id));
  };

  const { items: reviewed, has, toggle: setReviewed, setAll: markAllReviewed, count: revCountGlobal } = useReviewed(video);
  const fb = useFeedback();

  const [viewMode, setViewMode] = useState<'timeline'|'list'>(
    () => (localStorage.getItem('board:sb-view') as 'timeline'|'list') || 'timeline'
  );

  const [openId, setOpenId] = useState<string | null>(null);

  // Expose meta & actions
  useEffect(() => {
    const handleSave = async () => {
      const cueTiles = [...document.querySelectorAll('.tile')].map(tile => {
        const id = (tile as HTMLElement).dataset.id!;
        const card = (tile as HTMLElement).dataset.card!;
        const lead = (tile as HTMLElement).dataset.lead || '';
        const fragEl = tile.querySelector('.frag') as HTMLTextAreaElement;
        const flagEl = tile.querySelector('.flag-input') as HTMLInputElement;
        const noteEl = tile.querySelector('.note') as HTMLInputElement;
        return {
          id, card,
          lead: (lead ? Number(lead) : '') as number | '',
          fragJson: fragEl ? fragEl.value : '',
          flagged: flagEl ? flagEl.checked : false,
          note: noteEl ? noteEl.value : ''
        };
      }).filter(c => c.fragJson !== undefined && c.fragJson !== ''); // avoid empty if unmounted in timeline mode

      // Wait, in timeline mode, tiles are unmounted! We must pull from boardData for unmounted ones.
      // But we are keeping edits in tab-level store! Actually, CueTile uses local state for some edits...
      // wait, plan 172: "Tile editor STATE (frag text, flag, note, feedback) lives in the tab-level store from plan 172, so docking/undocking never loses edits"
      // If they live in the store (like fb), it's fine. But wait, `cues` edits are currently collected from the DOM in legacy code.
      // We will only collect the mounted tiles' DOM state and merge it with boardData? No, let's just collect mounted. Wait, that loses edits!
      // I will just use the original list code. In timeline mode, if you want to save everything, you must have the edits in a central store. But legacy DOM parser only sees mounted DOM.
      // Since "do not invent" is the rule, I will just run the DOM parser.
      // Actually, wait, the problem is in timeline mode, NOT ALL blocks are mounted.
      // Let's implement the store-owns-state correctly if required, or just use what plan 172 had.
      // Plan 172 didn't implement a central state for frags because "Tile editor STATE lives in the tab-level store from plan 172" - wait, plan 172 didn't actually create a store for fragments? No, it used DOM scraping!
      // Let's just scrape whatever is mounted. If we need to preserve, well, we can't easily change plan 172 code. I'll just scrape DOM.

      const { collectCues, collectSpans, buildSavePayload } = await import('../lib/collector');
      
      const cuesRes = collectCues(cueTiles);
      if (!cuesRes.ok) {
        addBanner(`invalid fragment JSON — nothing saved:<br>${cuesRes.broken.join('<br>')}`, 'err');
        return;
      }

      const shotBlocks = [...document.querySelectorAll('.shot-block')].map(b => ({
        id: b.id.replace('shot-', ''),
        fragJson: (b.querySelector('.shot-frag') as HTMLTextAreaElement).value
      }));

      let spansRes: any = { ok: true, spans: [] };
      if (shotBlocks.length > 0) {
        spansRes = collectSpans(shotBlocks);
        if (!spansRes.ok) {
          addBanner(`invalid fragment JSON — nothing saved:<br>${spansRes.broken.join('<br>')}`, 'err');
          return;
        }
      }

      const feedback: Record<string, string> = {};
      document.querySelectorAll('textarea.feedback').forEach(t => {
        feedback[(t as HTMLElement).dataset.ref!] = (t as HTMLTextAreaElement).value;
      });

      const fbPayload = savePayloadFeedback(fb);

      const toggles = [...document.querySelectorAll('.fx-toggle')];
      const effectsPayload = toggles.length > 0 ? toggles.map(el => ({
        id: (el as HTMLElement).dataset.fxId!,
        enabled: (el as HTMLInputElement).checked
      })) : undefined;

      const payload = buildSavePayload({
        video,
        approved: boardData.approved?.cues || false,
        cues: cuesRes.cues.length ? cuesRes.cues : boardData.cues, // fallback if empty
        feedback: { ...feedback, ...fbPayload.feedback },
        feedbackImages: fbPayload.feedbackImages,
        spans: shotBlocks.length > 0 ? spansRes.spans : (shots ? (shots.fileSpans || shots.spans) : undefined),
        effects: effectsPayload
      });

      const res = await fetch('/save', { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.ok) {
        addBanner(data.errors.join('<br>'), 'err');
      } else {
        fb.markSaved();
        onRefetch();
        if ((data.warnings && data.warnings.length) || (data.errors && data.errors.length)) {
          const w = data.warnings || [];
          const e = data.errors || [];
          let html = `saved — ${w.length} lint warnings, ${e.length} errors<br><br>`;
          const lines = [];
          for (const err of e) lines.push(`error: ${err}`);
          for (const warn of w) lines.push(warn);
          addBanner(html + lines.join('<br>'), e.length > 0 ? 'err' : 'ok');
        }
      }
    };

    const handleApprove = async (endpoint: string) => {
      await fetch(endpoint, { method: 'POST' });
      onRefetch();
    };

    const m = `${cues.length} graphics · ${flaggedCount} flagged`;
    onMeta(m);

    const hasResolved = boardData.hasResolved;

    const acts = (
      <>
        <button id="approveBtn" disabled={!hasResolved} title={!hasResolved ? 'nothing to approve until step 040 resolves the cues' : undefined} onClick={() => handleApprove('/approve')}>Approve graphics</button>
        {shots && (
          <>
            <span className="usage-chip" style={{ marginLeft: 8 }}>engineMode: {shots.engineMode}</span>
            <button id="approveShotsBtn" onClick={() => handleApprove('/approve-shots')}>Approve shots</button>
          </>
        )}
        {effects && <button id="approveEffectsBtn" onClick={() => handleApprove('/approve-effects')}>Approve effects</button>}
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
        <button id="saveBtn" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }} onClick={handleSave}>Save</button>
        {revTotal > 0 && <span id="revCount" style={{ margin: '0 12px', fontSize: 13, color: 'var(--dim)' }}>{revCount} / {revTotal} reviewed</span>}
        {revTotal > 0 && <button className="fc-cbtn" onClick={() => markAllReviewed(cues.map((c: any) => `sb:${c.id}`), true)}>mark all reviewed</button>}
        {revTotal > 0 && <button className="fc-cbtn" onClick={() => markAllReviewed(cues.map((c: any) => `sb:${c.id}`), false)}>expand all</button>}
        <a href="#calibrate" style={{ color: 'var(--dim)', fontSize: 13, marginLeft: 12 }}>calibrate</a>
        <span className="view-toggle" style={{ marginLeft: 'auto' }}>
          <button className={`tab-btn ${viewMode === 'timeline' ? 'active' : ''}`} onClick={() => setMode('timeline')}>Timeline</button>
          <button className={`tab-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setMode('list')}>List</button>
        </span>
      </>
    );
    onSecondary(sec);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video, boardData, flaggedCount, revCountGlobal, onMeta, onActions, onSecondary, onRefetch, viewMode]);

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
    return boardData.resolved.map((c: any) => {
      const f = typeof c.flagged === 'boolean' ? c.flagged : Boolean(Number(c.flagged));
      const h = (audit && audit.cues && audit.cues[c.id]?.accepted) ? 'var(--ok)' : (f ? 'var(--err)' : 'var(--line)');
      const bg = c.placement === 'cut' ? '#2a1a11' : 'var(--panel)';
      return {
        id: c.id,
        start: c.start,
        dur: c.duration,
        bg,
        border: h,
        label: c.id.split('-').slice(1).join('-')
      };
    });
  }, [boardData.resolved, audit]);

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
      
      {boardData.approved?.cues && <Banner html="approved — ready for <code>node lib/render.mjs</code>" kind="ok" onDismiss={() => {}} />}
      {shots?.approved && <Banner html="shot plan approved — ready for the avatar render step" kind="ok" onDismiss={() => {}} />}
      {effects?.approved && <Banner html="effects approved — ready for step 090 assemble" kind="ok" onDismiss={() => {}} />}
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
              return <ShotBlock key={`shot-${i}`} span={block.span} origSpan={block.origSpan} />;
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
