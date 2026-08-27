# The Bites story

Eleven chapters. Each one is a **new requirement**, not a topic.

You will notice this list tells you what *breaks*, and never how to fix it.
That is on purpose. The fix is the chapter.

Tick a box when you finish a chapter and have written your line in `NOTES.md`.

---

## Phase 1 — Get it working

- [ ] **1. Day one.**
  Bites has one restaurant and one kitchen tablet. When a customer places an
  order, the tablet must show it. The tablet loses wifi constantly and reboots.
  **No order may be lost.**
  → `src/01-hello/` · *unlocks: broker, topic, producer, consumer, offset*

- [ ] **2. Three cities.**
  Traffic is 50x. One kitchen consumer cannot keep up. Worse, a bug report
  landed: the customer app showed **"Delivered" before "Out for delivery"** on
  the same order.
  → `src/02-partitions/` · *unlocks: partitions, keys, ordering, choosing partition count*

- [ ] **3. The 8pm rush.**
  Every night at 8pm the kitchen screen falls 20 minutes behind. Ops asks two
  questions: **how far behind are we right now**, and **can we just add more
  servers?**
  → `src/03-consumer-groups/` · *unlocks: consumer groups, lag, rebalancing, the partition ceiling*

## Phase 2 — Make it correct

- [ ] **4. The double charge.**
  A kitchen worker process crashed halfway through an order. The customer was
  charged twice. Support has 40 tickets and the CEO is in your DMs.
  → *unlocks: offsets and commits, at-least-once vs at-most-once, idempotent consumers*

- [ ] **5. The disk alert.**
  Kafka's disk hit 92%. Separately, a new "current order status" screen takes
  11 minutes to boot because it replays 400 million events to find the latest
  status of each order.
  → *unlocks: retention, log compaction, compacted topics as a database*

- [ ] **6. The poison order.**
  A partner restaurant's integration sent one malformed order. Everything
  behind it on that partition stopped for three hours. Nobody noticed until
  a customer tweeted.
  → *unlocks: poison pills, retry topics, dead letter queues*

- [ ] **7. Money must not lie.**
  Payments must record "charged" in Kafka **and** mark the order paid.
  Both, or neither. Never one.
  → *unlocks: transactions, exactly-once, the outbox pattern*

## Phase 3 — Make it survivable

- [ ] **8. The mobile team shipped a field.**
  Android added `tipAmount` to the order payload. Three backend consumers
  crashed on deploy. Nobody told anyone.
  → *unlocks: schema registry, Avro vs JSON vs Protobuf, compatibility modes*

- [ ] **9. The TV in the office.**
  Ops wants a live board: orders per restaurant in the last 5 minutes,
  updating continuously. They want it this week and you have no time to build
  a service.
  → *unlocks: stream processing, windowing, ksqlDB*

- [ ] **10. Analytics wants the restaurants table.**
  Restaurant details live in Postgres. Analytics needs them in Kafka, always
  current, and you are not allowed to write a syncing service.
  → *unlocks: Kafka Connect, change data capture, streams vs tables*

## Phase 4 — The interview

- [ ] **11. Whiteboard, 45 minutes.**
  *"Design a food delivery system for 10 million orders a day."*
  You have already built it. Now learn to say it out loud in 45 minutes,
  including the part where you argue Kafka is the **wrong** choice for
  two of the components.
  → *unlocks: Kafka vs RabbitMQ vs SQS vs Kinesis, back-of-envelope sizing,
  when not to use Kafka*

---

## Pace

One chapter per sitting, 40 to 60 minutes each. Do not read ahead. The whole
value of this format is that you feel the problem before you learn the fix.
