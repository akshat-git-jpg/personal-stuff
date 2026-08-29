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
| `04-what-is-allowed.excalidraw` | 1-3 | The reference sheet: a full world map, offsets-per-group, and nine combinations each ticked or crossed |

`04` is the big one and it is tall — scroll. Three sections, in order:

1. **THE WORLD** — 2 topics, 7 partitions, 3 groups, 7 consumers, and who holds what
2. **THE BOOKMARK BELONGS TO THE GROUP** — one partition read by three groups sitting at
   three different offsets
3. **NINE SCENARIOS** — every combination, ticked or crossed

Drawing rule used everywhere in it: a **wide dashed box is a partition**, the **small
numbered squares inside it are messages** (numbered by offset), and an **arrow means that
whole partition is assigned to that consumer**.

More get added as we go. **Ask me to visualise anything** — a concept, a
failure, a comparison — and I will generate a new one here.

## How they are made

Each `NN-name.mjs` script builds its `.excalidraw` file:

```bash
node diagrams/01-the-log.mjs
```

`lib/excalidraw.mjs` is just boilerplate so the diagram scripts stay readable.
You never need to touch either. Ask me for a change and I regenerate it.
