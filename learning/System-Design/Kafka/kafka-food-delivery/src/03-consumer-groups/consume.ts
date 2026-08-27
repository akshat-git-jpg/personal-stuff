/**
 * Chapter 3, part 2: consumer groups and rebalancing.
 *
 *   npm run ch3:consume -- rider-1
 *   npm run ch3:consume -- rider-2
 *   npm run ch3:consume -- rider-3
 *
 * Run each in its OWN terminal. They all join the group `ch3-dispatch`.
 *
 * The rule Kafka enforces: inside one group, each partition goes to exactly
 * ONE consumer. Never two. That is how Kafka lets you scale out without two
 * riders being sent to the same delivery.
 *
 * ch3-orders has 3 partitions, so:
 *   1 consumer  -> it holds all 3 partitions
 *   2 consumers -> 2 and 1
 *   3 consumers -> 1 each, perfectly balanced
 *   4 consumers -> the 4th sits IDLE with nothing to do, forever
 *
 * That last line is the interview trap. Partition count is the hard ceiling on
 * how many consumers in a group can do work. Adding pods past that does nothing.
 *
 * Try this, in order:
 *   1. Start rider-1. It prints "holding partitions 0, 1, 2".
 *   2. Start rider-2. Watch BOTH terminals reprint their assignment. That
 *      reshuffle is called a REBALANCE.
 *   3. Start rider-3. Rebalance again, now 1 partition each.
 *   4. Start rider-4. It gets nothing. Idle.
 *   5. Ctrl-C rider-2. Its partition moves to someone else within a second.
 *
 * Every rebalance pauses ALL consumers in the group for a moment. That is why
 * a service that restarts constantly has terrible Kafka throughput.
 */
import { kafka, TOPICS, banner, logReceived, hint, onShutdown, sleep } from '../lib/client.js';
import type { OrderEvent } from '../lib/client.js';

const GROUP_ID = 'ch3-dispatch';
const WHO = process.argv[2] ?? 'rider-1';

/** How long this rider "spends" cooking each order. Slow it down to build lag. */
const WORK_MS = Number(process.env.WORK_MS ?? 300);

async function main(): Promise<void> {
  banner(
    `Chapter 3 - ${WHO}`,
    `topic: ${TOPICS.ch3}   group: ${GROUP_ID}   work time: ${WORK_MS}ms/order   (Ctrl-C to stop)`,
  );

  const consumer = kafka.consumer({
    kafkaJS: { groupId: GROUP_ID, fromBeginning: true },
  });

  await consumer.connect();
  await consumer.subscribe({ topics: [TOPICS.ch3] });

  let handled = 0;

  // Poll our own assignment and announce it whenever it changes. This is the
  // rebalance, made visible. Started BEFORE run() so you never miss the first one.
  let lastPrinted = '';
  const watchAssignment = setInterval(() => {
    let parts: number[] = [];
    try {
      parts = (consumer.assignment() ?? [])
        .map((a: { partition: number }) => a.partition)
        .sort((a: number, b: number) => a - b);
    } catch {
      return; // not connected yet
    }
    const now = parts.join(',');
    if (now === lastPrinted) return;
    lastPrinted = now;
    console.log(
      parts.length === 0
        ? `\n>>> ${WHO} holds NO partitions. It is IDLE. (More consumers than partitions?)\n`
        : `\n>>> ${WHO} now holds partition(s): ${parts.join(', ')}\n`,
    );
  }, 500);

  onShutdown(async () => {
    clearInterval(watchAssignment);
    console.log(`${WHO} handled ${handled} order(s) this run.`);
    await consumer.disconnect();
  });

  hint('waiting for an assignment...\n');

  await consumer.run({
    eachMessage: async ({ partition, message }) => {
      const order = JSON.parse(message.value!.toString()) as OrderEvent;
      // Pretend the kitchen takes time. This is what creates consumer LAG,
      // the single most important Kafka metric in production.
      await sleep(WORK_MS);
      handled++;
      logReceived({
        who: WHO,
        partition,
        offset: message.offset,
        key: message.key?.toString() ?? '(none)',
        order,
      });
    },
  });
}

main().catch((err) => {
  console.error('\nFailed:', err instanceof Error ? err.message : err);
  console.error('\nIs Kafka running? Try:  npm run up   then  npm run topics:create');
  process.exit(1);
});
