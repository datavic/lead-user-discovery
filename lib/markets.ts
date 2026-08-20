/**
 * APAC market definitions.
 *
 * Searching these markets in English surfaces regional news bots reporting on
 * AI, not people doing the work. Practitioners write in their own language, so
 * each market carries native problem-and-self-solution phrasing and native
 * first-person markers — without both, the scoring heuristics score their
 * posts at zero and drop them before any model sees them.
 */
export interface Market {
  /** Topic label shown in the UI and stored on each finding. */
  topic: string;
  language: string;
  /** Native equivalents of "I built / I use ... to". */
  phrases: string[];
  /** Native first-person markers, the signal that someone is describing their own work. */
  firstPerson: string[];
}

export const APAC_MARKETS: Market[] = [
  {
    topic: "Japan · practitioners using AI",
    language: "Japanese",
    phrases: ["ChatGPTで作った", "ChatGPTを使って", "GPTで自動化", "ChatGPTに任せて"],
    firstPerson: ["私", "僕", "自分", "うちの"],
  },
  {
    topic: "Korea · practitioners using AI",
    language: "Korean",
    phrases: ["챗GPT로 만들었", "GPT로 자동화", "챗GPT를 써서", "직접 만들었"],
    firstPerson: ["제가", "내가", "저는", "우리"],
  },
  {
    topic: "Indonesia · practitioners using AI",
    language: "Indonesian",
    phrases: ["pakai ChatGPT untuk", "bikin pakai ChatGPT", "saya buat sendiri", "pakai AI buat"],
    firstPerson: ["saya", "aku", "kami", "gue"],
  },
  {
    topic: "Vietnam · practitioners using AI",
    language: "Vietnamese",
    phrases: ["dùng ChatGPT để", "tự làm bằng ChatGPT", "tôi đã tạo", "dùng AI để"],
    firstPerson: ["tôi", "mình", "chúng tôi"],
  },
  {
    topic: "Thailand · practitioners using AI",
    language: "Thai",
    phrases: ["ใช้ ChatGPT ทำ", "ทำเองด้วย ChatGPT", "ผมใช้ ChatGPT", "ใช้ AI ช่วย"],
    firstPerson: ["ผม", "ฉัน", "เรา", "ดิฉัน"],
  },
];

const BY_TOPIC = new Map(APAC_MARKETS.map((market) => [market.topic, market]));

export function findMarket(topic: string): Market | undefined {
  return BY_TOPIC.get(topic);
}

/** Every native phrase across markets, for scoring text of unknown origin. */
export const ALL_MARKET_PHRASES: string[] = APAC_MARKETS.flatMap((m) => m.phrases);

export const ALL_MARKET_FIRST_PERSON: string[] = APAC_MARKETS.flatMap((m) => m.firstPerson);
