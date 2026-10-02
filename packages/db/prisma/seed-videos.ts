// The demo video categories and topics (changes-16 PR 2, ADR-068). Their own
// module, like `seed-articles.ts`, so `arabic-seed.test.ts` can compare the
// Arabic against them; `seed.ts` writes them (see the note there).

export const DEMO_TEST_REEL = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";

export const VIDEO_CATEGORIES = [
  {
    slug: "getting-started",
    name: "Getting started",
    description: "Short walkthroughs for a trader opening their first chart.",
  },
  {
    slug: "strategy-and-analysis",
    name: "Strategy & analysis",
    description: "Longer sessions on reading a market and building a plan around it.",
  },
];

export interface SeedVideoTopic {
  slug: string;
  title: string;
  /** A LEARN_TRACKS key. Required — it is the URL's second segment (ADR-068 §1). */
  track: string;
  /** A VIDEO_CATEGORIES slug, or null for uncategorised. */
  category: string | null;
  summary: string;
  content: string;
  /** Seeded on exactly one topic per track — see the note above. */
  videoUrl?: string;
  links?: { label: string; path?: string; url?: string }[];
}

export const VIDEO_TOPICS: SeedVideoTopic[] = [
  {
    slug: "reading-your-first-candlestick-chart",
    title: "Reading your first candlestick chart",
    track: "forex",
    category: "getting-started",
    summary:
      "What the body, the wicks and the colour of a candle actually tell you about a period of trading.",
    content:
      "<p>A candlestick compresses four numbers into one shape: where a period opened, where it closed, and the highest and lowest prices traded in between. The body spans open to close; the wicks reach out to the extremes.</p><p>That is the whole vocabulary. Everything else — the named patterns, the multi-candle formations — describes how several of those shapes sit next to each other, and none of it means much without the context of the level it forms at.</p>",
    videoUrl: DEMO_TEST_REEL,
    links: [
      { label: "Candlestick in the glossary", path: "/glossary/candlestick" },
      { label: "Browse forex courses", path: "/learn/forex" },
    ],
  },
  {
    slug: "placing-a-stop-loss-that-survives-noise",
    title: "Placing a stop loss that survives noise",
    track: "forex",
    category: "getting-started",
    summary:
      "Why a stop placed at a round number gets hit, and how to size a position around a sensible one instead.",
    content:
      "<p>Most stops are placed where they are convenient rather than where they are meaningful — a round number, a fixed pip distance, or whatever leaves the position size the trader already wanted. All three put the stop exactly where ordinary volatility reaches.</p><p>The order that works is the other way round: decide where the idea is wrong, put the stop there, and let that distance and your risk budget decide the position size. The size is the output, not the input.</p>",
    links: [
      { label: "Stop loss in the glossary", path: "/glossary/stop-loss" },
      { label: "Position size calculator", path: "/tools/position-size" },
    ],
  },
  {
    slug: "building-a-weekly-trading-plan",
    title: "Building a weekly trading plan",
    track: "forex",
    category: "strategy-and-analysis",
    summary:
      "A repeatable routine: the levels that matter, the data on the calendar, and what would make you stand aside.",
    content:
      "<p>A plan written after the week starts is a running commentary. Written before it, the same notes are a filter — they say in advance which setups you are willing to take and which you are not, at a moment when nothing is at stake.</p><p>Three things belong in it: the levels you will trade around, the scheduled releases that could invalidate them, and the conditions under which you do nothing at all. The third is the one most plans omit and the one that saves the most money.</p>",
    links: [{ label: "Economic calendar", path: "/economic-calendar" }],
  },
  {
    slug: "what-a-blockchain-actually-records",
    title: "What a blockchain actually records",
    track: "crypto",
    category: "getting-started",
    summary:
      "Blocks, confirmations and finality — what has really happened when a wallet says a transfer is complete.",
    content:
      "<p>A blockchain is an append-only ledger agreed on by a network with no central bookkeeper. A transaction is not an instruction to a bank; it is a signed message broadcast to that network, which decides whether and when to include it in a block.</p><p>That is why confirmations exist. Inclusion in a block is not the end of the story — each block built on top makes reversing the one below it more expensive, so finality is a probability that rises with depth rather than a state that flips.</p>",
    videoUrl: DEMO_TEST_REEL,
    links: [
      { label: "Blockchain in the glossary", path: "/glossary/blockchain" },
      { label: "Browse crypto courses", path: "/learn/crypto" },
    ],
  },
  {
    slug: "custody-and-why-keys-matter",
    title: "Custody, and why keys matter",
    track: "crypto",
    category: "getting-started",
    summary:
      "The difference between holding an asset and holding a claim on someone else who holds it.",
    content:
      "<p>Holding crypto on an exchange is not holding crypto. It is holding a claim against that exchange, recorded in its own database, redeemable while it stays solvent and operational. The on-chain balance belongs to the exchange's key.</p><p>Self-custody moves that key to you, and moves the entire failure mode with it: no counterparty can lose your asset, and no counterparty can restore it if you lose the key. Neither choice is safer in the abstract — they fail in different directions.</p>",
    links: [{ label: "Private key in the glossary", path: "/glossary/private-key" }],
  },
  {
    slug: "reading-on-chain-volume-honestly",
    title: "Reading on-chain volume honestly",
    track: "crypto",
    category: "strategy-and-analysis",
    summary:
      "Why reported volume and real economic activity diverge, and which measures survive the difference.",
    content:
      "<p>Volume is the easiest number on a crypto dashboard to inflate: wash trading on a venue costs almost nothing, and transfers between wallets one entity controls look identical on-chain to transfers between two parties.</p><p>The measures that hold up are the ones that are expensive to fake — fees actually paid, addresses that both received and later spent, and settlement value net of self-transfers. They are smaller numbers, and they are the ones worth watching.</p>",
    links: [{ label: "Volume in the glossary", path: "/glossary/volume" }],
  },
];
