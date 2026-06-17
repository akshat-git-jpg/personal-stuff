// Plain-language "what you do here" guidance shown at the top of each board, so
// whoever holds a role knows their responsibilities. Keyed by pipeline stage id;
// the Reviewer queue uses REVIEWER_GUIDE. Edit the wording freely — it's just copy.

export const STAGE_GUIDE: Record<string, string> = {
  topic:
    "Write the topic: a clear title, the notes/brief, and a description. Assign the scriptwriter, recorder, editor, uploader, and a reviewer, then submit it for review. The reviewer adds the starting instructions and marks it Done — that's what lets the scriptwriter begin.",
  script:
    "Write the script from the topic notes and the instructions on the card. Paste your script link and submit it for review. If it comes back as “Needs changes”, read the feedback, fix it, and resubmit.",
  recording:
    "Record the tutorial from the approved script. Paste your recording link and submit it for review. If it's sent back, check the feedback, redo it, and resubmit.",
  editing:
    "Edit the final video from the approved recording. Paste the edited video link and submit it for review. Address any “Needs changes” feedback and resubmit.",
  upload:
    "Upload the approved final video. Add the YouTube link and upload details, then mark it Uploaded. There's no review step here — this is the last stage.",
};

export const REVIEWER_GUIDE =
  "You handle whatever has been submitted to you. For a topic: add the starting instructions for the assigned freelancers and mark it Done so the scriptwriter can begin (topics can't be sent back). For a script, recording, or edit: check the work, then either Approve it or send it back with feedback saying what to change.";
