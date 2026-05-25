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
