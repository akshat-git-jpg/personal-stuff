/**
 * Chapter 1, part 2: read the messages back.
 *
 *   npm run ch1:consume
 *
 * This process does NOT exit. That is correct and it is the point. A consumer
 * is a long-running service, not a script that finishes. It reads everything
 * that exists, then sits there waiting for the next message.
 *
 * Leave it running. In a SECOND terminal run `npm run ch1:produce` again, and
 * watch the new orders appear here within a second.
 *
 * Stop it with Ctrl-C.
 */
import { kafka, TOPICS, banner, logReceived, hint, onShutdown } from '../lib/client.js';
import type { OrderEvent } from '../lib/client.js';

/**
 * A `groupId` is a name you invent. Kafka uses it as a bookmark label:
 * "how far has the group called ch1-kitchen read?" That bookmark survives
 * restarts, which is why a crashed consumer resumes instead of starting over.
 *
 * Change this string and re-run, and you will re-read all 5 messages from the
 * start, because a new name means a brand new bookmark.
 */
const GROUP_ID = 'ch1-kitchen';

async function main(): Promise<void> {
  banner(
    'Chapter 1 - consuming',
    `topic: ${TOPICS.ch1}   group: ${GROUP_ID}   (Ctrl-C to stop)`,
  );

  const consumer = kafka.consumer({
    kafkaJS: {
      groupId: GROUP_ID,
      // Only applies the FIRST time this group ever runs. After that, Kafka has
      // a saved bookmark and uses it instead.
      fromBeginning: true,
    },
  });

  await consumer.connect();
  await consumer.subscribe({ topics: [TOPICS.ch1] });

  hint('waiting for messages...\n');

  onShutdown(async () => {
    await consumer.disconnect();
  });

  await consumer.run({
    eachMessage: async ({ partition, message }) => {
      const order = JSON.parse(message.value!.toString()) as OrderEvent;
      logReceived({
        who: 'kitchen',
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
