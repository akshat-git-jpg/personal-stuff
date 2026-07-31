import React, { useEffect, useState, ReactNode } from 'react';
import { ReviewTick } from '../components/ReviewTick';
import { useReviewed } from '../lib/reviewed';
import './CardPlanTab.css';

function pad(n: number) { return String(n).padStart(2, '0'); }
function timecode(sec: number) { return `${Math.floor(sec/60)}:${pad(Math.floor(sec)%60)}`; }

export function CardPlanTab({ video, cardPlan, onMeta, onActions, onSecondary, onRefetch }: {
  video: string;
  cardPlan: any;
  onMeta: (meta: ReactNode) => void;
  onActions: (actions: ReactNode) => void;
  onSecondary: (sec: ReactNode) => void;
  onRefetch: () => Promise<void>;
}) {
  const reviewed = useReviewed(video);
  const [approvedDismissed, setApprovedDismissed] = useState(false);
  const [inFlight, setInFlight] = useState(false);
  const [noteValues, setNoteValues] = useState<Record<string, string>>({});

  const sections = cardPlan?.sections || [];
  let numItems = 0;
  let numExisting = 0;
  let numToBuild = 0;
  for (const s of sections) {
    for (const item of (s.items || [])) {
      numItems++;
      if (item.status === 'existing') numExisting++;
      if (item.status === 'new') numToBuild++;
    }
  }

  useEffect(() => {
    onMeta(`${numItems} cues · ${numExisting} existing · ${numToBuild} to build`);
    
    const approveCardPlan = async () => {
      try {
        const res = await fetch('/approve-card-plan', { method: 'POST' });
        if (res.ok) await onRefetch();
      } catch (e) {
        console.error(e);
      }
    };
    
    // No card-plan.json (a video from before gate 037, or step 035 not run
    // yet): the tab stays in the strip for chrome consistency, but approving
    // a plan that does not exist must be impossible — the POST would 500 on
    // the missing file.
    onActions(
      <button className="approve plan-approve-btn" onClick={approveCardPlan}
        disabled={!cardPlan}
        title={!cardPlan ? 'no card plan yet — step 035 writes card-plan.json' : undefined}
        style={{ borderColor: 'var(--ok)', color: 'var(--ok)' }}>
        Approve card plan
      </button>
    );

    onSecondary(
      <div style={{ paddingLeft: '8px' }}>
        <span style={{ fontSize: '13px', color: 'var(--dim)' }}>{reviewed.count} / {numItems} reviewed</span>
      </div>
    );

    return () => {
      onMeta(null);
      onActions(null);
      onSecondary(null);
    };
  }, [cardPlan, numItems, numExisting, numToBuild, reviewed.count, onMeta, onActions, onSecondary, onRefetch]);

  const saveFeedback = async (part: string, cue: string | null, card: string | null, text: string, key: string) => {
    if (!text.trim()) return;
    setInFlight(true);
    try {
      const res = await fetch('/card-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ part, cue, card, text })
      });
      if (res.ok) {
        setNoteValues(prev => ({ ...prev, [key]: '' }));
        await onRefetch();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setInFlight(false);
    }
  };

  const rulebookOf = (part: string) => part === 'body' ? 'the body rulebook (030)' : 'the intro/outro rulebook (035)';

  if (!cardPlan) {
    return (
      <div className="card-plan-tab">
        <div style={{ maxWidth: 800, margin: '24px auto', color: 'var(--dim)', fontSize: 13 }}>
          no <code>card-plan.json</code> yet — it is written by step 035
          (<code>pick-or-propose-intro-outro-llm</code>). This video either predates
          Gate 1 or has not reached that step; check the <a href="#" onClick={(e) => { e.preventDefault(); location.hash = ''; }}>Run</a> tab.
        </div>
      </div>
    );
  }

  return (
    <div className="card-plan-tab">
      {cardPlan.approved && !approvedDismissed && (
        <div className="banner" style={{ marginBottom: '20px' }}>
          <button className="banner-x" title="dismiss" onClick={() => setApprovedDismissed(true)}>×</button>
          approved — {numToBuild > 0 ? 'build the NEW cards (step 038), then run.sh <slug> resolve' : 'ready for run.sh <slug> resolve'}
        </div>
      )}
      {sections.map((s: any, idx: number) => {
        const comments = cardPlan.comments?.[s.part] || [];
        const sectionComments = comments.filter((c: any) => !c.cue);

        return (
          <div key={idx} style={{ marginBottom: '32px' }}>
            <h2>
              {s.part}
              {s.start != null && (
                <span className="cp-span"> ({timecode(s.start)} → {timecode(s.end)})</span>
              )}
            </h2>
            {s.items && s.items.length > 0 ? (
              s.items.map((item: any) => {
                const rid = `cp:${item.id}`;
                const isRev = reviewed.has(rid);
                const itemComments = comments.filter((c: any) => c.cue === item.id);
                const proposal = item.proposal;
                const specBits = proposal ? [
                  proposal.kind ? `kind: ${proposal.kind}` : null,
                  proposal.beats ? `${proposal.beats} beats` : null,
                  proposal.placement ? proposal.placement : null,
                  Array.isArray(proposal.variables) && proposal.variables.length ? `vars: ${proposal.variables.join(', ')}` : null,
                ].filter(Boolean) : [];

                const noteKey = `${s.part}:${item.id}`;

                return (
                  <div key={item.id} className={`cp-item ${isRev ? 'is-reviewed' : ''}`} data-rid={rid}>
                    <div className="cp-head">
                      <strong className="cp-id">#{item.id}</strong>
                      <span className="cp-card">{item.card ?? '(none)'}</span>
                      <span className="usage-chip">{item.placement ?? '?'}</span>
                      {item.status === 'existing' ? (
                        <span className="usage-chip existing">EXISTING</span>
                      ) : (
                        <span className="usage-chip new">NEW — to build</span>
                      )}
                      {item.flagged && <span className="usage-chip flagged">flagged</span>}
                      <ReviewTick checked={isRev} onChange={() => reviewed.toggle(rid)} />
                    </div>
                    {item.anchor && <div className="cp-anchor">@ “{item.anchor}”</div>}
                    {item.status === 'new' && proposal && (
                      <div className="cp-proposal">
                        {proposal.does ?? ''}
                        {specBits.length > 0 && (
                          <div className="cp-proposal-spec">{specBits.join(' · ')}</div>
                        )}
                      </div>
                    )}
                    {itemComments.map((c: any, i: number) => (
                      <div key={i} className="cp-prior">
                        “{c.text}” <span className="cp-prior-meta">{c.added ?? ''}{c.folded ? ' · folded' : ''}</span>
                      </div>
                    ))}
                    <div className="cp-note-row">
                      <input
                        className="cp-note plan-note"
                        value={noteValues[noteKey] ?? ''}
                        onChange={(e) => setNoteValues(prev => ({ ...prev, [noteKey]: e.target.value }))}
                        data-part={s.part} data-cue={item.id} data-card={item.card ?? ''}
                        placeholder={`why is this right or wrong? (folds into ${rulebookOf(s.part)})`}
                      />
                      <button
                        className="cp-note-save plan-note-save"
                        disabled={inFlight || !(noteValues[noteKey]?.trim())}
                        onClick={() => saveFeedback(s.part, item.id, item.card ?? '', noteValues[noteKey] ?? '', noteKey)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="cp-empty">(no graphics planned)</div>
            )}
            {sectionComments.map((c: any, i: number) => (
              <div key={i} className="cp-prior">
                “{c.text}” <span className="cp-prior-meta">{c.added ?? ''}{c.folded ? ' · folded' : ''}</span>
              </div>
            ))}
            <div className="cp-note-row" style={{ marginTop: '10px' }}>
              <input
                className="cp-note plan-note"
                value={noteValues[s.part] ?? ''}
                onChange={(e) => setNoteValues(prev => ({ ...prev, [s.part]: e.target.value }))}
                data-part={s.part}
                placeholder={`a note about the ${s.part} as a whole`}
              />
              <button
                className="cp-note-save plan-note-save"
                disabled={inFlight || !(noteValues[s.part]?.trim())}
                onClick={() => saveFeedback(s.part, null, null, noteValues[s.part] ?? '', s.part)}
              >
                Save
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
