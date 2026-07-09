import { existsSync } from "node:fs";
import { arg } from "../cli/args.mjs";
import { die } from "../client/http.mjs";
import { resolveAvatar, resolveTemplate } from "../client/registry.mjs";
import { submitGenerate, submitAudioGenerate, submitFromTemplate } from "../operations/render.mjs";
import { RESOLUTIONS } from "../operations/audio.mjs";

export async function generate(auth, args) {
  const avatar = resolveAvatar(arg(args, "--avatar")), voice = arg(args, "--voice"), text = arg(args, "--text");
  if (!avatar || !voice || !text) die('generate needs --avatar <look_id> --voice <voice_id> --text "..."');
  const iv = args.includes("--iv"); // default = unlimited Avatar III
  console.error(`→ submitting ${iv ? "Avatar IV (METERED)" : "Avatar III (unlimited-mode)"} …`);
  const { video_id, raw } = await submitGenerate(auth, {
    avatar, voice, text, iv,
    title: arg(args, "--title"),
    orientation: arg(args, "--orientation"),
    res: arg(args, "--res"),
  });
  if (video_id) console.error(`✓ video_id: ${video_id}\n  → view: https://app.heygen.com/projects`);
  console.log(JSON.stringify(raw, null, 2));
}

export async function generateFromAudio(auth, args) {
  const avatar = resolveAvatar(arg(args, "--avatar")), audioPath = arg(args, "--audio");
  const engine = arg(args, "--engine") || "heygen3", title = arg(args, "--title");
  const orientation = arg(args, "--orientation") || "landscape";
  if (!avatar || !audioPath)
    die('generate-from-audio needs --avatar <avatar_id> --audio <file> [--engine heygen3|heygen4] ' +
        '[--orientation landscape|portrait] [--title T]');
  if (!RESOLUTIONS[orientation]) die(`--orientation must be landscape|portrait, got '${orientation}'`);
  if (!existsSync(audioPath)) die(`no such audio file: ${audioPath}`);
  try {
    const { video_id } = await submitAudioGenerate(auth, { avatar, audioPath, engine, title, orientation });
    console.log(JSON.stringify({ video_id }, null, 2));
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }
}

export async function generateFromTemplate(auth, args) {
  const templateId = resolveTemplate(arg(args, "--template")), audioPath = arg(args, "--audio");
  const title = arg(args, "--title");
  if (!templateId || !audioPath)
    die('generate-from-template needs --template <template_id> --audio <file> [--title T]');
  if (!existsSync(audioPath)) die(`no such audio file: ${audioPath}`);
  try {
    const { video_id } = await submitFromTemplate(auth, { templateId, audioPath, title });
    console.log(JSON.stringify({ video_id }, null, 2));
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }
}
