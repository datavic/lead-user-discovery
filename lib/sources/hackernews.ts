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
      // Comments carry no title of their own. Falling back to a constant made
      // every comment row read "Comment on Hacker News", so derive a label
      // from the opening words instead.
      title: hit.title || summarise(plain) || (isComment ? "Comment on Hacker News" : "Hacker News post"),
      snippet: plain,
      date: hit.created_at || null,
    };
  });
}

/** First sentence (or opening clause) of a comment, for use as a title. */
function summarise(text: string): string {
  if (!text) return "";

  const sentence = text.split(/(?<=[.!?])\s/)[0] || text;
  if (sentence.length <= 90) return sentence.trim();

  const truncated = sentence.slice(0, 90);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, lastSpace > 40 ? lastSpace : 90).trim()}…`;
}

function stripHtml(input: string): string {
  return (input || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
