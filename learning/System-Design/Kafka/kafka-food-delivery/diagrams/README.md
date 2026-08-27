# Diagrams

Real Excalidraw files. You can move things, recolour them, add your own boxes.
Editing them is a good way to check you understood.

## How to open one

**Easiest:** go to **https://excalidraw.com**, then drag the `.excalidraw` file
onto the page. Free, no account.

**Inside your editor:** install the *Excalidraw* extension (VS Code or Cursor),
then just click the file. It opens as a canvas.

## What is here

| File | Chapter | The idea |
|---|---|---|
| `01-the-log.excalidraw` | 1 | Kafka is a numbered list that does not forget |
| `02-the-whole-picture.excalidraw` | 1-3 | Broker holds topics, topics split into partitions, consumers read in groups |
| `03-the-poll-loop.excalidraw` | 1-3 | One consumer holds many partitions but processes one message at a time |
| `04-what-is-allowed.excalidraw` | 1-3 | Eight consumer/partition/group combinations, each with a tick or a cross |

More get added as we go. **Ask me to visualise anything** — a concept, a
failure, a comparison — and I will generate a new one here.

## How they are made

Each `NN-name.mjs` script builds its `.excalidraw` file:

```bash
node diagrams/01-the-log.mjs
```

`lib/excalidraw.mjs` is just boilerplate so the diagram scripts stay readable.
You never need to touch either. Ask me for a change and I regenerate it.
