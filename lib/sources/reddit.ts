import { Candidate } from "@/lib/types";

const USER_AGENT = "lead-user-discovery/0.1";

export async function getRedditAccessToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const basic = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Reddit auth failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("Reddit auth did not return an access token");
  }
  return data.access_token as string;
}

export async function searchReddit(query: string, token: string, limit = 15): Promise<Candidate[]> {
  const url = `https://oauth.reddit.com/search?q=${encodeURIComponent(
    query
  )}&sort=relevance&limit=${limit}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Reddit search failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const children: any[] = data?.data?.children || [];

  return children.map((child) => {
    const post = child.data;
    return {
      source: "reddit" as const,
      url: `https://www.reddit.com${post.permalink}`,
      author: post.author || "unknown",
      title: post.title || "Reddit post",
      snippet: (post.selftext || "").slice(0, 600) || post.title || "",
      date: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null,
    };
  });
}

/**
 * Credential-free fallback. Reddit's JSON API now 403s unauthenticated
 * callers, but the Atom feed behind /search.rss is still open, which keeps
 * the most valuable source working without an API app.
 */
export async function searchRedditRss(query: string, limit = 15): Promise<Candidate[]> {
  const url = `https://www.reddit.com/search.rss?q=${encodeURIComponent(
    query
  )}&sort=relevance&limit=${limit}`;

  // Anonymous RSS tolerates only about one request every few seconds, so a
  // 429 is expected rather than exceptional. Back off and retry.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });

    if (res.ok) return parseRedditFeed(await res.text());

    if (res.status !== 429 || attempt >= 3) {
      // 403 here usually means the caller's IP range is blocked outright
      // (Reddit blocks datacenter ranges), which is worth distinguishing from
      // ordinary rate limiting.
      const hint =
        res.status === 403
          ? " — Reddit blocks datacenter IPs; set REDDIT_CLIENT_ID/SECRET to use the OAuth API instead"
          : "";
      throw new Error(`Reddit RSS search failed (${res.status})${hint}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000 * (attempt + 1)));
  }
}

function parseRedditFeed(xml: string): Candidate[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  const candidates: Candidate[] = [];

  for (const entry of entries) {
    const url = entry.match(/<link href="([^"]+)"/)?.[1];
    // Search also returns subreddit profiles; only real posts have /comments/.
    if (!url || !url.includes("/comments/")) continue;

    const title = decodeEntities(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "Reddit post");
    const author = entry.match(/<name>([\s\S]*?)<\/name>/)?.[1]?.replace(/^\/u\//, "") || "unknown";
    const rawBody = entry.match(/<content type="html">([\s\S]*?)<\/content>/)?.[1] || "";
    const body = stripHtml(decodeEntities(decodeEntities(rawBody)));

    candidates.push({
      source: "reddit",
      url: decodeEntities(url),
      author,
      title,
      snippet: (body || title).slice(0, 600),
      date: entry.match(/<updated>([\s\S]*?)<\/updated>/)?.[1] || null,
    });
  }

  return candidates;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
