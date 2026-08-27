/**
 * Chapter 1 diagram: Kafka is a numbered list that does not forget.
 *
 *   node diagrams/01-the-log.mjs
 */
import { rect, text, arrow, line, labelledBox, save, COLORS } from './lib/excalidraw.mjs';

const els = [];

// --- title -----------------------------------------------------------------
els.push(text({ x: 60, y: 40, str: 'Chapter 1 — a numbered list that does not forget', size: 24 }));
els.push(
  text({
    x: 60,
    y: 76,
    str: 'Bites: the Order service must reach the Kitchen tablet, and the tablet reboots all day.',
    size: 14,
    color: COLORS.greyLine,
  }),
);

// --- the broker ------------------------------------------------------------
const BX = 300, BY = 130, BW = 580, BH = 240;
els.push(rect({ x: BX, y: BY, w: BW, h: BH, stroke: COLORS.greyLine, dashed: true }));
els.push(text({ x: BX + 14, y: BY + 12, str: 'BROKER — one Kafka server (your Docker container)', size: 13, color: COLORS.greyLine }));
els.push(text({ x: BX + 14, y: BY + 42, str: 'topic: ch1-orders    ·    1 partition', size: 15, color: COLORS.blueLine }));

// --- the log cells ---------------------------------------------------------
const CX = 322, CY = BY + 78, CW = 84, CH = 70, GAP = 6;
const WRITTEN = 5; // offsets 0..4 exist; slot 5 is the next append
for (let i = 0; i < 6; i++) {
  const x = CX + i * (CW + GAP);
  const isNext = i >= WRITTEN;
  els.push(
    rect({
      x,
      y: CY,
      w: CW,
      h: CH,
      fill: isNext ? 'transparent' : COLORS.green,
      stroke: isNext ? COLORS.greyLine : COLORS.greenLine,
      dashed: isNext,
      round: false,
    }),
  );
  els.push(
    text({
      x: x + CW / 2,
      y: CY + 22,
      str: isNext ? 'next' : `ord-${1000 + i}`,
      size: 13,
      align: 'center',
      color: isNext ? COLORS.greyLine : COLORS.ink,
    }),
  );
  els.push(
    text({
      x: x + CW / 2,
      y: CY + CH + 8,
      str: `offset ${i}`,
      size: 12,
      align: 'center',
      color: COLORS.greyLine,
    }),
  );
}

// --- producer --------------------------------------------------------------
els.push(
  labelledBox({
    x: 60,
    y: CY,
    w: 190,
    h: CH,
    str: 'Order service\n(producer)',
    fill: COLORS.blue,
    stroke: COLORS.blueLine,
    size: 14,
  }),
);
els.push(arrow({ x1: 254, y1: CY + CH / 2, x2: BX - 6, y2: CY + CH / 2, color: COLORS.blueLine }));
els.push(text({ x: 258, y: CY + CH / 2 - 24, str: 'append', size: 12, color: COLORS.blueLine }));

// --- consumer --------------------------------------------------------------
els.push(
  labelledBox({
    x: 930,
    y: CY,
    w: 200,
    h: CH,
    str: 'Kitchen tablet\n(consumer)',
    fill: COLORS.yellow,
    stroke: COLORS.yellowLine,
    size: 14,
  }),
);
els.push(arrow({ x1: BX + BW + 6, y1: CY + CH / 2, x2: 924, y2: CY + CH / 2, color: COLORS.yellowLine }));
els.push(text({ x: 892, y: CY + CH / 2 - 24, str: 'read', size: 12, color: COLORS.yellowLine }));

// --- the bookmark ----------------------------------------------------------
const BOOK_X = CX + WRITTEN * (CW + GAP) - GAP / 2;
els.push(line({ x1: BOOK_X, y1: CY - 10, x2: BOOK_X, y2: CY + CH + 44, color: COLORS.redLine, dashed: true }));
els.push(
  text({
    x: BOOK_X,
    y: CY + CH + 52,
    str: 'bookmark\ngroup "ch1-kitchen" has read up to 5',
    size: 12,
    align: 'center',
    color: COLORS.redLine,
  }),
);

// --- the point -------------------------------------------------------------
els.push(
  text({
    x: 60,
    y: 440,
    str:
      'Reading does NOT delete. The message stays at its offset.\n' +
      'The bookmark lives on the BROKER, not on the tablet.\n' +
      'So the tablet can die mid-shift, come back, and resume at exactly offset 5.',
    size: 16,
  }),
);
els.push(
  text({
    x: 60,
    y: 540,
    str: 'Kafka deletes on a timer (7 days by default) — not when someone reads. That is chapter 5.',
    size: 13,
    color: COLORS.greyLine,
  }),
);

save(new URL('./01-the-log.excalidraw', import.meta.url).pathname, els);
