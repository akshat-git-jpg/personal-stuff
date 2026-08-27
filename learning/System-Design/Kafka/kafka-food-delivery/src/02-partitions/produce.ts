/**
 * Chapter 2, part 1: keys decide the partition.
 *
 *   npm run ch2:produce
 *
 * The topic `ch2-orders` has 3 partitions. A partition is one numbered list.
 * Three partitions means three separate numbered lists, and they are
 * independent: partition 0 has its own offset 0, and so does partition 1.
 *
 * We send in two rounds so you can compare them side by side.
 *
 * ROUND A - with a key (customerId).
 *   Kafka hashes the key and does `hash % 3`. Same key always gives the same
 *   answer, so every order from cust-anita lands on the same partition, always,
 *   forever. That is the ONLY ordering guarantee Kafka gives you.
 *
 * ROUND B - no key.
 *   Kafka spreads them around. Fast and balanced, but now one customer's
 *   orders can be scattered across three partitions, so their ACCEPTED event
 *   can be read before their PLACED event.
 *
 * For a food delivery app this is the real design decision. Key by orderId
 * (or customerId) and you get correct per-order state. Skip the key and your
 * order-tracking screen shows nonsense under load.
 */
import { kafka, TOPICS, makeOrder, banner, logSent, hint } from '../lib/client.js';

async function main(): Promise<void> {
  banner(
    'Chapter 2 - keys and partitions',
    `topic: ${TOPICS.ch2}   partitions: 3`,
  );

  const producer = kafka.producer();
  await producer.connect();

  console.log('\nROUND A - key = customerId\n');
  for (let i = 0; i < 8; i++) {
    const order = makeOrder(i);
    const result = await producer.send({
      topic: TOPICS.ch2,
      messages: [
        {
          // THIS is the whole chapter. One extra field.
          key: order.customerId,
          value: JSON.stringify(order),
        },
      ],
    });
    const meta = result[0];
    logSent({
      topic: TOPICS.ch2,
      partition: meta.partition ?? 0,
      offset: String(meta.baseOffset ?? meta.offset ?? '?'),
      key: order.customerId,
      order,
    });
  }

  hint(
    '\n^ Look at the colours. Every cust-anita row is the same colour, because it is\n' +
      '  the same partition. Same for rahul, meera, dev. Kafka did not choose randomly.\n',
  );

  console.log('\nROUND B - no key\n');
  for (let i = 100; i < 108; i++) {
    const order = makeOrder(i);
    const result = await producer.send({
      topic: TOPICS.ch2,
      messages: [{ value: JSON.stringify(order) }],
    });
    const meta = result[0];
    logSent({
      topic: TOPICS.ch2,
      partition: meta.partition ?? 0,
      offset: String(meta.baseOffset ?? meta.offset ?? '?'),
      key: '(none)',
      order,
    });
  }

  await producer.disconnect();

  hint(
    '\n^ Now the same customer can appear on different partitions. Order is gone.' +
      '\n\nThe interview sentence: "Kafka guarantees order WITHIN a partition, not across' +
      '\na topic. So you get ordering by choosing a key that puts related events together."' +
      '\n\nNext: run  npm run ch2:consume  and see which partition each message came from.',
  );
}

main().catch((err) => {
  console.error('\nFailed:', err instanceof Error ? err.message : err);
  console.error('\nIs Kafka running? Try:  npm run up   then  npm run topics:create');
  process.exit(1);
});
