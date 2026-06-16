// Client-side API wrappers + shared types (mirror of the worker's analytics types).

export interface LinkStat {
  slug: string;
  tool: string;
  target_url: string;
  short_url: string;
  clicks_30d: number;
  clicks_all: number;
}

export interface VideoStat {
  video_code: string;
  video_title: string;
  yt_video_id: string | null;
  views: number | null;
  total_30d: number;
  total_all: number;
  links: LinkStat[];
}

export interface VideosResponse {
  videos: VideoStat[];
  generated_at: number;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthorizedError";
  }
}

export async function fetchVideos(): Promise<VideosResponse> {
  const res = await fetch("/api/videos", { credentials: "same-origin" });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`Failed to load data (${res.status})`);
  return (await res.json()) as VideosResponse;
}

export async function login(password: string): Promise<void> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    credentials: "same-origin",
  });
  if (res.status === 401) throw new Error("Wrong password");
  if (!res.ok) throw new Error(`Login failed (${res.status})`);
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
}
