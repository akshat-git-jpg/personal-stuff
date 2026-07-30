export type TileModel = {
  id: string;
  card: string;
  lead: number | '';
  fragJson: string;
  flagged: boolean;
  note: string;
};

export type CueOut = {
  id: string;
  card: string;
  anchor: string;
  hold?: number;
  variables?: Record<string, any>;
  beats?: any[];
  flagged: boolean;
  lead?: number;
  note?: string;
};

export type CollectResult =
  | { ok: true; cues: CueOut[] }
  | { ok: false; broken: string[] };

export function collectCues(tiles: TileModel[]): CollectResult {
  const broken: string[] = [];
  const cues: CueOut[] = [];

  for (const tile of tiles) {
    let fragment;
    try {
      fragment = JSON.parse(tile.fragJson);
    } catch (e: any) {
      broken.push(`${tile.id}: ${e.message}`);
      continue;
    }

    const cue: CueOut = {
      id: tile.id,
      card: tile.card,
      anchor: fragment.anchor,
      hold: fragment.hold,
      variables: fragment.variables,
      beats: fragment.beats,
      flagged: tile.flagged,
    };

    if (tile.lead !== '') cue.lead = Number(tile.lead);
    if (tile.note) cue.note = tile.note;

    cues.push(cue);
  }

  if (broken.length > 0) {
    return { ok: false, broken };
  }
  return { ok: true, cues };
}

export function collectSpans(models: { id: string; fragJson: string }[]): { ok: true; spans: unknown[] } | { ok: false; broken: string[] } {
  const shotBroken: string[] = [];
  const spans: unknown[] = [];

  for (const b of models) {
    try {
      spans.push(JSON.parse(b.fragJson));
    } catch (e: any) {
      shotBroken.push(`${b.id}: ${e.message}`);
    }
  }

  if (shotBroken.length > 0) {
    return { ok: false, broken: shotBroken };
  }
  return { ok: true, spans };
}

export function buildSavePayload(args: {
  video: string;
  approved: boolean;
  cues: CueOut[];
  feedback: Record<string, string>;
  feedbackImages?: Record<string, string | null>;
  spans?: unknown[];
  effects?: { id: string; enabled: boolean }[];
}): object {
  const payload: any = {
    video: args.video,
    approved: args.approved,
    cues: args.cues,
    feedback: args.feedback,
  };

  if (args.feedbackImages && Object.keys(args.feedbackImages).length > 0) {
    payload.feedbackImages = args.feedbackImages;
  }
  if (args.spans !== undefined) {
    payload.spans = args.spans;
  }
  if (args.effects !== undefined) {
    payload.effects = args.effects;
  }

  return payload;
}
