# Review Studio

One page to watch every video the edit recipes make and leave comments on it.

- **Home** lists every video from `yt-video-edit` (visuals-flow) and `yt-animate` (animate-flow), newest first.
- **A video** shows its parts, the player, the script following playback, the comments, and a timeline with pins, parts, cards, frames and the voice wave.
- **Press C** to pin a comment at the play head. It fills in what was being said, the part and the card. You add what to change and why.

Comments go into the video's own `feedback.json`, the same file the old boards use. Both boards can be open at once: each shows the other's comments.

## Start it

Node 22 or newer. The first time:

```bash
cd pipelines/video/review-studio
npm run setup
```

Then every time:

```bash
npm start
```

Open http://localhost:4340.

## Keys

| Key | Does |
|---|---|
| Space | Play or pause |
| J / L | Back or forward 5 seconds |
| Left / Right | Back or forward 1 second |
| C | Comment at the play head |
| [ / ] | Previous or next comment |
| F | Full screen |
| Ctrl + Enter | Save the comment you are typing |
| Ctrl + scroll | Zoom the timeline |
