interface LlmConfig {
  provider: "groq" | "openai";
  apiKey: string;
  baseUrl: string;
  model: string;
}

export class LlmNotConfiguredError extends Error {
  constructor() {
    super(
      "No LLM provider configured. Set GROQ_API_KEY or OPENAI_API_KEY (see .env.example)."
    );
    this.name = "LlmNotConfiguredError";
  }
}

// Groq retires models with little notice — llama-3.1-8b-instant vanished and
// silently broke every classification for three days. Keep the default in one
// place so the next replacement is a single edit.
const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";

function getLlmConfig(): LlmConfig {
  const preferred = (process.env.LLM_PROVIDER || "").toLowerCase();

  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if ((preferred === "groq" || !preferred) && groqKey) {
    return {
      provider: "groq",
      apiKey: groqKey,
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL,
    };
  }

  if ((preferred === "openai" || !preferred) && openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      baseUrl: "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    };
  }

  if (groqKey) {
    return {
      provider: "groq",
      apiKey: groqKey,
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL,
    };
  }

  if (openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      baseUrl: "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    };
  }

  throw new LlmNotConfiguredError();
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/**
 * Calls an OpenAI-compatible chat completions endpoint (Groq or OpenAI)
 * with JSON-object response mode and returns the parsed object.
 */
const MAX_RETRIES = 4;

/**
 * Free tiers (notably Groq's 6k tokens/minute) reject bursts with a 429 that
 * says how long to wait. Prefer that hint, then the Retry-After header, then
 * a plain exponential backoff.
 */
function retryDelayMs(res: Response, body: string, attempt: number): number {
  const fromBody = body.match(/try again in ([\d.]+)s/i);
  if (fromBody) return Math.ceil(parseFloat(fromBody[1]) * 1000) + 250;

  const header = res.headers.get("retry-after");
  if (header) {
    const seconds = parseFloat(header);
    if (!Number.isNaN(seconds)) return Math.ceil(seconds * 1000) + 250;
  }

  return 1000 * 2 ** attempt;
}

/**
 * @param expiryMs Absolute timestamp (Date.now() based) past which no further
 * retry is attempted. Without it a rate-limited call can keep backing off well
 * beyond an interactive request's timeout, which is what produced 504s even
 * when the caller thought it had budgeted its time.
 */
export async function chatJSON<T>(messages: ChatMessage[], expiryMs?: number): Promise<T> {
  const config = getLlmConfig();

  let res!: Response;

  for (let attempt = 0; ; attempt++) {
    res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (res.ok) break;

    const isRetryable = res.status === 429 || res.status >= 500;
    if (!isRetryable || attempt >= MAX_RETRIES) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `LLM request to ${config.provider} failed (${res.status}): ${text.slice(0, 300)}`
      );
    }

    const text = await res.text().catch(() => "");
    const delay = retryDelayMs(res, text, attempt);

    // Don't start a wait that would run past the caller's deadline.
    if (expiryMs !== undefined && Date.now() + delay >= expiryMs) {
      throw new Error(
        `LLM request to ${config.provider} rate-limited (${res.status}) and the retry would ` +
          `exceed the time budget`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`LLM response from ${config.provider} had no content`);
  }

  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(`Failed to parse JSON from ${config.provider} response`);
  }
}
