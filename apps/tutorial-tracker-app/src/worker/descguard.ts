/** Compares each published video's real YouTube description with the links minted for it. Only `fetchDescriptions` does I/O. */
import type { GuardIssue } from "./linkguard";

export interface DescVideo { video_code: string; yt_video_id: string; title: string; description: string }
export interface DescInput {
  videos: DescVideo[];
  /** Every minted link: slug is `<video_code>/<tool>`. */
  links: { slug: string; video_code: string; tool: string }[];
  /** Affiliate programmes, so a raw tool URL pasted instead of a short link is caught. */
  programs: { slug: string; kind: string; target_url: string }[];
  /** Every short-link domain in use, e.g. go.agrolloo.com. */
  linkDomains: string[];
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hostOf = (raw: string): string | null => {
  try { return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return null; }
};

/** Short-link slugs (`code/tool`) found in a description. */
export function shortSlugsIn(description: string, linkDomains: string[]): string[] {
  const out = new Set<string>();
  for (const domain of linkDomains) {
    const re = new RegExp(`(?:https?://)?(?:www\\.)?${esc(domain)}/([A-Za-z0-9]+)/([A-Za-z0-9._-]+)`, "gi");
    for (const m of description.matchAll(re)) out.add(`${m[1]}/${m[2].replace(/[.,;:!?]+$/, "")}`);
  }
  return [...out];
}

export function descriptionIssues(input: DescInput): GuardIssue[] {
  const issues: GuardIssue[] = [];
  const linkBySlug = new Map(input.links.map((l) => [l.slug, l]));
  const shortHosts = new Set(input.linkDomains.map((d) => d.toLowerCase()));
  const toolByHost = new Map<string, string>();
  for (const p of input.programs) {
    if (p.kind !== "affiliate" || !p.target_url) continue;
    const host = hostOf(p.target_url);
    if (host && !shortHosts.has(host) && !toolByHost.has(host)) toolByHost.set(host, p.slug);
  }

  for (const v of input.videos) {
    const studio = `https://studio.youtube.com/video/${v.yt_video_id}/edit`;
    const found = shortSlugsIn(v.description, input.linkDomains);
    for (const slug of found) {
      const link = linkBySlug.get(slug);
      if (!link) {
        issues.push({ code: "desc_unknown_link", slug, url: studio, detail: `"${v.title}" links to /${slug}, which was never minted, so it goes nowhere.` });
      } else if (link.video_code !== v.video_code) {
        issues.push({ code: "desc_wrong_video", slug, url: studio, detail: `"${v.title}" uses /${slug}, which belongs to another video, so its clicks are counted there.` });
      }
    }
    const foundSet = new Set(found);
    for (const link of input.links) {
      if (link.video_code === v.video_code && !foundSet.has(link.slug)) {
        issues.push({ code: "desc_missing_link", slug: link.slug, url: studio, detail: `Minted for "${v.title}" but not in its YouTube description.` });
      }
    }
    const rawTools = new Set<string>();
    for (const m of v.description.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)) {
      const tool = toolByHost.get(hostOf(m[0]) ?? "");
      if (tool && !rawTools.has(tool)) {
        rawTools.add(tool);
        issues.push({ code: "desc_raw_link", slug: `${v.video_code}/${tool}`, url: studio, detail: `"${v.title}" links straight to ${m[0]} instead of a short link, so its clicks are not tracked.` });
      }
    }
  }
  return issues;
}

/** Title + description per YouTube id, 50 per call (1 quota unit each). Throws on an API error. */
export async function fetchDescriptions(ids: string[], apiKey: string, fetchFn: typeof fetch = fetch): Promise<Map<string, { title: string; description: string }>> {
  const out = new Map<string, { title: string; description: string }>();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const res = await fetchFn(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${batch.join(",")}&key=${encodeURIComponent(apiKey)}`);
    if (!res.ok) throw new Error(`YouTube videos.list ${res.status}`);
    const json = await res.json() as { items?: { id: string; snippet?: { title?: string; description?: string } }[] };
    for (const it of json.items ?? []) out.set(it.id, { title: it.snippet?.title ?? "", description: it.snippet?.description ?? "" });
  }
  return out;
}
