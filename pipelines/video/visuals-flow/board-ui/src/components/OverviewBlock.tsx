import { useState, useEffect } from 'react';
import { GraphicsMinimap, AvatarMinimap, EffectsMinimap, SoundMinimap } from './Minimap';
import { buildPlanIndex, isOverCap, isNewCard } from '../lib/cardStatus';

function timecode(sec: number) {
  if (typeof sec !== 'number' || isNaN(sec)) return '0:00.0';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

export function OverviewBlock({ boardData, onEffectToggle }: { boardData: any; onEffectToggle: (id: string, enabled: boolean) => void }) {
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem('board:list-overview') !== 'false';
    } catch (e) {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('board:list-overview', String(expanded));
    } catch (e) {}
  }, [expanded]);

  const cues = boardData.cues || [];
  const segments = boardData.segments || [];
  const totalDuration = boardData.totalDuration || 0;

  const usageCounts = new Map<string, number>();
  for (const c of cues) {
    usageCounts.set(c.card, (usageCounts.get(c.card) ?? 0) + 1);
  }
  const usage = [...usageCounts.entries()].sort((a, b) => b[1] - a[1]);

  // Both answers come from cardStatus.ts, which mirrors the linter and nothing
  // else — see that file for why each of these used to be wrong.
  const { byCard, newCards } = buildPlanIndex(boardData.cardPlan);
  const overCap = (card: string, n: number) => isOverCap(card, n, byCard);

  const shots = boardData.shots;
  const effects = boardData.effects;
  const sound = boardData.sound;

  return (
    <>
      <button className="fold-toggle" onClick={() => setExpanded(!expanded)}>
        overview {expanded ? '▾' : '▸'}
      </button>
      
      {expanded && (
        <div id="overviewBlock">
          <div className="usage">
            {usage.map(([card, n]) => {
              // A card that does not exist yet must never look like one that
              // does — this is the marker plan 195 dropped when it deleted the
              // Card Plan tab.
              const isNew = isNewCard(card, byCard);
              return (
                <span key={card} className={`usage-chip ${overCap(card, n) ? 'hot' : ''}`}
                  style={isNew ? { borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 700 } : undefined}
                  title={isNew ? 'this card does not exist yet — step 240 builds it' : undefined}>
                  {card.split('/').pop()} &times;{n}{isNew ? ' · NEW' : ''}
                </span>
              );
            })}
          </div>
          {newCards.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 13, color: 'var(--accent)' }}>
              {newCards.length} card{newCards.length > 1 ? 's' : ''} in this plan {newCards.length > 1 ? 'do' : 'does'} not exist yet
              {' '}— {newCards.join(', ')}. Step 240 builds {newCards.length > 1 ? 'them' : 'it'} after you approve the look.
            </div>
          )}

          <div className="lane-row">
            <span className="lane-label">graphics</span>
            <GraphicsMinimap segments={segments} cues={cues} />
          </div>

          {shots?.spans?.length > 0 && (
            <div className="lane-row">
              <span className="lane-label">avatar</span>
              <AvatarMinimap spans={shots.spans} totalDuration={totalDuration} />
            </div>
          )}

          {effects?.instances?.length > 0 && (
            <div className="lane-row">
              <span className="lane-label">effects</span>
              <EffectsMinimap instances={effects.instances} totalDuration={totalDuration} />
            </div>
          )}

          {sound?.instances?.length > 0 && (
            <div className="lane-row">
              <span className="lane-label">sound</span>
              <SoundMinimap instances={sound.instances} totalDuration={totalDuration} />
            </div>
          )}

          <div className="lane-legend">
            <span><span className="dot" style={{ background: 'var(--accent)' }}></span>fullframe card</span>
            <span><span className="dot" style={{ background: 'var(--overlay-seg)' }}></span>overlay card</span>
            {shots?.spans?.length > 0 && (
              <span><span className="dot" style={{ background: 'var(--shot)' }}></span>full-screen avatar</span>
            )}
            <span><span className="dot" style={{ background: 'var(--line)' }}></span>screen recording + corner avatar</span>
          </div>

          {effects?.instances?.length > 0 && (
            <div className="fx-chips">
              {effects.instances.map((i: any) => {
                const when = typeof i.at === 'number' ? ` ${timecode(i.at)}` : (typeof i.start === 'number' ? ` ${timecode(i.start)}` : '');
                const extra = i.style ? ` ${i.style}` : '';
                return (
                  <label key={i.id} className="fx-chip">
                    <input type="checkbox" className="fx-toggle" data-fx-id={i.id} checked={i.enabled !== false} onChange={e => onEffectToggle(i.id, e.target.checked)} />
                    {i.type}{when}{extra}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
