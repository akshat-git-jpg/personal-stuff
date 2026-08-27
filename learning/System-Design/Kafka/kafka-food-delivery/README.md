# Kafka, explained with a food delivery app

Learning Kafka by **looking at it**, not by running it.

The running code was removed on 2026-08-28 — diagrams turned out to be the faster route.
It is still in git history if it is ever wanted back.

Everything you need is in three places.

---

## 1. The diagrams

**[`diagrams/`](diagrams/)** — real Excalidraw files. Drag one onto
**https://excalidraw.com** and it opens. You can move things and edit them, which is a good
way to check you understood.

| File | The idea |
|---|---|
| `01-the-log.excalidraw` | A broker holds a topic. Messages sit at offsets. A bookmark tracks the reader. |
| `02-the-whole-picture.excalidraw` | Broker → topics → partitions → consumer groups |
| `03-the-poll-loop.excalidraw` | One consumer holds many partitions, but processes one message at a time |
| `04-what-is-allowed.excalidraw` | Nine combinations of partitions, consumers and groups — each ticked or crossed |

Start with `01`, then `02`. `04` is the reference sheet to come back to.

## 2. The interview answers

**[`INTERVIEW.md`](INTERVIEW.md)** — the 30-second spoken answer for each concept, plus the
follow-up trap an interviewer uses to check whether you actually understand it.

## 3. The map of what is left to learn

**[`CURRICULUM.md`](CURRICULUM.md)** — the concepts still uncovered, each framed as a
problem that breaks the Bites food delivery app. It deliberately does **not** explain the
answers. Ask for one and you get the explanation plus its diagram.

**[`NOTES.md`](NOTES.md)** — yours. One line per concept: the thing that surprised you.

---

## How this works now

You ask questions. I answer in plain terms and draw the picture.

- **"visualise X"** → a new `.excalidraw` file in `diagrams/`
- **"explain X"** → plain answer, then a diagram if it helps
- **"cover X"** → the concept plus its interview section plus its diagram

Every diagram uses a real setup: multiple topics, multi-partition topics, and groups with
several consumers. No toy single-partition examples.
