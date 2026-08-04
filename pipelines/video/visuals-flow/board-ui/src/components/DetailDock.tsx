import { CueTile } from './CueTile';
import { GapBlock } from './GapBlock';
import { ShotBlock } from './ShotBlock';

export function DetailDock({
  activeBlock,
  cues,
  audit,
  hasReviewed,
  onReviewedChange,
  tilePropsFor,
  spanFragFor,
  onSpanEdit
}: {
  activeBlock: any;
  cues: any[];
  audit: any;
  hasReviewed: (id: string) => boolean;
  onReviewedChange: (id: string, v: boolean) => void;
  // edit state lives in StoryboardTab's store — the dock unmounts blocks on
  // every reveal, so it must never own edits itself
  tilePropsFor: (cue: any) => { frag: string; onEdit: (patch: any) => void };
  spanFragFor: (origSpan: any) => string;
  onSpanEdit: (id: string, fragJson: string) => void;
}) {
  return (
    <aside id="detail-panel" className="detail-dock" style={{ width: 520, flex: 'none', background: 'var(--panel)', borderLeft: '1px solid var(--line)', overflowY: 'auto', position: 'sticky', top: 60, height: 'calc(100vh - 80px)', padding: 20 }}>
      {!activeBlock ? (
        <div className="placeholder" style={{ color: 'var(--dim)', textAlign: 'center', marginTop: 100 }}>click a block to preview</div>
      ) : (
        <>
          {activeBlock.isShot ? (
            <ShotBlock span={activeBlock.span} origSpan={activeBlock.origSpan}
              fragJson={spanFragFor(activeBlock.origSpan)}
              onEdit={(v) => onSpanEdit(activeBlock.origSpan.id, v)} />
          ) : activeBlock.seg.kind === 'gap' ? (
            <GapBlock seg={activeBlock.seg} />
          ) : (
            <CueTile
              seg={activeBlock.seg}
              cue={cues.find(c => c.id === activeBlock.seg.cueId)}
              resolved={activeBlock.resolved}
              audit={audit?.cues?.[activeBlock.seg.cueId]}
              reviewed={hasReviewed(`sb:${activeBlock.seg.cueId}`)}
              onReviewedChange={(v) => onReviewedChange(`sb:${activeBlock.seg.cueId}`, v)}
              {...tilePropsFor(cues.find(c => c.id === activeBlock.seg.cueId))}
            />
          )}
        </>
      )}
    </aside>
  );
}
