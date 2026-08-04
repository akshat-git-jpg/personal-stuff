export interface Block {
  id: string;
  start: number;
  kind: 'cue' | 'gap';
}

export function playthroughView(blocks: Block[], t: number): { kind: 'cue' | 'gap'; id: string; nextStart?: number | null } | null {
  let active = null;
  for (const b of blocks) {
    if (b.start <= t) active = b;
  }
  if (!active) return null;
  if (active.kind === 'gap') {
    const next = blocks.find((b) => b.kind === 'cue' && b.start > active.start);
    return { kind: 'gap', id: active.id, nextStart: next ? next.start : null };
  }
  return { kind: 'cue', id: active.id };
}
