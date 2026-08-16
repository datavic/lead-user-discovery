import { Candidate } from "@/lib/types";

const GITHUB_API = "https://api.github.com";

export async function searchGithub(query: string, limit = 15): Promise<Candidate[]> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "lead-user-discovery",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${GITHUB_API}/search/issues?q=${encodeURIComponent(
    query
  )}&sort=updated&order=desc&per_page=${limit}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub search failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const items: any[] = data?.items || [];

  return items.map((item) => ({
    source: "github" as const,
    url: item.html_url,
    author: item.user?.login || "unknown",
    title: item.title || "GitHub issue/PR",
    snippet: (item.body || "").slice(0, 600),
    date: item.updated_at || item.created_at || null,
  }));
}
