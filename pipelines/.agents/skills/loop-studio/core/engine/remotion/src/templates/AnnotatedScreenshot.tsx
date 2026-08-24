import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { DarkGridBg } from "./Backgrounds";
import { useTypeBase } from "./motion";

const resolveSrc = (s: string): string => /^https?:\/\//i.test(s) ? s : staticFile(s);

export type AnnotationHighlight = {
  /** Rectangle in IMAGE-FRACTION coords. 0,0 = top-left of image, 1,1 = bottom-right.
   *  Width/height are also fractions of the image dimensions. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Optional label rendered as a callout on a corner. */
  label?: string;
  /** Anchor for the label callout. Default "right". */
  label_anchor?: "right" | "left" | "top" | "bottom";
  /** When this highlight draws in (sec, relative). Auto-stagger if missing. */
  appear_sec?: number;
};

export type AnnotatedScreenshotProps = {
  /** Path to the screenshot. Should be on disk in the workdir. */
  image_path: string;
  highlights: AnnotationHighlight[];
  /** When set, after all highlights have drawn in, smoothly zoom INTO the
   *  bounding box of all highlights (or the union if multiple), holding
   *  there for the rest of the beat. Default false. */
  zoom_to_highlights?: boolean;
};

const MAX_HIGHLIGHTS = 4;

/**
 * Premium "annotated screenshot" — a real screenshot with lime brackets that
 * draw in around specific UI regions, plus optional callout labels and an
 * optional cinematic zoom that pulls the camera toward the annotations.
 *
 * What it does that no other template does:
 *  1. Vignette darkens everything OUTSIDE the active highlight rectangles
 *     so the viewer's eye is forced to the highlighted region
 *  2. Lime brackets (corner-only, not full rectangles) draw in with eased
 *     wipes — feels like a focus grid landing
 *  3. Optional labels with leader lines from the highlight to the label
 *  4. Optional camera-pan-and-zoom toward the union of all highlights at
 *     end of the beat — cinematic finishing move
 *
 * Use for: "look at THIS specific button on the dashboard", "see how the
 * routine status changes here", any moment where you want to direct the
 * eye to a tiny part of a complex UI.
 */
export const AnnotatedScreenshot: React.FC<AnnotatedScreenshotProps> = ({ image_path, highlights, zoom_to_highlights }) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";
  const N = Math.min(MAX_HIGHLIGHTS, highlights.length);

  // The screenshot fills the frame with `objectFit: contain`. We compute the
  // actual displayed image rectangle so highlight coords (which are in image
  // fractions) map correctly to screen pixels even when the image
  // letterboxes.
  // Without knowing the image's intrinsic size at render time, we treat the
  // image as filling the whole frame (cover). Authoring assumes screenshot
  // aspect ≈ frame aspect (16:9 dashboard screenshots — same shape).
  // For tighter mapping, the user pre-crops their screenshot to 16:9.
  const imgX = 0;
  const imgY = 0;
  const imgW = width;
  const imgH = height;

  const totalSec = durationInFrames / fps;
  const span = totalSec * 0.55;
  const norm = highlights.slice(0, MAX_HIGHLIGHTS).map((h, i) => ({
    ...h,
    appear_sec: typeof h.appear_sec === "number" ? h.appear_sec : 0.30 + (span / Math.max(1, N)) * i,
  }));

  // Camera zoom-and-pan: when zoom_to_highlights is true, after all
  // highlights have settled, lerp toward the union bounding-box.
  let camScale = 1;
  let camX = 0;
  let camY = 0;
  if (zoom_to_highlights && N > 0) {
    const lastAppear = Math.max(...norm.map((h) => h.appear_sec!));
    const zoomStart = lastAppear + 0.50;
    const zoomEnd = totalSec - 0.30;
    const tNow = frame / fps;
    const k = interpolate(tNow, [zoomStart, zoomStart + 1.20], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
    if (k > 0) {
      // Compute union bbox in image-fraction coords
      const minX = Math.max(0, Math.min(...norm.map((h) => h.x)) - 0.04);
      const minY = Math.max(0, Math.min(...norm.map((h) => h.y)) - 0.04);
      const maxX = Math.min(1, Math.max(...norm.map((h) => h.x + h.w)) + 0.04);
      const maxY = Math.min(1, Math.max(...norm.map((h) => h.y + h.h)) + 0.04);
      const bboxW = maxX - minX;
      const bboxH = maxY - minY;
      // Target scale so the bbox fills 0.62 of the frame
      const targetScale = Math.min(1 / Math.max(0.001, bboxW * 1.6), 1 / Math.max(0.001, bboxH * 1.6));
      const cappedScale = Math.min(2.4, targetScale);
      camScale = 1 + (cappedScale - 1) * k;
      // Center on bbox center
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      camX = (0.5 - cx) * imgW * (camScale - 1) * k;
      camY = (0.5 - cy) * imgH * (camScale - 1) * k;
      // Hold (no further movement) once we're in
      void zoomEnd;
    }
  }

  // Bracket bracket-stroke length as fraction of bracket dimension
  const BRACKET_FRAC = 0.32;
  const strokeW = Math.round(typeBase * 0.008);
  const labelFontSize = Math.round(typeBase * 0.026);

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#0F121A" }}>
      <DarkGridBg />

      {/* Camera-transformed image + annotations */}
      <div style={{
        position: "absolute",
        left: 0, top: 0, width: "100%", height: "100%",
        transform: `translate(${camX}px, ${camY}px) scale(${camScale})`,
        transformOrigin: "center",
      }}>
        <Img
          src={resolveSrc(image_path)}
          style={{
            position: "absolute",
            left: imgX, top: imgY,
            width: imgW, height: imgH,
            objectFit: "cover",
          }}
        />

        {/* Vignette layer — dark overlay everywhere EXCEPT the active highlights.
            We don't actually mask because that's expensive in WebKit; instead
            we render a uniform darken layer that fades in/out at appropriate
            times. Highlights still render BRIGHTER via a re-image trick. */}
        {N > 0 && (() => {
          const tNow = frame / fps;
          const firstAppear = Math.min(...norm.map((h) => h.appear_sec!));
          const lastAppear = Math.max(...norm.map((h) => h.appear_sec!));
          const dimK = interpolate(tNow, [firstAppear, firstAppear + 0.40], [0, 0.45], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          // Fade vignette out at very end if zoom is happening (they'd compete)
          const fadeOut = zoom_to_highlights
            ? interpolate(tNow, [lastAppear + 1.80, lastAppear + 2.20], [1, 0.5], {
                extrapolateLeft: "clamp", extrapolateRight: "clamp",
              })
            : 1;
          return (
            <div style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(15,18,26,0.85)",
              opacity: dimK * fadeOut,
              pointerEvents: "none",
            }} />
          );
        })()}

        {/* Re-render image inside each highlight rect (over the vignette) so
            those areas pop. This is cheaper than CSS masks and works on every
            renderer. */}
        {norm.map((h, i) => {
          const tNow = frame / fps;
          const popIn = interpolate(tNow, [h.appear_sec!, h.appear_sec! + 0.30], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          const x = imgX + h.x * imgW;
          const y = imgY + h.y * imgH;
          const w = h.w * imgW;
          const ht = h.h * imgH;
          return (
            <div key={`reimg-${i}`} style={{
              position: "absolute",
              left: x, top: y, width: w, height: ht,
              overflow: "hidden",
              opacity: popIn,
              pointerEvents: "none",
            }}>
              <Img
                src={resolveSrc(image_path)}
                style={{
                  position: "absolute",
                  left: -x + imgX,
                  top: -y + imgY,
                  width: imgW,
                  height: imgH,
                  objectFit: "cover",
                }}
              />
            </div>
          );
        })}

        {/* Lime corner brackets around each highlight */}
        {norm.map((h, i) => {
          const tNow = frame / fps;
          const drawProg = interpolate(tNow, [h.appear_sec!, h.appear_sec! + 0.45], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1),
          });
          const x = imgX + h.x * imgW;
          const y = imgY + h.y * imgH;
          const w = h.w * imgW;
          const ht = h.h * imgH;
          const bw = w * BRACKET_FRAC;
          const bh = ht * BRACKET_FRAC;
          const drawW = bw * drawProg;
          const drawH = bh * drawProg;
          return (
            <svg
              key={`br-${i}`}
              style={{
                position: "absolute",
                left: x, top: y, width: w, height: ht,
                overflow: "visible", pointerEvents: "none",
              }}
            >
              {/* TL corner */}
              <line x1={0} y1={0} x2={drawW} y2={0} stroke="#CFFF05" strokeWidth={strokeW} strokeLinecap="round" />
              <line x1={0} y1={0} x2={0} y2={drawH} stroke="#CFFF05" strokeWidth={strokeW} strokeLinecap="round" />
              {/* TR corner */}
              <line x1={w} y1={0} x2={w - drawW} y2={0} stroke="#CFFF05" strokeWidth={strokeW} strokeLinecap="round" />
              <line x1={w} y1={0} x2={w} y2={drawH} stroke="#CFFF05" strokeWidth={strokeW} strokeLinecap="round" />
              {/* BL corner */}
              <line x1={0} y1={ht} x2={drawW} y2={ht} stroke="#CFFF05" strokeWidth={strokeW} strokeLinecap="round" />
              <line x1={0} y1={ht} x2={0} y2={ht - drawH} stroke="#CFFF05" strokeWidth={strokeW} strokeLinecap="round" />
              {/* BR corner */}
              <line x1={w} y1={ht} x2={w - drawW} y2={ht} stroke="#CFFF05" strokeWidth={strokeW} strokeLinecap="round" />
              <line x1={w} y1={ht} x2={w} y2={ht - drawH} stroke="#CFFF05" strokeWidth={strokeW} strokeLinecap="round" />
            </svg>
          );
        })}

        {/* Labels (callout pills) */}
        {norm.map((h, i) => {
          if (!h.label) return null;
          const tNow = frame / fps;
          const labelEnter = interpolate(tNow, [h.appear_sec! + 0.30, h.appear_sec! + 0.65], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1),
          });
          const x = imgX + h.x * imgW;
          const y = imgY + h.y * imgH;
          const w = h.w * imgW;
          const ht = h.h * imgH;
          const anchor = h.label_anchor ?? "right";
          let labelX = 0, labelY = 0;
          const labelOffset = Math.round(typeBase * 0.030);
          if (anchor === "right") { labelX = x + w + labelOffset; labelY = y + ht / 2 - labelFontSize; }
          else if (anchor === "left") { labelX = x - labelOffset; labelY = y + ht / 2 - labelFontSize; }
          else if (anchor === "top") { labelX = x + w / 2; labelY = y - labelOffset - labelFontSize * 2; }
          else { labelX = x + w / 2; labelY = y + ht + labelOffset; }

          const transform = anchor === "left"
            ? `translate(-100%, 0)`
            : anchor === "top" || anchor === "bottom"
              ? `translate(-50%, 0)`
              : "none";

          return (
            <div key={`lbl-${i}`} style={{
              position: "absolute",
              left: labelX,
              top: labelY,
              transform,
              fontFamily,
              fontWeight: 700,
              fontSize: labelFontSize,
              color: "#0F121A",
              backgroundColor: "#CFFF05",
              padding: `${Math.round(typeBase * 0.008)}px ${Math.round(typeBase * 0.018)}px`,
              borderRadius: Math.round(typeBase * 0.010),
              opacity: labelEnter,
              transformOrigin: "center",
              boxShadow: `0 ${Math.round(typeBase * 0.005)}px ${Math.round(typeBase * 0.014)}px rgba(15,18,26,0.30)`,
              whiteSpace: "nowrap",
              maxWidth: width * 0.30,
              overflow: "hidden",
              textOverflow: "ellipsis",
              letterSpacing: "0.02em",
            }}>
              {h.label}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
