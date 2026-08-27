# Chapter 1 — Day one

## The requirement

Bites has one restaurant. There is an **Order service** (the customer app talks
to it) and a **Kitchen tablet** (the cook stares at it).

> When a customer places an order, the kitchen tablet must show it.
> The tablet is on restaurant wifi. It drops out and reboots several times a day.
> **No order may be lost.**

## Think first

The obvious answer is: Order service calls the tablet's API directly.

Take ten seconds and find the hole in that.

<details>
<summary>The hole</summary>

The tablet is offline when the call happens. The call fails. Now what?

You could retry. But retry for how long? And where do you keep the order
meanwhile? And if the Order service itself restarts during the retry, the order
is gone forever.

You need a **place to put the order** that is not the tablet and not the Order
service. Something that holds it until the tablet is ready, however long that
takes, and remembers exactly where the tablet got to.

That place is Kafka.
</details>

## The three words

- **Broker** — one Kafka server. The thing holding your messages. You are
  running one, in Docker.
- **Topic** — a named list inside the broker. Ours is called `ch1-orders`.
- **Offset** — the position number of a message in that list. 0, then 1, then 2.

That is the whole of chapter 1. Kafka is a numbered list that does not forget.

## Run it

**Terminal 1** — the kitchen tablet. Leave this running.

```bash
npm run ch1:consume
```

**Terminal 2** — a customer places 5 orders.

```bash
npm run ch1:produce
```

## What you should see

Terminal 2 prints five `SENT` lines with offsets `0, 1, 2, 3, 4`.

Terminal 1 prints five `RECV` lines almost instantly.

Then open **http://localhost:8080** → **Topics** → **ch1-orders** → **Messages**.
The orders are sitting there. They were **not deleted when the tablet read them**.

## Now break it

This is the actual requirement, so test it:

1. Press `Ctrl-C` in Terminal 1. The tablet just died.
2. Run `npm run ch1:produce` again in Terminal 2. Three orders arrive while
   the kitchen is offline.
3. Start Terminal 1 again: `npm run ch1:consume`.

**It picks up exactly where it left off.** It does not re-read the old five,
and it does not miss the new five. Requirement met.

How? Kafka wrote down a number: *"the group called `ch1-kitchen` has read up to
offset 5"*. That bookmark lives on the broker, not in the tablet. So the tablet
can burn down and the bookmark survives.

## Say it in an interview

> "Kafka is an append-only log. Producers append; consumers read at their own
> pace and track their position with an offset. Because reading does not delete,
> a consumer can crash, restart, and resume exactly where it stopped. That
> decoupling is the reason you put Kafka between two services instead of having
> one call the other."

Say that in one breath. It is worth a lot of marks.

## The trap

An interviewer will ask:

> *"So when does Kafka delete a message?"*

The wrong answer is *"when the consumer reads it"*. That is a **queue** like
RabbitMQ or SQS, and it is a different product.

The right answer is **"on a timer, or when the disk limit is hit, whether or
not anybody read it."** The default is 7 days.

Which means: a consumer that is down for 8 days has permanently lost data,
even though nothing crashed. Chapter 5 is about that.

## Your turn

You do not write code here. Ask me and I change it, then you run it and watch.

1. Ask: **"change the group id in chapter 1"**. I will point it at a fresh
   group name. Run the consumer again and **everything re-reads from offset 0**.
   A new group name means a brand new bookmark.
2. Run `npm run ch1:produce` five times in a row. Watch offsets climb to 24.
   Nothing was overwritten. Kafka only ever appends.
3. Run this to see the bookmark Kafka is keeping for you:
   ```bash
   docker exec kafka-lab-broker /opt/kafka/bin/kafka-consumer-groups.sh \
     --bootstrap-server localhost:9092 --describe --group ch1-kitchen
   ```
   `CURRENT-OFFSET` is the bookmark. `LOG-END-OFFSET` is how many exist.
   `LAG` is the difference. Remember the word **lag** — chapter 3 is entirely
   about it.

## Done

Write one line in `NOTES.md`, then go to
[`src/02-partitions/README.md`](../02-partitions/README.md).

Bites is about to launch in three cities.
