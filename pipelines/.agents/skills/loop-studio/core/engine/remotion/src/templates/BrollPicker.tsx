import {
  AbsoluteFill,
  Img,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useTypeBase } from "./motion";

/**
 * BROLL PICKER — "here's all my b-roll, watch Claude pick one".
 *
 * Renders the real b-roll library as a grid of thumbnails (= "all my b-roll
 * from my drive"), then a lime scanning highlight hops across the tiles and
 * LOCKS onto the chosen clip, which scales up + glows while the rest dim —
 * literally showing the system selecting a clip. Full-screen takeover on the
 * brand raisin grid.
 */
export type BrollPickerItem = { image_path: string };

export type BrollPickerProps = {
  items: BrollPickerItem[];
  /** Index of the tile Claude picks (defaults to a middle tile). */
  pick_index?: number;
  /** Header label, e.g. "MY B-ROLL". */
  title?: string;
  /** Count shown next to the title, e.g. "48 CLIPS". */
  count_label?: string;
  beat_start_sec?: number;
};

const LIME = "#CFFF05";
const RAISIN = "#0F121A";
const BLOCK = "'Space Grotesk', system-ui, sans-serif";

const resolveSrc = (p: string): string =>
  p.startsWith("http") || p.startsWith("data:") ? p : staticFile(p);

export const BrollPicker: React.FC<BrollPickerProps> = ({
  items,
  pick_index,
  title = "MY B-ROLL",
  count_label,
  beat_start_sec,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();

  const list = (items ?? []).filter((it) => it && it.image_path);
  if (list.length === 0) return null;

  const n = list.length;
  const cols = n >= 12 ? 4 : n >= 6 ? 3 : 2;
  const rows = Math.ceil(n / cols);
  const pick = Math.max(0, Math.min(n - 1, pick_index ?? Math.floor(n / 2)));

  // Phase boundaries as a fraction of the whole beat (adapts to beat length).
  const dur = durationInFrames;
  const scanStart = 0.14;
  const lockAt = 0.48; // when the highlight settles on `pick` (holds longer)
  const t = frame / dur; // 0..1 over the beat

  // Scan hop sequence — deterministic walk across tiles, ending on `pick`.
  const hops: number[] = [];
  let cur = 0;
  for (let k = 0; k < 7; k++) {
    cur = (cur + Math.max(1, Math.round(n / 5)) + k) % n;
    hops.push(cur);
  }
  hops.push(pick);

  // Which tile is highlighted right now.
  let hi = pick;
  if (t < lockAt) {
    const sp = (t - scanStart) / Math.max(0.001, lockAt - scanStart); // 0..1 in scan window
    if (sp <= 0) hi = hops[0];
    else hi = hops[Math.min(hops.length - 1, Math.floor(sp * hops.length))];
  }
  const locked = t >= lockAt;

  // Layout
  const padX = Math.round(width * 0.045);
  const headH = Math.round(height * 0.13);
  const gap = Math.round(width * 0.012);
  const gridW = width - padX * 2;
  const tileW = (gridW - gap * (cols - 1)) / cols;
  const tileH = tileW * (9 / 16);
  const gridH = tileH * rows + gap * (rows - 1);
  const top0 = headH + (height - headH - gridH) / 2;

  // Header reveal
  const headIn = spring({ frame, fps, durationInFrames: Math.round(0.3 * fps), config: { damping: 16 } });
  const exit = frame > dur - 8
    ? interpolate(frame, [dur - 8, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  const titleSize = Math.round(typeBase * 0.046);
  const lockF = Math.round(lockAt * dur);
  const lockPop = spring({ frame: frame - lockF, fps, durationInFrames: Math.round(0.4 * fps), config: { damping: 12, stiffness: 200 } });

  return (
    <AbsoluteFill style={{ backgroundColor: RAISIN, opacity: exit }}>
      {/* subtle grid wash */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: `${Math.round(width / 22)}px ${Math.round(width / 22)}px`,
          maskImage: "radial-gradient(ellipse at 50% 45%, black 30%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 45%, black 30%, transparent 85%)",
        }}
      />

      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: Math.round(headH * 0.34),
          left: padX,
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          opacity: headIn,
          transform: `translateY(${(1 - headIn) * -12}px)`,
        }}
      >
        <span style={{ fontFamily: BLOCK, fontWeight: 800, fontSize: titleSize, color: "#fff", letterSpacing: 1 }}>
          {title}
        </span>
        {count_label && (
          <span style={{ fontFamily: BLOCK, fontWeight: 700, fontSize: Math.round(titleSize * 0.5), color: LIME, letterSpacing: 2 }}>
            {count_label}
          </span>
        )}
      </div>

      {/* Grid */}
      {list.map((it, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = padX + c * (tileW + gap);
        const y = top0 + r * (tileH + gap);
        const appearF = Math.round((0.02 + i * 0.012) * fps);
        const tileIn = spring({ frame: frame - appearF, fps, durationInFrames: Math.round(0.32 * fps), config: { damping: 15, stiffness: 180 } });
        const isHi = i === hi;
        const isPick = i === pick;

        // Opacity: during lock, non-picked tiles dim.
        const dim = locked && !isPick ? 0.32 : 1;
        const sc = (isPick && locked ? 1 + 0.12 * lockPop : isHi ? 1.03 : 1) * (0.9 + 0.1 * tileIn);
        const ring = isPick && locked ? 4 : isHi ? 3 : 0;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: tileW,
              height: tileH,
              borderRadius: 8,
              overflow: "hidden",
              opacity: tileIn * dim,
              transform: `scale(${sc})`,
              transformOrigin: "center",
              boxShadow: ring ? `0 0 0 ${ring}px ${LIME}, 0 12px 40px rgba(207,255,5,0.25)` : "0 4px 16px rgba(0,0,0,0.4)",
              zIndex: isPick && locked ? 5 : isHi ? 3 : 1,
            }}
          >
            <Img src={resolveSrc(it.image_path)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {isPick && locked && (
              <div
                style={{
                  position: "absolute",
                  bottom: 6,
                  left: 6,
                  background: LIME,
                  color: RAISIN,
                  fontFamily: BLOCK,
                  fontWeight: 800,
                  fontSize: Math.round(tileH * 0.13),
                  letterSpacing: 1,
                  padding: "3px 8px",
                  borderRadius: 5,
                  opacity: lockPop,
                }}
              >
                ✓ PICKED
              </div>
            )}
          </div>
        );
      })}

      {/* "claude" scanning label */}
      <div
        style={{
          position: "absolute",
          bottom: Math.round(height * 0.05),
          left: padX,
          fontFamily: BLOCK,
          fontWeight: 700,
          fontSize: Math.round(typeBase * 0.026),
          color: locked ? LIME : "#B5BFC2",
          letterSpacing: 1,
          opacity: headIn,
        }}
      >
        {locked ? "claude › matched the clip" : "claude › scanning b-roll…"}
      </div>
    </AbsoluteFill>
  );
};

export default BrollPicker;
