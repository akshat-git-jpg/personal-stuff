i fill the yt tracker sheet. Also update the affiliate sheet
i mark the topic status as in yt tracker sheet - to process

i run the workflow called - process_yt_tracker.
it checks the videos where status in to process.
it figures out what tools i am promoting from title and notes.
it fetches information about actual affiliate links from affiliate sheet.
it generates short urls for all those tools.
it adds two columns in yt tracker sheet in actual_links, short_links.
it generates description from video title, notes and short_links.

now i can run on demand script yt_analysis.

- its main job is to fill Analysis sheet and YT Ranking sheet.
- It asks questions - what all do you want to sync - views per video, affiliate links clicks and rank analysis.
- for rank anaysis - there is a separate sheet and separate workflow [ Don't Do anything for now]
- for views and affiliate links click - it will sync video meta data from yt tracker sheet to Analysis sheet. video_title video_notes video_description category sub_category yt_upload_status yt_upload_date yt_link
- Core run will only run on videos where yt upload status is uploaded
- for views, we already have a script. Fill the views column.
- for affiliate links clicks count - fill the affiliate_link_clicks column - tool name, actual affiliate link, generated link, count last 30 days, count overall
- Post the summary.

---

Tutorial maker:
Skill - No avatar, any accent, any gender, avg English Level:
Main skill - Research + tutorial video scripting intution - what tutorial makes a good video
Work:

- Take a topic, research, watch compeitiors videos.
- Submit draft/outline of video - get approval from founders
- Make the screen recorded tutorial with voice.

Process transcript:

- Get Transcript from screen recorded video - tool
- Fix transcript - add punctuation, prounanciation, Remove wrong words, add/update sentence etc - tool
- Make tts from transcript, listnet to it. Fix prounanciation - once finalize - submit.

Video editor:
Main skill - sync voice with screen recording (should have experience working with screen recorded videos)
Work:

- Take tts and screen recording.

Process tts/transcript and make avatar:

- remove space from tts.
- Divide tts/transcript on avatar - what part to be made by heygen 4 (5 min) vs heygen 3 (entire)
- Extract 5 min heygen audios and make heygen 4 avatar.
- Make entire video heygen 3 avatar.

- Make screen recording match with tts at relevant places.
- Fill missing gaps with avatar video and motion graphics - Video done
- Make thumbnail.

Issues:

- Make reaslitic avatar video
- Make avatar video looking at laptop/side laptop or down - at time of showing screen recordings.

---

1. Creative (expensive, scarce) — Tutorial maker
   Research → outline → approval → screen-record + voice. Full stop. This is the only genuinely hard-to-hire skill ("what makes a good tutorial"). Don't dilute it with transcript cleanup.

2. Production / mechanical (cheap or automated) — new "Production assistant" role, or mostly Claude + CLI
   Transcript fix, TTS generation, space removal, avatar generation (III and IV). This is the assembly line. It should be 80% automated with our tooling and a junior doing QC — not eating creative or editor hours. This is where everything we built this week lives.

3. Craft (mid, taste-driven) — Video editor
   Sync screen recording to TTS, gap-fill, motion graphics. Pure editing judgment. This is real skill, but it shouldn't include generating avatars or fixing transcripts.
