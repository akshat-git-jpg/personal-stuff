/**
 * The whole picture: broker > topics > partitions, and consumer groups.
 *
 * Answers two questions:
 *   1. Is a broker a topic?  No. A broker HOLDS topics.
 *   2. What is a consumer group?  A team name. See the two rules at the bottom.
 *
 *   node diagrams/02-the-whole-picture.mjs
 */
import { rect, text, arrow, labelledBox, save, COLORS } from './lib/excalidraw.mjs';

const els = [];

// --- title -----------------------------------------------------------------
els.push(text({ x: 60, y: 36, str: 'The whole picture', size: 26 }));
els.push(
  text({
    x: 60,
    y: 74,
    str: 'BROKER holds TOPICS  ·  a topic is cut into PARTITIONS  ·  consumers read in GROUPS',
    size: 14,
    color: COLORS.greyLine,
  }),
);

// ===========================================================================
// THE BROKER — the outer container. Everything Kafka owns lives in here.
// ===========================================================================
els.push(rect({ x: 340, y: 140, w: 500, h: 700, stroke: COLORS.greyLine, dashed: true }));
els.push(
  text({
    x: 356,
    y: 152,
    str: 'BROKER  —  one Kafka server (a machine)',
    size: 14,
    color: COLORS.greyLine,
  }),
);
els.push(
  text({
    x: 356,
    y: 172,
    str: 'It is a building. Topics are shelves inside it.',
    size: 11,
    color: COLORS.greyLine,
  }),
);

/** Draws one topic box with N partition strips inside. */
function topic({ x, y, w, label, note, partitions, fill, stroke, startY }) {
  const out = [];
  const h = 46 + partitions * 65;
  out.push(rect({ x, y, w, h, stroke, dashed: true }));
  out.push(text({ x: x + 14, y: y + 12, str: label, size: 15, color: stroke }));
  out.push(text({ x: x + 14, y: y + 32, str: note, size: 11, color: COLORS.greyLine }));

  const rows = [];
  for (let i = 0; i < partitions; i++) {
    const py = y + startY + i * 65;
    out.push(rect({ x: x + 24, y: py, w: w - 48, h: 50, fill, stroke, round: false }));
    out.push(text({ x: x + 38, y: py + 8, str: `partition ${i}`, size: 13 }));
    out.push(
      text({
        x: x + 38,
        y: py + 28,
        str: '[0][1][2][3][4] ->  appended here, forever',
        size: 10,
        color: COLORS.greyLine,
      }),
    );
    rows.push({ x: x + w - 24, y: py + 25 });
  }
  return { els: out, rows, bottom: y + h };
}

// --- topic: orders ---------------------------------------------------------
const orders = topic({
  x: 364,
  y: 195,
  w: 452,
  label: 'TOPIC: orders',
  note: 'one shelf, cut into 3 stacks',
  partitions: 3,
  fill: COLORS.green,
  stroke: COLORS.greenLine,
  startY: 52,
});
els.push(orders.els);

// --- topic: payments -------------------------------------------------------
const payments = topic({
  x: 364,
  y: 500,
  w: 452,
  label: 'TOPIC: payments',
  note: 'a different shelf, in the SAME building',
  partitions: 2,
  fill: COLORS.purple,
  stroke: COLORS.purpleLine,
  startY: 52,
});
els.push(payments.els);

// ===========================================================================
// PRODUCERS — left side
// ===========================================================================
els.push(
  labelledBox({
    x: 70,
    y: 300,
    w: 210,
    h: 66,
    str: 'Order service\n(producer)',
    fill: COLORS.blue,
    stroke: COLORS.blueLine,
    size: 13,
  }),
);
els.push(arrow({ x1: 284, y1: 333, x2: 358, y2: 333, color: COLORS.blueLine }));

els.push(
  labelledBox({
    x: 70,
    y: 570,
    w: 210,
    h: 66,
    str: 'Payment service\n(producer)',
    fill: COLORS.blue,
    stroke: COLORS.blueLine,
    size: 13,
  }),
);
els.push(arrow({ x1: 284, y1: 603, x2: 358, y2: 603, color: COLORS.purpleLine }));

els.push(
  text({
    x: 70,
    y: 390,
    str: 'A producer picks the\npartition using the key:\nhash(key) % 3',
    size: 11,
    color: COLORS.greyLine,
  }),
);

// ===========================================================================
// CONSUMER GROUPS — right side
// ===========================================================================
/** A group box with N consumers inside. Returns the left-edge anchor per consumer. */
function group({ x, y, w, label, note, members, stroke }) {
  const out = [];
  const h = 52 + members.length * 58;
  out.push(rect({ x, y, w, h, stroke, dashed: false }));
  out.push(text({ x: x + 14, y: y + 12, str: label, size: 13, color: stroke }));
  out.push(text({ x: x + 14, y: y + 30, str: note, size: 10, color: COLORS.greyLine }));

  const anchors = [];
  members.forEach((m, i) => {
    const my = y + 52 + i * 58;
    out.push(labelledBox({ x: x + 22, y: my, w: w - 44, h: 44, str: m, fill: COLORS.grey, stroke, size: 12 }));
    anchors.push({ x, y: my + 22 });
  });
  return { els: out, anchors, bottom: y + h };
}

const kitchen = group({
  x: 910,
  y: 195,
  w: 300,
  label: 'CONSUMER GROUP: "kitchen"',
  note: '3 members, 3 partitions -> 1 each',
  members: ['kitchen-pod-1', 'kitchen-pod-2', 'kitchen-pod-3'],
  stroke: COLORS.greenLine,
});
els.push(kitchen.els);

const analytics = group({
  x: 910,
  y: 440,
  w: 300,
  label: 'CONSUMER GROUP: "analytics"',
  note: '1 member -> it holds ALL 3 partitions',
  members: ['analytics-job'],
  stroke: COLORS.yellowLine,
});
els.push(analytics.els);

const billing = group({
  x: 910,
  y: 590,
  w: 300,
  label: 'CONSUMER GROUP: "billing"',
  note: 'reads a different topic entirely',
  members: ['billing-pod-1', 'billing-pod-2'],
  stroke: COLORS.purpleLine,
});
els.push(billing.els);

// --- wiring: orders -> kitchen (one partition each) ------------------------
orders.rows.forEach((row, i) => {
  els.push(arrow({ x1: row.x + 6, y1: row.y, x2: 904, y2: kitchen.anchors[i].y, color: COLORS.greenLine }));
});

// --- wiring: orders -> analytics (all three, one fat arrow) ----------------
els.push(
  arrow({
    x1: 822,
    y1: 430,
    x2: 904,
    y2: analytics.anchors[0].y,
    color: COLORS.yellowLine,
    bend: 30,
  }),
);
els.push(
  text({
    x: 826,
    y: 452,
    str: 'all 3 partitions',
    size: 10,
    color: COLORS.yellowLine,
  }),
);

// --- wiring: payments -> billing -------------------------------------------
payments.rows.forEach((row, i) => {
  els.push(arrow({ x1: row.x + 6, y1: row.y, x2: 904, y2: billing.anchors[i].y, color: COLORS.purpleLine }));
});

// ===========================================================================
// THE TWO RULES
// ===========================================================================
els.push(rect({ x: 60, y: 880, w: 1150, h: 190, stroke: COLORS.redLine, fill: '#fff5f5' }));
els.push(text({ x: 82, y: 898, str: 'The two rules that are the entire idea', size: 17, color: COLORS.redLine }));
els.push(
  text({
    x: 82,
    y: 934,
    str:
      '1.  INSIDE one group, each partition goes to exactly ONE member.\n' +
      '    So "kitchen" never cooks the same order twice. Add a 4th kitchen pod and it sits IDLE -\n' +
      '    3 partitions is the ceiling. Partition count caps useful parallelism.',
    size: 13,
  }),
);
els.push(
  text({
    x: 82,
    y: 1010,
    str:
      '2.  ACROSS groups, nothing is shared. "kitchen" and "analytics" both read EVERY order,\n' +
      '    each with its own bookmark. Adding a new team never slows down or steals from an old one.',
    size: 13,
  }),
);

// --- the correction --------------------------------------------------------
els.push(
  text({
    x: 60,
    y: 1100,
    str: 'A broker is NOT a topic. Broker = the building. Topic = a named shelf inside it. Partition = one stack on that shelf.',
    size: 13,
    color: COLORS.greyLine,
  }),
);

save(new URL('./02-the-whole-picture.excalidraw', import.meta.url).pathname, els);
