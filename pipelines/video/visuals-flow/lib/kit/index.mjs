// Public surface of the recipe-agnostic kit. Recipes import from here, never from a sibling recipe.
export {
  DEFAULT_CANVAS, CLIP_KINDS, RESERVED_KINDS, AVATAR_MODES,
  resolveCanvas, validateEditPlan, editPlanErrors, editPlanToTracks, clipEnd, isShadowedBy,
} from './edit-plan.mjs';
export {
  assembleEditPlan,
  CANVAS, AVATAR_LIPSYNC_LEAD, SLIVER_GRAPHIC_HOLD, SLIVER_GRAPHIC_HEAD, SLIVER_GRAPHIC, SLIVER_AVATAR,
  planSegments, freezeTrailingGap, fillGapsWithFreeze, planSegmentOverlays, absorbSlivers,
  framesUntil, probeSrcAspect, planPanelGeometry, planSideGeometry,
  captionSegKey, maskCaptionWords, captionsApply, encoderArgs, detectEncoder, assemblyMd, drawtextFont,
} from './assemble-core.mjs';
export { registerVersion } from '../versions.mjs';
export {
  HYPERFRAMES, NPX_NEEDS_SHELL, npxArgs, npxSpawnOpts, lintArgs, checkArgs, snapshotArgs, renderArgs,
  extractJsonObject, summariseFindings, checkComposition, snapshotComposition, renderComposition, lavfiPath, frameLuma,
} from './hyperframes.mjs';
