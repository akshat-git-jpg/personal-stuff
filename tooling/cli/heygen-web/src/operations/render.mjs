import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { call, endpoints } from "../client/endpoints.mjs";
import { die } from "../client/http.mjs";
import { fillTemplate } from "../client/payloads/fill.mjs";
import { uploadAudio, RESOLUTIONS } from "./audio.mjs";
import { arg } from "../cli/args.mjs";
import { appendRenderLog } from "../cli/render-log.mjs";

export async function submitGenerate(auth, { avatar, voice, text, title, orientation, res, iv }) {
  const body = {
    video_title: title || "heygen-web video",
    video_orientation: orientation || "portrait",
    resolution: res || "720p",
    avatar_id: avatar,
    source_type: "avatar_video_shortcut_modal",
    fit: "cover",
    audio_data: { audio_type: "tts_pending", text, voice_id: voice },
    avatar_settings: { use_avatar_iv_model: iv, use_unlimited_mode: !iv },
    enable_caption: false,
    create_new_avatar: false,
  };
  const out = await call(auth, endpoints.avatarShortcutSubmit, {}, { body });
  appendRenderLog({ avatar, audio: "TTS", video_id: out?.data?.video_id });
  return { video_id: out?.data?.video_id, raw: out };
}

export async function submitAudioGenerate(auth, { avatar, audioPath, engine, title, orientation }) {
  if (engine !== "heygen3")
    throw new Error(`[TODO][HNS] generate-from-audio: only heygen3 (Avatar III) is HAR-verified; ` +
      `heygen4 (Avatar IV) needs its own captured HAR before this path can be wired.`);
  const { width, height, scale } = RESOLUTIONS[orientation || "landscape"];
  const audio = await uploadAudio(auth, audioPath);

  const create = await call(auth, endpoints.textDraftCreate, {}, {
    xPath: "/create-v4/draft",
    body: { video_output: { resolution: { width, height }, fps: 25 }, source_type: "ai_studio" },
  });
  const vid = create?.data?.video_id;
  if (!vid) die("text_draft.create failed: " + JSON.stringify(create));
  const editorPath = `/create-v4/${vid}`;

  const tokens = {
    __VIDEO_ID__: vid, __AVATAR_ID__: avatar, __TITLE__: title || "generate-from-audio",
    __AUDIO_URL__: audio.transcodeUrl,
    __AUDIO_TEXT__: JSON.stringify(audio.text).slice(1, -1),
    __VOICE_ID__: "42d00d4aac5441279d8536cd6b52c53c",
    __WIDTH__: width, __HEIGHT__: height, __SCALE__: scale,
  };

  const saveBody = fillTemplate("generate-audio-save.json", tokens);
  const saveAudioMeta = saveBody.metadata.find((m) => m.type === "audio");
  saveAudioMeta.words = audio.words; saveAudioMeta.duration = audio.duration;
  await call(auth, endpoints.textDraftSave, {}, { xPath: editorPath, body: saveBody });

  const genBody = fillTemplate("generate-audio-generate.json",
    { ...tokens, __VERSION_ID__: randomUUID().replace(/-/g, "") });
  const genMeta = genBody.draft_details.text_draft_with_metadata.metadata;
  const genTextDraft = genBody.draft_details.text_draft_with_metadata.text_draft;
  const audioElId = genTextDraft.script.timeline[0];
  genMeta[audioElId].words = audio.words;
  genMeta[audioElId].duration = audio.duration;

  const gen = await call(auth, endpoints.textDraftGenerate, {}, { xPath: editorPath, body: genBody });
  const outVid = gen?.data?.video_id;
  if (!outVid) die("text_draft.generate failed: " + JSON.stringify(gen));
  appendRenderLog({ avatar, audio: basename(audioPath), video_id: outVid });
  return { video_id: outVid };
}

export async function getTemplate(auth, templateId) {
  const r = await call(auth, endpoints.heygenTemplateGet, { id: templateId });
  const t = r?.data?.text_draft;
  if (!t) die("heygen_template.get failed: " + JSON.stringify(r));
  return t;
}

export async function submitFromTemplate(auth, { templateId, audioPath, title }) {
  const tmpl = await getTemplate(auth, templateId);
  const audio = await uploadAudio(auth, audioPath);

  const create = await call(auth, endpoints.textDraftCreate, {}, {
    xPath: "/create-v4/draft",
    body: { video_output: tmpl.video_output, source_type: "ai_studio_template", template_id: templateId },
  });
  const vid = create?.data?.video_id;
  if (!vid) die("text_draft.create failed: " + JSON.stringify(create));
  const editorPath = `/create-v4/${vid}`;

  const textDraft = JSON.parse(JSON.stringify(tmpl.text_draft));
  const metadata = JSON.parse(JSON.stringify(tmpl.metadata));

  const scriptElId = textDraft.script.timeline[0];
  const { voice_id, voice_settings } = textDraft.script.elements[scriptElId].attributes;
  textDraft.script.elements[scriptElId] = {
    id: scriptElId, type: "audio",
    attributes: { src: audio.transcodeUrl, voice_id, voice_settings },
    voice_mirroring: false,
  };
  metadata[scriptElId] = {
    element_id: scriptElId, type: "audio", seed: Math.floor(Math.random() * 2 ** 32),
    url: audio.transcodeUrl, duration: audio.duration, words: audio.words,
    name: basename(audioPath), fileType: "upload", source_audio_url: audio.transcodeUrl,
  };

  const saveBody = {
    video_id: vid, text_draft: textDraft, video_output: tmpl.video_output,
    metadata: Object.values(metadata), title: title || "generate-from-template",
    skip_rate_limit: false, has_faceswap: false,
  };
  await call(auth, endpoints.textDraftSave, {}, { xPath: editorPath, body: saveBody });

  const genBody = {
    video_id: vid, enable_watermark: false, generate_type: "normal",
    version_id: randomUUID().replace(/-/g, ""), complete_tts_in_backend: true,
    draft_details: { text_draft_with_metadata: { metadata, text_draft: textDraft, video_output: tmpl.video_output } },
  };
  const gen = await call(auth, endpoints.textDraftGenerate, {}, { xPath: editorPath, body: genBody });
  const outVid = gen?.data?.video_id;
  if (!outVid) die("text_draft.generate failed: " + JSON.stringify(gen));
  appendRenderLog({ avatar: templateId, audio: basename(audioPath), video_id: outVid });
  return { video_id: outVid };
}

export async function studioRender(auth, args) {
  const avatar = arg(args, "--avatar");
  if (!avatar) die("studio-render needs --avatar <look_id>");
  const title = arg(args, "--title") || `studio ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
  const fill = (f, vid) => fillTemplate(f, { __VIDEO_ID__: vid, __AVATAR_ID__: avatar });

  const cr = await call(auth, endpoints.textDraftCreate, {}, {
    body: { video_output: { resolution: { width: 1080, height: 1920 }, fps: 25 }, source_type: "ai_studio" },
  });
  const vid = cr?.data?.video_id;
  if (!vid) die("text_draft.create failed: " + JSON.stringify(cr));
  console.error(`✓ draft created: ${vid}`);

  const saveBody = fill("save.json", vid);
  saveBody.video_id = vid; saveBody.title = title;
  await call(auth, endpoints.textDraftSave, {}, { body: saveBody });
  console.error(`✓ draft saved with avatar ${avatar}, title "${title}"`);

  const prevBody = fill("preview.json", vid);
  prevBody.video_id = vid;
  const pv = await call(auth, endpoints.sceneAvatarPreview, {}, { body: prevBody });
  const job = pv?.data?.job_id;
  if (!job) die("scene_avatar_preview failed: " + JSON.stringify(pv));

  console.log(JSON.stringify({ video_id: vid, job_id: job, title,
    open: "https://app.heygen.com/projects" }, null, 2));
  console.error(`✓ render kicked off (job ${job}). It's processing server-side now —\n` +
    `  check the web app: Projects → "${title}". No polling.`);
}

export async function studioRenderStatus(auth, vid, job) {
  if (!vid || !job) die("studio-render-status needs <video_id> <job_id>");
  const s = await call(auth, endpoints.sceneAvatarPreviewCheck, { job_id: job, video_id: vid });
  console.log(JSON.stringify(s?.data || s, null, 2));
  const url = s?.data?.video_url;
  console.error(url ? `✓ done → ${url}` : `…still rendering (no video_url yet).`);
}
