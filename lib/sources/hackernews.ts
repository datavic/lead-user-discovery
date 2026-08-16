import { Candidate } from "@/lib/types";

const HN_SEARCH_URL = "https://hn.algolia.com/api/v1/search";

export async function searchHackerNews(query: string, limit = 15): Promise<Candidate[]> {
  // Algolia treats a bare comma as AND, so `tags=story,comment` matches nothing.
  // Parentheses are required for OR.
  const url = `${HN_SEARCH_URL}?query=${encodeURIComponent(query)}&tags=${encodeURIComponent(
    "(story,comment)"
  )}&hitsPerPage=${limit}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Hacker News search failed (${res.status})`);
  }

  const data = await res.json();
  const hits: any[] = data?.hits || [];

  return hits.map((hit) => {
    const isComment = hit._tags?.includes("comment");
    const text: string = isComment ? hit.comment_text : hit.story_text || hit.title || "";
    const plain = stripHtml(text).slice(0, 600);

    return {
      source: "hackernews" as const,
      url: isComment
        ? `https://news.ycombinator.com/item?id=${hit.objectID}`
        : hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      author: hit.author || "unknown",
      title: hit.title || (isComment ? "Comment on Hacker News" : "Hacker News post"),
      snippet: plain,
      date: hit.created_at || null,
    };
  });
}

function stripHtml(input: string): string {
  return (input || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
