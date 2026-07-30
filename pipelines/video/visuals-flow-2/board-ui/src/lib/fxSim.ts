export interface Fullframe {
  id: string;
  start: number;
  end: number;
}
export interface Span {
  id: string;
  start: number;
  end: number;
}
export interface FxInstance {
  type: string;
  style?: string;
  at?: number;
  enabled?: boolean;
}

export function fxContext(t: number, fullframes: Fullframe[], spans: Span[]): 'graphic' | 'avatar' | 'screen' {
  if (fullframes.some((f) => t >= f.start && t < f.end)) return 'graphic';
  if (spans.some((s) => t >= s.start && t < s.end)) return 'avatar';
  return 'screen';
}

export function fxEventsAt(prevT: number, t: number, instances: FxInstance[]): FxInstance[] {
  return instances.filter((i) => i.enabled && typeof i.at === 'number' && i.at > prevT && i.at <= t);
}
