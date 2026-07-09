import { createPhotoAvatar } from "../operations/avatars.mjs";
import { submitAudioGenerate } from "../operations/render.mjs";
import { die } from "../client/http.mjs";
import { arg } from "../cli/args.mjs";

export async function photoToVideo(auth, args) {
  const img = arg(args, "--image");
  const audio = arg(args, "--audio");
  if (!img || !audio) die("photo-to-video needs --image <img.jpg> --audio <audio.mp3> [--name N] [--title T] [--orientation O]");

  const name = arg(args, "--name");
  const avatarArgs = [img];
  if (name) { avatarArgs.push("--name", name); }

  console.error("→ Step 1: Creating photo avatar...");
  const { look_id } = await createPhotoAvatar(auth, avatarArgs);
  if (!look_id) die("Failed to get look_id from avatar creation");

  console.error(`→ Step 2: Generating video with avatar ${look_id}...`);
  const title = arg(args, "--title") || "photo-to-video";
  const orientation = arg(args, "--orientation") || "landscape";
  const engine = "heygen3";

  try {
    const { video_id } = await submitAudioGenerate(auth, { avatar: look_id, audioPath: audio, engine, title, orientation });
    console.log(JSON.stringify({ look_id, video_id }, null, 2));
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }
}
