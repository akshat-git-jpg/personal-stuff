export function spliceShotBlocks(blocks: any[], spans: any[]) {
  const result = [...blocks];
  if (!spans || !spans.length) return result;

  for (const span of spans) {
    const origSpan = span.origSpan || span; // Ensure origSpan is available
    const block = { isShot: true, start: span.start, id: `shot-${span.id}`, span, origSpan };
    
    const idx = result.findIndex(b => !b.isShot && b.start >= span.start);
    if (idx !== -1) {
      result.splice(idx, 0, block);
    } else {
      result.push(block);
    }
  }
  return result;
}
