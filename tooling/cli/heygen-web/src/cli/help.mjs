import { CURLS } from "../client/http.mjs";

export function printHelp() {
  console.log(`heygen-web — UNLIMITED Avatar III via the web session (api2.heygen.com)\n
  auth-check
  limits                      monthly seconds used / remaining
  usage [--save] [--diff]     credits + seconds + priority snapshot (prove unlimited = no delta)
  list-avatars [--limit 20]
  list-looks --group <group_id>
  generate --avatar <look_id> --voice <voice_id> --text "..." [--title T]
           [--orientation portrait|landscape] [--res 720p|1080p] [--iv]
  generate-from-audio --avatar <avatar_id> --audio <file> [--engine heygen3|heygen4]
           [--orientation landscape|portrait] [--title T]
           heygen3 (Avatar III) is real (HAR-verified 2026-07-07); heygen4 (Avatar IV) is [TODO][HNS].
           orientation defaults to landscape (1920x1080) — matches this pipeline's source recordings.
  generate-from-template --template <template_id> --audio <file> [--title T]
           renders a TEMPLATE (pre-composed background + avatar bubble, e.g. "Girl 1"/"girl 2")
           over your audio; visual composition untouched, only the audio swaps in.
           HAR-verified 2026-07-09 — see API-REFERENCE.md "Create from template".
  batch --file <items.txt|items.json> [--avatar id] [--voice id]
           [--orientation portrait|landscape] [--res 720p|1080p]
           [--out-dir DIR] [--delay 1500] [--download] [--iv]
           .txt = one script per line; .json = [{text,avatar?,voice?,title?,...}]
  download <video_id> [--res 1080p|720p] [--captions] [--out file.mp4]
  create-photo-avatar <image-path> [--name N]   Avatar III photo avatar → look_id
  photo-to-video --image <img.jpg> --audio <audio.mp3> [--name N] [--title T] [--orientation O]
           creates an avatar from a photo and immediately renders it over audio
  studio-render --avatar <look_id> [--title T]  AI Studio render over the fixed 1-min audio
  list-voices [--limit 30] [--page 1] [--search term] [--json]
  list-videos [--limit 30] [--type heygen_video] [--json]
  status <video_id>           one-shot status + ETA/progress (no polling loop)
  delete-video <video_id> [<video_id> ...] [--type heygen_video]
  raw <path> [--json '<body>']\n
--avatar / --template accept a SLUG from the avatar registry (pipelines/video/heygen/registry.json) (e.g. "girl-1") or a raw id.
Auth file: ${CURLS}\n⚠️  ToS-grey, account-bound. Default mode = unlimited Avatar III.`);
}
