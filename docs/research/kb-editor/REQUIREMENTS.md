# Owner requirements: own AI-driven video editor (as stated, 2026-10-17)

Owner makes YouTube videos (tutorial / explainer style: screen recordings, AI voiceover,
HeyGen avatar clips, HTML motion-graphics cards rendered with HyperFrames, music, SFX).
Today Claude Code builds the edit via scripts, renders an mp4, and an optional FCPXML is
exported to DaVinci Resolve (free) for touch-ups. Review happens on a separate local web
board with timestamped comments. The owner wants to replace this with ONE editor app.

Owner's real edit flow (added 2026-10-17):
- Owner/freelancer writes the full script first.
- Freelancer records MANY short screen recordings, one per relevant script part, talking
  over them in her own rough voice. Her voice is only a guide; it is never used.
- The final voiceover is TTS generated from the full script.
- The edit syncs: screen recordings + TTS VO + cuts/edits + motion graphics + avatar.
  So the editor must handle many short clips mapped to script parts, mute/drop the guide
  audio, and retime clips (speed change, trim, freeze frame, cut pauses) so the screen
  action lines up with the TTS VO. The guide voice can be transcribed and matched to the
  script to find where each script line happens in each recording (an alignment aid).

OWNER DECISION 2026-10-17 (supersedes requirement 2 below): NO terminal pane inside the
editor for v1. The owner chats with Claude in his normal terminal (VS Code). Claude reads
and edits the editor through the editor's MCP server (comments, playhead, selection,
timeline). Comments live in the editor; a Copy button copies one or all comments with
timestamps + clip refs as a free extra. A terminal pane may be added later.

Hard requirements:
1. Claude drives ~95% of the editing; humans do quick hand edits (first: timing/trim,
   cut/blade, delete, ripple; later text, audio levels).
2. A REAL Claude Code terminal session lives inside the editor (pane). The owner talks
   to Claude there; Claude edits the timeline and the owner sees changes live on the
   timeline. Claude must use the user's own Claude SUBSCRIPTION (Pro/Max), not API billing.
3. Claude must "see" the editor state: playhead, selection, comments (likely via an MCP
   server the editor exposes) and change the timeline programmatically.
4. Timestamped comments / feedback UI on the timeline, inside the editor.
5. NO re-rendering while editing: the timeline plays live with all layers (video, avatar,
   HTML/GSAP graphics, VO, music, SFX). Render/export once at the very end.
   Preview must match export (WYSIWYG).
6. Anyone can use it: owner (macOS), his non-technical sister (Windows), hired human
   video editors on their own machines. Must work on macOS AND Windows. One-click install
   for non-technical users.
7. Collaboration = pass the project folder (e.g. via Google Drive). No live multi-user.
8. Super customizable: owner adds his own features via plugins Claude writes
   (example: paste a Google Drive link -> import everything onto the timeline).
9. Long-term project; owner wants decisions that hold up for years. Owner prefers no
   recurring costs where possible. Videos are typically 5-15 min, 1080p (sometimes 4K
   screen recordings), many layers.
10. Development cost is NOT a constraint (AI agents write the code); pick the right
   design, not the cheap one.
