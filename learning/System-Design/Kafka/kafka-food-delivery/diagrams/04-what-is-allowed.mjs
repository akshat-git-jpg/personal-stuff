/**
 * Every consumer / partition / group combination, with a tick or a cross.
 *
 * Uses ONE rich world throughout so no scenario is a toy:
 *   topic orders   -> 4 partitions
 *   topic payments -> 3 partitions
 *   group kitchen   -> 3 consumers, subscribes orders
 *   group analytics -> 2 consumers, subscribes orders AND payments
 *   group billing   -> 2 consumers, subscribes payments
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
  warn: { mark: '!', word: 'LEGAL BUT WRONG', color: COLORS.yellowLine, tint: '#fff9db' },
};

// ===========================================================================
// TITLE
// ===========================================================================
els.push(text({ x: 60, y: 30, str: 'What is allowed, and what is not', size: 28 }));
els.push(
  text({
    x: 60,
    y: 72,
    str: 'ONE hard rule: no two members of the SAME group ever hold the SAME partition. Everything else on this page is legal.',
    size: 14,
    color: COLORS.greyLine,
  }),
);

// ===========================================================================
// THE WORLD — the setup every scenario below refers to
// ===========================================================================
els.push(text({ x: 60, y: 122, str: 'THE WORLD  —  2 topics · 7 partitions · 3 groups · 7 consumers', size: 17, color: COLORS.blueLine }));

/** A topic box listing its partitions. */
function topicBox({ x, y, w, name, count, note }) {
  const out = [];
  const h = 74 + count * 36;
  out.push(rect({ x, y, w, h, stroke: COLORS.greenLine, dashed: true }));
  out.push(text({ x: x + 16, y: y + 12, str: `TOPIC: ${name}`, size: 15, color: COLORS.greenLine }));
  out.push(text({ x: x + 16, y: y + 34, str: note, size: 10, color: COLORS.greyLine }));
  const anchors = [];
  for (let i = 0; i < count; i++) {
    const py = y + 60 + i * 36;
    out.push(rect({ x: x + 24, y: py, w: w - 48, h: 30, fill: COLORS.green, stroke: COLORS.greenLine, round: false }));
    out.push(text({ x: x + 40, y: py + 7, str: `partition ${i}`, size: 12 }));
    anchors.push({ x: x + w - 24, y: py + 15 });
  }
  return { els: out, anchors, bottom: y + h };
}

const orders = topicBox({ x: 60, y: 160, w: 320, name: 'orders', count: 4, note: '4 partitions — every order event' });
els.push(orders.els);

const payments = topicBox({ x: 60, y: 400, w: 320, name: 'payments', count: 3, note: '3 partitions — every charge' });
els.push(payments.els);

/** A group box whose members declare what they hold. */
function groupBox({ x, y, w, name, subscribes, members, note, stroke }) {
  const out = [];
  const h = 76 + members.length * 38;
  out.push(rect({ x, y, w, h, stroke }));
  out.push(text({ x: x + 16, y: y + 12, str: `GROUP: ${name}`, size: 15, color: stroke }));
  out.push(text({ x: x + 16, y: y + 34, str: `subscribes to: ${subscribes}`, size: 10, color: COLORS.greyLine }));
  const anchors = [];
  members.forEach((m, i) => {
    const my = y + 58 + i * 38;
    out.push(rect({ x: x + 24, y: my, w: w - 48, h: 32, fill: COLORS.blue, stroke: COLORS.blueLine, round: false }));
    out.push(text({ x: x + 38, y: my + 9, str: m, size: 11 }));
    anchors.push({ x, y: my + 16 });
  });
  out.push(text({ x: x + 16, y: y + h - 22, str: note, size: 10, color: stroke }));
  return { els: out, anchors, bottom: y + h };
}

const kitchen = groupBox({
  x: 700,
  y: 160,
  w: 560,
  name: 'kitchen',
  subscribes: 'orders',
  members: [
    'K1    holds   orders P0  +  orders P3',
    'K2    holds   orders P1',
    'K3    holds   orders P2',
  ],
  note: '4 partitions split over 3 consumers -> somebody gets two. Kafka does not care that it is uneven.',
  stroke: COLORS.greenLine,
});
els.push(kitchen.els);

const analytics = groupBox({
  x: 700,
  y: 380,
  w: 560,
  name: 'analytics',
  subscribes: 'orders AND payments',
  members: [
    'A1    holds   orders P0, P1   +   payments P0, P1',
    'A2    holds   orders P2, P3   +   payments P2',
  ],
  note: '7 partitions across 2 topics, split over 2 consumers. One consumer can span topics freely.',
  stroke: COLORS.yellowLine,
});
els.push(analytics.els);

const billing = groupBox({
  x: 700,
  y: 570,
  w: 560,
  name: 'billing',
  subscribes: 'payments',
  members: ['B1    holds   payments P0  +  payments P1', 'B2    holds   payments P2'],
  note: '3 partitions over 2 consumers. Different group, different size, nobody else is affected.',
  stroke: COLORS.purpleLine,
});
els.push(billing.els);

// --- the one arrow worth drawing: orders P0 reaches TWO groups --------------
els.push(arrow({ x1: 388, y1: orders.anchors[0].y, x2: 694, y2: kitchen.anchors[0].y, color: COLORS.greenLine }));
els.push(arrow({ x1: 388, y1: orders.anchors[0].y, x2: 694, y2: analytics.anchors[0].y, color: COLORS.yellowLine, bend: 40 }));
els.push(
  text({
    x: 400,
    y: 600,
    str: 'orders P0 is read by K1 AND by A1.\nDifferent groups -> both get every message.\nSame group -> that could never happen.',
    size: 11,
    color: COLORS.redLine,
  }),
);

// ===========================================================================
// THE SCENARIO CARDS
// ===========================================================================
const CARD_W = 580;
const CARD_H = 255;

function card({ x, y, title, verdict, word, parts, cons, links, reason }) {
  const v = VERDICT[verdict];
  const out = [];

  out.push(rect({ x, y, w: CARD_W, h: CARD_H, stroke: v.color, fill: v.tint }));
  out.push(text({ x: x + 20, y: y + 14, str: title, size: 14 }));
  out.push(text({ x: x + CARD_W - 26, y: y + 10, str: v.mark, size: 30, color: v.color, align: 'right', font: 2 }));
  out.push(text({ x: x + CARD_W - 26, y: y + 46, str: word ?? v.word, size: 9, color: v.color, align: 'right' }));

  const ROW = 36;
  const TOP = y + 66;

  const pa = [];
  parts.forEach((p, i) => {
    const py = TOP + i * ROW;
    out.push(rect({ x: x + 22, y: py, w: 190, h: 30, fill: COLORS.green, stroke: COLORS.greenLine, round: false }));
    out.push(text({ x: x + 32, y: py + 8, str: p, size: 10 }));
    pa.push(py + 15);
  });

  const ca = [];
  cons.forEach((c, i) => {
    const cy = TOP + i * ROW;
    const idle = typeof c === 'object' && c.idle;
    const label = typeof c === 'object' ? c.label : c;
    out.push(
      rect({
        x: x + 300,
        y: cy,
        w: 258,
        h: 30,
        fill: idle ? '#ffffff' : COLORS.blue,
        stroke: idle ? COLORS.greyLine : COLORS.blueLine,
        dashed: !!idle,
        round: false,
      }),
    );
    out.push(text({ x: x + 310, y: cy + 8, str: label, size: 10, color: idle ? COLORS.greyLine : COLORS.ink }));
    ca.push(cy + 15);
  });

  links.forEach(([pi, ci]) => {
    out.push(
      arrow({
        x1: x + 216,
        y1: pa[pi],
        x2: x + 296,
        y2: ca[ci],
        color: verdict === 'no' ? COLORS.redLine : COLORS.greyLine,
        dashed: verdict === 'no',
      }),
    );
  });

  out.push(text({ x: x + 20, y: y + CARD_H - 42, str: reason, size: 10, color: COLORS.greyLine }));
  return out;
}

const L = 60;
const R = 700;
const ROWS = [800, 1075, 1350, 1625, 1900];

els.push(text({ x: 60, y: 762, str: 'NINE SCENARIOS  —  same world, tick or cross', size: 17, color: COLORS.blueLine }));

// --- 1 ---------------------------------------------------------------------
els.push(
  card({
    x: L,
    y: ROWS[0],
    title: '1.  Uneven split: 4 partitions, 3 consumers',
    verdict: 'ok',
    parts: ['orders P0', 'orders P1', 'orders P2', 'orders P3'],
    cons: ['K1  [kitchen]', 'K2  [kitchen]', 'K3  [kitchen]'],
    links: [[0, 0], [3, 0], [1, 1], [2, 2]],
    reason:
      'K1 ends up with two. Kafka balances PARTITIONS, not traffic — if P0 is the busy one, K1 drowns and Kafka never notices.',
  }),
);

// --- 2 ---------------------------------------------------------------------
els.push(
  card({
    x: R,
    y: ROWS[0],
    title: '2.  Same partition, SAME group',
    verdict: 'no',
    parts: ['orders P0   msg ord-1000'],
    cons: ['K1  [kitchen]', 'K2  [kitchen]'],
    links: [[0, 0], [0, 1]],
    reason: 'THE one hard rule. This is exactly what stops the same order being cooked twice by two kitchen pods.',
  }),
);

// --- 3 ---------------------------------------------------------------------
els.push(
  card({
    x: L,
    y: ROWS[1],
    title: '3.  One consumer spanning TWO topics',
    verdict: 'ok',
    parts: ['orders P0', 'orders P1', 'payments P0', 'payments P1'],
    cons: ['A1  [analytics]'],
    links: [[0, 0], [1, 0], [2, 0], [3, 0]],
    reason:
      'A1 subscribed to both topics, so one poll() returns a single batch mixing all four partitions from two different topics.',
  }),
);

// --- 4 ---------------------------------------------------------------------
els.push(
  card({
    x: R,
    y: ROWS[1],
    title: '4.  Splitting ONE partition inside a group',
    verdict: 'no',
    parts: ['payments P0   msgs 0..9'],
    cons: ['B1 takes msgs 0-4  [billing]', 'B2 takes msgs 5-9  [billing]'],
    links: [[0, 0], [0, 1]],
    reason: 'Kafka hands out whole partitions, never message ranges. There is no config for this. It simply does not exist.',
  }),
);

// --- 5 ---------------------------------------------------------------------
els.push(
  card({
    x: L,
    y: ROWS[2],
    title: '5.  One partition, THREE different groups',
    verdict: 'ok',
    parts: ['orders P0   msg ord-1000'],
    cons: ['K1  [kitchen]', 'A1  [analytics]', 'F1  [fraud — a new team]'],
    links: [[0, 0], [0, 1], [0, 2]],
    reason:
      'All three read ord-1000. Three separate bookmarks. Bolting the fraud team onto a live topic slows nobody down.',
  }),
);

// --- 6 ---------------------------------------------------------------------
els.push(
  card({
    x: R,
    y: ROWS[2],
    title: '6.  More consumers than partitions',
    verdict: 'warn',
    word: 'LEGAL BUT POINTLESS',
    parts: ['payments P0', 'payments P1', 'payments P2'],
    cons: [
      'B1  [billing]',
      'B2  [billing]',
      'B3  [billing]',
      { label: 'B4  [billing]   IDLE, forever', idle: true },
    ],
    links: [[0, 0], [1, 1], [2, 2]],
    reason:
      'Kafka accepts B4 and gives it nothing. 3 partitions is billing\'s ceiling no matter how many pods you deploy.',
  }),
);

// --- 7 ---------------------------------------------------------------------
els.push(
  card({
    x: L,
    y: ROWS[3],
    title: '7.  Two groups of DIFFERENT sizes, same topic',
    verdict: 'ok',
    parts: ['orders P0', 'orders P1', 'orders P2', 'orders P3'],
    cons: ['kitchen — 3 pods, splits all 4', 'analytics — 2 pods, splits all 4'],
    links: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1]],
    reason:
      'How many pods a group runs is its own private business. Both groups still read all 4 partitions, in full, independently.',
  }),
);

// --- 8 ---------------------------------------------------------------------
els.push(
  card({
    x: R,
    y: ROWS[3],
    title: '8.  One group, members with different subscriptions',
    verdict: 'no',
    parts: ['orders P0', 'payments P0'],
    cons: ['K1 subscribes: orders    [kitchen]', 'K2 subscribes: payments  [kitchen]'],
    links: [[0, 0], [1, 1]],
    reason:
      'Kafka raises no error. Assignment just goes wrong and partitions get dropped. Every member of a group MUST subscribe to the same list.',
  }),
);

// --- 9 ---------------------------------------------------------------------
els.push(
  card({
    x: L,
    y: ROWS[4],
    title: '9.  Two unrelated services sharing one groupId',
    verdict: 'warn',
    word: 'LEGAL — AND A REAL OUTAGE',
    parts: ['orders P0', 'orders P1', 'orders P2', 'orders P3'],
    cons: ['kitchen-service   [group: my-group]', 'email-service     [group: my-group]'],
    links: [[0, 0], [2, 0], [1, 1], [3, 1]],
    reason:
      'Someone copy-pasted the groupId. They are now ONE group, so they SPLIT the orders — the kitchen silently misses half of them.',
  }),
);

els.push(
  text({
    x: R,
    y: ROWS[4] + 40,
    str:
      'Scenario 9 is the most common Kafka bug in real\n' +
      'companies. The groupId is not a label — it is the\n' +
      'thing Kafka uses to decide who competes with whom.\n\n' +
      'Two services that must BOTH see every message\n' +
      'need two DIFFERENT groupIds. Always.',
    size: 13,
    color: COLORS.redLine,
  }),
);

// ===========================================================================
// SUMMARY
// ===========================================================================
els.push(rect({ x: 60, y: 2200, w: 1200, h: 170, stroke: COLORS.ink, fill: '#f8f9fa' }));
els.push(text({ x: 82, y: 2218, str: 'Remember only this', size: 18 }));
els.push(
  text({
    x: 82,
    y: 2256,
    str:
      'INSIDE one group   ->  every partition has exactly ONE owner. The team handles each message once.\n' +
      'ACROSS groups      ->  nothing is shared. Every group gets its own full copy of every message.',
    size: 14,
  }),
);
els.push(
  text({
    x: 82,
    y: 2322,
    str: 'Kafka assigns PARTITIONS, never messages. Hold that sentence and all nine cards become obvious instead of memorised.',
    size: 12,
    color: COLORS.greyLine,
  }),
);

save(new URL('./04-what-is-allowed.excalidraw', import.meta.url).pathname, els);
