# Tutorials Tracker — How it works

A simple board for running a YouTube tutorial from **idea → published**. Each video is one card. It moves through five stages, and each person only sees and touches the part that's theirs. When you finish your part and it's approved, the video automatically shows up for the next person.

This guide explains, in plain language, **who does what, the status each stage goes through, and when a video becomes visible to the next role.**

---

## The team (roles)

| Role | Their job |
|---|---|
| **Admin** | Creates the topic + brief, assigns people, approves each step, and publishes the final video. |
| **Script Writer** | Writes the script. |
| **Tutorial Maker** | Makes the screen-recording video (shares a draft first, then records). |
| **Video Editor** | Edits the final video and uploads it to YouTube as a private draft. |
| **Reviewer** | (Optional) Helps the Admin review and approve. Same powers as Admin for approving. |

> One person can have **more than one role** (e.g. Sam writes scripts *and* records). They'll see a small **Script / Recording** switcher to move between their boards.

---

## The journey (overview)

```
ADMIN            SCRIPT WRITER       TUTORIAL MAKER        VIDEO EDITOR          ADMIN
create topic  →  write script    →  record the video   →  edit final video  →  review & publish
& assign         (approved)          (approved)            (approved → YT draft)   on YouTube
```

A video only appears on your board **after the previous stage is approved**. You can never "jump the queue."

---

## The status lifecycle (every work stage)

Script, Recording, and Editing all use the same four statuses. You move your card left → right as you work:

| Status | Means | Who sets it |
|---|---|---|
| **To Do** | Assigned to you, not started | you |
| **Working on it** *(In Progress)* | You're doing it | you |
| **Submitted for review** *(In Review)* | You're done — waiting for approval | you (this is the furthest you can go) |
| **Done** ✅ | Approved | **Admin / Reviewer only** |

**You cannot mark your own work "Done."** You submit it ("Submitted for review"); an Admin/Reviewer approves it. The **Done** lane is shown to you but locked (🔒 Approver only) — you can't drag a card there.

**If your work needs changes:** the approver sends it back. The card returns to **Working on it** with a **⚠ Reviewer note** explaining what to fix. You revise and submit again.

**Once approved (Done), your card locks** — you can't change it anymore (so you don't disrupt the next person). Only an Admin can re-open it.

---

## Step by step

### 1. Admin — create the topic
- Add the video: **title**, **notes / brief** (what to cover), **category**.
- Assign the **Script Writer** (and later the Tutorial Maker, Video Editor) by putting their email in the right field.
- Set **Topic status → "Ready for script."**
- ➡️ As soon as it's **Ready** and a script writer is assigned, the video appears on the **Script Writer's** board.

### 2. Script Writer — write the script
- **Shows up when:** topic is *Ready* and you're the assigned script writer.
- You can see the **brief** (read-only). You fill in the **Script** link.
- Move your status: To Do → Working on it → **Submitted for review**.
- 🔗 Paste a **publicly viewable** link ("Anyone with the link can view").
- Admin/Reviewer approves → status becomes **Done**.
- ➡️ When the script is **Done**, the video appears on the **Tutorial Maker's** board.

### 3. Tutorial Maker — record the video
- **Shows up when:** the script is *Done* and you're the assigned tutorial maker.
- You can see the **approved script** (read-only) to record from.
- Share a quick text/doc draft first if you like, then record the screen-capture and paste the **recording** link.
- Move status To Do → Working on it → **Submitted for review** → (Admin approves) **Done**.
- ➡️ When the recording is **Done**, the video appears on the **Video Editor's** board.

### 4. Video Editor — edit the final video
- **Shows up when:** the recording is *Done* and you're the assigned editor.
- You can see the **approved recording** (read-only) to edit from.
- Edit, then paste the **Final video** link. Submit for review.
- After it's approved, **upload it to YouTube as an unlisted/private draft.**
- ➡️ When editing is **Done**, the video appears for the **Admin/Reviewer** to publish.

### 5. Admin / Reviewer — review & publish
- **Shows up when:** editing is *Done*.
- Review the final video on YouTube. The **Upload status** goes: To Do → **Draft** (editor's YT draft) → **Published**.
- Add the **YouTube link**, then mark **Published**. 🎉 Done.

---

## Approving & sending back (Admin / Reviewer)

You have an **"Awaiting approval"** view listing everything submitted across Script, Recording, and Editing. Click any item to open the card and:
- **✓ Approve** — moves it to **Done**, which releases it to the next person.
- **↩ Send back** — type a note; the card goes back to the freelancer's "Working on it" with your feedback attached.

---

## Notifications (email)

You'll get an email automatically (from "Tutorials Tracker") when:
- **You're assigned** a new video → the assignee.
- **Something is submitted** for review → the reviewer/admin.
- **Your work is approved** → the freelancer.
- **Your work is sent back** → the freelancer (with the feedback note).

No app-watching required — the email tells you when it's your turn.

---

## Admin views (the big picture)

- **Overview** — counts at each stage, what's **awaiting your approval**, what's **stalled** (sent back) or **stuck** (no movement in days), and each person's workload.
- **Pipeline** — a row per video, with columns for each stage, showing exactly where every video is at a glance.
- **Board** — the classic Kanban, switchable by stage, with filters (assignee / category / stage).
- **View as** — see the app exactly as any teammate sees it.

---

## Quick tips
- **Always paste links set to "Anyone with the link can view"** — otherwise the next person can't open them.
- **You only see your own assigned videos** (Admin sees everything).
- **Finished work collapses** — your "Done" pile is tucked away so your board stays focused on what's active.
- **Add/remove people** by editing the **Employes** tab in the sheet (Name, Email, Role — separate multiple roles with a comma). No mapping = no access.

---

*Technical/architecture details for developers live in [`CLAUDE.md`](CLAUDE.md).*
