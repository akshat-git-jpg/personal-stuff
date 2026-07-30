export interface BoardData {
  video: string;
  videos: string[];
  cards: any[]; // Placeholder for actual schema if needed
  cues?: any[];
  transcript?: any;
  feedback?: any[];
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
