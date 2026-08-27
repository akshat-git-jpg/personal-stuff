# Kafka, by building a food delivery app

You are the backend engineer at **Bites**, a food delivery startup.

Each chapter gives you **one new requirement** from the business. You solve it.
Solving it teaches you one piece of Kafka. Then the business grows and breaks
what you built, and that is the next chapter.

Nothing is explained before you need it. If a chapter mentions a word you have
not met yet, that is a bug — tell me and I will fix it.

Everything runs on your Mac. It costs nothing.

---

## Start here (5 minutes)

**1. Start Kafka.**

```bash
cd learning/System-Design/Kafka/kafka-food-delivery
npm install        # first time only
npm run up
```

Wait about 20 seconds. Then open **http://localhost:8080**. That is your
dashboard. It is empty right now. That is correct.

**2. Make the topics.**

```bash
npm run topics:create
```

Refresh the dashboard, click **Topics**. Three appeared.

**3. Go to chapter 1.**

Open [`src/01-hello/README.md`](src/01-hello/README.md).

---

## The three commands you will use constantly

| Command | What it does |
|---|---|
| `npm run up` | Start Kafka + the dashboard |
| `npm run down` | Stop them, **keep** your messages |
| `npm run reset` | Stop them, **delete** everything, start fresh |

Dashboard: **http://localhost:8080**

If a script says *"connection refused"* or *"all broker connections down"*,
Kafka is not running. Run `npm run up`.

---

## Where things live

```
kafka-food-delivery/
  README.md            <- you are here
  CURRICULUM.md        <- the 11 chapters, and what breaks in each one
  NOTES.md             <- YOU write in this one, after each chapter
  INTERVIEW.md         <- grows as you go: the questions and the answers
  docker-compose.yml   <- the whole infrastructure, ~60 lines, commented
  diagrams/            <- Excalidraw files, one per chapter
  src/
    lib/               <- shared setup, shared fake orders, pretty printing
    01-hello/          <- chapter 1: README + the code
    02-partitions/     <- chapter 2
    03-consumer-groups/<- chapter 3
```

Every `.ts` file is short and heavily commented. Read the comments. They are
the lesson; the code is just proof.

---

## How to actually learn this

After each chapter, open `NOTES.md` and write **one line**: what surprised you.
Not a summary. The surprise. That one line is what you will still remember in
six months, and it is what you will say in the interview.
