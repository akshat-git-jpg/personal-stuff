/**
 * Topic admin for the lab.
 *
 *   npm run topics:create     make the three chapter topics
 *   npm run topics:list       show every topic on the broker
 *   npm run topics:describe   show partitions and which broker leads each one
 *   npm run topics:nuke       delete the chapter topics (start over)
 *
 * We create topics on purpose instead of letting Kafka auto-create them,
 * because auto-create is off in docker-compose.yml. That is deliberate:
 * in production auto-create turns a typo into a silent, empty, permanent
 * topic that nobody notices for six months.
 */
import { kafka, TOPICS, banner, hint } from './client.js';

/** How each chapter's topic is shaped, and why. */
const TOPIC_SPECS = [
  {
    topic: TOPICS.ch1,
    numPartitions: 1,
    why: 'Chapter 1. One partition, so there is exactly one line of messages and nothing to be confused about.',
  },
  {
    topic: TOPICS.ch2,
    numPartitions: 3,
    why: 'Chapter 2. Three partitions, so you can watch keys decide which partition an order lands in.',
  },
  {
    topic: TOPICS.ch3,
    numPartitions: 3,
    why: 'Chapter 3. Three partitions, so up to three consumers in a group can share the work.',
  },
];

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'list';
  const admin = kafka.admin();
  await admin.connect();

  try {
    if (command === 'create') {
      banner('Creating the chapter topics');
      const existing = new Set(await admin.listTopics());

      for (const spec of TOPIC_SPECS) {
        if (existing.has(spec.topic)) {
          console.log(`  already there  ${spec.topic}`);
          continue;
        }
        await admin.createTopics({
          topics: [
            {
              topic: spec.topic,
              numPartitions: spec.numPartitions,
              // 1 copy of each partition, because we run 1 broker.
              // Production is almost always 3.
              replicationFactor: 1,
            },
          ],
        });
        console.log(`  created        ${spec.topic}  (${spec.numPartitions} partition(s))`);
        hint(`                 ${spec.why}`);
      }
      hint('\nNow open http://localhost:8080 and click Topics. You should see all three.');
    } else if (command === 'list') {
      banner('Every topic on this broker');
      const topics = (await admin.listTopics()).sort();
      for (const t of topics) {
        // Names starting with __ are Kafka's own bookkeeping. __consumer_offsets
        // is where Kafka remembers how far each consumer group has read.
        const mine = t.startsWith('__') ? '  (Kafka internal)' : '';
        console.log(`  ${t}${mine}`);
      }
      hint(`\n${topics.length} topic(s).`);
    } else if (command === 'describe') {
      banner('Partition layout');
      const wanted = TOPIC_SPECS.map((s) => s.topic);
      const existing = new Set(await admin.listTopics());
      const present = wanted.filter((t) => existing.has(t));

      if (present.length === 0) {
        hint('None of the chapter topics exist yet. Run: npm run topics:create');
        return;
      }

      // Returns one entry per topic, each with its partition list.
      const meta = await admin.fetchTopicMetadata({ topics: present });
      for (const t of meta) {
        console.log(`\n  ${t.name}`);
        for (const p of t.partitions) {
          console.log(
            `    partition ${p.partitionId}` +
              `   leader broker ${p.leader}` +
              `   replicas [${p.replicas.join(', ')}]` +
              `   in-sync [${p.isr.join(', ')}]`,
          );
        }
      }
      hint(
        '\n"leader" = the broker that handles all reads and writes for that partition.' +
          '\n"in-sync" = the copies that are fully caught up. With 1 broker, always just [1].' +
          '\nWith 3 brokers this is where you would watch failover happen.',
      );
    } else if (command === 'nuke') {
      banner('Deleting the chapter topics');
      const existing = new Set(await admin.listTopics());
      const present = TOPIC_SPECS.map((s) => s.topic).filter((t) => existing.has(t));
      if (present.length === 0) {
        hint('Nothing to delete.');
        return;
      }
      await admin.deleteTopics({ topics: present });
      for (const t of present) console.log(`  deleted  ${t}`);
      hint('\nRun: npm run topics:create   to make them again, empty.');
    } else {
      console.error(`Unknown command "${command}". Use: create | list | describe | nuke`);
      process.exitCode = 1;
    }
  } finally {
    await admin.disconnect();
  }
}

main().catch((err) => {
  console.error('\nFailed:', err instanceof Error ? err.message : err);
  console.error(
    '\nIf this says "connection refused" or "all broker connections down",' +
      '\nKafka is probably not running. Start it with:  npm run up',
  );
  process.exit(1);
});
