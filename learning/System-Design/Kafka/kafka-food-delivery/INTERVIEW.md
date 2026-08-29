# Kafka, for the interview

The spoken answers and the follow-up traps, saved from the chapters that were removed.
Everything here is about what you **say**, not what you type.

Grows as we cover more. Right now it covers the log, partitions, and consumer groups.

---

## 1. What Kafka is

> "Kafka is an append-only log. Producers append; consumers read at their own pace and
> track their position with an offset. Because reading does not delete, a consumer can
> crash, restart, and resume exactly where it stopped. That decoupling is why you put
> Kafka between two services instead of having one call the other."

**The trap:** *"So when does Kafka delete a message?"*

Wrong answer: "when the consumer reads it." That is a queue — RabbitMQ, SQS. Different product.

Right answer: **on a timer, or when a size limit is hit, whether or not anybody read it.**
Default is 7 days. Which means a consumer that is down for 8 days has permanently lost
data, with nothing having crashed.

---

## 2. Partitions and ordering

> "Partitions are Kafka's unit of parallelism and its unit of ordering, and those are the
> same thing — that is the trade-off. I key by the entity that needs ordering: `orderId`
> for order lifecycle events, `customerId` if I need per-customer ordering. Anything
> unkeyed gets spread for throughput and I accept that it has no order."

The one sentence underneath it all:

> **Kafka guarantees order inside a partition. It guarantees nothing across partitions. Ever.**

**Trap A:** *"Can you just add partitions later when you need more throughput?"*

You can add them, but `hash(key) % 3` and `hash(key) % 6` give different answers. Existing
keys move to different partitions, so ordering breaks across that boundary permanently for
every key that already existed. You also cannot *reduce* partitions at all — Kafka does not
support it.

So partition count is a decision you get roughly one shot at. Over-provision.

**Trap B:** *"How many partitions should this topic have?"*

Never say a number without the arithmetic:

> "Partitions cap parallelism, so I start from the consumer. If one consumer handles
> 500 msg/sec and I need 5,000/sec, that is 10 partitions minimum. I double it to 20 for
> headroom, because adding later breaks key ordering. I would not go to 2,000 — every
> partition costs file handles, memory, and rebalance time on the broker."

**Trap C — the skew one:** four keys hashed into three partitions cannot be even. One
partition gets two keys and roughly double the traffic. That is a **hot partition**. It is
why keying by `restaurantId` is dangerous when one restaurant does 30% of orders.

---

## 3. Consumer groups, lag and rebalancing

> "Consumers scale by joining a group. Kafka assigns each partition to exactly one consumer
> in that group, so partition count caps useful parallelism — extra consumers idle. I
> monitor consumer lag per partition as the primary health signal, because rising lag means
> consumers are slower than producers and everything downstream is stale. I also watch
> rebalance frequency, because each rebalance pauses the whole group."

**Definitions to have ready:**

- **Consumer group** — consumers sharing a `groupId`, splitting the work.
- **Lag** — latest offset written minus offset the group has read. The number of messages
  you are behind. *The* Kafka metric.
- **Rebalance** — Kafka reshuffling partition ownership when a member joins or leaves.
  By default it is stop-the-world: every member pauses, not just the one that left.

**The trap:** *"Your consumers are lagging. What do you do?"*

The junior answer is "add more consumers", and then the interviewer says "you are already at
partition count" and the conversation ends. The real order:

1. **Growing lag or flat-and-large?** Flat-and-large is a one-time backlog. Growing means
   you are structurally under-provisioned.
2. **Make the consumer faster.** Batch the DB writes. Kill the synchronous HTTP call per
   message. Usually wins, costs nothing.
3. **Add consumers**, up to partition count.
4. **Add partitions**, accepting the key-ordering break, and only if key ordering actually
   matters for this topic.
5. **Check for a hot partition.** If one partition has all the lag and the others are at
   zero, your key is skewed and more consumers will not help at all.

Point 5 is the one that impresses people.

---

## 4. The delivery rules

- **Inside one group** — each partition has exactly one owner, so each message is handled
  once by that team.
- **Across groups** — nothing is shared. Every group gets a full copy of every message,
  with its own bookmark.

**Kafka assigns partitions, never messages.** Everything above follows from that sentence.

**The asterisk:** if a consumer handles a message and crashes *before* saving its bookmark,
the partition moves to another member and that message is handled again. That is
**at-least-once delivery**, and it is the default. It is why "the customer was charged
twice" is a real Kafka incident and not a hypothetical.

**The production trap:** two unrelated services that copy-paste the same `groupId` become
one group. They then *split* the messages instead of both receiving them, and each service
silently misses half its work. `groupId` is not a label — it is the thing Kafka uses to
decide who competes with whom.

---

## Still to cover

Commits and delivery guarantees · retention and compaction · dead letter queues ·
transactions and exactly-once · schema registry · stream processing · Kafka Connect ·
Kafka vs RabbitMQ vs SQS vs Kinesis · sizing arithmetic · when Kafka is the wrong choice.

Ask and I will write the section plus its diagram.
