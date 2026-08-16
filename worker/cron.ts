/**
 * Scheduled trigger for the daily sweep.
 *
 * Cloudflare Pages cannot run cron jobs, so this tiny Worker owns the
 * schedule and simply calls the Pages app's /api/sweep endpoint. Keeping the
 * pipeline in the app avoids duplicating it here.
 */

// Declared locally so this file type-checks alongside the Next.js app without
// pulling @cloudflare/workers-types into the whole project. The Workers
// runtime supplies the real implementations.
interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

export interface Env {
  /** Base URL of the deployed Pages app, e.g. https://lead-user-discovery.pages.dev */
  APP_URL: string;
  /** Must match SWEEP_SECRET in the Pages project settings. */
  SWEEP_SECRET: string;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runSweep(env));
  },

  // Also reachable over HTTP so the schedule can be tested without waiting a day.
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.headers.get("authorization") !== `Bearer ${env.SWEEP_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    return new Response(await runSweep(env), {
      headers: { "Content-Type": "application/json" },
    });
  },
};

async function runSweep(env: Env): Promise<string> {
  const res = await fetch(`${env.APP_URL}/api/sweep`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SWEEP_SECRET}`,
      "Content-Type": "application/json",
    },
  });

  const body = await res.text();

  if (!res.ok) {
    console.error(`[cron] sweep failed (${res.status}): ${body.slice(0, 300)}`);
  } else {
    console.log(`[cron] sweep ok: ${body.slice(0, 300)}`);
  }

  return body;
}
