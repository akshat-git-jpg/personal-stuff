/**
 * Ink.tsx — hand-drawn worksheet illustrations for the Business Brain film.
 * Each drawing is authored on a 40x40 design grid and draws on (SVG dash). Raisin ink by default.
 * Use inside <InkLayer>: <Ink name="database" x={30} y={18} w={20} at={0.6} />  (x,y,w in page units).
 */
import React from "react";
import { Draw, RAISIN, LIME } from "./Brand";

type Seg = { d: string; len?: number; color?: string; capButt?: boolean };

const D: Record<string, (accent: string) => Seg[]> = {
  folder: () => [
    { d: "M6 14 L16 14 L19 10 L34 10 L34 34 L6 34 Z", len: 130 },
    { d: "M11 20 L29 20", len: 20 }, { d: "M11 25 L29 25", len: 20 }, { d: "M11 30 L24 30", len: 16 },
  ],
  database: (a) => [
    { d: "M8 10 a12 4 0 1 0 24 0 a12 4 0 1 0 -24 0", len: 90, color: a },
    { d: "M8 10 L8 30", len: 22 }, { d: "M32 10 L32 30", len: 22 },
    { d: "M8 30 a12 4 0 0 0 24 0", len: 42 },
    { d: "M8 17 a12 4 0 0 0 24 0", len: 42 }, { d: "M8 24 a12 4 0 0 0 24 0", len: 42 },
  ],
  loop: (a) => [
    { d: "M8 20 A12 12 0 0 1 32 20", len: 60, color: a }, { d: "M32 20 l -4 -3 M32 20 l -3 4", len: 12, color: a },
    { d: "M32 20 A12 12 0 0 1 8 20", len: 60, color: a }, { d: "M8 20 l 4 3 M8 20 l 3 -4", len: 12, color: a },
  ],
  recipe: () => [
    { d: "M11 6 L27 6 L33 12 L33 36 L11 36 Z", len: 110 }, { d: "M27 6 L27 12 L33 12", len: 18 },
    { d: "M16 17 L29 17", len: 15 }, { d: "M16 22 L29 22", len: 15 }, { d: "M16 27 L29 27", len: 15 }, { d: "M16 31 L23 31", len: 9 },
  ],
  dashboard: (a) => [
    { d: "M6 8 L34 8 L34 30 L6 30 Z", len: 110 }, { d: "M18 30 L18 34 M13 34 L27 34", len: 20 },
    { d: "M9 12 L20 12 L20 27 L9 27 Z", len: 55 }, { d: "M23 12 L31 12 L31 18 L23 18 Z", len: 34 }, { d: "M23 21 L31 21 L31 27 L23 27 Z", len: 34 },
    { d: "M10 25 L13 20 L16 22 L19 15", len: 22, color: a },
  ],
  plug: (a) => [
    { d: "M4 15 L16 15 L16 27 L4 27 Z", len: 50 },
    { d: "M24 15 a6 2.4 0 1 0 12 0 a6 2.4 0 1 0 -12 0 M24 15 L24 27 M36 15 L36 27 M24 27 a6 2.4 0 0 0 12 0", len: 70 },
    { d: "M16 21 L21 21", len: 6, color: a }, { d: "M21 18.5 L23 18.5 L23 23.5 L21 23.5 Z", len: 12, color: a }, { d: "M23 19.5 L24.5 19.5 M23 22.5 L24.5 22.5", len: 6, color: a },
  ],
  spark: (a) => [
    { d: "M20 5 C21.5 15 25 18.5 35 20 C25 21.5 21.5 25 20 35 C18.5 25 15 21.5 5 20 C15 18.5 18.5 15 20 5 Z", len: 130, color: a },
  ],
  stackFiles: () => [
    { d: "M14 10 L24 10 L28 14 L28 30 L14 30 Z", len: 70 },
    { d: "M11 13 L21 13 L25 17 L25 33 L11 33 Z", len: 70 },
    { d: "M8 16 L18 16 L22 20 L22 36 L8 36 Z", len: 70 }, { d: "M12 24 L19 24 M12 28 L19 28", len: 14 },
  ],
  movie: (a) => [
    { d: "M6 18 L34 18 L34 34 L6 34 Z", len: 90 },
    { d: "M6 14 L33 11 L34 16 L7 19 Z", len: 60, color: a },
    { d: "M12 12 L14 18 M18 11.5 L20 17.5 M24 11 L26 17", len: 20, color: a },
  ],
  photo: (a) => [
    { d: "M6 10 L34 10 L34 32 L6 32 Z", len: 100 },
    { d: "M9 29 L16 21 L21 25 L27 18 L31 29", len: 36, color: a },
    { d: "M27 16 a3 3 0 1 0 0.1 0", len: 20, color: a },
  ],
  frozenFile: (a) => [
    { d: "M11 6 L27 6 L33 12 L33 36 L11 36 Z", len: 110, color: a }, { d: "M27 6 L27 12 L33 12", len: 18, color: a },
    { d: "M22 21 L17 16 M22 21 L28 18 M22 21 L20 28 M22 21 L28 26 M22 21 L15 24", len: 40, color: a },
  ],
  stream: (a) => [
    { d: "M4 12 q6 -4 12 0 t12 0 t12 0", len: 50, color: a },
    { d: "M4 20 q6 -4 12 0 t12 0 t12 0", len: 50, color: a },
    { d: "M4 28 q6 -4 12 0 t12 0 t12 0", len: 50, color: a },
    { d: "M6 34 q7 -4 14 0 t14 0", len: 40, color: a },
  ],
};

// aliases so manifest drawing names map onto the library
const ALIAS: Record<string, string> = { files: "stackFiles", mdfile: "recipe", md: "recipe", loops: "loop", cylinder: "database" };

export const INK_NAMES = Object.keys(D);

export const Ink: React.FC<{ name: string; x: number; y: number; w: number; at?: number; dur?: number; color?: string; accent?: string; stagger?: number }> = ({ name, x, y, w, at = 0.4, dur = 0.9, color = RAISIN, accent = LIME, stagger = 0.12 }) => {
  const segs = (D[ALIAS[name] || name] || D.folder)(accent);
  const sc = w / 40;
  const sw = 0.44 / sc;
  return (
    <g transform={`translate(${x} ${y}) scale(${sc})`}>
      {segs.map((s, i) => (
        <Draw key={i} d={s.d} at={at + i * stagger} dur={dur} w={sw} color={s.color || color} len={s.len ?? 120} cap={s.capButt ? "butt" : "round"} />
      ))}
    </g>
  );
};
