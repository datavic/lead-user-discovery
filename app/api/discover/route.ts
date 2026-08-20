export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { DiscoverResponse } from "@/lib/types";
import { isLlmConfigured } from "@/lib/llm";
import { runDiscovery } from "@/lib/discover";

const LIVE_MAX_CANDIDATES = Number(process.env.LIVE_MAX_CANDIDATES || 6);

export async function POST(req: NextRequest) {
  if (!isLlmConfigured()) {
    return NextResponse.json(
      { error: "No LLM provider configured. Set GROQ_API_KEY or OPENAI_API_KEY (see .env.example)." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const topics: string[] = [
    body.topic,
    ...(Array.isArray(body.extraTopics) ? body.extraTopics : []),
  ].filter(Boolean);

  if (topics.length === 0) {
    return NextResponse.json({ error: "A search topic is required." }, { status: 400 });
  }

  // An interactive request must finish inside the hosting timeout, so it
  // classifies far fewer candidates than the nightly sweep does.
  const result = await runDiscovery(topics, { maxCandidates: LIVE_MAX_CANDIDATES });
  return NextResponse.json<DiscoverResponse>(result);
}
