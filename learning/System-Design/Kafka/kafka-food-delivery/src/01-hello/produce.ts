/**
 * Chapter 1, part 1: send a message.
 *
 *   npm run ch1:produce
 *
 * Five food orders go into the topic `ch1-orders`. That topic has exactly one
 * partition, so there is one line of messages and nothing to be confused about.
 *
 * Watch the `offset` column. It counts 0, 1, 2, 3, 4. That number is the whole
 * idea of Kafka: a message is not deleted when it is read. It sits at a fixed
 * position in a numbered list, and readers remember which number they reached.
 */
import { kafka, TOPICS, makeOrder, banner, logSent, hint } from '../lib/client.js';

async function main(): Promise<void> {
  banner(
    'Chapter 1 - producing to a 1-partition topic',
    `topic: ${TOPICS.ch1}`,
  );

  const producer = kafka.producer();
  await producer.connect();

  for (let i = 0; i < 5; i++) {
    const order = makeOrder(i);

    // `value` must be bytes or a string. Kafka itself does not care what is
    // inside. It never parses your message. JSON is a choice we are making,
    // not something Kafka requires. (Chapter 8 replaces it with a schema.)
    const result = await producer.send({
      topic: TOPICS.ch1,
      messages: [{ value: JSON.stringify(order) }],
    });

    const meta = result[0];
    logSent({
      topic: TOPICS.ch1,
      partition: meta.partition ?? 0,
      offset: String(meta.baseOffset ?? meta.offset ?? '?'),
      key: '(none)',
      order,
    });
  }

  await producer.disconnect();

  hint(
    '\nDone. Two things to do now:' +
      '\n  1. Open http://localhost:8080 -> Topics -> ch1-orders -> Messages. Your 5 orders are there.' +
      '\n  2. Run this script AGAIN. The offsets keep counting: 5, 6, 7, 8, 9.' +
      '\n     Nothing was overwritten. Kafka only ever appends.',
  );
}

main().catch((err) => {
  console.error('\nFailed:', err instanceof Error ? err.message : err);
  console.error('\nIs Kafka running? Try:  npm run up   then  npm run topics:create');
  process.exit(1);
});
