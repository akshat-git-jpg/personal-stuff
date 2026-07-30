import { useEffect, useState } from 'react';
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

  // Expose meta & actions
  useEffect(() => {
    const handleSave = async () => {
      // we need to run collectCues, etc.
      // But the DOM state is what we rely on, or we can use the collector with DOM selection like the original?
      // Wait, collector is pure, but it needs tiles state.
      // If we use pure collector on DOM:
      const broken: string[] = [];
      const cueTiles = [...document.querySelectorAll('.tile')].map(tile => {
        const id = (tile as HTMLElement).dataset.id!;
        const card = (tile as HTMLElement).dataset.card!;
        const lead = (tile as HTMLElement).dataset.lead || '';
        const fragJson = (tile.querySelector('.frag') as HTMLTextAreaElement).value;
        const flagged = (tile.querySelector('.flag-input') as HTMLInputElement).checked;
        const note = (tile.querySelector('.note') as HTMLInputElement).value;
        return { id, card, lead: (lead ? Number(lead) : '') as number | '', fragJson, flagged, note };
      });

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
        cues: cuesRes.cues,
        feedback: { ...feedback, ...fbPayload.feedback },
        feedbackImages: fbPayload.feedbackImages,
        spans: shotBlocks.length > 0 ? spansRes.spans : undefined,
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

    const sec = (
      <>
        <button id="saveBtn" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }} onClick={handleSave}>Save</button>
        {revTotal > 0 && <span id="revCount" style={{ margin: '0 12px', fontSize: 13, color: 'var(--dim)' }}>{revCount} / {revTotal} reviewed</span>}
        {revTotal > 0 && <button className="fc-cbtn" onClick={() => markAllReviewed(cues.map((c: any) => `sb:${c.id}`), true)}>mark all reviewed</button>}
        {revTotal > 0 && <button className="fc-cbtn" onClick={() => markAllReviewed(cues.map((c: any) => `sb:${c.id}`), false)}>expand all</button>}
        <a href="/calibrate" style={{ color: 'var(--dim)', fontSize: 13, marginLeft: 12 }}>calibrate</a>
        <span className="view-toggle" style={{ marginLeft: 'auto' }}>
          <button className="tab-btn" disabled title="timeline mode ships in plan 173">Timeline</button>
          <button className="tab-btn active">List</button>
        </span>
      </>
    );
    onSecondary(sec);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video, boardData, flaggedCount, revCountGlobal, onMeta, onActions, onSecondary, onRefetch]);

  let blocks = segments.map((seg: any) => ({
    isShot: false,
    start: seg.start,
    id: seg.id,
    seg
  }));

  if (shots && shots.spans) {
    const shotSpans = shots.fileSpans || shots.spans;
    blocks = spliceShotBlocks(blocks, shotSpans);
  }

  // Pre-040 banner
  const pre040Banner = !boardData.hasResolved ? (
    <div className="banner err" style={{ marginBottom: 24 }}>
      no <code>resolved.json</code> yet — you are viewing the raw pre-040 cues. Approve the <a href="/#card-plan" style={{ color: 'inherit', fontWeight: 'bold' }}>#card-plan</a> and run step 040 to generate timings and live previews.
    </div>
  ) : null;

  return (
    <div className="timeline">
      {banners.map(b => <Banner key={b.id} html={b.html} kind={b.kind} onDismiss={() => removeBanner(b.id)} />)}
      
      {boardData.approved?.cues && <Banner html="approved — ready for <code>node lib/render.mjs</code>" kind="ok" onDismiss={() => {}} />}
      {shots?.approved && <Banner html="shot plan approved — ready for the avatar render step" kind="ok" onDismiss={() => {}} />}
      {effects?.approved && <Banner html="effects approved — ready for step 090 assemble" kind="ok" onDismiss={() => {}} />}
      {shots?.errors?.length > 0 && <Banner html={`shots: ${shots.errors.join('<br>')}`} kind="err" onDismiss={() => {}} />}

      {pre040Banner}

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
            const resolved = boardData.resolved.find((r: any) => r.id === seg.cueId);
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
    </div>
  );
}
