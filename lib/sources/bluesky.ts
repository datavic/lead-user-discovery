import { Candidate } from "@/lib/types";

const BSKY_SEARCH = "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts";

/**
 * Bluesky's public AppView needs no authentication. It has become the main
 * home for the scientists, academics and journalists who left Twitter, which
 * makes it the best free stand-in for X (whose search API is paid-only).
 */
export async function searchBluesky(query: string, limit = 15): Promise<Candidate[]> {
  const url = `${BSKY_SEARCH}?q=${encodeURIComponent(query)}&limit=${limit}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "lead-user-discovery/0.1", Accept: "application/json" },
  });

  if (!res.ok) {
    // Include the body: a 403 from Bluesky itself (JSON with an error name)
    // means something different from a 403 served by an intermediary.
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`Bluesky search failed (${res.status}): ${detail}`);
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
