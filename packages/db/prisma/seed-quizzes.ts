// The two demo quizzes, one per school (ADR-065 §1). Their own module, like
// `seed-articles.ts`, so `arabic-seed.test.ts` can compare the Arabic against
// them; `seed.ts` writes them.

export const DEMO_QUIZ = {
  // ADR-065 §3 — required: the quiz's URL is /learn/<track>/quizzes/<slug>.
  track: "forex",
  slug: "forex-basics-check",
  title: "Forex basics: a quick check",
  description: "Six questions on the vocabulary the first course assumes. Nothing here is a trick.",
  category: "forex-basics",
  passingScore: 70,
  questions: [
    {
      type: "SINGLE_CHOICE" as const,
      prompt: "What does a currency PAIR quote actually tell you?",
      options: [
        "How much of the quote currency one unit of the base currency buys",
        "The total daily volume in that currency",
        "The interest rate difference between the two countries",
        "How many brokers offer that pair",
      ],
      correct: 0,
      explanations: [
        "EUR/USD at 1.08 means one euro buys 1.08 dollars. Base first, quote second.",
        "",
        "That is the carry, which affects a pair's cost to hold but is not the quote.",
        "",
      ],
    },
    {
      type: "TRUE_FALSE" as const,
      prompt: "A pip is the same size on every currency pair.",
      options: ["True", "False"],
      correct: 1,
      explanations: [
        "",
        "Most pairs move in 0.0001 steps, but JPY pairs quote to two decimals, so a pip there is 0.01.",
      ],
    },
    {
      type: "SINGLE_CHOICE" as const,
      prompt: "Leverage of 1:30 means…",
      options: [
        "Your profits are multiplied by 30 and your losses are not",
        "You can control a position 30 times your deposit — losses scale with it",
        "The broker pays 30% of any loss",
        "You may hold a position for 30 days",
      ],
      correct: 1,
      explanations: [
        "Leverage is symmetric. Anything that claims otherwise is selling something.",
        "The position size scales, and so does every pip against you.",
        "",
        "",
      ],
    },
    {
      type: "MULTIPLE_CHOICE" as const,
      prompt: "Which of these are costs of holding a leveraged position overnight?",
      options: [
        "The spread you paid to enter",
        "The overnight financing (swap)",
        "A fee for closing in profit",
        "Slippage if the market gaps",
      ],
      correct: [1, 3],
      explanations: [
        "Real, but paid on entry rather than for holding.",
        "Charged or paid every night the position stays open.",
        "No such thing — if a broker charges one, that is the product, not the market.",
        "A gap can fill your stop worse than where you set it.",
      ],
    },
    {
      type: "TRUE_FALSE" as const,
      prompt: "A stop-loss order guarantees you exit at exactly your stop price.",
      options: ["True", "False"],
      correct: 1,
      explanations: [
        "",
        "It becomes a market order when touched. In a gap it fills at the next available price.",
      ],
    },
    {
      type: "SINGLE_CHOICE" as const,
      prompt: "The forex market is open 24 hours a day because…",
      options: [
        "One global exchange never closes",
        "Trading passes between financial centres around the world",
        "Brokers hold orders overnight and fill them in the morning",
        "Central banks operate around the clock",
      ],
      correct: 1,
      explanations: [
        "There is no central exchange at all — that is the point.",
        "Sydney, then Tokyo, then London, then New York. The handover is why liquidity varies by hour.",
        "",
        "",
      ],
    },
  ],
};

// The crypto school's own (ADR-065 §1). Both indexes are per-track now, so
// one seeded quiz would leave "Learn Crypto → Quizzes" empty on a fresh
// database — an empty state where the nav promised content reads as a bug
// rather than as a choice.
export const DEMO_QUIZ_CRYPTO = {
  track: "crypto",
  slug: "crypto-basics-check",
  title: "Crypto basics: a quick check",
  description: "Three questions on the vocabulary the crypto course assumes.",
  category: "crypto-basics",
  passingScore: 70,
  questions: [
    {
      type: "SINGLE_CHOICE" as const,
      prompt: "What does a blockchain actually store?",
      options: [
        "An ordered, append-only record of transactions",
        "The current balance of every wallet, and nothing else",
        "A copy of every user's identity documents",
        "The price history of the asset",
      ],
      correct: 0,
      explanations: [
        "Balances are DERIVED by replaying the record — the record itself is the ledger.",
        "Balances are computed from the history, not stored in place of it.",
        "",
        "Prices live on exchanges, which are not the chain.",
      ],
    },
    {
      type: "TRUE_FALSE" as const,
      prompt: "A transaction confirmed on-chain can be reversed by the sender.",
      options: ["True", "False"],
      correct: 1,
      explanations: [
        "",
        "Settlement is final. A mistaken transfer is recovered only if the recipient sends it back.",
      ],
    },
    {
      type: "SINGLE_CHOICE" as const,
      prompt: "What is a private key?",
      options: [
        "The secret that authorises spending from an address",
        "The address others send funds to",
        "A password held by the exchange on your behalf",
        "A backup of the blockchain",
      ],
      correct: 0,
      explanations: [
        "Whoever holds it can spend the funds — which is the whole of self-custody.",
        "That is the PUBLIC address, safe to share.",
        "That is a custodial account, where the exchange holds the key instead.",
        "",
      ],
    },
  ],
};
