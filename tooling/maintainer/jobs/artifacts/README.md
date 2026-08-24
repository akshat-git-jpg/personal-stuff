# Artifacts Job

This job identifies published videos that still have working files and render leftovers in the repository.

**What makes a video published?**
A video is considered published if and only if BOTH of the following conditions are met:
1. It has a YouTube link (`yt_link`) in the tracker.
2. It has an upload status (`yt_upload_status`) of `Done`, `Published`, or `Complete`.

**Reporting Only:**
This job **reports only**. It does not delete or move any files itself.

**Archiving vs. Deleting:**
Local renders are untracked and purposefully gitignored, which means they cannot be recovered from git if deleted. Removing a render requires a **move** to `$ARCHIVE_ROOT/<date>-artifacts/`, never an `rm`.
