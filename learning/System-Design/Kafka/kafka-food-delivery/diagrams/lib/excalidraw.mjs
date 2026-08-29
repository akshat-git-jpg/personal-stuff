/**
 * A tiny helper for writing .excalidraw files.
 *
 * Excalidraw's file format is just JSON, but every element needs about 20
 * boilerplate fields. This fills them in so a diagram script stays readable.
 *
 * Not a library. Not tested. It exists so making diagram #7 is as cheap as #1.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

let n = 0;
const id = (p = 'el') => `${p}-${++n}`;

/** Fields every element must have. */
const base = (extra) => ({
  id: id(),
  version: 1,
  versionNonce: 1,
  isDeleted: false,
  angle: 0,
  strokeColor: '#1e1e1e',
  backgroundColor: 'transparent',
  fillStyle: 'solid',
  strokeWidth: 2,
  strokeStyle: 'solid',
  roughness: 1,
  opacity: 100,
  groupIds: [],
  frameId: null,
  roundness: null,
  seed: 1,
  boundElements: [],
  updated: 1,
  link: null,
  locked: false,
  ...extra,
});

export const COLORS = {
  ink: '#1e1e1e',
  blue: '#a5d8ff',
  blueLine: '#1971c2',
  green: '#b2f2bb',
  greenLine: '#2f9e44',
  yellow: '#ffec99',
  yellowLine: '#f08c00',
  red: '#ffc9c9',
  redLine: '#e03131',
  grey: '#e9ecef',
  greyLine: '#868e96',
  purple: '#d0bfff',
  purpleLine: '#6741d9',
};

/** A box. */
export function rect({ x, y, w, h, fill = 'transparent', stroke = COLORS.ink, dashed = false, round = true }) {
  return base({
    type: 'rectangle',
    x,
    y,
    width: w,
    height: h,
    backgroundColor: fill,
    strokeColor: stroke,
    strokeStyle: dashed ? 'dashed' : 'solid',
    roundness: round ? { type: 3 } : null,
  });
}

/** Free-floating text. `align` is 'left' | 'center' | 'right' relative to x. */
export function text({ x, y, str, size = 16, color = COLORS.ink, align = 'left', font = 1 }) {
  const lines = str.split('\n');
  const w = Math.max(...lines.map((l) => l.length)) * size * 0.56;
  const h = lines.length * size * 1.25;
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  return base({
    type: 'text',
    x: left,
    y,
    width: w,
    height: h,
    strokeColor: color,
    text: str,
    originalText: str,
    fontSize: size,
    fontFamily: font,
    textAlign: align === 'center' ? 'center' : 'left',
    verticalAlign: 'top',
    containerId: null,
    lineHeight: 1.25,
    autoResize: true,
  });
}

/** A box with a label centred inside it. Returns both elements. */
export function labelledBox({ x, y, w, h, str, fill, stroke, size = 16, dashed = false }) {
  return [
    rect({ x, y, w, h, fill, stroke, dashed }),
    text({
      x: x + w / 2,
      y: y + h / 2 - (str.split('\n').length * size * 1.25) / 2,
      str,
      size,
      align: 'center',
    }),
  ];
}

/** An arrow from [x1,y1] to [x2,y2]. `bend` lifts the midpoint for a curve. */
export function arrow({ x1, y1, x2, y2, color = COLORS.ink, dashed = false, bend = 0, head = 'arrow' }) {
  const points = bend
    ? [
        [0, 0],
        [(x2 - x1) / 2, (y2 - y1) / 2 + bend],
        [x2 - x1, y2 - y1],
      ]
    : [
        [0, 0],
        [x2 - x1, y2 - y1],
      ];
  return base({
    type: 'arrow',
    x: x1,
    y: y1,
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1) + Math.abs(bend),
    strokeColor: color,
    strokeStyle: dashed ? 'dashed' : 'solid',
    points,
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: head,
    elbowed: false,
  });
}

/** A plain line, no arrowhead. */
export function line({ x1, y1, x2, y2, color = COLORS.ink, dashed = false }) {
  return base({
    type: 'line',
    x: x1,
    y: y1,
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
    strokeColor: color,
    strokeStyle: dashed ? 'dashed' : 'solid',
    points: [
      [0, 0],
      [x2 - x1, y2 - y1],
    ],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
  });
}

/** Write the scene to disk. */
export function save(path, elements) {
  mkdirSync(dirname(path), { recursive: true });
  const scene = {
    type: 'excalidraw',
    version: 2,
    source: 'kafka-food-delivery',
    // flat(Infinity): helpers return arrays, and callers nest those arrays inside
    // their own arrays. One level of flattening is not enough.
    elements: elements.flat(Infinity),
    appState: { gridSize: null, viewBackgroundColor: '#ffffff' },
    files: {},
  };
  writeFileSync(path, JSON.stringify(scene, null, 2));
  console.log(`wrote ${path}  (${scene.elements.length} elements)`);
}
