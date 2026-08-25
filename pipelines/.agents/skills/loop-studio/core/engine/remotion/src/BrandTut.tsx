/**
 * BrandTut — the tutorial/recap section of the personal-brand video, in the BrandIntro language.
 * 3840x2160 @30, ~65.3s. Talking head + real-asset showcase, beat per idea (colour, face/Soul,
 * consistency, website, the test, payoff, skill CTA, Seedance motion, subscribe). Same bb2 system.
 */
import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { DarkBg, SILVER, LIME, RAISIN, SANS, MONO, type SK, skf } from "./bb2/scene";
import { FPS, MAGENTA, ip, HL, Cap, Eyebrow, Asset as KitAsset, SubscribeBtn, MarkerC, FootageC, SiteScroll } from "./bb2/brandkit";
import { SfxLayer, type Sfx } from "./bb2/engine";

const A = (n: string) => staticFile(`brandtut/${n}`);
export const BRAND_TUT_FRAMES = Math.round(65.301 * FPS);
// asset cards read from the brandtut public dir
const AC = MAGENTA;  // Nout's accent — the whole tutorial is HIS brand
const Asset: React.FC<React.ComponentProps<typeof KitAsset>> = (p) => <KitAsset accent={AC} {...p} dir="brandtut" />;
const THUMBS = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `thumb_${i}.png`);
const SW = ["brand/swatch_raisin.png", "brand/swatch_silver.png", "brand/swatch_lime.png"];

export const BrandTut: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W } = useVideoConfig();
  const u = W / 100;
  const t = frame / FPS;
  const ink = SILVER;

  /* the head spine — docks RIGHT while assets showcase LEFT, hides when an asset owns the frame */
  const P = (a: number) => ({ t: a, x: 73, y: 53, s: 0.94, dim: 0.06, fr: 1 } as SK);   // panel right
  const HIDE = (a: number) => ({ t: a, x: 50, y: 50, s: 1, dim: 1, fr: 1 } as SK);        // hidden
  const FULL = (a: number) => ({ t: a, x: 50, y: 50, s: 1, dim: 0, fr: 0 } as SK);        // full bleed
  const SKF: SK[] = [
    FULL(0), FULL(0.6), P(1.1), P(19.6),          // colour → face → posts (panel)
    HIDE(20.0), HIDE(27.7),                        // WEBSITE owns the frame (word "website" at 23.3)
    P(28.0), P(34.7),                              // written-down / brand book
    HIDE(35.0), HIDE(41.9),                        // the test owns the frame; hold hidden until assets clear (41.3)
    FULL(42.3), FULL(46.6),                        // "nothing this morning → everything" ("nothing" at 42.9)
    P(47.0), P(51.7),                             // skill CTA ("skill" 48.2, "link" 50.8)
    HIDE(52.0), HIDE(61.3),                       // Seedance ("sedans" 53, "moving" 58.9) — head hidden, single decode
    P(61.6), P(65.3),                             // subscribe ("subscribe" 62.7)
  ];
  const sk = skf(SKF, frame);

  const SFX: Sfx[] = [
    { t: 0.5, name: "es_swell.wav", vol: 0.11 },
    { t: 4.9, name: "card-pop.wav", vol: 0.14 },    // the face lands
    { t: 20.3, name: "es_swell.wav", vol: 0.13 },   // the website
    { t: 38.8, name: "es_ping.wav", vol: 0.16 },    // "one person"
    { t: 42.5, name: "boom_sub.wav", vol: 0.18 },   // payoff, full bleed
    { t: 62.7, name: "es_success.wav", vol: 0.14 }, // subscribe
  ];

  return (
    <AbsoluteFill style={{ background: RAISIN, overflow: "hidden" }}>
      <Audio src={A("vo.m4a")} />
      <Audio src={staticFile("music/brand_intro_bed.wav")} volume={0.26} />
      <SfxLayer plan={SFX} />
      <DarkBg u={u} />
      <FootageC sk={sk} u={u} src="brandtut/head_4k.mp4" accent={AC} />

      {/* B0 0.0–4.5 · THE COLOUR — the three real palette cards */}
      {t < 4.5 && (
        <>
          <Eyebrow u={u} t={t} at={0.4} ink={ink} accent={AC}>STEP 1 · THE COLOUR</Eyebrow>
          {["nout/swatch_magenta.png","nout/swatch_slate.png","nout/swatch_paper.png"].map((s, i) => <Asset key={s} x={20 + i * 12} y={45} u={u} w={9.5} ar={0.435} src={s} t={t} at={1.2 + i * 0.14} />)}
          <Cap u={u} t={t} at={0.2} out={4.4} ink={ink} accent={AC} pre="a colour that is " hot="recognisable" post=", but it pops" />
        </>
      )}

      {/* B1 4.5–13.6 · THE FACE — trained Soul, it's actually him */}
      {t >= 4.5 && t < 13.6 && (
        <>
          <Eyebrow u={u} t={t} at={4.8} ink={ink} accent={AC}>STEP 2 · THE FACE</Eyebrow>
          <Asset x={20} y={44} u={u} w={19} ar={1} src="nout/avatar.png" t={t} at={4.9} />
          <Asset x={41} y={44} u={u} w={19} ar={1} src="nout/hero.png" t={t} at={9.4} out={13.5} />
          <Cap u={u} t={t} at={5.4} out={9.0} ink={ink} accent={AC} pre="his face, we trained this on a " hot="Soul" />
          <Cap u={u} t={t} at={9.3} out={13.4} ink={ink} accent={AC} pre="it's actually " hot="him" post=", not a new guy every image" />
        </>
      )}

      {/* B2 13.6–18.1 · CONSISTENCY — his posts, same everywhere */}
      {t >= 13.5 && t < 20.0 && (
        <>
          <Eyebrow u={u} t={t} at={13.9} ink={ink} accent={AC}>EVERYTHING INHERITS IT</Eyebrow>
          {["nout/carousel_1.png","nout/carousel_2.png","nout/carousel_3.png"].map((s, i) => (
            <Asset key={s} x={14 + i * 15} y={45} u={u} w={13} ar={0.8} src={s} t={t} at={13.8 + i * 0.14} />
          ))}
          <HL u={u} t={t} at={18.4} ink={ink} size={2.9}>SAME <MarkerC u={u} t={t} at={19.0} base={ink} accent={AC}>PERSON</MarkerC> EVERYWHERE</HL>
        </>
      )}

      {/* B3 20.0–28.0 · THE WEBSITE — his real site scrolls; word "website" lands at 23.3 */}
      {t >= 20.0 && t < 28.0 && (
        <>
          <Eyebrow u={u} t={t} at={20.3} ink={ink} accent={AC}>NOUTALLEMAN.COM</Eyebrow>
          <SiteScroll u={u} t={t} at={20.3} src="nout/site_scroll.png" dir="brandtut" x={50} y={46} w={54} imgAr={2880 / 3604} accent={AC} scrollFrom={1.2} scrollDur={5.6} />
          <HL u={u} t={t} at={23.1} ink={ink} size={2.9}>A WHOLE <MarkerC u={u} t={t} at={23.5} base={ink} accent={AC}>WEBSITE</MarkerC></HL>
        </>
      )}

      {/* B4 28.0–35.0 · WRITTEN DOWN — the brand book; word "written" lands at 33.1 */}
      {t >= 28.0 && t < 35.0 && (
        <>
          <Eyebrow u={u} t={t} at={28.3} ink={ink} accent={AC}>THE BRAND BOOK</Eyebrow>
          <Asset x={31} y={45} u={u} w={40} ar={16 / 9} src="nout/bookpage.png" t={t} at={28.3} out={34.7} />
          <HL u={u} t={t} at={32.6} ink={ink} size={2.9}>IT'S ALL <MarkerC u={u} t={t} at={33.1} base={ink} accent={AC}>WRITTEN DOWN</MarkerC></HL>
        </>
      )}

      {/* B5 27.8–41.6 · THE TEST — everything on one screen, could a stranger tell it's one person */}
      {t >= 35.0 && t < 42.0 && (() => {
        const items: [string, number, number, number, number][] = [
          ["nout/avatar.png", 17, 32, 13, 1], ["nout/carousel_1.png", 37, 31, 12, 0.8], ["nout/hero.png", 58, 32, 13, 1],
          ["nout/swatch_magenta.png", 76, 33, 5.5, 0.435], ["nout/bookpage.png", 34, 64, 26, 16 / 9], ["nout/motion_poster.png", 66, 63, 9, 0.562],
        ];
        return (
          <>
            <Eyebrow u={u} t={t} at={35.2} ink={ink} accent={AC}>THE TEST</Eyebrow>
            {items.map(([s, x, y, w, ar], i) => (
              <Asset key={s} x={x} y={y} u={u} w={w} ar={ar} src={s} t={t} at={35.1 + i * 0.16} out={41.3} />
            ))}
            <HL u={u} t={t} at={38.3} out={41.4} ink={ink} size={2.9}>ONE <MarkerC u={u} t={t} at={38.8} base={ink} accent={AC}>PERSON</MarkerC></HL>
          </>
        );
      })()}

      {/* B6 41.65–47.0 · THE PAYOFF — nothing this morning → everything, on him full-bleed */}
      {t >= 42.0 && t < 47.0 && (
        <HL u={u} t={t} at={42.6} ink={SILVER} size={3.2}>FROM NOTHING TO A WHOLE <MarkerC u={u} t={t} at={43.6} base={SILVER} accent={AC}>BRAND</MarkerC></HL>
      )}

      {/* B7 47.0–56.6 · THE SKILL — one skill, do it yourself, link */}
      {t >= 47.0 && t < 52.0 && (() => {
        const a = ip(t, 50.6, 51.0);
        return (
          <>
            <Eyebrow u={u} t={t} at={47.3} ink={ink} accent={AC}>PACKAGED AS A SKILL</Eyebrow>
            <Asset x={30} y={45} u={u} w={26} ar={16 / 9} src="nout/bookpage.png" t={t} at={47.2} />
            <Cap u={u} t={t} at={47.2} out={51.8} ink={ink} accent={AC} pre="packaged into " hot="one skill" post=" — do it yourself" />
            {t >= 50.6 && <div style={{ position: "absolute", left: "30%", top: "70%", transform: "translate(-50%,-50%)", opacity: a,
              padding: `${u * 0.7}px ${u * 1.8}px`, background: RAISIN, border: `${u * 0.14}px solid ${AC}`, borderRadius: u * 0.6,
              fontFamily: SANS, fontWeight: 800, fontSize: u * 1.5, color: AC, textTransform: "uppercase" }}>LINK IN DESCRIPTION</div>}
          </>
        );
      })()}

      {/* B8 52.0–61.6 · SEEDANCE — his BRAND BACKGROUNDS (not his face). Magenta ink then grid drift,
           shown one at a time so only one video decodes. This is the "moving stuff" the VO names. */}
      {t >= 52.0 && t < 61.6 && (() => {
        const a = ip(t, 52.4, 52.9);
        const Bg: React.FC<{ src: string }> = ({ src }) => (
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%,-50%) scale(${0.94 + 0.06 * a})`, opacity: a }}>
            <div style={{ position: "absolute", inset: 0, background: AC, borderRadius: u * 0.6, transform: `translate(${u * 0.35}px,${u * 0.35}px)`, opacity: 0.9 }} />
            <div style={{ position: "relative", width: u * 58, height: u * 58 * 9 / 16, overflow: "hidden", borderRadius: u * 0.6, border: `${u * 0.1}px solid ${AC}` }}>
              <OffthreadVideo src={A(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          </div>
        );
        return (
          <>
            <Eyebrow u={u} t={t} at={52.4} ink={ink} accent={AC}>SEEDANCE 2.0</Eyebrow>
            {/* one at a time — ink first, then the grid drift on "his website" */}
            {t < 57.2 ? <Bg src="nout/bg_ink.mp4" /> : <Bg src="nout/bg_drift.mp4" />}
            <HL u={u} t={t} at={57.6} ink={ink} size={3.0} top>BACKGROUNDS THAT <MarkerC u={u} t={t} at={58.9} base={ink} accent={AC}>MOVE</MarkerC></HL>
          </>
        );
      })()}

      {/* B9 61.6–65.3 · SUBSCRIBE */}
      {t >= 61.6 && (
        <>
          <SubscribeBtn u={u} t={t} at={62.0} y="60%" accent={AC} />
          <Cap u={u} t={t} at={61.7} out={65.2} ink={ink} accent={AC} pre="like and " hot="subscribe" post=" — see you next time" />
        </>
      )}
    </AbsoluteFill>
  );
};
