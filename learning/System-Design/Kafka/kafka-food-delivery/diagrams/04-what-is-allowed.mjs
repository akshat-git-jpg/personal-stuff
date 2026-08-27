/**
 * Every consumer / partition / group combination, with a tick or a cross.
 *
 * The whole point: there is only ONE hard rule. Everything else is allowed.
 *
 *   node diagrams/04-what-is-allowed.mjs
 */
import { rect, text, arrow, save, COLORS } from './lib/excalidraw.mjs';

const els = [];

const VERDICT = {
  ok: { mark: '✓', word: 'ALLOWED', color: COLORS.greenLine, tint: '#ebfbee' },
  no: { mark: '✗', word: 'IMPOSSIBLE', color: COLORS.redLine, tint: '#fff5f5' },
  warn: { mark: '!', word: 'LEGAL BUT POINTLESS', color: COLORS.yellowLine, tint: '#fff9db' },
};

const CARD_W = 580;
const CARD_H = 230;

/**
 * One scenario card.
 *  parts: [{ label, sub }]           left column
 *  cons:  [{ label, sub, idle }]     right column
 *  links: [[partIndex, consIndex]]
 */
function card({ x, y, title, verdict, parts, cons, links, reason }) {
  const v = VERDICT[verdict];
  const out = [];

  out.push(rect({ x, y, w: CARD_W, h: CARD_H, stroke: v.color, fill: v.tint }));
  out.push(text({ x: x + 20, y: y + 16, str: title, size: 15 }));
  out.push(text({ x: x + CARD_W - 30, y: y + 12, str: v.mark, size: 30, color: v.color, align: 'right', font: 2 }));
  out.push(text({ x: x + CARD_W - 30, y: y + 48, str: v.word, size: 10, color: v.color, align: 'right' }));

  const ROW = 34;
  const TOP = y + 58;

  const partAnchor = [];
  parts.forEach((p, i) => {
    const py = TOP + i * ROW;
    out.push(rect({ x: x + 26, y: py, w: 150, h: 28, fill: COLORS.green, stroke: COLORS.greenLine, round: false }));
    out.push(text({ x: x + 36, y: py + 7, str: p.label, size: 11 }));
    if (p.sub) out.push(text({ x: x + 182, y: py + 8, str: p.sub, size: 9, color: COLORS.greyLine }));
    partAnchor.push(py + 14);
  });

  const consAnchor = [];
  cons.forEach((c, i) => {
    const cy = TOP + i * ROW;
    out.push(
      rect({
        x: x + 330,
        y: cy,
        w: 220,
        h: 28,
        fill: c.idle ? '#ffffff' : COLORS.blue,
        stroke: c.idle ? COLORS.greyLine : COLORS.blueLine,
        dashed: !!c.idle,
        round: false,
      }),
    );
    out.push(text({ x: x + 340, y: cy + 7, str: c.label, size: 11, color: c.idle ? COLORS.greyLine : COLORS.ink }));
    consAnchor.push(cy + 14);
  });

  links.forEach(([pi, ci]) => {
    out.push(
      arrow({
        x1: x + 274,
        y1: partAnchor[pi],
        x2: x + 326,
        y2: consAnchor[ci],
        color: verdict === 'no' ? COLORS.redLine : COLORS.greyLine,
        dashed: verdict === 'no',
      }),
    );
  });

  out.push(text({ x: x + 20, y: y + CARD_H - 40, str: reason, size: 11, color: COLORS.greyLine }));
  return out;
}

// --- title -----------------------------------------------------------------
els.push(text({ x: 60, y: 34, str: 'What is allowed, and what is not', size: 26 }));
els.push(
  text({
    x: 60,
    y: 74,
    str: 'There is exactly ONE hard rule: no two members of the SAME group ever hold the SAME partition. Everything else is fine.',
    size: 14,
    color: COLORS.greyLine,
  }),
);

const L = 60;
const R = 700;
const ROWS = [140, 400, 660, 920];

// ===========================================================================
// LEFT COLUMN — allowed
// ===========================================================================
els.push(
  card({
    x: L,
    y: ROWS[0],
    title: '1.  One consumer, many partitions',
    verdict: 'ok',
    parts: [
      { label: 'orders  P0' },
      { label: 'orders  P1' },
      { label: 'orders  P2' },
    ],
    cons: [{ label: 'kitchen-pod-1   [group: kitchen]' }],
    links: [[0, 0], [1, 0], [2, 0]],
    reason: 'Alone in its group it owns every partition. This is the default, not a special case.',
  }),
);

els.push(
  card({
    x: L,
    y: ROWS[1],
    title: '2.  One consumer, two different topics',
    verdict: 'ok',
    parts: [
      { label: 'orders    P0' },
      { label: 'orders    P1' },
      { label: 'payments  P0' },
    ],
    cons: [{ label: 'kitchen-pod-1   [group: kitchen]' }],
    links: [[0, 0], [1, 0], [2, 0]],
    reason: 'It subscribed to both topics. One poll returns a batch mixing all three partitions.',
  }),
);

els.push(
  card({
    x: L,
    y: ROWS[2],
    title: '3.  Same group, different partitions',
    verdict: 'ok',
    parts: [
      { label: 'orders  P0' },
      { label: 'orders  P1' },
      { label: 'orders  P2' },
    ],
    cons: [
      { label: 'kitchen-pod-1   [group: kitchen]' },
      { label: 'kitchen-pod-2   [group: kitchen]' },
      { label: 'kitchen-pod-3   [group: kitchen]' },
    ],
    links: [[0, 0], [1, 1], [2, 2]],
    reason: 'The normal way to scale. Work is split, nothing is duplicated, nothing is missed.',
  }),
);

els.push(
  card({
    x: L,
    y: ROWS[3],
    title: '4.  SAME partition, DIFFERENT groups',
    verdict: 'ok',
    parts: [{ label: 'orders  P0', sub: 'one message: ord-1000' }],
    cons: [
      { label: 'kitchen-pod-1    [group: kitchen]' },
      { label: 'analytics-job    [group: analytics]' },
    ],
    links: [[0, 0], [0, 1]],
    reason: 'BOTH read ord-1000. Separate groups, separate bookmarks. Adding analytics never slows the kitchen.',
  }),
);

// ===========================================================================
// RIGHT COLUMN — not allowed
// ===========================================================================
els.push(
  card({
    x: R,
    y: ROWS[0],
    title: '5.  SAME partition, SAME group',
    verdict: 'no',
    parts: [{ label: 'orders  P0', sub: 'one message: ord-1000' }],
    cons: [
      { label: 'kitchen-pod-1   [group: kitchen]' },
      { label: 'kitchen-pod-2   [group: kitchen]' },
    ],
    links: [[0, 0], [0, 1]],
    reason: 'The one hard rule. Kafka will never assign this, so the order is never cooked twice.',
  }),
);

els.push(
  card({
    x: R,
    y: ROWS[1],
    title: '6.  Splitting one partition between members',
    verdict: 'no',
    parts: [{ label: 'orders  P0', sub: 'messages 0,1,2,3,4' }],
    cons: [
      { label: 'pod-1 takes msgs 0,1,2   [kitchen]' },
      { label: 'pod-2 takes msgs 3,4     [kitchen]' },
    ],
    links: [[0, 0], [0, 1]],
    reason: 'Kafka hands out WHOLE partitions, never individual messages. There is no setting for this.',
  }),
);

els.push(
  card({
    x: R,
    y: ROWS[2],
    title: '7.  More consumers than partitions',
    verdict: 'warn',
    parts: [{ label: 'orders  P0' }, { label: 'orders  P1' }],
    cons: [
      { label: 'kitchen-pod-1   [group: kitchen]' },
      { label: 'kitchen-pod-2   [group: kitchen]' },
      { label: 'kitchen-pod-3   IDLE, forever', idle: true },
    ],
    links: [[0, 0], [1, 1]],
    reason: 'Kafka allows it, but pod-3 does nothing. Partition count is the ceiling on useful parallelism.',
  }),
);

els.push(
  card({
    x: R,
    y: ROWS[3],
    title: '8.  One group, different topic lists',
    verdict: 'no',
    parts: [{ label: 'orders    P0' }, { label: 'payments  P0' }],
    cons: [
      { label: 'pod-1 subscribes: orders   [kitchen]' },
      { label: 'pod-2 subscribes: payments [kitchen]' },
    ],
    links: [[0, 0], [1, 1]],
    reason: 'Not an error message, just broken behaviour. Every member of a group must subscribe to the same topics.',
  }),
);

// ===========================================================================
// THE SUMMARY
// ===========================================================================
els.push(rect({ x: 60, y: 1190, w: 1220, h: 150, stroke: COLORS.ink, fill: '#f8f9fa' }));
els.push(text({ x: 82, y: 1208, str: 'Remember only this', size: 17 }));
els.push(
  text({
    x: 82,
    y: 1244,
    str:
      'INSIDE one group   ->  each partition has exactly ONE owner.  A message is handled once by that team.\n' +
      'ACROSS groups      ->  nothing is shared.  Every group gets its own full copy of every message.',
    size: 14,
  }),
);
els.push(
  text({
    x: 82,
    y: 1300,
    str: 'Kafka assigns partitions, not messages. Once you hold that sentence, all eight cards above are obvious.',
    size: 12,
    color: COLORS.greyLine,
  }),
);

save(new URL('./04-what-is-allowed.excalidraw', import.meta.url).pathname, els);
