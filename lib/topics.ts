/**
 * Topics swept every night. The UI offers these as instant-switch chips and
 * the scheduled sweep populates all of them, so both stay in step — a chip
 * with no pre-computed data behind it would look broken.
 */
import { APAC_MARKETS } from "@/lib/markets";

const GLOBAL_TOPICS = [
  "Advanced OpenAI / ChatGPT users",
  "Farmers using ChatGPT",
  "Scientists using AI in research",
  "Small business owners using ChatGPT",
  "Local LLM tinkerers",
  "AI coding agent power users",
];

/**
 * Global topics plus one per APAC market. The market topics search in local
 * languages, which is the only way to reach practitioners rather than the
 * regional news accounts an English query returns.
 */
export const PRESET_TOPICS = [...GLOBAL_TOPICS, ...APAC_MARKETS.map((m) => m.topic)];
