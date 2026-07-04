/* ============================================================================
   recipes.js — shared GSAP motion helpers for Devsplainers-clone scenes.
   Load AFTER gsap. Motion grammar is restrained (~3/10): fade / slide / scale
   on a beat, connectors draw on, pills pop with a slight overshoot.

   Usage inside a scene's TIMELINE block:
     const tl = gsap.timeline({ paused: true });
     R.fadeUp(tl, '#headline', 0.4);
     R.staggerIn(tl, '.pill', 0.8);
     R.drawOn(tl, '#edge', 1.0);
     window.__timelines['main'] = tl;

   IMPORTANT (Hyperframes lint):
   - NEVER target a `.clip` element — animate its INNER content only.
   - No infinite repeats (repeat:-1). Use R.pulse() which derives a finite count.
   - Timeline stays paused + registered by the scene; helpers only add tweens.
   ============================================================================ */

(function (global) {
  // Eases + timings mirror tokens.css motion vars (kept in JS since GSAP eases
  // aren't CSS-expressible). Tune here to shift the whole kit's feel.
  const EASE = 'power3.out';
  const EASE_SOFT = 'power2.out';
  const EASE_POP = 'back.out(1.6)';
  const DUR = 0.35;
  const DUR_SLOW = 0.6;
  const STAGGER = 0.06;

  const R = {
    EASE, EASE_SOFT, EASE_POP, DUR, DUR_SLOW, STAGGER,

    /* Fade + rise. The default entrance for text/blocks. */
    fadeUp(tl, target, at, opts = {}) {
      return tl.from(target, {
        opacity: 0,
        y: opts.y ?? 28,
        duration: opts.duration ?? DUR,
        ease: opts.ease ?? EASE,
      }, at);
    },

    /* Slide in from a side. dir: 'left' | 'right' | 'up' | 'down'. */
    slideIn(tl, target, at, dir = 'left', opts = {}) {
      const dist = opts.dist ?? 60;
      const from = { opacity: 0, duration: opts.duration ?? DUR, ease: opts.ease ?? EASE };
      if (dir === 'left') from.x = -dist;
      else if (dir === 'right') from.x = dist;
      else if (dir === 'up') from.y = dist;
      else if (dir === 'down') from.y = -dist;
      return tl.from(target, from, at);
    },

    /* Pop with a slight scale overshoot — for pills / badges / stamps. */
    popIn(tl, target, at, opts = {}) {
      return tl.from(target, {
        opacity: 0,
        scale: opts.scale ?? 0.7,
        transformOrigin: opts.origin ?? 'center',
        duration: opts.duration ?? DUR,
        ease: opts.ease ?? EASE_POP,
        stagger: opts.stagger, // undefined for a single target; set for groups
      }, at);
    },

    /* Draw on a dashed/solid SVG line or path (the connector). Target must be
       an SVG stroke element. Computes its length so it works for any path. */
    drawOn(tl, target, at, opts = {}) {
      const els = gsap.utils.toArray(target);
      els.forEach((el) => {
        const len = typeof el.getTotalLength === 'function' ? el.getTotalLength() : 1000;
        // Preserve the authored dash pattern by animating dashoffset only.
        gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
      });
      return tl.to(target, {
        strokeDashoffset: 0,
        duration: opts.duration ?? DUR_SLOW,
        ease: opts.ease ?? EASE_SOFT,
      }, at);
    },

    /* Count a number up to its final value. Reads the element's text as the
       target unless opts.to is given. Keeps a prefix/suffix intact. */
    countUp(tl, target, at, opts = {}) {
      const el = typeof target === 'string' ? document.querySelector(target) : target;
      if (!el) return tl;
      const raw = (opts.to ?? el.textContent).toString();
      const num = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
      const prefix = opts.prefix ?? (raw.match(/^[^0-9.]*/) || [''])[0];
      const suffix = opts.suffix ?? (raw.match(/[^0-9.]*$/) || [''])[0];
      const decimals = opts.decimals ?? 0;
      const state = { v: opts.from ?? 0 };
      return tl.to(state, {
        v: num,
        duration: opts.duration ?? DUR_SLOW,
        ease: opts.ease ?? EASE_SOFT,
        onUpdate() {
          el.textContent = prefix + state.v.toFixed(decimals) + suffix;
        },
      }, at);
    },

    /* Staggered entrance for a group (list rows, pills, cards, dots). */
    staggerIn(tl, target, at, opts = {}) {
      return tl.from(target, {
        opacity: 0,
        y: opts.y ?? 20,
        duration: opts.duration ?? DUR,
        ease: opts.ease ?? EASE,
        stagger: opts.stagger ?? STAGGER,
      }, at);
    },

    /* Grow a bar/fill from a baseline. origin defaults to bottom (vertical bars). */
    grow(tl, target, at, opts = {}) {
      return tl.from(target, {
        scaleY: opts.axis === 'x' ? undefined : 0,
        scaleX: opts.axis === 'x' ? 0 : undefined,
        transformOrigin: opts.origin ?? (opts.axis === 'x' ? 'left center' : 'bottom center'),
        duration: opts.duration ?? DUR_SLOW,
        ease: opts.ease ?? EASE,
      }, at);
    },

    /* Rotate a gauge needle from a start angle to its final angle (degrees).
       Pass opts.svgOrigin ("cx cy" in SVG user units) to pivot around the dial
       center — the correct choice for an SVG needle line. */
    needle(tl, target, at, deg, opts = {}) {
      const originVars = opts.svgOrigin
        ? { svgOrigin: opts.svgOrigin }
        : { transformOrigin: opts.origin ?? 'center' };
      gsap.set(target, { rotation: opts.from ?? -90, ...originVars });
      return tl.to(target, {
        rotation: deg,
        ...originVars,
        duration: opts.duration ?? DUR_SLOW,
        ease: opts.ease ?? EASE,
      }, at);
    },

    /* Finite pulse (breathing) — NEVER infinite. Derives repeat count from the
       hold window so it respects Hyperframes' no-infinite-repeat lint. */
    pulse(tl, target, at, opts = {}) {
      const hold = opts.hold ?? 3.0;
      const cycle = opts.cycle ?? 1.2;
      const repeats = Math.max(0, Math.floor(hold / cycle) - 1);
      return tl.to(target, {
        scale: opts.scale ?? 1.06,
        transformOrigin: 'center',
        duration: cycle / 2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: repeats,
      }, at);
    },

    /* Full-screen color flash: quick scale/opacity punch-in for a transition. */
    flash(tl, target, at, opts = {}) {
      return tl.from(target, {
        opacity: 0,
        scale: opts.scale ?? 1.1,
        duration: opts.duration ?? 0.25,
        ease: opts.ease ?? 'power2.inOut',
      }, at);
    },
  };

  global.R = R;
})(typeof window !== 'undefined' ? window : this);
