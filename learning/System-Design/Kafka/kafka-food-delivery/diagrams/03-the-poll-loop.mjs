/**
 * How one consumer actually works.
 *
 * Fixes the most common wrong mental picture: that a consumer reads one
 * partition, or one message, at a time.
 *
 * The truth is two separate facts that people merge into one:
 *   - it HOLDS many partitions   (assignment is by whole partition)
 *   - it PROCESSES one message at a time  (it is one thread)
 *
 *   node diagrams/03-the-poll-loop.mjs
 */
import { rect, text, arrow, labelledBox, save, COLORS } from './lib/excalidraw.mjs';

const els = [];

const P = [
  { name: 'partition 0', tag: 'A', fill: COLORS.green, line: COLORS.greenLine },
  { name: 'partition 1', tag: 'B', fill: COLORS.yellow, line: COLORS.yellowLine },
  { name: 'partition 2', tag: 'C', fill: COLORS.purple, line: COLORS.purpleLine },
];

// --- title -----------------------------------------------------------------
els.push(text({ x: 60, y: 34, str: 'One consumer, three partitions', size: 26 }));
els.push(
  text({
    x: 60,
    y: 72,
    str: 'It HOLDS all three. It PROCESSES one message at a time. Those are different things.',
    size: 14,
    color: COLORS.greyLine,
  }),
);

// ===========================================================================
// LEFT — the broker and its three partitions
// ===========================================================================
els.push(rect({ x: 60, y: 150, w: 420, h: 330, stroke: COLORS.greyLine, dashed: true }));
els.push(text({ x: 76, y: 162, str: 'BROKER  ·  topic: orders', size: 13, color: COLORS.greyLine }));

P.forEach((p, pi) => {
  const py = 200 + pi * 92;
  els.push(rect({ x: 84, y: py, w: 372, h: 76, stroke: p.line, dashed: true }));
  els.push(text({ x: 98, y: py + 8, str: p.name, size: 12, color: p.line }));
  for (let i = 0; i < 5; i++) {
    const cx = 98 + i * 64;
    els.push(rect({ x: cx, y: py + 34, w: 58, h: 32, fill: p.fill, stroke: p.line, round: false }));
    els.push(text({ x: cx + 29, y: py + 42, str: `${p.tag}${i + 1}`, size: 13, align: 'center' }));
  }
});

// ===========================================================================
// STEP 1 — the consumer ASKS. Kafka never pushes.
// ===========================================================================
els.push(arrow({ x1: 940, y1: 128, x2: 300, y2: 128, color: COLORS.redLine, dashed: true }));
els.push(
  text({
    x: 470,
    y: 100,
    str: '1.  the consumer ASKS  —  poll().  Kafka never pushes.',
    size: 13,
    color: COLORS.redLine,
  }),
);

// ===========================================================================
// STEP 2 — one mixed batch comes back
// ===========================================================================
els.push(rect({ x: 540, y: 190, w: 300, h: 300, stroke: COLORS.ink }));
els.push(text({ x: 556, y: 202, str: '2.  ONE batch comes back', size: 13 }));
els.push(text({ x: 556, y: 222, str: 'messages from all 3, mixed together', size: 10, color: COLORS.greyLine }));

const BATCH = [
  { tag: 'A1', p: 0 },
  { tag: 'B1', p: 1 },
  { tag: 'A2', p: 0 },
  { tag: 'C1', p: 2 },
  { tag: 'B2', p: 1 },
  { tag: 'C2', p: 2 },
];
BATCH.forEach((m, i) => {
  const by = 252 + i * 38;
  const p = P[m.p];
  els.push(rect({ x: 560, y: by, w: 260, h: 32, fill: p.fill, stroke: p.line, round: false }));
  els.push(text({ x: 574, y: by + 8, str: `${m.tag}   from ${p.name}`, size: 12 }));
});

els.push(arrow({ x1: 484, y1: 320, x2: 534, y2: 320, color: COLORS.greyLine }));
els.push(arrow({ x1: 846, y1: 340, x2: 934, y2: 340, color: COLORS.greyLine }));

// ===========================================================================
// STEP 3 — the consumer, one thread
// ===========================================================================
els.push(rect({ x: 940, y: 190, w: 380, h: 300, fill: COLORS.grey, stroke: COLORS.blueLine }));
els.push(text({ x: 956, y: 202, str: 'kitchen-pod-1', size: 15, color: COLORS.blueLine }));
els.push(text({ x: 956, y: 224, str: 'ONE process  ·  ONE thread', size: 11, color: COLORS.greyLine }));
els.push(text({ x: 956, y: 252, str: '3.  walks the batch, one by one', size: 12 }));

els.push(
  labelledBox({
    x: 972,
    y: 286,
    w: 316,
    h: 60,
    str: 'handle(A1)   <- doing this now',
    fill: '#ffffff',
    stroke: COLORS.blueLine,
    size: 12,
  }),
);
els.push(
  text({
    x: 984,
    y: 362,
    str: 'then B1 ... then A2 ... then C1 ...\nnever two at the same moment',
    size: 12,
    color: COLORS.greyLine,
  }),
);
els.push(
  text({
    x: 956,
    y: 432,
    str: 'holds partition(s): 0, 1, 2',
    size: 13,
    color: COLORS.greenLine,
  }),
);

// ===========================================================================
// STEP 4 — the loop
// ===========================================================================
els.push(arrow({ x1: 1130, y1: 500, x2: 270, y2: 500, color: COLORS.redLine, dashed: true, bend: 34 }));
els.push(
  text({
    x: 560,
    y: 538,
    str: '4.  save the bookmark, then ask again  —  forever',
    size: 13,
    color: COLORS.redLine,
  }),
);

// ===========================================================================
// THE POINT
// ===========================================================================
els.push(rect({ x: 60, y: 600, w: 1260, h: 210, stroke: COLORS.redLine, fill: '#fff5f5' }));
els.push(text({ x: 82, y: 618, str: 'The two halves people merge into one', size: 17, color: COLORS.redLine }));
els.push(
  text({
    x: 82,
    y: 654,
    str: 'HOLDS 3 partitions.       Kafka assigns whole partitions, never single messages.\n                          Alone in its group, one consumer owns every partition. That is the default, not a special case.',
    size: 12,
  }),
);
els.push(
  text({
    x: 82,
    y: 706,
    str: 'PROCESSES 1 at a time.    It is one thread. Holding three partitions does NOT make it three times faster.\n                          Want 3x throughput? Run 3 processes. Not a bigger batch, not a bigger laptop.',
    size: 12,
  }),
);
els.push(
  text({
    x: 82,
    y: 764,
    str: 'And this is why order looks jumbled: the batch arrives A1 B1 A2 C1 ... Inside one partition A1 -> A2 -> A3 is always perfect.',
    size: 12,
    color: COLORS.greyLine,
  }),
);

save(new URL('./03-the-poll-loop.excalidraw', import.meta.url).pathname, els);
