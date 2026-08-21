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
  /** BCP-47 code used to restrict source searches to this market's language. */
  lang: string;
  /** Native equivalents of "I built / I use ... to". */
  phrases: string[];
  /** Native first-person markers, the signal that someone is describing their own work. */
  firstPerson: string[];
}

export const APAC_MARKETS: Market[] = [
  {
    // Singapore's practitioners work in English, so the "native language" here
    // is English — what localises the search is the place name, not the script.
    topic: "Singapore · practitioners using AI",
    language: "English",
    lang: "en",
    phrases: [
      "Singapore ChatGPT",
      "Singapore AI workflow",
      "Singapore built with AI",
      "SG startup ChatGPT",
      "Singapore automated with AI",
      "Singapore small business AI",
    ],
    firstPerson: ["I ", "my ", "we ", "our "],
  },
  {
    // Bluesky tags Traditional and Simplified alike as "zh", so phrasing covers
    // both scripts. ChatGPT is unavailable in mainland China, so domestic
    // models are included — omitting them would miss most of the practitioners
    // writing in Simplified. Reach here skews to Taiwan, Hong Kong and the
    // diaspora; mainland practitioners are largely on domestic platforms.
    topic: "Mandarin · practitioners using AI",
    language: "Mandarin",
    lang: "zh",
    phrases: [
      "用ChatGPT做了",
      "我自己寫了",
      "自己做了一個",
      "用AI做了一个",
      "我自己写了",
      "自己搭了一个",
      "用ChatGPT寫了",
      "拿AI來做",
      "用DeepSeek做",
      "自己弄了一個",
    ],
    firstPerson: ["我", "我們", "我们", "自己"],
  },
  {
    topic: "Japan · practitioners using AI",
    language: "Japanese",
    lang: "ja",
    phrases: [
      "ChatGPTで作った",
      "ChatGPTを使って",
      "GPTで自動化",
      "ChatGPTに任せて",
      "自分で作った",
      "ChatGPTで効率化",
      "GPTsを作って",
      "ChatGPTで書いた",
      "AIで自動化した",
      "プロンプトを作った",
    ],
    firstPerson: ["私", "僕", "自分", "うちの"],
  },
  {
    topic: "Korea · practitioners using AI",
    language: "Korean",
    lang: "ko",
    phrases: [
      "챗GPT로 만들었",
      "GPT로 자동화",
      "챗GPT를 써서",
      "직접 만들었",
      "GPT로 만든",
      "챗지피티로",
      "프롬프트를 만들었",
      "AI로 자동화",
      "제가 만든",
    ],
    firstPerson: ["제가", "내가", "저는", "우리"],
  },
  {
    topic: "Indonesia · practitioners using AI",
    language: "Indonesian",
    lang: "id",
    phrases: [
      "pakai ChatGPT untuk",
      "bikin pakai ChatGPT",
      "saya buat sendiri",
      "pakai AI buat",
      "saya bikin",
      "coba pakai ChatGPT",
      "otomatisasi pakai AI",
      "saya pakai ChatGPT",
      "bikin sendiri pakai",
    ],
    firstPerson: ["saya", "aku", "kami", "gue"],
  },
  {
    topic: "Vietnam · practitioners using AI",
    language: "Vietnamese",
    lang: "vi",
    phrases: [
      "dùng ChatGPT để",
      "tự làm bằng ChatGPT",
      "tôi đã tạo",
      "dùng AI để",
      "mình dùng ChatGPT",
      "mình tự làm",
      "tự động hóa bằng AI",
      "tôi xây dựng",
      "mình đã tạo",
    ],
    firstPerson: ["tôi", "mình", "chúng tôi"],
  },
  {
    topic: "Thailand · practitioners using AI",
    language: "Thai",
    lang: "th",
    phrases: [
      "ใช้ ChatGPT ทำ",
      "ทำเองด้วย ChatGPT",
      "ผมใช้ ChatGPT",
      "ใช้ AI ช่วย",
      "ฉันใช้ ChatGPT",
      "ทำเอง",
      "เขียนเองด้วย AI",
      "ใช้ ChatGPT ช่วย",
    ],
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
