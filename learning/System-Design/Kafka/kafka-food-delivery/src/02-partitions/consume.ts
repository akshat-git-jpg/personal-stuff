/**
 * Chapter 2, part 2: read all 3 partitions with ONE consumer.
 *
 *   npm run ch2:consume
 *
 * One consumer alone in its group gets assigned every partition. So you see
 * all 12 messages. But look at the ORDER they arrive in. It is not the order
 * you sent them.
 *
 * Kafka drains one partition at a time. Within a partition the order is exact.
 * Across partitions there is no order at all, and there never can be, because
 * the partitions are independent files that may even live on different machines.
 *
 * This is not a bug you can configure away. It is the trade Kafka makes to go
 * fast. Understanding this one sentence is most of what "I know Kafka" means.
 *
 * Ctrl-C to stop.
 */
import { kafka, TOPICS, banner, logReceived, hint, onShutdown } from '../lib/client.js';
import type { OrderEvent } from '../lib/client.js';

const GROUP_ID = 'ch2-reader';

async function main(): Promise<void> {
  banner(
    'Chapter 2 - consuming 3 partitions with 1 consumer',
    `topic: ${TOPICS.ch2}   group: ${GROUP_ID}   (Ctrl-C to stop)`,
  );

  const consumer = kafka.consumer({
    kafkaJS: { groupId: GROUP_ID, fromBeginning: true },
  });

  await consumer.connect();
  await consumer.subscribe({ topics: [TOPICS.ch2] });

  // Count what landed where, so you get a summary instead of squinting.
  const perPartition = new Map<number, number>();
  const perCustomerPartitions = new Map<string, Set<number>>();

  const printSummary = () => {
    console.log('\n--- what you just saw ---');
    for (const [p, n] of [...perPartition.entries()].sort((a, b) => a[0] - b[0])) {
      console.log(`  partition ${p}: ${n} message(s)`);
    }
    console.log('\n  customer -> partitions it landed on');
    for (const [cust, parts] of [...perCustomerPartitions.entries()].sort()) {
      const list = [...parts].sort().join(', ');
      const verdict = parts.size === 1 ? 'ordered' : 'SPLIT - order lost';
      console.log(`  ${cust.padEnd(14)} [${list}]   ${verdict}`);
    }
    console.log(
      '\n  Keyed messages stuck to one partition. Unkeyed ones did not.\n',
    );
  };

  onShutdown(async () => {
    printSummary();
    await consumer.disconnect();
  });

  hint('waiting for messages... (summary prints when you press Ctrl-C)\n');

  await consumer.run({
    eachMessage: async ({ partition, message }) => {
      const order = JSON.parse(message.value!.toString()) as OrderEvent;
      const key = message.key?.toString() ?? '(none)';

      perPartition.set(partition, (perPartition.get(partition) ?? 0) + 1);
      if (key !== '(none)') {
        if (!perCustomerPartitions.has(key)) perCustomerPartitions.set(key, new Set());
        perCustomerPartitions.get(key)!.add(partition);
      }

      logReceived({ who: 'reader', partition, offset: message.offset, key, order });
    },
  });
}

main().catch((err) => {
  console.error('\nFailed:', err instanceof Error ? err.message : err);
  console.error('\nIs Kafka running? Try:  npm run up   then  npm run topics:create');
  process.exit(1);
});
