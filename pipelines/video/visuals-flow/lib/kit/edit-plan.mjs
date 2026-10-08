// The edit plan: the one timeline contract the assembly core accepts.
// A recipe maps its own artifacts into this shape; the core never reads them.

/**
 * @typedef {object} Canvas
 * @property {number} w    output width in px (even)
 * @property {number} h    output height in px (even)
 * @property {number} fps  frames per second (integer)
 */

/**
 * @typedef {object} EditPlan
 * @property {number} total          master clock length in seconds (the voiceover)
 * @property {Canvas} [canvas]       default DEFAULT_CANVAS (1920x1080 @ 25)
 * @property {{src: string}} [audio] the soundtrack for the whole cut; default master.wav, else vo.mp3, in the workdir
 * @property {Clip[]} clips          order matters: overlays composite in this order
 */

/**
 * @typedef {object} Clip
 * @property {string} id             unique per kind; names the segment file
 * @property {'card'|'composition'|'footage'|'avatar'|'image'|'generated'} kind
 *   card         pre-rendered card clip (base or overlay layer)
 *   composition  pre-rendered HTML/hyperframes film, base layer, anywhere on the timeline
 *   footage      the screen recording bed: fills every gap between base clips (at most one, no start/end)
 *   avatar       talking-head clip, placed by `mode`
 *   image, generated  reserved: rejected until implemented
 * @property {number} [start]        seconds on the master clock (all kinds except footage)
 * @property {number} [end]          give `end` OR `duration`, never both; the core keeps the one given
 * @property {number} [duration]
 * @property {string} [src]          path to the media; required unless an avatar has `placeholder`
 * @property {'base'|'overlay'} [layer]   card only, default 'base'
 * @property {string} [chroma]       overlay card only: key colour for a plate without alpha
 * @property {boolean} [clearsCaptions]   captions step aside while this clip plays
 * @property {'full'|'panel'|'side'|'bubble'} [mode]  avatar only, default 'full'
 * @property {string} [placeholder]  full avatar only: still shown while `src` is not rendered yet
 * @property {boolean} [shadows]     composition only: base clips that START inside it are dropped instead of refused
 * @property {number} [offset]       footage only: seconds into `src` at master time 0
 * @property {object} [data]         opaque recipe payload, handed to effect modules untouched
 */

// 25 fps: HeyGen avatars are 25 fps, and 30 repeats every 6th avatar frame (AVATAR-III-QUALITY.md).
export const DEFAULT_CANVAS = Object.freeze({ w: 1920, h: 1080, fps: 25 });
export const CLIP_KINDS = ['card', 'composition', 'footage', 'avatar', 'image', 'generated'];
export const RESERVED_KINDS = ['image', 'generated'];
export const AVATAR_MODES = ['full', 'panel', 'side', 'bubble'];
const EPS = 0.05; // same tolerance the segment planner uses for base overlaps

export function resolveCanvas(canvas) {
  if (canvas === undefined || canvas === null) return DEFAULT_CANVAS;
  const { w, h, fps } = { ...DEFAULT_CANVAS, ...canvas };
  const errs = [];
  if (!Number.isInteger(w) || w <= 0 || w % 2) errs.push(`w must be a positive even integer (got ${w})`);
  if (!Number.isInteger(h) || h <= 0 || h % 2) errs.push(`h must be a positive even integer (got ${h})`);
  if (!Number.isInteger(fps) || fps <= 0) errs.push(`fps must be a positive integer (got ${fps})`);
  if (errs.length) throw new Error(`edit plan canvas: ${errs.join('; ')}`);
  return { w, h, fps };
}

export function clipEnd(c) {
  return c.end !== undefined ? c.end : c.start + c.duration;
}

// A base clip starting inside [start, end) of a shadowing composition is dropped. Shared with the segment planner.
export function isShadowedBy(clipStart, start, end) {
  return clipStart >= start - EPS && clipStart < end - EPS;
}

const isBase = (c) => c.kind === 'composition'
  || (c.kind === 'card' && (c.layer ?? 'base') === 'base')
  || (c.kind === 'avatar' && (c.mode ?? 'full') === 'full');

// Mirrors planSegments' arithmetic exactly, so the validator never rejects a plan the planner accepts.
function baseEnd(c, total) {
  if (c.kind === 'composition') return clipEnd(c);
  const end = c.duration !== undefined ? +(c.start + c.duration).toFixed(3) : c.end;
  return Math.min(end, total);
}

// Every problem in the plan, as one-line messages. Empty means valid.
export function editPlanErrors(plan) {
  const errs = [];
  if (!plan || typeof plan !== 'object') return ['edit plan must be an object'];
  if (!(Number.isFinite(plan.total) && plan.total > 0)) errs.push(`total must be a positive number of seconds (got ${plan.total})`);
  try { resolveCanvas(plan.canvas); } catch (e) { errs.push(e.message.replace(/^edit plan /, '')); }
  if (plan.audio !== undefined && !(plan.audio && typeof plan.audio.src === 'string' && plan.audio.src)) errs.push('audio.src must be a non-empty path');
  if (!Array.isArray(plan.clips)) return [...errs, 'clips must be an array'];

  const seen = new Set();
  for (const [i, c] of plan.clips.entries()) {
    const at = `clip ${c?.id ?? `#${i}`}`;
    if (!c || typeof c !== 'object') { errs.push(`clip #${i} must be an object`); continue; }
    if (!CLIP_KINDS.includes(c.kind)) { errs.push(`${at}: unknown kind "${c.kind}" (known: ${CLIP_KINDS.join(', ')})`); continue; }
    if (RESERVED_KINDS.includes(c.kind)) { errs.push(`${at}: kind "${c.kind}" is reserved and not implemented yet`); continue; }
    if (typeof c.id !== 'string' || !c.id) errs.push(`clip #${i} (${c.kind}): id must be a non-empty string`);
    else if (seen.has(`${c.kind}:${c.id}`)) errs.push(`${at}: duplicate ${c.kind} id`);
    else seen.add(`${c.kind}:${c.id}`);

    const needsSrc = !(c.kind === 'avatar' && c.placeholder);
    if (needsSrc && (typeof c.src !== 'string' || !c.src)) errs.push(`${at}: missing src`);
    if (c.kind === 'avatar' && c.placeholder && (c.mode ?? 'full') !== 'full') errs.push(`${at}: placeholder is only supported on a full avatar`);
    if (c.kind === 'avatar' && !AVATAR_MODES.includes(c.mode ?? 'full')) errs.push(`${at}: unknown avatar mode "${c.mode}" (known: ${AVATAR_MODES.join(', ')})`);
    if (c.kind === 'card' && !['base', 'overlay'].includes(c.layer ?? 'base')) errs.push(`${at}: layer must be base or overlay (got "${c.layer}")`);
    if (c.shadows !== undefined && c.kind !== 'composition') errs.push(`${at}: shadows is for composition clips only`);

    if (c.kind === 'footage') {
      if (c.start !== undefined || c.end !== undefined || c.duration !== undefined) errs.push(`${at}: footage is the bed and takes no start/end/duration`);
      continue;
    }
    if (!(Number.isFinite(c.start) && c.start >= 0)) errs.push(`${at}: start must be a number >= 0 (got ${c.start})`);
    const hasEnd = c.end !== undefined, hasDur = c.duration !== undefined;
    if (hasEnd === hasDur) errs.push(`${at}: give exactly one of end or duration`);
    else if (!(clipEnd(c) > c.start)) errs.push(`${at}: ends at ${clipEnd(c)}, not after its start ${c.start}`);
  }
  if (plan.clips.filter((c) => c?.kind === 'footage').length > 1) errs.push('at most one footage clip (the bed)');
  if (errs.length) return errs;

  // Base clips may not overlap, except that a shadowing composition drops base clips starting inside it.
  const shadowing = plan.clips.filter((c) => c.kind === 'composition' && c.shadows);
  const shadowed = (c) => c.kind !== 'composition' && shadowing.some((s) => isShadowedBy(c.start, s.start, clipEnd(s)));
  const base = plan.clips.filter((c) => isBase(c) && !shadowed(c))
    .map((c) => ({ id: c.id, start: c.start, end: baseEnd(c, plan.total) }))
    .sort((a, b) => a.start - b.start);
  for (let i = 1; i < base.length; i++) {
    if (base[i].start < base[i - 1].end - EPS) {
      errs.push(`overlapping base clips: ${base[i - 1].id} ends ${base[i - 1].end}, ${base[i].id} starts ${base[i].start}`);
    }
  }
  return errs;
}

export function validateEditPlan(plan) {
  const errs = editPlanErrors(plan);
  if (errs.length) throw new Error(`invalid edit plan:\n  ${errs.join('\n  ')}`);
  return plan;
}

// The plan as the per-role tracks the assembly engine runs on.
export function editPlanToTracks(plan) {
  const t = { resolved: [], avatarJobs: [], panelJobs: [], sideJobs: [], cornerJobs: [], films: [],
    cardSrc: new Map(), screen: undefined, screenOffset: 0, base: 'none', total: plan.total, audio: plan.audio?.src ?? null };
  for (const c of plan.clips) {
    if (c.kind === 'card') {
      const duration = c.duration !== undefined ? c.duration : c.end - c.start;
      t.resolved.push({ ...c.data, id: c.id, start: c.start, duration, placement: (c.layer ?? 'base') === 'overlay' ? 'overlay' : 'fullframe',
        ...(c.chroma ? { chroma: c.chroma } : {}), ...(c.clearsCaptions ? { clearsCaptions: true } : {}) });
      t.cardSrc.set(c.id, c.src);
    } else if (c.kind === 'avatar') {
      const end = clipEnd(c);
      const mode = c.mode ?? 'full';
      if (mode === 'full') {
        t.avatarJobs.push({ ...c.data, id: c.id, start: c.start, end, file: c.src, purpose: 'avatar-full',
          ...(c.placeholder ? { placeholder: true, placeholderFile: c.placeholder } : {}) });
      } else {
        const job = { ...c.data, id: c.id, start: c.start, end, file: c.src };
        ({ panel: t.panelJobs, side: t.sideJobs, bubble: t.cornerJobs })[mode].push(job);
      }
    } else if (c.kind === 'composition') {
      t.films.push({ id: c.id, start: c.start, end: clipEnd(c), src: c.src, shadows: !!c.shadows });
    } else if (c.kind === 'footage') {
      t.screen = c.src;
      t.screenOffset = c.offset ?? 0;
      t.base = 'screen';
    }
  }
  return t;
}
