# Chapter 3 — The 8pm rush

## The requirement

It is 8pm. Bites does 70% of its daily volume in the next 90 minutes.

> The kitchen screen is showing orders from **20 minutes ago**. Cooks are
> cooking food for customers who already cancelled.
>
> Ops asks two questions and wants a number, not a shrug:
> **1.** How far behind are we, right now?
> **2.** Can we just add more servers?

## Think first

Chapter 2 gave you 3 partitions. That is 3 independent lists.

Question: if you start three copies of the kitchen consumer, what stops all
three of them from reading the same partition and cooking the same order
three times?

## The words

- **Consumer group** — a set of consumers that share a `groupId` and split the
  work between them.
- **The rule Kafka enforces:** inside one group, **each partition is assigned
  to exactly one consumer.** Never two.
- **Lag** — `latest offset written` minus `offset this group has read`.
  It is the number of messages you are behind. It is *the* Kafka metric.
- **Rebalance** — when a consumer joins or leaves, Kafka reshuffles who owns
  which partition.

## Run it

You need **four terminals**. Open them all first.

**Terminal 1** — the order firehose. Start this and leave it.

```bash
npm run ch3:produce
```

**Terminal 2** — the first kitchen worker.

```bash
npm run ch3:consume -- rider-1
```

Watch it print:

```
>>> rider-1 now holds partition(s): 0, 1, 2
```

Alone in its group, it owns everything.

**Terminal 3** — add a second worker.

```bash
npm run ch3:consume -- rider-2
```

Watch **both** terminals reprint their assignment. That reshuffle is the
rebalance. Now it is 2 partitions and 1 partition.

**Terminal 4** — a third worker.

```bash
npm run ch3:consume -- rider-3
```

Rebalance again. One partition each. Perfectly balanced.

## The answer to question 2

Now the interesting part. Open a **fifth** terminal:

```bash
npm run ch3:consume -- rider-4
```

It prints:

```
>>> rider-4 holds NO partitions. It is IDLE.
```

It will sit there forever doing nothing.

> **Partition count is a hard ceiling on how many consumers in a group can do
> work.** 3 partitions means at most 3 working consumers. The 4th, the 40th and
> the 400th all do nothing.

So the answer to Ops is: *"No. Adding servers past 3 does nothing. We need more
partitions first, and adding partitions breaks key ordering for existing
customers. Here is the plan..."*

That answer is worth more in an interview than anything else in this chapter.

## The answer to question 1

Lag. Run this any time:

```bash
docker exec kafka-lab-broker /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 --describe --group ch3-dispatch
```

Or just open **http://localhost:8080** → **Consumers** → **ch3-dispatch**. The
dashboard shows lag per partition, live, and it is much easier to watch.

**Make lag happen on purpose.** Stop all the consumers, leave the producer
running, wait 20 seconds, and watch lag climb in the dashboard. Then start one
consumer and watch it drain.

## Watch a rebalance hurt

With all three riders running, press `Ctrl-C` on `rider-2`.

Within about a second its partition moves to another rider. But notice: for
that moment, **every consumer in the group stopped**, not just the one that
left. That is the default rebalance behaviour, and it is called *stop-the-world*.

Which means a service that crash-loops every 30 seconds keeps triggering
rebalances, and the whole group spends its life pausing. Real incident, very
common.

## Say it in an interview

> "Consumers scale by joining a group. Kafka assigns each partition to exactly
> one consumer in that group, so partition count caps useful parallelism —
> extra consumers idle. I monitor consumer lag per partition as the primary
> health signal, because lag rising means the consumers are slower than the
> producers and everything downstream is stale. I also watch rebalance
> frequency, because each rebalance pauses the whole group."

## The trap

> *"Your consumers are lagging. What do you do?"*

The junior answer is "add more consumers". Then the interviewer says "you are
already at partition count", and the conversation is over.

The real answers, roughly in order of what you should try:

1. **Is the consumer slow, or is the producer fast?** Look at whether lag is
   growing or flat-and-large. Flat-and-large means a one-time backlog. Growing
   means you are structurally under-provisioned.
2. **Make the consumer faster.** Batch the database writes. Stop doing a
   synchronous HTTP call per message. This usually wins, and costs nothing.
3. **Add consumers,** up to partition count.
4. **Add partitions,** accepting the key-ordering break, and only if the key
   ordering actually matters for this topic.
5. **Check for a hot partition.** If one partition has all the lag and the
   others are at zero, your key is skewed. More consumers will not help at all.

Point 5 is the one that impresses people.

## Your turn

You do not write code here. Ask me and I change it, then you run it and watch.

1. Run one consumer slowly to force lag:
   ```bash
   WORK_MS=3000 npm run ch3:consume -- slow-rider
   ```
   Watch lag climb in the dashboard while the producer keeps going.
2. Ask: **"make chapter 3 lag only on one partition"**. I will skew the keys
   so one customer sends 90% of orders. Then watch the dashboard: one partition
   red, two at zero. That is a hot partition, seen with your own eyes.
3. Predict, then check: 3 partitions, 2 consumers. One holds 2 partitions, one
   holds 1. Is the work split evenly?

<details>
<summary>Answer to 3</summary>

No. Kafka balances **partitions**, not **messages**. The consumer holding two
partitions gets roughly twice the work. Kafka has no idea how much traffic each
partition carries and does not try to find out.
</details>

## Done

One line in `NOTES.md`.

Phase 1 is finished. You can now explain what Kafka is, why it is fast, and how
it scales. That already covers most Kafka interview questions.

Chapter 4 is where it gets uncomfortable: a customer gets charged twice.
Tell me when you are ready and I will build it.
