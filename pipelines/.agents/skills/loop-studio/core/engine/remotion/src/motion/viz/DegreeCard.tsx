import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { clamp, SANS, SERIF, MONO, RAISIN, BODY } from "../kit";

export type DegreeCardProps = {
  logo?: string;        // staticFile path to a university wordmark (transparent png)
  institution?: string; // fallback text if no logo
  level?: string;       // "BACHELOR OF SCIENCE"
  field?: string;       // "ARTIFICIAL INTELLIGENCE"
  note?: string;        // "Final year"
  stamp?: string;       // the slam-on stamp, default "DROPPED OUT"
};

const STAMP_RED = "#C62828"; // a cancellation stamp reads red — deliberate, for clarity

/* The hook artifact: a real university degree certificate that gets a big red
   "DROPPED OUT" stamp slammed across it. Grounds "I dropped out of my AI degree"
   in a concrete object instead of a text caption. */
export const DegreeCard: React.FC<DegreeCardProps> = ({
  logo = "edu/uva_wordmark.png",
  institution = "UNIVERSITY OF AMSTERDAM",
  level = "BACHELOR OF SCIENCE",
  field = "ARTIFICIAL INTELLIGENCE",
  note = "Final year · never finished",
  stamp = "DROPPED OUT",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // card eases in fast
  const inS = spring({ frame, fps, config: { damping: 16, stiffness: 150 } });
  // stamp slams on at ~33% of the beat (lands on "...degree"): big -> settle
  const stampStart = Math.round(durationInFrames * 0.33);
  const ss = spring({ frame: frame - stampStart, fps, config: { damping: 9, stiffness: 240 } });
  const stampScale = interpolate(clamp(ss, 0, 1), [0, 1], [1.8, 1]);
  const stampOp = clamp(ss * 1.4, 0, 1);
  // a tiny impact shake on the card right when the stamp lands
  const shakeT = clamp((frame - stampStart) / 7, 0, 1);
  const shake = frame >= stampStart && shakeT < 1 ? Math.sin(shakeT * Math.PI * 3) * (1 - shakeT) * 7 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#D9DDE4" }}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img src={staticFile("brand/grid-light.png")} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(206,211,219,0.45)" }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            position: "relative",
            width: 1180,
            padding: "84px 96px",
            background: "#FBFAF6",
            border: "2px solid #C9CCD2",
            outline: "10px solid #FBFAF6",
            boxShadow: "0 40px 90px rgba(15,18,26,0.22)",
            borderRadius: 4,
            transform: `translateX(${shake}px) scale(${interpolate(clamp(inS, 0, 1), [0, 1], [0.92, 1])})`,
            opacity: clamp(inS, 0, 1),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          {/* university lockup */}
          {logo ? (
            <Img src={staticFile(logo)} style={{ height: 92, objectFit: "contain", marginBottom: 14 }} />
          ) : (
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 40, color: RAISIN }}>{institution}</div>
          )}
          <div style={{ width: 120, height: 3, background: RAISIN, opacity: 0.85, margin: "26px 0 30px" }} />
          <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: "0.34em", color: BODY, textTransform: "uppercase" }}>{level}</div>
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 86, color: RAISIN, lineHeight: 1.04, margin: "14px 0 18px" }}>{field}</div>
          <div style={{ fontFamily: SANS, fontSize: 26, color: BODY, letterSpacing: "0.02em" }}>{note}</div>

          {/* the slam-on stamp */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "57%",
              transform: `translate(-50%, -50%) rotate(-11deg) scale(${stampScale})`,
              opacity: stampOp,
              border: `7px solid ${STAMP_RED}`,
              borderRadius: 10,
              padding: "12px 30px",
              color: STAMP_RED,
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: 78,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              boxShadow: "0 0 0 2px rgba(198,40,40,0.25)",
              background: "rgba(255,255,255,0.04)",
              whiteSpace: "nowrap",
            }}
          >
            {stamp}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
