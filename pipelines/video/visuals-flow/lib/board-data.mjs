// board-data.mjs — one JSON-safe snapshot of everything the board renders.
// The React SPA (plans 170-174) consumes this; the legacy pages keep using
// loadBoardData directly until the cutover deletes them.
import fs from 'node:fs';
import path from 'node:path';
import { normWord } from './resolve.mjs';
import { planCaptions } from './captions.mjs';
import { loadShots, loadEffects } from './board.mjs';

function normalizeFeedbackItems(raw) {
  const items = {};
  for (const [ref, v] of Object.entries(raw ?? {})) {
    if (typeof v === 'string') items[ref] = { text: v };
    else if (v && typeof v === 'object' && typeof v.text === 'string') items[ref] = v;
  }
  return items;
}

export function computeProbeTimes(beats, duration) {
  const times = (beats ?? []).map((b) => +(b.at + 0.6).toFixed(2)).filter((t) => t >= 0);
  const end = +(duration - 0.1).toFixed(2);
  if (end >= 0) times.push(end);
  return times;
}

export function loadBoardData(workdir) {
  const cuesFile = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
  const resolvedPath = path.join(workdir, 'resolved.json');
  const hasResolved = fs.existsSync(resolvedPath);
  const resolved = hasResolved ? JSON.parse(fs.readFileSync(resolvedPath, 'utf8')).resolved : [];
  const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));
  const fbPath = path.join(workdir, 'feedback.json');
  const feedbackItems = fs.existsSync(fbPath) ? normalizeFeedbackItems(JSON.parse(fs.readFileSync(fbPath, 'utf8')).items) : {};
  const shots = loadShots(workdir, words);
  const effects = loadEffects(workdir);
  const soundPath = path.join(workdir, 'sound.json');
  const sound = fs.existsSync(soundPath) ? JSON.parse(fs.readFileSync(soundPath, 'utf8')) : null;
  const auditPath = path.join(workdir, 'audit.json');
  const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : null;
  const zpPath = path.join(workdir, 'card-plan.json');
  const cardPlan = fs.existsSync(zpPath) ? JSON.parse(fs.readFileSync(zpPath, 'utf8')) : null;
  return { cuesFile, resolved, words, feedbackItems, shots, effects, sound, audit, cardPlan, hasResolved };
}

export function anchorHighlights(cue, segWords) {
  const phrases = [cue.anchor, ...(cue.beats ?? []).map((b) => b.anchor)];
  const highlighted = new Set();
  for (const phrase of phrases) {
    if (!phrase) continue;
    const p = phrase.split(/\s+/).map(normWord).filter(Boolean);
    if (p.length === 0) continue;
    for (let j = 0; j <= segWords.length - p.length; j++) {
      let ok = true;
      for (let k = 0; k < p.length; k++) {
        if (normWord(segWords[j + k].text) !== p[k]) { ok = false; break; }
      }
      if (ok) { for (let k = 0; k < p.length; k++) highlighted.add(j + k); break; }
    }
  }
  return [...highlighted].sort((a, b) => a - b);
}

export function buildBoardData(workdir, cardLibraryRoot, { buildSegments }) {
  const d = loadBoardData(workdir);
  
  const video = path.basename(workdir);
  
  let finalCut = null;
  const fcPath = path.join(workdir, 'final-cut.json');
  if (fs.existsSync(fcPath)) {
    try { finalCut = JSON.parse(fs.readFileSync(fcPath, 'utf8')).approved === true; } catch (e) {}
  }

  const segmentsRaw = buildSegments(d.words, d.resolved);
  
  const byId = new Map(d.resolved.map((r) => [r.id, r]));
  const unresolvedSegs = (d.cuesFile.cues || []).filter(c => !byId.has(c.id)).map(c => ({
    kind: 'cue', cue: c, start: 0, end: 0, words: [], unresolved: true
  }));
  const segmentsAll = [...unresolvedSegs, ...segmentsRaw];

  const segments = segmentsAll.map((seg, i) => {
    const id = `seg-${i}`;
    const mid = (seg.start + seg.end) / 2;
    const inShot = Boolean(d.shots?.spans?.some(s => mid >= s.start && mid <= s.start + s.duration));
    if (seg.kind === 'gap') {
      return {
        kind: 'gap', id, start: seg.start, end: seg.end, words: seg.words
      };
    } else {
      const cue = (d.cuesFile.cues || []).find(c => c.id === seg.cue.id);
      const r = seg.unresolved ? null : seg.cue;
      return {
        kind: 'cue', id, cueId: cue.id, start: seg.start, end: seg.end,
        unresolved: Boolean(seg.unresolved),
        words: seg.words,
        highlights: anchorHighlights(cue, seg.words),
        probeTimes: r ? computeProbeTimes(r.variables?.beats, r.duration) : [],
        inShot
      };
    }
  });

  const totalDuration = d.words.length ? d.words[d.words.length - 1].end : 0;
  
  const fxInstances = d.effects?.instances ?? [];
  const fxFullframes = d.resolved.filter((c) => c.placement === 'fullframe').map((c) => ({ id: c.id, start: c.start, end: c.start + c.duration }));
  const shotSpans = d.shots?.spans?.map(s => ({ id: s.id, start: s.start, end: s.start + s.duration })) || [];
  const capChunks = fxInstances.some((i) => i.type === 'captions' && i.enabled) ? planCaptions(d.words) : [];

  let planComments = undefined;
  if (d.cardPlan) {
    planComments = {};
    for (const [key, it] of Object.entries(d.feedbackItems ?? {})) {
      let part = null;
      if (key.startsWith('zone-')) part = it.zone ?? key.slice('zone-'.length).split(':')[0];
      else if (key.startsWith('card-body:')) part = 'body';
      else continue;
      (planComments[part] ??= []).push({
        text: it.text ?? '',
        added: it.added ?? '',
        folded: Boolean(it.folded),
        cue: it.context?.cue ?? null,
      });
    }
  }

  return {
    video,
    hasResolved: d.hasResolved,
    totalDuration,
    approved: {
      cues: d.cuesFile.approved === true,
      shots: d.shots ? (d.shots.shotsFile?.approved === true) : null,
      effects: d.effects ? (d.effects.approved === true) : null,
      cardPlan: d.cardPlan ? (d.cardPlan.approved === true) : null,
      finalCut
    },
    cues: d.cuesFile.cues || [],
    resolved: d.resolved,
    segments,
    shots: d.shots ? {
      engineMode: d.shots.shotsFile?.engineMode || 'test',
      approved: d.shots.shotsFile?.approved === true,
      errors: d.shots.errors || [],
      spans: d.shots.spans || [],
      fileSpans: d.shots.shotsFile?.spans || []
    } : null,
    effects: d.effects ? {
      approved: d.effects.approved === true,
      instances: d.effects.instances || []
    } : null,
    sound: d.sound ? { instances: d.sound.instances || [] } : null,
    audit: d.audit ? { cues: d.audit.cues || {} } : null,
    cardPlan: d.cardPlan ? {
      approved: d.cardPlan.approved === true,
      sections: d.cardPlan.sections || [],
      comments: planComments
    } : null,
    feedback: d.feedbackItems,
    fx: {
      fullframes: fxFullframes,
      shotSpans,
      capChunks
    }
  };
}

export function introData(workdir) {
  const introDir = path.join(workdir, 'intro-film');
  if (!fs.existsSync(introDir)) {
    return { present: false };
  }
  
  let approved = false;
  let beats = [];
  let findings = [];
  let sheets = [];
  
  try {
    const sp = JSON.parse(fs.readFileSync(path.join(introDir, 'screenplay.json'), 'utf8'));
    approved = sp.approved === true;
    beats = sp.beats || [];
  } catch (e) {
    // ignore
  }

  const reviewDir = path.join(introDir, 'review');
  if (fs.existsSync(reviewDir)) {
    try {
      const checkData = JSON.parse(fs.readFileSync(path.join(reviewDir, 'check.json'), 'utf8'));
      findings = checkData.findings || checkData || []; // handle if check.json is array or object
      if (!Array.isArray(findings)) findings = []; // just in case
    } catch (e) {
      // ignore
    }

    try {
      const files = fs.readdirSync(reviewDir);
      
      const frames = files.filter(f => /^frame-.*\.png$/.test(f) || /^frame-.*\.jpg$/.test(f));
      beats.forEach(b => {
        b.frames = frames.filter(f => {
          const m = f.match(/at-([0-9.]+)s/);
          if (m) {
            const t = parseFloat(m[1]);
            return t >= b.t_start && t < b.t_end;
          }
          return false;
        });
      });
      
      sheets = files.filter(f => /^contact-sheet-.*\.jpg$/.test(f));
    } catch (e) {
      // ignore
    }
  }

  return {
    present: true,
    approved,
    beats,
    findings,
    sheets
  };
}

