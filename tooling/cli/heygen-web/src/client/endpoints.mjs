export const endpoints = {
  avatarGroupPrivateList: { method: "GET",    path: ({ limit = 20, page = 1 }) => `/v2/avatar_group.private.list?limit=${limit}&page=${page}` },
  avatarLookList:         { method: "GET",    path: ({ group_id })            => `/v2/avatar_group/look.list?group_id=${group_id}&type=all&page=1&limit=20` },
  photoTempCreate:        { method: "GET",    path: ()                        => `/v1/avatar_group/photo/temp.create?num_photos=1` },
  imageAttributesSubmit:  { method: "POST",   path: ()                        => `/v1/media_evaluation/image_attributes.submit` },
  photoTempConvert:       { method: "GET",    path: ({ tid, name })           => `/v1/avatar_group/photo/temp.convert?parent_temporary_user_photar_id=${tid}&name=${encodeURIComponent(name)}&skip_validation=true` },
  textDraftCreate:        { method: "POST",   path: ()                        => `/v1/text_draft.create` },
  textDraftSave:          { method: "POST",   path: ()                        => `/v1/text_draft.save` },
  textDraftGenerate:      { method: "POST",   path: ()                        => `/v1/text_draft.generate` },
  sceneAvatarPreview:     { method: "POST",   path: ()                        => `/v1/text_draft.scene_avatar_preview` },
  sceneAvatarPreviewCheck:{ method: "GET",    path: ({ job_id, video_id })    => `/v1/text_draft.scene_avatar_preview.check?job_id=${encodeURIComponent(job_id)}&video_id=${video_id}` },
  heygenTemplateGet:      { method: "GET",    path: ({ id })                  => `/v2/heygen_template.get?id=${encodeURIComponent(id)}` },
  voiceList:              { method: "GET",    path: ({ page = 1, limit = 30 })=> `/v1/voice.list?page=${page}&limit=${limit}` },
  projectItems:           { method: "GET",    path: ({ limit = 30, type })    => `/v1/project/items?limit=${limit}&item_types=${type}&sort_key=created_ts&sort_order=desc&include_children=true&is_trash=false` },
  projectItemsStatus:     { method: "GET",    path: ({ id })                  => `/v1/project/items/status?item_ids=${encodeURIComponent(id)}` },
  projectItemTrash:       { method: "DELETE", path: ()                        => `/v1/project/item.trash` },
  avatarShortcutSubmit:   { method: "POST",   path: ()                        => `/v2/avatar/shortcut/submit` },
  fileUrlGet:             { method: "GET",    path: ({ base, ct })            => `/v1/file/url.get?file_type=audio&filename=${encodeURIComponent(base)}&content_type=${encodeURIComponent(ct)}&properties%5Baudio_source%5D=voice_recording` },
  fileUpload:             { method: "POST",   path: ()                        => `/v1/file.upload` },
  fastAsr:                { method: "POST",   path: ()                        => `/v1/audio/fast_asr` },
  videoGenerateLimits:    { method: "GET",    path: ()                        => `/v1/avatar/video_generate/limits` },
  monthlyPriorityCount:   { method: "GET",    path: ()                        => `/v1/video_history/monthly_priority_video_count` },
  aiGenerateElementLimits:{ method: "GET",    path: ()                        => `/v1/file.ai_generate_element.limits` },
  migrateToCreditCheck:   { method: "POST",   path: ()                        => `/v1/payment/migrate_to_credit_first.check` },
  videoDownload:          { method: "POST",   path: ()                        => `/v1/pacific/collaboration/video.download` },
  videoDownloadStatus:    { method: "GET",    path: ({ workflow_id })         => `/v1/pacific/collaboration/video.download/status?workflow_id=${encodeURIComponent(workflow_id)}` },
};

export async function call(auth, ep, params = {}, opts = {}) {
  const { api } = await import("./http.mjs");
  return api(auth, ep.path(params), { method: ep.method, ...opts });
}
