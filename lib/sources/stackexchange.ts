import { Candidate } from "@/lib/types";

const SE_API = "https://api.stackexchange.com/2.3/search/excerpts";

/**
 * Deliberately non-programming sites. Stack Overflow surfaces developers, who
 * GitHub already covers; these are where domain experts (growers, makers,
 * clinicians, pilots, researchers) describe their real workflows.
 */
export const SE_SITES = ["academia", "gardening", "cooking", "diy", "outdoors", "engineering"];

/**
 * Anonymous callers get 300 requests/day, and each site costs one request, so
 * callers should pass the bare topic rather than every phrase variation.
 */
export async function searchStackExchange(
  query: string,
  site: string,
  limit = 10
): Promise<Candidate[]> {
  const url =
    `${SE_API}?order=desc&sort=relevance&q=${encodeURIComponent(query)}` +
    `&site=${encodeURIComponent(site)}&pagesize=${limit}`;

  const res = await fetch(url, { headers: { "User-Agent": "lead-user-discovery/0.1" } });

  if (!res.ok) {
    throw new Error(`Stack Exchange (${site}) search failed (${res.status})`);
  }

  const data = await res.json();
  if (data?.error_message) {
    throw new Error(`Stack Exchange (${site}): ${data.error_message}`);
  }

  const items: any[] = data?.items || [];

  return items.flatMap((item) => {
    const id = item.question_id;
    if (!id) return [];

    return [
      {
        source: "stackexchange" as const,
        url: siteUrl(site, id),
        author: item.owner?.display_name || "unknown",
        title: decodeEntities(item.title || "Stack Exchange question"),
        snippet: decodeEntities(item.excerpt || item.title || "").slice(0, 600),
        date: item.creation_date ? new Date(item.creation_date * 1000).toISOString() : null,
      },
    ];
  });
}

function siteUrl(site: string, questionId: number): string {
  // Stack Overflow and a few others sit on their own domain rather than
  // <site>.stackexchange.com.
  const ownDomain: Record<string, string> = {
    stackoverflow: "stackoverflow.com",
    serverfault: "serverfault.com",
    superuser: "superuser.com",
    askubuntu: "askubuntu.com",
    mathoverflow: "mathoverflow.net",
  };
  const host = ownDomain[site] || `${site}.stackexchange.com`;
  return `https://${host}/q/${questionId}`;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
