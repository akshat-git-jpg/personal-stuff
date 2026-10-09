import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { die } from "../client/http.mjs";
import { resolveAvatar, resolveTemplate } from "../client/registry.mjs";
import { arg } from "../cli/args.mjs";
import { meterChecked } from "../operations/account.mjs";
import { submitAudioGenerate, submitFromTemplate } from "../operations/render.mjs";
import { downloadCore } from "../operations/videos.mjs";

// Avatar III motion follows the render clock, not the words (AVATAR-III-QUALITY.md). So a long clip is
// rendered as short pieces, and each join is placed where the end pose of one piece matches the start
// pose of the next. The pose at every render second comes from a one-time free "pose map" render.

const FPS = 25, FW = 256, FH = 144, FRAME = FW * FH;
const POSE_DIR = process.env.HEYGEN_POSE_MAPS || join(homedir(), "kb-scratch/video/heygen/pose-maps-v2");

// Pixels weighted by how much they move in the pose map (eyes, head, hands), so a blink counts and the static room does not.
export function frameDiff(a, b, w) {
  let s = 0, n = 0;
  for (let i = 0; i < a.length; i++) { const k = w ? w[i] : 1; s += k * Math.abs(a[i] - b[i]); n += k; }
  return n ? s / n : 0;
}

export function motionWeights(map) {
  const n = map.length, len = map[0].length, mean = new Float64Array(len), w = new Float32Array(len);
  for (const f of map) for (let i = 0; i < len; i++) mean[i] += f[i] / n;
  for (const f of map) for (let i = 0; i < len; i++) w[i] += (f[i] - mean[i]) ** 2 / n;
  for (let i = 0; i < len; i++) w[i] = Math.sqrt(w[i]);
  return w;
}

// Pose map: frames[i] = small grayscale frame at render second i/25.
export function poseAt(map, t) { return map[Math.min(map.length - 1, Math.max(0, Math.round(t * FPS)))]; }

// The mean frame-to-frame step plus spread: a join under this is as smooth as normal motion.
export function smoothLimit(map, w) {
  const steps = [];
  for (let i = 1; i < map.length; i++) steps.push(frameDiff(map[i - 1], map[i], w));
  steps.sort((a, b) => a - b);
  return steps[Math.floor(steps.length * 0.99)] || 3;
}

// Pieces: each shows min..max s of audio, cut inside a pause. Piece k>0 starts `lead` s earlier in the
// audio (its render clock runs ahead), and that lead is trimmed off, so the join uses the best-matching pose.
export function planPieces(duration, silences, map, { min = 10, max = 25, maxLead = 3, weights } = {}) {
  const pieces = [];
  let pos = 0, lead = 0;
  while (duration - pos > max) {
    const lo = pos + min, hi = Math.min(pos + max, duration - min);
    let best = null;
    const cutsIn = [];
    for (const s of silences) for (let c = s.start + 0.06; c <= s.end - 0.06; c += 0.04) if (c >= lo && c <= hi) cutsIn.push(c);
    if (!cutsIn.length) cutsIn.push(Math.min(pos + max, hi > lo ? hi : pos + max));
    for (const c of cutsIn) {
      const endPose = poseAt(map, lead + (c - pos));
      for (let s = 0; s <= maxLead + 1e-9; s += 1 / FPS) {
        if (c - s < pos) break;
        const cost = frameDiff(endPose, poseAt(map, s), weights);
        if (!best || cost < best.cost) best = { cut: c, nextLead: s, cost };
      }
    }
    pieces.push({ start: pos, end: +best.cut.toFixed(3), lead, joinCost: +best.cost.toFixed(2) });
    pos = +best.cut.toFixed(3); lead = +best.nextLead.toFixed(3);
  }
  pieces.push({ start: pos, end: duration, lead, joinCost: null });
  return pieces;
}

export function parseSilences(log) {
  const out = [];
  let start = null;
  for (const line of log.split("\n")) {
    const s = line.match(/silence_start: ([\d.]+)/), e = line.match(/silence_end: ([\d.]+)/);
    if (s) start = +s[1];
    if (e && start !== null) { out.push({ start, end: +e[1] }); start = null; }
  }
  return out;
}

const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: ["ignore", "ignore", "inherit"] });
const probeDuration = (f) => +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim();
const silencesOf = (f) => parseSilences(spawnSync("ffmpeg", ["-hide_banner", "-i", f, "-af", "silencedetect=n=-35dB:d=0.2", "-f", "null", "-"], { encoding: "utf8" }).stderr || "");

function readFrames(video, { start = 0, end } = {}) {
  const trim = end !== undefined ? ["-ss", String(start), "-to", String(end)] : ["-ss", String(start)];
  const buf = execFileSync("ffmpeg", ["-v", "error", "-i", video, ...trim, "-vf", `fps=${FPS},scale=${FW}:${FH},format=gray`,
    "-f", "rawvideo", "-"], { maxBuffer: 1 << 30 });
  const out = [];
  for (let i = 0; i + FRAME <= buf.length; i += FRAME) out.push(buf.subarray(i, i + FRAME));
  return out;
}

async function renderAll(auth, args, jobs, target) {
  return meterChecked(auth, args, async () => {
    for (const j of jobs) {
      const r = target.avatar
        ? await submitAudioGenerate(auth, { avatar: target.avatar, audioPath: j.audio, engine: "heygen3", title: j.name, orientation: "landscape" })
        : await submitFromTemplate(auth, { templateId: target.templateId, audioPath: j.audio, title: j.name, iv: false });
      j.video_id = r.video_id;
      console.error(`  submitted ${j.name}: ${j.video_id}`);
      await new Promise((r) => setTimeout(r, 1500));
    }
    return jobs;
  }, { ids: (js) => js.map((j) => j.video_id) });
}

async function fetchVideo(auth, id, out) {
  const url = await downloadCore(auth, id, "1080p", false, 5);
  if (!url) die(`no download url for ${id}`);
  writeFileSync(out, Buffer.from(await (await fetch(url)).arrayBuffer()));
}

// One free render per avatar: the clip's own audio, looped to `len` s. Motion does not depend on the words.
async function loadPoseMap(auth, args, target, key, audio, work, len) {
  const file = join(POSE_DIR, `${key}.bin`);
  if (existsSync(file)) {
    const buf = readFileSync(file), map = [];
    for (let i = 0; i + FRAME <= buf.length; i += FRAME) map.push(buf.subarray(i, i + FRAME));
    if (map.length >= (len - 0.5) * FPS) return map;
  }
  console.error(`pose map for ${key}: one free ${len} s render`);
  const cal = { name: `pose-map-${key.slice(0, 8)}`, audio: join(work, "pose-map.mp3") };
  ff(["-stream_loop", "-1", "-i", audio, "-t", String(len), "-c:a", "libmp3lame", "-b:a", "192k", cal.audio]);
  await renderAll(auth, args, [cal], target);
  if (process.exitCode === 2) die("credits were used on Avatar III: stopped.");
  const vid = join(work, "pose-map.mp4");
  await fetchVideo(auth, cal.video_id, vid);
  const map = readFrames(vid);
  mkdirSync(POSE_DIR, { recursive: true });
  writeFileSync(file, Buffer.concat(map));
  return map;
}

export async function clipBatch(auth, args) {
  const avatarArg = arg(args, "--avatar"), templateArg = arg(args, "--template"), audio = arg(args, "--audio");
  if (!audio || (!avatarArg === !templateArg))
    die("clip-batch needs --audio <file> and one of --avatar <slug|id> / --template <slug> [--title T] [--out f.mp4] [--min 10] [--max 25]");
  if ((arg(args, "--engine") || "heygen3") !== "heygen3" || args.includes("--iv"))
    die("clip-batch is Avatar III only. For Avatar IV use generate-from-audio / generate-from-template --engine heygen4.");
  if (!existsSync(audio)) die(`no such audio file: ${audio}`);
  const title = arg(args, "--title") || basename(audio).replace(/\.[^.]+$/, "");
  const out = arg(args, "--out") || join(dirname(audio), `${title}-avatar-iii.mp4`);
  const min = +(arg(args, "--min") || 10), max = +(arg(args, "--max") || 25), maxLead = 3;
  const work = join(dirname(out), `${title}-pieces`);
  mkdirSync(work, { recursive: true });
  const target = avatarArg ? { avatar: resolveAvatar(avatarArg) } : { templateId: resolveTemplate(templateArg) };
  const key = target.avatar || target.templateId;

  const duration = probeDuration(audio);
  const map = duration > max ? await loadPoseMap(auth, args, target, key, audio, work, max + maxLead + 2) : null;
  const weights = map && motionWeights(map);
  const pieces = map ? planPieces(duration, silencesOf(audio), map, { min, max, maxLead, weights }) : [{ start: 0, end: duration, lead: 0, joinCost: null }];
  const limit = map ? smoothLimit(map, weights) : 0;
  console.error(`${pieces.length} piece(s); smooth limit ${limit.toFixed(2)}`);
  for (const p of pieces) console.error(`  ${p.start.toFixed(2)}-${p.end.toFixed(2)} s, lead ${p.lead.toFixed(2)} s` +
    (p.joinCost !== null ? `, planned join ${p.joinCost}${p.joinCost > limit ? " (above smooth limit)" : ""}` : ""));

  pieces.forEach((p, i) => {
    p.name = `${title}-p${String(i + 1).padStart(2, "0")}`;
    p.audio = join(work, `${p.name}.mp3`);
    ff(["-i", audio, "-ss", String(p.start - p.lead), "-to", String(p.end), "-c:a", "libmp3lame", "-b:a", "192k", p.audio]);
  });
  await renderAll(auth, args, pieces, target);
  if (process.exitCode === 2) die("credits were used on Avatar III: stopped before the join.");
  for (const p of pieces) { p.video = join(work, `${p.name}.mp4`); await fetchVideo(auth, p.video_id, p.video); console.error(`  downloaded ${p.name}`); }

  // Measured join quality: last shown frame of a piece vs first shown frame of the next.
  const joins = [];
  for (let i = 0; i + 1 < pieces.length; i++) {
    const a = pieces[i], b = pieces[i + 1], aLen = a.lead + (a.end - a.start);
    const fa = readFrames(a.video, { start: Math.max(0, aLen - 0.12), end: aLen });
    const fb = readFrames(b.video, { start: b.lead, end: b.lead + 0.12 });
    if (fa.length && fb.length) joins.push(+frameDiff(fa.at(-1), fb[0], weights).toFixed(2));
  }

  const inputs = pieces.flatMap((p) => ["-i", p.video]);
  const graph = pieces.map((p, i) => {
    const len = (p.end - p.start).toFixed(3);
    return `[${i}:v]trim=start=${p.lead}:duration=${len},setpts=PTS-STARTPTS[v${i}];` +
      `[${i}:a]atrim=start=${p.lead}:duration=${len},asetpts=PTS-STARTPTS[a${i}];`;
  }).join("") + pieces.map((_, i) => `[v${i}][a${i}]`).join("") + `concat=n=${pieces.length}:v=1:a=1[v][a]`;
  ff([...inputs, "-filter_complex", graph, "-map", "[v]", "-map", "[a]", "-r", String(FPS),
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", out]);
  const got = probeDuration(out);
  console.log(JSON.stringify({ out, duration: +got.toFixed(2), audio_duration: +duration.toFixed(2), smooth_limit: +limit.toFixed(2),
    joins, pieces: pieces.map(({ name, start, end, lead, joinCost, video_id }) => ({ name, start, end, lead, joinCost, video_id })) }, null, 2));
  if (joins.some((j) => j > limit)) console.error(`⚠️ a join is above the smooth limit (${limit.toFixed(2)}): watch it before use`);
  if (Math.abs(got - duration) > 0.5) console.error(`⚠️ joined video is ${got.toFixed(2)} s, audio is ${duration.toFixed(2)} s`);
}
