export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { isLlmConfigured } from "@/lib/llm";
import { runDiscovery } from "@/lib/discover";
import { D1Database, recordSweep } from "@/lib/db";

/**
 * Topics swept every day. Kept deliberately short: each one costs a full
 * multi-source run plus LLM classification, and free tiers are the binding
 * constraint.
 */
const DAILY_TOPICS = (process.env.SWEEP_TOPICS || "Advanced OpenAI / ChatGPT users")
  .split(",")
  .map((topic) => topic.trim())
  .filter(Boolean);

function getDb(): D1Database | null {
  // next-on-pages exposes bindings on the Cloudflare env at runtime.
  return (process.env as unknown as { DB?: D1Database }).DB || null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.SWEEP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SWEEP_SECRET is not configured." }, { status: 500 });
  }

  // The endpoint writes to the database and spends API quota, so it must not
  // be publicly triggerable.
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isLlmConfigured()) {
    return NextResponse.json({ error: "No LLM provider configured." }, { status: 400 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "No D1 binding named DB. Check wrangler.toml and the Pages project settings." },
      { status: 500 }
    );
  }

  const summary: { topic: string; found: number; new: number; error?: string }[] = [];

  for (const topic of DAILY_TOPICS) {
    try {
      const { candidates, sourceNotes } = await runDiscovery([topic]);
      const { newUrls } = await recordSweep(db, topic, candidates, sourceNotes);
      summary.push({ topic, found: candidates.length, new: newUrls.length });
    } catch (err: any) {
      console.error(`[sweep] "${topic}" failed: ${err?.message}`);
      summary.push({ topic, found: 0, new: 0, error: err?.message || "sweep failed" });
    }
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), summary });
}
