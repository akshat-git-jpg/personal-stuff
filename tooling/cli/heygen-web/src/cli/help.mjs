import { CURLS } from "../client/http.mjs";

export function printHelp() {
  console.log(`heygen-web — UNLIMITED Avatar III via the web session (api2.heygen.com)\n
  login-from-browser [--browser arc|chrome]   copy the logged-in browser session into the auth file (macOS)
  auth-check
  limits                      monthly seconds used / remaining
  credits                     plan vs add-on credits left (billing page numbers)
  usage [--save] [--diff]     credits + seconds + priority snapshot (prove unlimited = no delta)
  list-avatars [--limit 20]
  list-looks --group <group_id>
  generate --avatar <look_id> --voice <voice_id> --text "..." [--title T]
           [--orientation portrait|landscape] [--res 720p|1080p] [--iv]
  generate-from-audio --avatar <avatar_id> --audio <file> [--engine heygen3|heygen4]
           [--orientation landscape|portrait] [--title T]
           heygen3 = free Avatar III; heygen4 = metered Avatar IV (needs --allow-spend).
           orientation defaults to landscape (1920x1080) — matches this pipeline's source recordings.
  generate-from-template --template <template_id> --audio <file> [--title T] [--engine heygen3|heygen4]
           renders a TEMPLATE (pre-composed background + avatar bubble, e.g. "Girl 1"/"girl 2")
           over your audio; visual composition untouched, only the audio swaps in.
           HAR-verified 2026-07-09 — see API-REFERENCE.md "Create from template".
  clip-batch (--avatar <slug|id> | --template <slug>) --audio <file> [--title T] [--out f.mp4] [--min 10] [--max 25]
           Avatar III only: cuts the audio on pauses into 10-25 s pieces, renders each from render second 0,
           downloads them at 1080p and joins them (x264 CRF 16, 25 fps). One credit check for the whole batch.
  template-engine --template <slug|id>   read-only: is the template Avatar III? exit 3 if not
  batch --file <items.txt|items.json> [--avatar id] [--voice id]
           [--orientation portrait|landscape] [--res 720p|1080p]
           [--out-dir DIR] [--delay 1500] [--download] [--iv]
           .txt = one script per line; .json = [{text,avatar?,voice?,title?,...}]
  download <video_id> [--res 1080p|720p] [--captions] [--out file.mp4]
  create-photo-avatar <image-path> [--name N]   Avatar III photo avatar → look_id
  avatar-test (--image <pic> | --avatar-id <id>) --audio <file> --name <N> [--pic-drive URL] [--source-pic P] [--watermark removed|none]
           photo avatar → Avatar III video → credit check (exit 2 if anything was used)
           → "Test Avatar" folder → row in pipelines/video/heygen/avatar-test/avatar-tests.json
  photo-to-video --image <img.jpg> --audio <audio.mp3> [--name N] [--title T] [--orientation O]
           creates an avatar from a photo and immediately renders it over audio
  studio-render --avatar <look_id> [--title T]  AI Studio render over the fixed 1-min audio
  list-voices [--limit 30] [--page 1] [--search term] [--json]
  list-videos [--limit 30] [--type heygen_video] [--json]
  status <video_id>           one-shot status + ETA/progress (no polling loop)
  delete-avatar <group_id> [<group_id> ...]   delete an avatar (whole group, all looks)
  move-video <video_id> [...] --folder <folder_id>   move videos into a HeyGen folder
  delete-video <video_id> [<video_id> ...] [--type heygen_video]
  raw <path> [--json '<body>']\n
--avatar / --template accept a SLUG from the avatar registry (pipelines/video/heygen/registry.json) (e.g. "girl-1") or a raw id.
Every generate/batch auto-runs a usage diff and prints ✓UNLIMITED / ⚠️NOT-free (Avatar III should stay free). Skip with --no-meter-check.
Auth file: ${CURLS}\n⚠️  ToS-grey, account-bound. Default mode = unlimited Avatar III.`);
}
