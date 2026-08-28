// The parser is plain JavaScript and lives with the pipeline that owns the
// format, not with this app. Only the TESTS reach for it - they re-parse after
// every splice to prove the markdown still holds together - so this declares
// just enough of the contract for those, and deliberately not a full mirror of
// the module. `src/types.ts` is the real contract; a second copy here would be
// one more thing to keep in step.
declare module '*/pipelines/youtube/yt-script/lib/beats.mjs' {
  import type { Beat, EditModel } from '../types'
  export function buildBeats(md: string): { title: string; beats: Beat[] }
  export function buildEditModel(md: string): EditModel
}
