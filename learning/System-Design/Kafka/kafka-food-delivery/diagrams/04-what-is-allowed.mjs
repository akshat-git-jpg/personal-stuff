/**
 * Every consumer / partition / group combination, with a tick or a cross.
 *
 * Drawing rule, so nothing is ambiguous:
 *   a WIDE box            = one partition
 *   small numbered square = one message, numbered by its offset
 *   an arrow              = that WHOLE partition is assigned to that consumer
 *
 * One rich world throughout, so no scenario is a toy:
 *   topic orders   -> 4 partitions
 *   topic payments -> 3 partitions
 *   group kitchen   -> 3 consumers, subscribes orders
 *   group analytics -> 2 consumers, subscribes orders AND payments
 *   group billing   -> 2 consumers, subscribes payments
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

const PART_W = 260;
const PART_H = 62;
const ROW = 74;

/**
 * One partition, drawn as a box with its messages inside as numbered squares.
 * `msgs` is how many messages to draw; they are labelled with their offsets.
 * Returns the right-edge anchor so arrows can leave from the partition itself.
 */
function partition({ x, y, topic, index, msgs = 4, note, fill = COLORS.green, stroke = COLORS.greenLine }) {
  const out = [];
  out.push(rect({ x, y, w: PART_W, h: PART_H, stroke, dashed: true }));
  out.push(text({ x: x + 12, y: y + 7, str: `${topic}  ·  partition ${index}`, size: 11, color: stroke }));
  if (note) out.push(text({ x: x + PART_W - 12, y: y + 8, str: note, size: 9, color: COLORS.greyLine, align: 'right' }));
  for (let i = 0; i < msgs; i++) {
    const cx = x + 12 + i * 50;
    out.push(rect({ x: cx, y: y + 28, w: 44, h: 26, fill, stroke, round: false }));
    out.push(text({ x: cx + 22, y: y + 34, str: String(i), size: 12, align: 'center' }));
  }
  out.push(text({ x: x + 12 + msgs * 50 + 4, y: y + 36, str: '->', size: 11, color: COLORS.greyLine }));
  return { els: out, anchor: { x: x + PART_W, y: y + PART_H / 2 } };
}

// ===========================================================================
// TITLE + LEGEND
// ===========================================================================
els.push(text({ x: 60, y: 28, str: 'What is allowed, and what is not', size: 28 }));
els.push(
  text({
    x: 60,
    y: 70,
    str: 'ONE hard rule: no two members of the SAME group ever hold the SAME partition. Everything else on this page is legal.',
    size: 14,
    color: COLORS.greyLine,
  }),
);

els.push(rect({ x: 60, y: 106, w: 1280, h: 74, stroke: COLORS.blueLine, fill: '#e7f5ff' }));
els.push(text({ x: 78, y: 118, str: 'How to read every box on this page', size: 13, color: COLORS.blueLine }));
els.push(
  text({
    x: 78,
    y: 140,
    str:
      'a WIDE dashed box = ONE partition   ·   the small numbered squares inside it = MESSAGES, numbered by offset (0, 1, 2, 3)\n' +
      'an ARROW leaves the whole partition = that ENTIRE partition, and every message in it, is assigned to that one consumer',
    size: 12,
  }),
);

// ===========================================================================
// THE WORLD
// ===========================================================================
els.push(text({ x: 60, y: 208, str: 'THE WORLD  —  2 topics · 7 partitions · 3 groups · 7 consumers', size: 17, color: COLORS.blueLine }));

// --- topic: orders ---------------------------------------------------------
els.push(rect({ x: 60, y: 240, w: 300, h: 328, stroke: COLORS.greenLine }));
els.push(text({ x: 76, y: 252, str: 'TOPIC: orders', size: 15, color: COLORS.greenLine }));
els.push(text({ x: 76, y: 272, str: '4 partitions', size: 10, color: COLORS.greyLine }));
const ordersP = [];
for (let i = 0; i < 4; i++) {
  const p = partition({ x: 80, y: 292 + i * ROW, topic: 'orders', index: i });
  els.push(p.els);
  ordersP.push(p.anchor);
}

// --- topic: payments -------------------------------------------------------
els.push(rect({ x: 60, y: 596, w: 300, h: 254, stroke: COLORS.purpleLine }));
els.push(text({ x: 76, y: 608, str: 'TOPIC: payments', size: 15, color: COLORS.purpleLine }));
els.push(text({ x: 76, y: 628, str: '3 partitions', size: 10, color: COLORS.greyLine }));
const paymentsP = [];
for (let i = 0; i < 3; i++) {
  const p = partition({
    x: 80,
    y: 648 + i * ROW,
    topic: 'payments',
    index: i,
    fill: COLORS.purple,
    stroke: COLORS.purpleLine,
  });
  els.push(p.els);
  paymentsP.push(p.anchor);
}

/** A group box whose members declare which partitions they hold. */
function groupBox({ x, y, w, name, subscribes, members, note, stroke }) {
  const out = [];
  const h = 78 + members.length * 40;
  out.push(rect({ x, y, w, h, stroke }));
  out.push(text({ x: x + 16, y: y + 12, str: `GROUP: ${name}`, size: 15, color: stroke }));
  out.push(text({ x: x + 16, y: y + 34, str: `subscribes to: ${subscribes}`, size: 10, color: COLORS.greyLine }));
  const anchors = [];
  members.forEach((m, i) => {
    const my = y + 58 + i * 40;
    out.push(rect({ x: x + 24, y: my, w: w - 48, h: 34, fill: COLORS.blue, stroke: COLORS.blueLine, round: false }));
    out.push(text({ x: x + 38, y: my + 10, str: m, size: 11 }));
    anchors.push({ x, y: my + 17 });
  });
  out.push(text({ x: x + 16, y: y + h - 22, str: note, size: 10, color: stroke }));
  return { els: out, anchors, bottom: y + h };
}

const kitchen = groupBox({
  x: 720,
  y: 240,
  w: 620,
  name: 'kitchen',
  subscribes: 'orders',
  members: [
    'K1   holds  orders partition 0  AND  orders partition 3',
    'K2   holds  orders partition 1',
    'K3   holds  orders partition 2',
  ],
  note: '4 partitions split over 3 consumers -> somebody gets two. Kafka does not care that it is uneven.',
  stroke: COLORS.greenLine,
});
els.push(kitchen.els);

const analytics = groupBox({
  x: 720,
  y: 460,
  w: 620,
  name: 'analytics',
  subscribes: 'orders AND payments',
  members: [
    'A1   holds  orders partitions 0, 1   +   payments partitions 0, 1',
    'A2   holds  orders partitions 2, 3   +   payments partition 2',
  ],
  note: '7 partitions across 2 topics, split over 2 consumers. One consumer can span topics freely.',
  stroke: COLORS.yellowLine,
});
els.push(analytics.els);

const billing = groupBox({
  x: 720,
  y: 660,
  w: 620,
  name: 'billing',
  subscribes: 'payments',
  members: ['B1   holds  payments partitions 0 AND 1', 'B2   holds  payments partition 2'],
  note: '3 partitions over 2 consumers. Different group, different size, nobody else is affected.',
  stroke: COLORS.purpleLine,
});
els.push(billing.els);

// --- the arrow worth drawing: orders partition 0 reaches TWO groups ---------
els.push(arrow({ x1: ordersP[0].x + 6, y1: ordersP[0].y, x2: 714, y2: kitchen.anchors[0].y, color: COLORS.greenLine }));
els.push(arrow({ x1: ordersP[0].x + 6, y1: ordersP[0].y, x2: 714, y2: analytics.anchors[0].y, color: COLORS.yellowLine, bend: 50 }));
els.push(
  text({
    x: 400,
    y: 780,
    str:
      'orders partition 0 — every message in it —\ngoes to K1 AND to A1.\n\nDifferent groups -> both get all of them.\nSame group -> that could never happen.',
    size: 11,
    color: COLORS.redLine,
  }),
);

// ===========================================================================
// OFFSETS LIVE PER GROUP — not per consumer
// ===========================================================================
els.push(
  text({
    x: 60,
    y: 900,
    str: 'THE BOOKMARK BELONGS TO THE GROUP  —  not to the consumer, and not to the partition',
    size: 17,
    color: COLORS.blueLine,
  }),
);

els.push(rect({ x: 60, y: 932, w: 1280, h: 158, stroke: COLORS.ink }));
els.push(
  text({
    x: 78,
    y: 944,
    str: 'orders  ·  partition 0     ONE partition. ONE copy of the data on disk. Three groups reading it at three different speeds.',
    size: 12,
  }),
);

const MSG_W = 110;
const MSG_GAP = 130;
const MSG_X0 = 90;
const MSG_Y = 976;
for (let i = 0; i < 8; i++) {
  const cx = MSG_X0 + i * MSG_GAP;
  els.push(rect({ x: cx, y: MSG_Y, w: MSG_W, h: 46, fill: COLORS.green, stroke: COLORS.greenLine, round: false }));
  els.push(text({ x: cx + MSG_W / 2, y: MSG_Y + 8, str: `offset ${i}`, size: 10, align: 'center', color: COLORS.greyLine }));
  els.push(text({ x: cx + MSG_W / 2, y: MSG_Y + 26, str: `ord-100${i}`, size: 11, align: 'center' }));
}

/** A dashed marker sitting just before the given offset. */
function bookmark({ offset, color, label }) {
  const bx = MSG_X0 + offset * MSG_GAP - 10;
  return [
    rect({ x: bx - 2, y: MSG_Y - 12, w: 4, h: 82, fill: color, stroke: color, round: false }),
    text({ x: bx, y: MSG_Y + 74, str: label, size: 10, align: 'center', color }),
  ];
}
els.push(bookmark({ offset: 5, color: COLORS.greenLine, label: 'kitchen\nis here' }));
els.push(bookmark({ offset: 2, color: COLORS.yellowLine, label: 'analytics\nis here' }));
els.push(bookmark({ offset: 0, color: COLORS.redLine, label: 'fraud\nis here' }));

/** One group's reading position, spelled out. */
function offsetCard({ x, y, name, consumers, committed, read, lag, stroke }) {
  return [
    rect({ x, y, w: 410, h: 172, stroke, fill: '#ffffff' }),
    text({ x: x + 18, y: y + 14, str: `GROUP: ${name}`, size: 15, color: stroke }),
    text({ x: x + 18, y: y + 40, str: consumers, size: 11, color: COLORS.greyLine }),
    text({ x: x + 18, y: y + 68, str: `committed offset  =  ${committed}`, size: 14 }),
    text({ x: x + 18, y: y + 96, str: `already read:  ${read}`, size: 11, color: COLORS.greyLine }),
    text({ x: x + 18, y: y + 122, str: `LAG  =  ${lag}`, size: 14, color: stroke }),
    text({ x: x + 18, y: y + 146, str: 'this number is stored ONCE, for the whole group', size: 9, color: COLORS.greyLine }),
  ];
}

els.push(
  offsetCard({
    x: 60,
    y: 1110,
    name: 'kitchen',
    consumers: '3 consumers: K1, K2, K3  —  K1 owns this partition',
    committed: 5,
    read: 'offsets 0, 1, 2, 3, 4',
    lag: '3   (offsets 5, 6, 7 still waiting)',
    stroke: COLORS.greenLine,
  }),
);
els.push(
  offsetCard({
    x: 495,
    y: 1110,
    name: 'analytics',
    consumers: '2 consumers: A1, A2  —  A1 owns this partition',
    committed: 2,
    read: 'offsets 0, 1',
    lag: '6',
    stroke: COLORS.yellowLine,
  }),
);
els.push(
  offsetCard({
    x: 930,
    y: 1110,
    name: 'fraud',
    consumers: '1 consumer: F1  —  deployed 10 seconds ago',
    committed: 0,
    read: 'nothing yet',
    lag: '8   (the whole partition)',
    stroke: COLORS.redLine,
  }),
);

els.push(rect({ x: 60, y: 1310, w: 1280, h: 170, stroke: COLORS.redLine, fill: '#fff5f5' }));
els.push(text({ x: 82, y: 1326, str: 'Why this matters', size: 16, color: COLORS.redLine }));
els.push(
  text({
    x: 82,
    y: 1358,
    str:
      'The bookmark is stored under three keys:   ( groupId , topic , partition ).   The CONSUMER is not one of them.\n\n' +
      'So if K1 dies while owning partition 0, K3 takes it over and resumes at offset 5 — because 5 belongs to the GROUP kitchen, not to K1.\n' +
      'And analytics being 6 messages behind slows kitchen down by nothing. Same bytes on disk, read three times, three separate positions.',
    size: 12,
  }),
);
els.push(
  text({
    x: 82,
    y: 1452,
    str: 'Kafka keeps these bookmarks in its own internal topic, literally named __consumer_offsets. It is a topic like any other.',
    size: 11,
    color: COLORS.greyLine,
  }),
);

// ===========================================================================
// SCENARIO CARDS
// ===========================================================================
const CARD_W = 630;
const CARD_H = 400;

function card({ x, y, title, verdict, word, parts, cons, links, reason }) {
  const v = VERDICT[verdict];
  const out = [];

  out.push(rect({ x, y, w: CARD_W, h: CARD_H, stroke: v.color, fill: v.tint }));
  out.push(text({ x: x + 20, y: y + 14, str: title, size: 14 }));
  out.push(text({ x: x + CARD_W - 26, y: y + 10, str: v.mark, size: 30, color: v.color, align: 'right', font: 2 }));
  out.push(text({ x: x + CARD_W - 26, y: y + 46, str: word ?? v.word, size: 9, color: v.color, align: 'right' }));

  const TOP = y + 66;

  const pa = [];
  parts.forEach((p, i) => {
    const box = partition({
      x: x + 20,
      y: TOP + i * ROW,
      topic: p.topic,
      index: p.index,
      msgs: p.msgs ?? 4,
      note: p.note,
      fill: p.topic === 'payments' ? COLORS.purple : COLORS.green,
      stroke: p.topic === 'payments' ? COLORS.purpleLine : COLORS.greenLine,
    });
    out.push(box.els);
    pa.push(box.anchor.y);
  });

  const ca = [];
  cons.forEach((c, i) => {
    const cy = TOP + i * ROW + 14;
    const idle = typeof c === 'object' && c.idle;
    const label = typeof c === 'object' ? c.label : c;
    out.push(
      rect({
        x: x + 370,
        y: cy,
        w: 240,
        h: 34,
        fill: idle ? '#ffffff' : COLORS.blue,
        stroke: idle ? COLORS.greyLine : COLORS.blueLine,
        dashed: !!idle,
        round: false,
      }),
    );
    out.push(text({ x: x + 380, y: cy + 10, str: label, size: 10, color: idle ? COLORS.greyLine : COLORS.ink }));
    ca.push(cy + 17);
  });

  links.forEach(([pi, ci]) => {
    out.push(
      arrow({
        x1: x + 286,
        y1: pa[pi],
        x2: x + 366,
        y2: ca[ci],
        color: verdict === 'no' ? COLORS.redLine : COLORS.greyLine,
        dashed: verdict === 'no',
      }),
    );
  });

  out.push(text({ x: x + 20, y: y + CARD_H - 46, str: reason, size: 10, color: COLORS.greyLine }));
  return out;
}

const L = 60;
const R = 710;
const BASE = 1560;
const PITCH = 426;
const ROWS = [BASE, BASE + PITCH, BASE + 2 * PITCH, BASE + 3 * PITCH, BASE + 4 * PITCH];

els.push(text({ x: 60, y: 1520, str: 'NINE SCENARIOS  —  same world, tick or cross', size: 17, color: COLORS.blueLine }));

const O = (i, extra = {}) => ({ topic: 'orders', index: i, ...extra });
const P = (i, extra = {}) => ({ topic: 'payments', index: i, ...extra });

// --- 1 ---------------------------------------------------------------------
els.push(
  card({
    x: L,
    y: ROWS[0],
    title: '1.  Uneven split: 4 partitions, 3 consumers',
    verdict: 'ok',
    parts: [O(0), O(1), O(2), O(3)],
    cons: ['K1  [group: kitchen]', 'K2  [group: kitchen]', 'K3  [group: kitchen]'],
    links: [[0, 0], [3, 0], [1, 1], [2, 2]],
    reason:
      'K1 ends up owning TWO whole partitions. Kafka balances partitions, not traffic — if partition 0 is the busy one, K1 drowns and Kafka never notices.',
  }),
);

// --- 2 ---------------------------------------------------------------------
els.push(
  card({
    x: R,
    y: ROWS[0],
    title: '2.  Same partition, SAME group',
    verdict: 'no',
    parts: [O(0, { note: 'msgs at offsets 0-3' })],
    cons: ['K1  [group: kitchen]', 'K2  [group: kitchen]'],
    links: [[0, 0], [0, 1]],
    reason:
      'THE one hard rule. Partition 0 has exactly one owner inside kitchen, which is what stops one order being cooked twice.',
  }),
);

// --- 3 ---------------------------------------------------------------------
els.push(
  card({
    x: L,
    y: ROWS[1],
    title: '3.  One consumer spanning TWO topics',
    verdict: 'ok',
    parts: [O(0), O(1), P(0), P(1)],
    cons: ['A1  [group: analytics]'],
    links: [[0, 0], [1, 0], [2, 0], [3, 0]],
    reason:
      'A1 subscribed to both topics, so ONE poll returns a single batch mixing messages from all four partitions across two different topics.',
  }),
);

// --- 4 ---------------------------------------------------------------------
els.push(
  card({
    x: R,
    y: ROWS[1],
    title: '4.  Splitting ONE partition inside a group',
    verdict: 'no',
    parts: [P(0, { note: 'B1 wants 0,1 — B2 wants 2,3' })],
    cons: ['B1 takes offsets 0,1  [billing]', 'B2 takes offsets 2,3  [billing]'],
    links: [[0, 0], [0, 1]],
    reason:
      'Kafka hands out WHOLE partitions, never message ranges. You cannot give offsets 0-1 to one member and 2-3 to another. No such setting exists.',
  }),
);

// --- 5 ---------------------------------------------------------------------
els.push(
  card({
    x: L,
    y: ROWS[2],
    title: '5.  One partition, THREE different groups',
    verdict: 'ok',
    parts: [O(0, { note: 'every message in it' })],
    cons: ['K1  [group: kitchen]', 'A1  [group: analytics]', 'F1  [group: fraud — new team]'],
    links: [[0, 0], [0, 1], [0, 2]],
    reason:
      'All three read offsets 0, 1, 2, 3 in full. Three separate bookmarks. Bolting the fraud team onto a live topic slows nobody down.',
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
    parts: [P(0), P(1), P(2)],
    cons: [
      'B1  [group: billing]',
      'B2  [group: billing]',
      'B3  [group: billing]',
      { label: 'B4  [billing]   IDLE, forever', idle: true },
    ],
    links: [[0, 0], [1, 1], [2, 2]],
    reason:
      'Kafka accepts B4 and gives it nothing, because there is no 4th partition to give. 3 partitions is billing\'s ceiling however many pods you deploy.',
  }),
);

// --- 7 ---------------------------------------------------------------------
els.push(
  card({
    x: L,
    y: ROWS[3],
    title: '7.  Two groups of DIFFERENT sizes, same topic',
    verdict: 'ok',
    parts: [O(0), O(1), O(2), O(3)],
    cons: ['kitchen  — 3 pods, splits all 4', 'analytics — 2 pods, splits all 4'],
    links: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1]],
    reason:
      'How many pods a group runs is its own private business. Both groups still receive every message from all 4 partitions, independently.',
  }),
);

// --- 8 ---------------------------------------------------------------------
els.push(
  card({
    x: R,
    y: ROWS[3],
    title: '8.  One group, members with different subscriptions',
    verdict: 'no',
    parts: [O(0), P(0)],
    cons: ['K1 subscribes: orders    [kitchen]', 'K2 subscribes: payments  [kitchen]'],
    links: [[0, 0], [1, 1]],
    reason:
      'Kafka raises no error. Assignment just goes wrong and partitions get dropped. Every member of a group MUST subscribe to the same topic list.',
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
    parts: [O(0), O(1), O(2), O(3)],
    cons: ['kitchen-service   [group: my-group]', 'email-service     [group: my-group]'],
    links: [[0, 0], [2, 0], [1, 1], [3, 1]],
    reason:
      'Someone copy-pasted the groupId. They are now ONE group, so the partitions get SPLIT between them — the kitchen silently never sees partitions 1 and 3.',
  }),
);

els.push(
  text({
    x: R,
    y: ROWS[4] + 60,
    str:
      'Scenario 9 is the most common Kafka bug in real\n' +
      'companies.\n\n' +
      'groupId is not a label. It is the thing Kafka uses\n' +
      'to decide WHO COMPETES WITH WHOM.\n\n' +
      'Two services that must BOTH see every message\n' +
      'need two DIFFERENT groupIds. Always.',
    size: 14,
    color: COLORS.redLine,
  }),
);

// ===========================================================================
// SUMMARY
// ===========================================================================
const SY = ROWS[4] + CARD_H + 50;
els.push(rect({ x: 60, y: SY, w: 1280, h: 190, stroke: COLORS.ink, fill: '#f8f9fa' }));
els.push(text({ x: 82, y: SY + 18, str: 'Remember only this', size: 18 }));
els.push(
  text({
    x: 82,
    y: SY + 58,
    str:
      'INSIDE one group   ->  every PARTITION has exactly ONE owner, so every message in it is handled once by that team.\n' +
      'ACROSS groups      ->  nothing is shared. Every group gets its own full copy of every message, with its own bookmark.',
    size: 14,
  }),
);
els.push(
  text({
    x: 82,
    y: SY + 132,
    str: 'Kafka assigns PARTITIONS, never individual messages. Hold that one sentence and all nine cards above stop being things to memorise.',
    size: 12,
    color: COLORS.greyLine,
  }),
);

save(new URL('./04-what-is-allowed.excalidraw', import.meta.url).pathname, els);
