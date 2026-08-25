/**
 * BrandOutro — the like/subscribe close of the personal-brand video, in the BrandIntro language.
 * 3840x2160 @30, ~7.0s. Talking head full-bleed with burned captions, a house SUBSCRIBE button that
 * clicks, an arrow to the description link, and a GET STARTED plate. Same bb2 system as the intro.
 */
import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FootageLayer, Marker, DarkBg, SILVER, LIME, RAISIN, SANS, MONO, type SK, skf } from "./bb2/scene";
import { FPS, ip, HL, Cap, Eyebrow, SubscribeBtn } from "./bb2/brandkit";
import { SfxLayer, type Sfx } from "./bb2/engine";

const A = (n: string) => staticFile(`brandoutro/${n}`);
export const BRAND_OUTRO_FRAMES = Math.round(7.018 * FPS);

export const BrandOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W } = useVideoConfig();
  const u = W / 100;
  const t = frame / FPS;
  const ink = SILVER;

  // head full-bleed throughout — this is a direct-address CTA
  const SKF: SK[] = [{ t: 0, x: 50, y: 50, s: 1, dim: 0, fr: 0 }, { t: 7.1, x: 50, y: 50, s: 1, dim: 0, fr: 0 }];
  const sk = skf(SKF, frame);

  const SFX: Sfx[] = [
    { t: 0.0, name: "es_swell.wav", vol: 0.18 },
    { t: 2.94, name: "es_success.wav", vol: 0.24 }, // subscribe click
    { t: 4.54, name: "es_blip.wav", vol: 0.2 },     // link
    { t: 5.82, name: "flare-hit.mp3", vol: 0.22 },  // get started
  ];

  return (
    <AbsoluteFill style={{ background: RAISIN, overflow: "hidden" }}>
      <Audio src={A("vo.m4a")} />
      <Audio src={staticFile("music/brand_intro_bed.wav")} volume={0.28} />
      <SfxLayer plan={SFX} />
      <DarkBg u={u} />
      <FootageLayer sk={sk} u={u} src="brandoutro/head_4k.mp4" />

      <Eyebrow u={u} t={t} at={0.3} ink={ink}>BEFORE YOU GO</Eyebrow>

      {/* B1 · like & subscribe (1.98–3.6) */}
      {t >= 1.9 && t < 3.7 && (
        <>
          <SubscribeBtn u={u} t={t} at={2.05} y="60%" />
          <Cap u={u} t={t} at={1.98} out={3.6} ink={ink} pre="make sure to like and " hot="subscribe" />
        </>
      )}

      {/* B2 · the link (3.74–5.6) */}
      {t >= 3.7 && t < 5.65 && (() => {
        const a = ip(t, 4.2, 4.6);
        return (
          <>
            {/* a pill pointing to the description, with a down arrow */}
            <div style={{ position: "absolute", left: "50%", top: "60%", transform: "translate(-50%,-50%)", opacity: a }}>
              <div style={{ display: "flex", alignItems: "center", gap: u * 0.9, padding: `${u * 0.8}px ${u * 2}px`,
                background: RAISIN, border: `${u * 0.14}px solid ${LIME}`, borderRadius: u * 0.7,
                fontFamily: SANS, fontWeight: 800, fontSize: u * 1.6, color: LIME, textTransform: "uppercase" }}>
                LINK IN DESCRIPTION
              </div>
              <svg viewBox="0 0 24 24" style={{ position: "absolute", left: "50%", top: "115%", transform: "translateX(-50%)", width: u * 2.6, height: u * 2.6 }}>
                <path d="M12 3 L12 17 M6 12 L12 18 L18 12" fill="none" stroke={LIME} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <Cap u={u} t={t} at={3.74} out={5.6} ink={ink} pre="check the " hot="link" post=" in the description" />
          </>
        );
      })()}

      {/* B3 · get started (5.72–7.0) */}
      {t >= 5.65 && (
        <HL u={u} t={t} at={5.85} ink={ink} size={3.2}>
          GET <Marker u={u} t={t} at={6.15} base={ink}>STARTED</Marker>
        </HL>
      )}
    </AbsoluteFill>
  );
};
