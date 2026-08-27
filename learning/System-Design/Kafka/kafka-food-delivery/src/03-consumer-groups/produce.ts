/**
 * Chapter 3, part 1: a steady stream of orders.
 *
 *   npm run ch3:produce
 *
 * Sends one order every 700ms for 60 orders (about 42 seconds), keyed by
 * customerId. Slow on purpose: chapter 3 is about WATCHING, and a burst that
 * finishes in 200ms shows you nothing.
 *
 * Leave this running while you start and stop consumers in other terminals.
 */
import { kafka, TOPICS, makeOrder, banner, logSent, hint, sleep } from '../lib/client.js';

const TOTAL = 60;
const GAP_MS = 700;

async function main(): Promise<void> {
  banner(
    'Chapter 3 - the order firehose',
    `topic: ${TOPICS.ch3}   ${TOTAL} orders, one every ${GAP_MS}ms   (Ctrl-C to stop early)`,
  );

  const producer = kafka.producer();
  await producer.connect();

  for (let i = 0; i < TOTAL; i++) {
    const order = makeOrder(i);
    const result = await producer.send({
      topic: TOPICS.ch3,
      messages: [{ key: order.customerId, value: JSON.stringify(order) }],
    });
    const meta = result[0];
    logSent({
      topic: TOPICS.ch3,
      partition: meta.partition ?? 0,
      offset: String(meta.baseOffset ?? meta.offset ?? '?'),
      key: order.customerId,
      order,
    });
    await sleep(GAP_MS);
  }

  await producer.disconnect();
  hint('\nStream finished.');
}

main().catch((err) => {
  console.error('\nFailed:', err instanceof Error ? err.message : err);
  console.error('\nIs Kafka running? Try:  npm run up   then  npm run topics:create');
  process.exit(1);
});
