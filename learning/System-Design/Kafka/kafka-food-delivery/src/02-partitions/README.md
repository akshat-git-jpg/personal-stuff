# Chapter 2 — Three cities

## The requirement

Bites launched in Bangalore, Delhi and Mumbai. Two things landed on your desk
the same morning.

> **1.** Traffic went from 1 order/sec to 300 orders/sec. One kitchen consumer
> is now permanently behind.
>
> **2.** Bug report, priority 1: the customer app showed **"Delivered"** and then
> **"Out for delivery"** for the same order. The screen went backwards.

Both are the same problem underneath. Solving the first one *causes* the second
one, unless you do it right.

## Think first

Chapter 1's topic was a single numbered list. One list means one reader can
work through it at a time, because the list has one end.

To go faster you need **more than one list**.

Now guess what happens to ordering when there are three lists.

## The word

- **Partition** — one topic is secretly N numbered lists. Each is a partition.
  Each has its own offsets starting at 0.

`ch2-orders` has 3 partitions. So it has three independent lists, and Kafka can
write to all three at once, on three different machines if it wants.

That is the entire speed story of Kafka. Everything else follows from it.

## Run it

```bash
npm run ch2:produce
```

Read the output before you run the consumer.

## What you should see

**Round A** sends 8 orders **with a key** (`customerId`).
Look at the colours. Every `cust-rahul` line is the same colour, so the same
partition. Every `cust-dev` line is another. Kafka did not roll a dice.

It did this:

```
partition = hash(key) % numberOfPartitions
```

Same key in, same number out. Every time. Forever. Even from a different
service, on a different day, in a different language.

**Round B** sends 8 orders **with no key**. Kafka spreads them out to balance
load. Fast, even, and the same customer's events are now scattered across three
lists.

## Now see the damage

```bash
npm run ch2:consume
```

Let it print everything, then press `Ctrl-C`. It prints a summary like:

```
customer -> partitions it landed on
cust-anita     [1]        ordered
cust-dev       [0]        ordered
cust-rahul     [2]        ordered
```

Those are the keyed ones. Every customer sat on exactly one partition, so their
events can only ever be read in the order they were written.

Now look at the `RECV` lines above the summary. They are **not** in the order
you sent them. Kafka drained partition by partition.

## The one sentence that is the whole chapter

> **Kafka guarantees order inside a partition. It guarantees nothing across
> partitions. Ever.**

So the "Delivered before Out for delivery" bug was this: the two status events
for one order went to different partitions, and the consumer read them in the
wrong order. The fix is not a config. The fix is **key by `orderId`**, so every
event for one order is forced onto the same partition.

## Say it in an interview

> "Partitions are Kafka's unit of parallelism and its unit of ordering, and
> those are the same thing, which is the trade-off. I key by the entity that
> needs ordering — `orderId` for order lifecycle events, `customerId` if I need
> per-customer ordering. Anything unkeyed gets spread for throughput and I
> accept it has no order."

## The trap

Two of them, and interviewers love both.

**Trap 1: "Can you just add partitions later when you need more throughput?"**

You can add them. But `hash(key) % 3` and `hash(key) % 6` give different
answers, so **existing keys move to different partitions**. From that moment,
old events for `cust-rahul` are on partition 2 and new ones are on partition 5.
Ordering is broken across the boundary, permanently, for existing keys.

You also cannot *reduce* partitions at all. Kafka does not support it.

So: **partition count is a decision you get roughly one shot at.** Over-provision.

**Trap 2: "How many partitions should this topic have?"**

Never say a number without showing the arithmetic. Say this instead:

> "Partitions is the max parallelism, so start from the consumer.
> If one consumer handles 500 orders/sec and I need 5,000/sec, that is 10
> partitions minimum. I double it to 20 for headroom, because adding later
> breaks key ordering. I would not go to 2,000 — every partition costs file
> handles, memory and rebalance time on the broker."

At 300 orders/sec today and one consumer doing ~500/sec, Bites needs surprisingly
few. The reason you still pick more is chapter 3.

## Your turn

You do not write code here. Ask me and I change it, then you run it and watch.

1. Ask: **"key chapter 2 by orderId instead"**. Run it. Now each order gets
   spread by its own id, so no two orders are ordered relative to each other,
   but each order's own events are. That is usually the right key for a
   delivery app. Think about why.
2. In the dashboard (**Topics → ch2-orders → Messages**), use the partition
   filter to view one partition at a time. Offsets go 0, 1, 2 inside each one.
   Three lists, three counters.
3. Predict, then check: if you send 1,000 orders keyed by `customerId` and you
   have 4 customers and 3 partitions, will the partitions be evenly loaded?

<details>
<summary>Answer to 3</summary>

No. Four keys hashed into three buckets cannot be even — one partition gets two
customers and roughly double the traffic. This is called a **hot partition**,
and it is why "key by `customerId`" is dangerous when one customer is huge.
Real example: keying by `restaurantId` when one restaurant does 30% of orders.
</details>

## Done

One line in `NOTES.md`, then
[`src/03-consumer-groups/README.md`](../03-consumer-groups/README.md).

It is 8pm. The rush is starting.
