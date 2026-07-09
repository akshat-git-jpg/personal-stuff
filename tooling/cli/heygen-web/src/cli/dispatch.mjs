import { loadAuth, die } from "../client/http.mjs";
import { authCheck } from "../operations/auth.mjs";
import { listAvatars, listLooks, createPhotoAvatar } from "../operations/avatars.mjs";
import { listVoices } from "../operations/voices.mjs";
import { listVideos, status, deleteVideos, downloadCore, download } from "../operations/videos.mjs";
import { submitGenerate, submitAudioGenerate, submitFromTemplate, studioRender, studioRenderStatus } from "../operations/render.mjs";
import { limits, usage } from "../operations/account.mjs";
import { batch } from "../workflows/batch.mjs";
import { raw } from "../workflows/raw.mjs";
import { generate, generateFromAudio, generateFromTemplate } from "../workflows/generate.mjs";
import { photoToVideo } from "../workflows/photo-to-video.mjs";
import { printHelp } from "./help.mjs";

export async function run(args) {
  const [cmd, ...rest] = args;
  if (!cmd || cmd === "help") {
    printHelp();
    process.exit(0);
  }
  const auth = loadAuth();
  switch (cmd) {
    case "auth-check":   await authCheck(auth); break;
    case "list-avatars": await listAvatars(auth, rest); break;
    case "list-looks":   await listLooks(auth, rest); break;
    case "limits":       await limits(auth); break;
    case "usage":        await usage(auth, rest); break;
    case "generate":     await generate(auth, rest); break;
    case "generate-from-audio": await generateFromAudio(auth, rest); break;
    case "generate-from-template": await generateFromTemplate(auth, rest); break;
    case "batch":        await batch(auth, rest); break;
    case "create-photo-avatar": await createPhotoAvatar(auth, rest); break;
    case "photo-to-video": await photoToVideo(auth, rest); break;
    case "studio-render": await studioRender(auth, rest); break;
    case "studio-render-status": await studioRenderStatus(auth, rest[0], rest[1]); break;
    case "list-voices":  await listVoices(auth, rest); break;
    case "list-videos":  await listVideos(auth, rest); break;
    case "status":       await status(auth, rest[0]); break;
    case "delete-video": await deleteVideos(auth, rest.filter((x) => !x.startsWith("--")), rest); break;
    case "download":     await download(auth, rest[0], rest.slice(1)); break;
    case "raw":          await raw(auth, rest[0], rest.slice(1)); break;
    default: die(`unknown command: ${cmd} (try: help)`);
  }
}
