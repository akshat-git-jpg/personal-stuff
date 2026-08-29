# The Bites story — what is left to learn

You are the backend engineer at **Bites**, a food delivery startup.

Each item below is a **problem**, not a topic. It tells you what breaks and never how to fix
it. That is on purpose — the fix is the lesson.

Say **"cover 4"** (or the name) and you get the explanation, the interview answer, and a
diagram.

---

## Done

- [x] **1. Day one.** The kitchen tablet reboots constantly and must lose no orders.
  → *broker, topic, offset, the bookmark* · `diagrams/01-the-log.excalidraw`

- [x] **2. Three cities.** Traffic is 50x, and the app showed "Delivered" before
  "Out for delivery" on the same order.
  → *partitions, keys, ordering, choosing partition count* · `diagrams/02`, `diagrams/04`

- [x] **3. The 8pm rush.** The kitchen screen is 20 minutes behind. Ops asks how far behind
  we are, and whether adding servers helps.
  → *consumer groups, lag, rebalancing, the partition ceiling* · `diagrams/03`, `diagrams/04`

## Next up

- [ ] **4. The double charge.**
  A kitchen worker's process crashed halfway through an order. The customer was charged
  twice. Support has 40 tickets and the CEO is in your DMs.
  → *offsets and commits, at-least-once vs at-most-once, idempotent consumers*

- [ ] **5. The disk alert.**
  Kafka's disk hit 92%. Separately, a new "current order status" screen takes 11 minutes to
  boot because it replays 400 million events to find the latest status of each order.
  → *retention, log compaction, a compacted topic used as a database*

- [ ] **6. The poison order.**
  A partner restaurant's integration sent one malformed order. Everything behind it on that
  partition stopped for three hours. Nobody noticed until a customer tweeted.
  → *poison pills, retry topics, dead letter queues*

- [ ] **7. Money must not lie.**
  Payments must record "charged" in Kafka **and** mark the order paid. Both, or neither.
  → *transactions, exactly-once, the outbox pattern*

- [ ] **8. The mobile team shipped a field.**
  Android added `tipAmount` to the order payload. Three backend consumers crashed on deploy.
  → *schema registry, Avro vs JSON vs Protobuf, compatibility modes*

- [ ] **9. The TV in the office.**
  Ops wants a live board: orders per restaurant in the last 5 minutes, updating
  continuously, and you have no time to build a service.
  → *stream processing, windowing, ksqlDB*

- [ ] **10. Analytics wants the restaurants table.**
  Restaurant details live in Postgres. Analytics needs them in Kafka, always current, and
  you may not write a syncing service.
  → *Kafka Connect, change data capture, streams vs tables*

- [ ] **11. Whiteboard, 45 minutes.**
  *"Design a food delivery system for 10 million orders a day."* Including the part where
  you argue Kafka is the **wrong** choice for two of the components.
  → *Kafka vs RabbitMQ vs SQS vs Kinesis, sizing arithmetic, when not to use Kafka*

---

## Also worth covering, outside the story

- [ ] Replication, leaders, followers and ISR — what a 3-broker cluster actually does when
  one dies. (Skipped so far because the lab ran a single broker.)
- [ ] How Kafka is actually fast — sequential disk writes, the page cache, zero-copy,
  batching and compression. A very common interview question.
- [ ] KRaft vs ZooKeeper, and why every tutorial older than 2023 looks different.
