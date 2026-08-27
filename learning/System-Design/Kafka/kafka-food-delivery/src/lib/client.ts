/**
 * Shared Kafka setup for every experiment.
 *
 * We use @confluentinc/kafka-javascript. Under the hood it is librdkafka, the
 * same C engine the Python, Go, C# and PHP clients use. So the behaviour you
 * see here is real Kafka behaviour, not a JavaScript approximation.
 *
 * The `.KafkaJS` namespace is a friendly wrapper whose shape matches the old
 * `kafkajs` package, so any tutorial you read online still applies.
 */
import { KafkaJS } from '@confluentinc/kafka-javascript';

const { Kafka, logLevel } = KafkaJS;

/**
 * The address of our broker as seen from your Mac.
 *
 * "bootstrap" server is a slightly odd name. You are not saying "this is THE
 * broker". You are saying "ask this broker who else exists". The client then
 * gets the full list and connects directly to whichever broker owns the
 * partition it needs. With 1 broker that list is just this one.
 */
export const BROKERS = ['localhost:9092'];

export const kafka = new Kafka({
  kafkaJS: {
    brokers: BROKERS,
    clientId: 'kafka-lab',
    // ERROR keeps the output readable. Bump to logLevel.INFO if you want to
    // watch the client's own chatter (useful once, noisy after).
    logLevel: logLevel.ERROR,
  },
});

// ---------------------------------------------------------------------------
// The food delivery domain we use in every chapter.
// ---------------------------------------------------------------------------

/** Topic names, one per chapter, so experiments never pollute each other. */
export const TOPICS = {
  ch1: 'ch1-orders',
  ch2: 'ch2-orders',
  ch3: 'ch3-orders',
} as const;

export type OrderEvent = {
  orderId: string;
  customerId: string;
  restaurant: string;
  item: string;
  amountRupees: number;
  status: 'PLACED' | 'ACCEPTED' | 'COOKING' | 'PICKED_UP' | 'DELIVERED';
  at: string;
};

const CUSTOMERS = ['cust-anita', 'cust-rahul', 'cust-meera', 'cust-dev'];
const RESTAURANTS = ['Biryani House', 'Dosa Corner', 'Punjabi Dhaba', 'Sushi Bay'];
const ITEMS = ['Chicken Biryani', 'Masala Dosa', 'Butter Naan', 'Salmon Roll', 'Paneer Tikka'];

let orderCounter = 0;

/**
 * Makes a fake order. Deterministic-ish so output is easy to read:
 * customers cycle in a fixed order, which makes partition behaviour obvious
 * in chapter 2.
 */
export function makeOrder(n = orderCounter++): OrderEvent {
  const customerId = CUSTOMERS[n % CUSTOMERS.length];
  return {
    orderId: `ord-${String(1000 + n)}`,
    customerId,
    restaurant: RESTAURANTS[n % RESTAURANTS.length],
    item: ITEMS[n % ITEMS.length],
    amountRupees: 150 + (n % 12) * 45,
    status: 'PLACED',
    at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Printing helpers. The whole point of this lab is SEEING what happens, so
// the console output is treated as a first-class feature.
// ---------------------------------------------------------------------------

const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const COLORS = ['\x1b[36m', '\x1b[33m', '\x1b[35m', '\x1b[32m', '\x1b[34m', '\x1b[31m'];

/** A stable colour per partition, so your eye can group messages instantly. */
export function partitionColor(partition: number): string {
  return COLORS[partition % COLORS.length];
}

export function banner(title: string, subtitle?: string): void {
  console.log('');
  console.log(`${BOLD}${title}${RESET}`);
  if (subtitle) console.log(`${DIM}${subtitle}${RESET}`);
  console.log(`${DIM}${'-'.repeat(72)}${RESET}`);
}

export function logSent(args: {
  topic: string;
  partition: number;
  offset: string;
  key: string;
  order: OrderEvent;
}): void {
  const c = partitionColor(args.partition);
  console.log(
    `${c}SENT${RESET}  ` +
      `partition ${c}${args.partition}${RESET}  ` +
      `offset ${String(args.offset).padStart(4)}  ` +
      `key ${args.key.padEnd(12)}  ` +
      `${args.order.orderId}  ${DIM}${args.order.item}${RESET}`,
  );
}

export function logReceived(args: {
  who: string;
  partition: number;
  offset: string;
  key: string;
  order: OrderEvent;
}): void {
  const c = partitionColor(args.partition);
  console.log(
    `${c}RECV${RESET}  ` +
      `${BOLD}${args.who.padEnd(10)}${RESET}  ` +
      `partition ${c}${args.partition}${RESET}  ` +
      `offset ${String(args.offset).padStart(4)}  ` +
      `key ${args.key.padEnd(12)}  ` +
      `${args.order.orderId}  ${DIM}${args.order.item}${RESET}`,
  );
}

export function hint(text: string): void {
  console.log(`${DIM}${text}${RESET}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ctrl-C handling. Kafka consumers must disconnect cleanly, otherwise the
 * broker waits out a timeout before noticing they are gone. That delay is
 * real and you will see it in chapter 3 if you kill a consumer with -9.
 */
export function onShutdown(fn: () => Promise<void>): void {
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    console.log('\nshutting down cleanly...');
    try {
      await fn();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}
