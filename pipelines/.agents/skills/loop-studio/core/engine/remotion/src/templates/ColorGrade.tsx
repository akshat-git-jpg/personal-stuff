import { AbsoluteFill } from "remotion";

/**
 * COLOR GRADE — a single cinematic grade laid over the WHOLE comp (speaker +
 * b-roll alike) so the piece reads as one graded film, not a speaker clip
 * with stock cutaways pasted on.
 *
 * Three restrained layers, top-down:
 *   1. duotone wash — warm in the highlights, cool in the shadows, via a
 *      soft-light blend. The filmic "warm/cool" separation, dialed way back.
 *   2. vignette — a soft radial darkening that pulls the eye to centre.
 *   3. (contrast/saturation lift is applied as a `filter` on the comp root
 *      in EditedVideo — see GRADE_FILTER — because a blend layer can't add
 *      contrast to what's beneath it.)
 *
 * Tuned to be felt, not seen. If you can point at "the filter", it's too
 * strong — back it off. This is a grade, not an Instagram preset.
 */

/** Applied as a CSS `filter` on the comp root. Subtle contrast + saturation
 *  + a hair of lift so the whole frame has more snap. */
export const GRADE_FILTER = "contrast(1.03) saturate(1.10) brightness(1.03)";

export const ColorGrade: React.FC = () => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* 1. duotone wash — warm top / cool bottom, soft-light blend */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(178deg, rgba(255,206,138,0.07) 0%, rgba(255,206,138,0.0) 42%, rgba(36,66,104,0.03) 64%, rgba(36,66,104,0.09) 100%)",
          mixBlendMode: "soft-light",
        }}
      />
      {/* 2. vignette — soft radial darkening, biased slightly up to the face.
             Lightened 2026-07-01 (Luuk: "too many luts") so it stops reading as
             a heavy filter. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 86% 76% at 50% 42%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.05) 82%, rgba(0,0,0,0.13) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
