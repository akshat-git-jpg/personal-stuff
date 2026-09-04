#!/usr/bin/env node
import process from 'node:process';

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) {
  console.log('Usage: pp-heygen-batch <video-key> [--dry-run] [--engine mlx|faster] [--drive-account <email>]');
  process.exit(0);
}

// Minimal placeholder for now. Verbs and orchestration wired in later steps.
console.log('pp-heygen-batch running...');
process.exit(0);
