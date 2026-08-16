import { Candidate } from "@/lib/types";

const PUBLIC_APPVIEW = "https://public.api.bsky.app";
const AUTH_HOST = "https://bsky.social";
const USER_AGENT = "lead-user-discovery/0.1";

/**
 * Bluesky is the main home for the scientists, academics and journalists who
 * left Twitter, which makes it the best free stand-in for X (whose search API
 * is paid-only).
 *
 * The unauthenticated AppView refuses post search from most hosts, so a
 * session is used when credentials are present and the public endpoint is only
 * a fallback.
 */
export function isBlueskyConfigured(): boolean {
  return Boolean(process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_APP_PASSWORD);
}

let cachedSession: { jwt: string; expiresAt: number } | null = null;

async function getAccessJwt(): Promise<string | null> {
  const identifier = process.env.BLUESKY_IDENTIFIER;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!identifier || !password) return null;

  // Sessions last well beyond a single sweep; re-use within a process.
  if (cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession.jwt;
  }

  const res = await fetch(`${AUTH_HOST}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({ identifier, password }),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(
      `Bluesky login failed (${res.status}): ${detail} — check BLUESKY_IDENTIFIER is your handle ` +
        `(e.g. name.bsky.social) and BLUESKY_APP_PASSWORD is an app password, not your account password`
    );
  }

  const data = await res.json();
  if (!data?.accessJwt) throw new Error("Bluesky login returned no access token");

  cachedSession = { jwt: data.accessJwt, expiresAt: Date.now() + 60 * 60 * 1000 };
  return data.accessJwt;
}

export async function searchBluesky(query: string, limit = 15): Promise<Candidate[]> {
  const jwt = await getAccessJwt();

  const host = jwt ? AUTH_HOST : PUBLIC_APPVIEW;
  const url = `${host}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${limit}`;

  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;

  const res = await fetch(url, { headers });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 160);
    const hint = jwt ? "" : " — set BLUESKY_IDENTIFIER/BLUESKY_APP_PASSWORD; anonymous search is refused";
    throw new Error(`Bluesky search failed (${res.status})${hint}: ${detail}`);
  }

  const data = await res.json();
  const posts: any[] = data?.posts || [];

  return posts.flatMap((post) => {
    const text: string = post?.record?.text || "";
    const handle: string = post?.author?.handle || "unknown";

    // at://did:plc:xxx/app.bsky.feed.post/<rkey> -> web permalink
    const rkey = typeof post?.uri === "string" ? post.uri.split("/").pop() : null;
    if (!rkey || !text) return [];

    return [
      {
        source: "bluesky" as const,
        url: `https://bsky.app/profile/${handle}/post/${rkey}`,
        author: handle,
        title: text.split("\n")[0].slice(0, 120) || "Bluesky post",
        snippet: text.slice(0, 600),
        date: post?.record?.createdAt || post?.indexedAt || null,
      },
    ];
  });
}
