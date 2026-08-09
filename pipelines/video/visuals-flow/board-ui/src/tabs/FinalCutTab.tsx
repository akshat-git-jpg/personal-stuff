import { useState, useEffect, ReactNode } from 'react';
import './FinalCutTab.css';
import { FC_FPS } from '../lib/fcTransport';
import { BoardData } from '../lib/api';
import { ReviewSurface, ReviewComment } from '../components/ReviewSurface';

// Gate 120. The player, comment list and composer all live in <ReviewSurface>,
// shared with the Intro tab — this file owns only what is specific to reviewing
// an assembled cut: the version picker and the approve action.

export function FinalCutTab({
  video,
  boardData,
  onMeta,
  onActions,
  onSecondary,
  onRefetch,
}: {
  video: string;
  boardData: BoardData;
  onMeta: (node: ReactNode) => void;
  onActions: (node: ReactNode) => void;
  onSecondary: (node: ReactNode) => void;
  onRefetch: () => void;
}) {
  const [versions, setVersions] = useState<{ label: string; placeholder: boolean }[]>([]);
  const [version, setVersion] = useState<string>('');
  const [fcItems, setFcItems] = useState<Record<string, ReviewComment>>({});

  // Gate 120's approved state, mirroring the Storyboard tab: the ✓ and the
  // disabled button ARE the confirmation. Without it this button wrote
  // final-cut.json, changed nothing on screen, and read as broken — the owner
  // reported it dead on 2026-08-09 when it had in fact approved v3 on the first
  // click. Same shape as the frame-step buttons that were "dead" because the
  // clock could not show a 1/30s step: ask whether the owner can SEE it work.
  const finalApproved = !!boardData.approved?.finalCut;

  useEffect(() => {
    onMeta('final cut review');
    onActions(
      <button
        className={`approve rs-cbtn${finalApproved ? ' approved' : ''}`}
        disabled={!version || finalApproved}
        title={finalApproved
          ? 'approved — assembling a new version re-opens this'
          : !version ? 'nothing to approve until a cut is assembled' : undefined}
        style={{ borderColor: 'var(--ok)', color: 'var(--ok)' }}
        onClick={async () => {
          const res = await fetch('/approve-final-cut', { method: 'POST', body: JSON.stringify({ version }) });
          if (res.ok) onRefetch();
          else alert(`approve failed: ${res.status} ${await res.text()}`);
        }}
      >
        {finalApproved ? `✓ final cut approved (${version})` : 'Approve final cut'}
      </button>
    );
    onSecondary(
      // A video with no assembled versions yet must SAY so (legacy behavior) —
      // an empty select reads as broken chrome, not as a degraded state.
      <select id="fc-version" value={version} onChange={(e) => setVersion(e.target.value)}
        disabled={versions.length === 0}>
        {versions.length === 0
          ? <option value="">No versions available</option>
          : versions.map((v) => (
            <option key={v.label} value={v.label}>
              {v.label}{v.placeholder ? ' · placeholder avatar' : ''}
            </option>
          ))}
      </select>
    );
    return () => {
      onMeta(null);
      onActions(null);
      onSecondary(null);
    };
  }, [version, versions, finalApproved, onMeta, onActions, onSecondary, onRefetch]);

  useEffect(() => {
    // The server returns { versions: [{ label, file, created, draft,
    // placeholder }] }, oldest first — NOT a bare string[]. Treating it as an
    // array made .reverse() throw and left the tab on "No versions available"
    // forever (owner report 2026-07-31, draft v1 invisible). `placeholder`
    // marks a draft whose avatar spans are labelled stills (HeyGen clips were
    // still rendering when it was cut).
    fetch('/versions?video=' + encodeURIComponent(video))
      .then((r) => r.json())
      .then((data: { versions?: { label: string; placeholder?: boolean }[] }) => {
        const list = (data.versions ?? []).map((v) => ({ label: v.label, placeholder: !!v.placeholder })).reverse();
        setVersions(list);
        if (list.length) setVersion(list[0].label);
      });
  }, [video]);

  useEffect(() => {
    if (boardData.feedback) {
      setFcItems((prev) => ({ ...prev, ...(boardData.feedback as Record<string, ReviewComment>) }));
    }
  }, [boardData.feedback]);

  return (
    <ReviewSurface
      src={version ? `/video/${version}` : ''}
      notReady="No assembled cut to review yet."
      namespace={version ? `final-${version}` : 'final-'}
      postUrl="/feedback-final"
      postBody={{ label: version }}
      contextPrefix="final"
      items={fcItems}
      onItemsChange={setFcItems}
      fps={FC_FPS}
      showSpeed
      showMute
    />
  );
}
