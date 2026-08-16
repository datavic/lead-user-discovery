export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { chatJSON, isLlmConfigured } from "@/lib/llm";
import { AnalogousResponse } from "@/lib/types";

const SYSTEM_PROMPT = `You are helping with Eric von Hippel-style lead user research. Given a topic/domain, \
suggest 3-5 analogous or adjacent markets that plausibly face the same underlying bottleneck or need, \
but in a different context (often a harsher or more extreme environment, which surfaces the need earlier). \
Respond ONLY with JSON: {"markets": [{"domain": string, "rationale": string}]}.`;

export async function POST(req: NextRequest) {
  if (!isLlmConfigured()) {
    return NextResponse.json(
      { error: "No LLM provider configured. Set GROQ_API_KEY or OPENAI_API_KEY (see .env.example)." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const topic: string | undefined = body.topic;

  if (!topic) {
    return NextResponse.json({ error: "A topic is required." }, { status: 400 });
  }

  try {
    const result = await chatJSON<AnalogousResponse>([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Topic: ${topic}` },
    ]);
    return NextResponse.json<AnalogousResponse>(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to generate analogous markets." }, { status: 500 });
  }
}
