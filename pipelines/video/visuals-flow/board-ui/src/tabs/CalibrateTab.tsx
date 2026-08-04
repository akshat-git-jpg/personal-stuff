import { useEffect, useState, useRef, ReactNode } from 'react';
import { useOverflowBadge } from '../lib/overflow';

function CalibrateTile({ card }: { card: any }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overflow = useOverflowBadge(iframeRef, card.probeTimes || []);

  const header = `${card.slug} · max_beats=${card.max_beats} · max_reveal_chars=${card.max_reveal_chars || 'null'}`;
  let badgeHtml = null;
  if (overflow.times.length > 0) {
    const label = overflow.times.map(x => x.t.toFixed(1) + 's').join(', ');
    const allOffenders = Array.from(new Set(overflow.times.flatMap(x => x.offenders))).slice(0, 5);
    badgeHtml = <span className="overflow-badge" style={{ marginLeft: 8 }}>OVERFLOW @ {label} ({allOffenders.join(' ')})</span>;
  }

  return (
    <div className="timeline-block tile reviewable">
      <div className="tile-header">
        {header}
        {badgeHtml}
      </div>
      <div className="preview">
        <iframe loading="lazy" ref={iframeRef} src={`/calibrate-card/${encodeURIComponent(card.slug)}`} />
      </div>
    </div>
  );
}

export function CalibrateTab({ onMeta }: { onMeta: (node: ReactNode) => void }) {
  const [cards, setCards] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/calibrate-data')
      .then(r => r.json())
      .then(d => {
        setCards(d.cards || []);
        onMeta(<span><strong>Calibrate</strong> — every beat card filled to its declared caps ({d.cards?.length || 0} beat cards)</span>);
      });
    return () => onMeta(null);
  }, [onMeta]);

  return (
    <div className="timeline" style={{ padding: 24, paddingBottom: '50vh' }}>
      {cards.map(c => <CalibrateTile key={c.slug} card={c} />)}
    </div>
  );
}
