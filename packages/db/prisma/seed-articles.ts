// Seed corpus for News & Analysis (changes-32).
//
// Module 15 shipped with ONE sample article, which was enough to load the
// editor and not nearly enough to look at `/news`: the front's spotlight only
// renders above `SPOTLIGHT_COUNT` visible stories, the per-category bands come
// from `getCategoryDigests`, and `loadArticleFacets` drops a zero-count
// category (ADR-081 #3). A single row therefore exercised none of it, and the
// owner's report — "add the multiple seeders for the news" — is that the
// section looks empty on a fresh install.
//
// Rules this corpus follows, and the reasons:
//
//   * **It is illustrative, not reportage.** No article quotes a real person,
//     attributes a statement to a real institution, or prints a price as
//     though it were today's. These rows sit in a database that ships, and a
//     fabricated central-bank quote is a fabricated central-bank quote
//     whether or not a seed file put it there. Every number here is framed as
//     an example ("a 100-pip move", "on a $10,000 account").
//   * **No covers.** `coverImageUrl` is null throughout, and that is
//     deliberate rather than unfinished: the news cards already have a
//     kind-toned fallback built for exactly this case, and twelve pieces of
//     invented stock art would be twelve decisions the design did not ask for.
//   * **`create`-only, keyed on the translation slug.** The seed rule from
//     Module 01: re-seeding repairs drift and never clobbers an editor's own
//     edits, so a row that exists is left completely alone.
//
// Spread across both surfaces on purpose: `/news` is `kind: NEWS` alone and
// `/analysis` is `ANALYSIS` + `TRADE_IDEA` (the routes' own filters), so a
// corpus of one kind would leave the other page exactly as empty as before.

export interface SeedArticleFaq {
  question: string;
  answer: string;
}

export interface SeedArticle {
  kind: "NEWS" | "ANALYSIS" | "TRADE_IDEA";
  /** Matches a seeded `ArticleCategory` translation slug. */
  categorySlug: string;
  /** Matches seeded `ArticleTag` translation slugs; unknown ones are skipped. */
  tagSlugs: string[];
  isFeatured?: boolean;
  /** Publication date, as a whole number of days before the seed run. */
  daysAgo: number;
  title: string;
  slug: string;
  excerpt: string;
  /** Paragraphs and headings, joined at seed time. Sanitised shape only. */
  body: string[];
  seoTitle: string;
  seoDescription: string;
  focusKeywords: string;
  faq?: SeedArticleFaq[];
}

export const SEED_ARTICLES: SeedArticle[] = [
  // ── Market News ───────────────────────────────────────────
  {
    kind: "NEWS",
    categorySlug: "market-news",
    tagSlugs: ["eur-usd", "ecb"],
    isFeatured: true,
    daysAgo: 1,
    title: "What a European rate decision actually does to EUR/USD",
    slug: "what-a-european-rate-decision-does-to-eur-usd",
    excerpt:
      "Rate decisions move currencies less through the number itself than through what the number says about the next six months. Here is how to read one.",
    body: [
      "<h2>The decision is rarely the surprise</h2>",
      "<p>By the time a central bank announces a policy rate, the market has usually priced the most likely outcome. What moves a pair is the distance between what was expected and what was delivered — and, more often, the language that comes with it.</p>",
      "<h2>Three things to read, in order</h2>",
      "<p>First, the rate itself against the consensus. Second, the statement's description of inflation and growth. Third, the press conference, where a single qualifier can undo the statement's tone.</p>",
      "<h3>Why the reaction can reverse</h3>",
      "<p>An initial move on the headline number is frequently faded once the statement is read in full. This is normal, and it is why position sizing around scheduled events matters more than direction.</p>",
      "<h2>Practical takeaway</h2>",
      '<p>Check the <a href="/economic-calendar">economic calendar</a> before you size a position. A pair you are comfortable holding through a quiet session is a different instrument in the ten minutes after a decision.</p>',
    ],
    seoTitle: "How a European rate decision moves EUR/USD",
    seoDescription:
      "Rate decisions move EUR/USD through expectations, not the headline number. How to read a statement, a press conference and the reaction that follows.",
    focusKeywords: "eur usd rate decision, ecb rate decision forex, central bank forex",
    faq: [
      {
        question: "Should I trade through a rate decision?",
        answer:
          "<p>Spreads widen and slippage is likely in the minutes around a scheduled decision. Many traders reduce size or stand aside rather than accept execution risk they cannot measure.</p>",
      },
      {
        question: "Why did the pair move the opposite way to the rate?",
        answer:
          "<p>Because the rate was expected and the guidance was not. The market trades the path of future policy, which the statement and the press conference describe.</p>",
      },
    ],
  },
  {
    kind: "NEWS",
    categorySlug: "market-news",
    tagSlugs: ["gold"],
    daysAgo: 3,
    title: "Why gold and the dollar usually move in opposite directions",
    slug: "why-gold-and-the-dollar-move-in-opposite-directions",
    excerpt:
      "Gold is priced in dollars, so a stronger dollar makes the same ounce cost more everywhere else. The relationship is real, and it breaks more often than people expect.",
    body: [
      "<h2>The mechanical part</h2>",
      "<p>Gold is quoted in US dollars. When the dollar strengthens against other currencies, the same ounce becomes more expensive for anyone holding those currencies, and demand softens. That is the inverse relationship in its simplest form.</p>",
      "<h2>The part that breaks</h2>",
      "<p>During a broad risk-off episode, both the dollar and gold can rise together: one is bought for liquidity, the other for safety. A trader who treats the correlation as a rule rather than a tendency gets caught in exactly these weeks.</p>",
      "<h2>How to use it</h2>",
      '<p>Treat the relationship as context, not as a signal. Our <a href="/tools">correlation tool</a> shows how the strength of a relationship changes over different windows.</p>',
    ],
    seoTitle: "Gold and the US dollar: why they move in opposite directions",
    seoDescription:
      "Gold is priced in dollars, which is why the two usually move inversely — and why the relationship breaks during risk-off episodes.",
    focusKeywords: "gold dollar correlation, gold usd inverse, xau usd",
  },
  {
    kind: "NEWS",
    categorySlug: "market-news",
    tagSlugs: ["crude-oil", "usd-jpy"],
    daysAgo: 5,
    title: "Energy prices, trade balances and the currencies that feel them first",
    slug: "energy-prices-trade-balances-and-the-currencies-that-feel-them-first",
    excerpt:
      "A country that imports its energy and a country that exports it do not experience the same oil price. Currency markets price that difference continuously.",
    body: [
      "<h2>Importers and exporters</h2>",
      "<p>An economy that buys most of its energy abroad sees a rising oil price as a widening import bill. An exporter sees the same move as revenue. Over time, that difference shows up in the trade balance and, through it, in the currency.</p>",
      "<h2>Why the effect is slow, then sudden</h2>",
      "<p>Trade data is published monthly and revised. Markets anticipate it, so a currency often reprices before the figure arrives and barely reacts when it does.</p>",
      "<h2>What to watch</h2>",
      "<p>Energy-sensitive pairs tend to show the relationship most clearly over weeks rather than hours. Intraday, flow and positioning dominate.</p>",
    ],
    seoTitle: "How energy prices move currencies",
    seoDescription:
      "Oil-importing and oil-exporting economies experience the same price differently. How that difference reaches the currency market.",
    focusKeywords: "oil price forex, energy prices currencies, commodity currencies",
  },
  {
    kind: "NEWS",
    categorySlug: "market-news",
    tagSlugs: ["gbp-usd"],
    daysAgo: 8,
    title: "Reading a monthly jobs report without over-reading it",
    slug: "reading-a-monthly-jobs-report-without-over-reading-it",
    excerpt:
      "Employment data is the most-watched release on most calendars, and the headline number is the least reliable part of it.",
    body: [
      "<h2>The headline is a first estimate</h2>",
      "<p>Employment figures are revised, sometimes substantially, in the months that follow. The first print is what the market trades and the last revision is what turns out to have been true.</p>",
      "<h2>Look at the components</h2>",
      "<p>Participation, average earnings and the breadth of hiring across sectors say more about the direction of policy than the headline count does.</p>",
      "<h2>Managing the release</h2>",
      "<p>Liquidity thins in the seconds before a scheduled release and spreads widen through it. A stop placed inside that window is not the stop you think you have.</p>",
    ],
    seoTitle: "How to read a monthly jobs report",
    seoDescription:
      "Employment data is revised, and the headline is a first estimate. Which components matter, and how the release affects execution.",
    focusKeywords: "jobs report forex, employment data trading, nfp",
  },

  // ── Central Banks ─────────────────────────────────────────
  {
    kind: "NEWS",
    categorySlug: "central-banks",
    tagSlugs: ["fed", "usd-jpy"],
    isFeatured: true,
    daysAgo: 2,
    title: "Forward guidance, and why wording changes move markets",
    slug: "forward-guidance-and-why-wording-changes-move-markets",
    excerpt:
      "Central banks tell markets what they intend to do next. Traders read the sentence that changed, not the ones that stayed the same.",
    body: [
      "<h2>Guidance is a commitment with an escape hatch</h2>",
      "<p>Forward guidance describes what a central bank expects to do if the economy behaves as forecast. It is deliberately conditional, which is what allows it to be withdrawn without being broken.</p>",
      "<h2>The diff is the news</h2>",
      "<p>Experienced readers compare a statement to the previous one word by word. A dropped adjective or a reordered clause is routinely worth more to the market than any number in the release.</p>",
      "<h3>An example of the pattern</h3>",
      "<p>A statement that stops describing policy as accommodative has said something about the next meeting without announcing anything about this one.</p>",
      "<h2>Where beginners go wrong</h2>",
      "<p>Trading the headline and ignoring the statement. The headline is the decision; the statement is the direction.</p>",
    ],
    seoTitle: "Forward guidance explained for traders",
    seoDescription:
      "Why a change of wording in a central bank statement moves currencies more than the rate decision itself.",
    focusKeywords: "forward guidance, central bank statement trading, fed guidance forex",
    faq: [
      {
        question: "What is forward guidance?",
        answer:
          "<p>A central bank's description of the policy path it expects to follow if the economy develops as forecast. It is conditional by design.</p>",
      },
    ],
  },
  {
    kind: "NEWS",
    categorySlug: "central-banks",
    tagSlugs: ["ecb", "fed"],
    daysAgo: 6,
    title: "Interest rate differentials, explained without the jargon",
    slug: "interest-rate-differentials-explained-without-the-jargon",
    excerpt:
      "A currency pair is two interest rates facing each other. The gap between them, and the expected path of that gap, is most of the story.",
    body: [
      "<h2>Two rates, one quote</h2>",
      "<p>Every currency pair prices one economy's rate against another's. Capital tends to move toward the higher expected return, adjusted for risk — which is why the differential, not the level, is what matters.</p>",
      "<h2>The expected path beats the current gap</h2>",
      "<p>Markets are forward-looking. A currency with the higher rate today can weaken if that rate is expected to fall faster than its counterpart's.</p>",
      "<h2>Where this shows up on your account</h2>",
      '<p>In the overnight financing applied to a position held past the daily rollover. Our <a href="/tools">calculators</a> show what a differential costs or pays on a given size.</p>',
    ],
    seoTitle: "Interest rate differentials in forex, explained",
    seoDescription:
      "A currency pair is two interest rates facing each other. Why the expected path of the gap matters more than the gap today.",
    focusKeywords: "interest rate differential forex, carry trade, rate differential currency",
  },
  {
    kind: "NEWS",
    categorySlug: "central-banks",
    tagSlugs: ["fed"],
    daysAgo: 11,
    title: "Quantitative tightening and the plumbing most traders never see",
    slug: "quantitative-tightening-and-the-plumbing-traders-never-see",
    excerpt:
      "Balance-sheet policy works slowly, in the background, and shows up in funding markets long before it shows up in a currency chart.",
    body: [
      "<h2>What it actually is</h2>",
      "<p>A central bank letting assets mature without replacing them, shrinking the reserves in the banking system. No announcement is needed once the programme is running.</p>",
      "<h2>Why currencies react late</h2>",
      "<p>The first effects appear in short-term funding rates and collateral markets. By the time they reach the exchange rate, the cause is several steps back.</p>",
      "<h2>What to monitor</h2>",
      "<p>Funding spreads and money-market conditions. They move first and are published continuously.</p>",
    ],
    seoTitle: "Quantitative tightening explained",
    seoDescription:
      "Balance-sheet policy reaches currencies through funding markets, slowly. What quantitative tightening is and where its effects appear first.",
    focusKeywords: "quantitative tightening, balance sheet policy, qt forex",
  },
  {
    kind: "NEWS",
    categorySlug: "trade-ideas",
    tagSlugs: ["usd-jpy"],
    daysAgo: 13,
    title: "Intervention risk: what happens when a finance ministry gets involved",
    slug: "intervention-risk-when-a-finance-ministry-gets-involved",
    excerpt:
      "Some currencies carry a risk no chart shows: the possibility that an official body decides the exchange rate has gone far enough.",
    body: [
      "<h2>Verbal before actual</h2>",
      "<p>Officials generally talk before they act. Escalating language — from monitoring, to concern, to a statement that excessive moves are undesirable — is the sequence to watch.</p>",
      "<h2>Why it matters for risk, not direction</h2>",
      "<p>Intervention is unpredictable in timing and violent in effect. It is a reason to size smaller, not a reason to position for it.</p>",
      "<h2>The practical rule</h2>",
      "<p>In a pair with a live intervention history, a stop is a request, not a guarantee. Treat gap risk as part of the position.</p>",
    ],
    seoTitle: "Currency intervention risk, explained",
    seoDescription:
      "How official intervention works, why verbal warnings come first, and why it is a position-sizing question rather than a trade idea.",
    focusKeywords: "currency intervention, fx intervention risk, usd jpy intervention",
  },

  // ── Technical Analysis (ANALYSIS) ─────────────────────────
  {
    kind: "ANALYSIS",
    categorySlug: "technical-analysis",
    tagSlugs: ["eur-usd", "gbp-usd"],
    daysAgo: 4,
    title: "Support and resistance are zones, not lines",
    slug: "support-and-resistance-are-zones-not-lines",
    excerpt:
      "Drawing a level to the pip creates false precision and a stop that gets taken out by noise. Levels are areas where behaviour changed.",
    body: [
      "<h2>Why the line is wrong</h2>",
      "<p>A level marks a region where buyers or sellers previously stepped in. That region has width — often tens of pips — because the participants who acted did not all act at one price.</p>",
      "<h2>Building the zone</h2>",
      "<p>Use the range of the wicks and bodies around the reaction rather than a single close. The zone is what the market defended, not the exact price it printed.</p>",
      "<h3>Where the stop goes</h3>",
      "<p>Beyond the zone, not inside it. A stop placed at the line is a stop placed in the middle of the noise the zone describes.</p>",
      "<h2>When a zone stops working</h2>",
      "<p>After it has been traded through cleanly and retested from the other side. At that point it is a different level with a different meaning.</p>",
    ],
    seoTitle: "Support and resistance zones, not lines",
    seoDescription:
      "Why support and resistance levels are areas rather than exact prices, how to draw the zone and where the stop belongs.",
    focusKeywords: "support and resistance, supply and demand zones, technical levels",
    faq: [
      {
        question: "How wide should a zone be?",
        answer:
          "<p>Wide enough to contain the reaction that created it. On a daily chart of a major pair that is frequently 20 to 50 pips; on an intraday chart it is smaller.</p>",
      },
    ],
  },
  {
    kind: "ANALYSIS",
    categorySlug: "technical-analysis",
    tagSlugs: ["gold", "eur-usd"],
    daysAgo: 7,
    title: "Multi-timeframe analysis without four screens of contradiction",
    slug: "multi-timeframe-analysis-without-contradiction",
    excerpt:
      "Looking at more charts does not produce more clarity unless each timeframe has been given one job before you open it.",
    body: [
      "<h2>Give each chart a job</h2>",
      "<p>One timeframe for context, one for the decision, one for entry. Three is usually enough, and the jobs are decided before the charts are opened rather than after.</p>",
      "<h2>Handling disagreement</h2>",
      "<p>The higher timeframe wins on direction; the lower one only chooses timing. A setup that needs the higher timeframe to be wrong is not a setup.</p>",
      "<h2>The failure mode</h2>",
      "<p>Adding a fourth chart to break a tie. If two timeframes disagree, the honest answer is no position.</p>",
    ],
    seoTitle: "Multi-timeframe analysis, done simply",
    seoDescription:
      "Give each timeframe one job — context, decision, entry — and a disagreement between charts becomes an answer rather than a problem.",
    focusKeywords: "multi timeframe analysis, timeframe trading, chart analysis",
  },
  {
    kind: "ANALYSIS",
    categorySlug: "technical-analysis",
    tagSlugs: ["crude-oil"],
    daysAgo: 10,
    title: "Volatility is a position-sizing input, not a signal",
    slug: "volatility-is-a-position-sizing-input-not-a-signal",
    excerpt:
      "The same stop distance means two different risks in a quiet week and a violent one. Sizing by volatility keeps the risk constant instead of the lot size.",
    body: [
      "<h2>The problem with a fixed lot size</h2>",
      "<p>A fixed size in a market whose daily range has doubled is a doubled risk that nobody decided to take.</p>",
      "<h2>Sizing to the range</h2>",
      "<p>Set the stop by the instrument's recent range, then derive the size from the account risk and that distance. Risk stays where you set it and the size moves instead.</p>",
      "<h3>Working the arithmetic</h3>",
      '<p>Position size equals account risk divided by stop distance in value terms. The <a href="/tools">position size calculator</a> does this per instrument.</p>',
      "<h2>What this does not tell you</h2>",
      "<p>Nothing about direction. Rising volatility is a reason to be smaller, not a reason to be short.</p>",
    ],
    seoTitle: "Volatility-based position sizing",
    seoDescription:
      "Sizing to an instrument's recent range keeps risk constant when volatility changes. Why volatility is an input, not a signal.",
    focusKeywords: "position sizing volatility, atr position size, risk per trade",
  },

  // ── Trade Ideas (TRADE_IDEA) ──────────────────────────────
  {
    kind: "TRADE_IDEA",
    categorySlug: "trade-ideas",
    tagSlugs: ["gbp-usd"],
    daysAgo: 9,
    title: "How to write a trade plan you will actually follow",
    slug: "how-to-write-a-trade-plan-you-will-actually-follow",
    excerpt:
      "A plan that only says what to buy is not a plan. The parts that get skipped are the invalidation and the exit.",
    body: [
      "<h2>Four lines, before the position</h2>",
      "<p>The idea, the invalidation, the size, and what would make you exit early. Written down, before entry, in that order.</p>",
      "<h2>Invalidation is not the stop</h2>",
      "<p>The stop is where you leave. The invalidation is the condition that makes the idea wrong — frequently reached before the stop, and the reason to close early rather than wait.</p>",
      "<h2>Reviewing it afterwards</h2>",
      "<p>Score the plan, not the outcome. A good plan that lost is repeatable; a bad plan that won is not.</p>",
    ],
    seoTitle: "Writing a trade plan you will follow",
    seoDescription:
      "Four lines written before entry: the idea, the invalidation, the size and the early exit. Why invalidation is not the stop.",
    focusKeywords: "trade plan, trading plan template, trade journal",
  },
];
