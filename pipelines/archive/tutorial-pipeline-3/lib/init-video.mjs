import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
let slug = null;
let root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--root') {
    root = args[++i];
  } else if (!slug) {
    slug = args[i];
  }
}

if (!slug) {
  console.error("usage: node lib/init-video.mjs <slug> [--root <dir>]");
  process.exit(1);
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error(`Invalid slug: ${slug}`);
  process.exit(1);
}

const videoDir = path.join(root, 'videos', slug);

if (fs.existsSync(videoDir)) {
  console.error(`Directory already exists: ${videoDir}`);
  process.exit(1);
}

fs.mkdirSync(path.join(videoDir, 'inputs', 'transcripts'), { recursive: true });

const topicContent = `# Topic

<one line: the video's topic>

## Channel

<channel slug>

## Target length

<minutes>
`;

const visionContent = `# Vision

<owner's notes: angle, must-cover points, verdict if any>
`;

fs.writeFileSync(path.join(videoDir, 'inputs', 'topic.md'), topicContent);
fs.writeFileSync(path.join(videoDir, 'inputs', 'vision.md'), visionContent);
console.log(`Initialized ${videoDir}`);
