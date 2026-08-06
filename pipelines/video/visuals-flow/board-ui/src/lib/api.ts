export interface BoardData {
  video: string;
  videos: string[];
  cards: any[];
  cues?: any[];
  transcript?: any;
  feedback?: Record<string, any>;
  cardPlan?: {
    approved: boolean;
    sections: any[];
    comments: Record<string, any[]>;
  };
  // plan 193: the owner's kickoff choices for this video (step 005) and which
  // board tabs this run actually reviews, both derived server-side from the
  // step registry + run-config.json.
  runConfig: { engine: string; review: string; intro: string; configured: boolean };
  tabs: string[];
}

export async function fetchBoardData(video: string | null): Promise<BoardData> {
  const url = video ? `/api/board-data?video=${encodeURIComponent(video)}` : '/api/board-data';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch board data: ${res.status}`);
  return res.json();
}

export async function fetchRunLog(video: string) {
  const res = await fetch(`/run-log?video=${encodeURIComponent(video)}`);
  if (!res.ok) throw new Error(`Failed to fetch run log: ${res.status}`);
  return res.json();
}

export async function fetchRunVideos() {
  const res = await fetch('/run-videos');
  if (!res.ok) throw new Error(`Failed to fetch run videos: ${res.status}`);
  return res.json();
}
