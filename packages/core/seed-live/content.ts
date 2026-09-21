// The live seed's starting corpus (ADR-144 §1).
//
// Written for this site, in its own words. The babypips pages the owner linked
// were a guide to which topics a beginner meets first and in what order — no
// sentence here is taken from them. Every figure is either arithmetic a reader
// can check (a pip is 0.0001 on EUR/USD) or a protocol fact (Bitcoin's supply
// cap), never a price, a forecast or a claim about MBX.
//
// Every video is a real, public recording, checked against YouTube's oEmbed
// endpoint on 2026-09-20 before it was written here. A video id is a factual
// claim — it asserts that this recording exists and teaches this — which is
// why the regular seed carries none (ADR-047 §3) and why an unverified one
// would not belong here either.
//
// Images are file names under `media/` (without extension).

export type ImageName =
  | "tablet-trading-chart"
  | "city-skyline-candlesticks"
  | "candlestick-bokeh"
  | "laptop-chart-review"
  | "analyst-rising-chart"
  | "desk-reports-planning"
  | "silhouettes-market-grid"
  | "bitcoin-circuit-board"
  | "dollar-rising-arrow"
  | "dollar-rate-arrow"
  | "cartoon-trader-charts"
  | "figures-climbing-chart"
  | "crypto-coins-workstation"
  | "hand-candlestick-chart"
  | "trading-screens-wall"
  | "market-data-screens";

/** Alt text per picture — set on the library row, so every placement inherits it. */
export const IMAGE_ALT: Record<ImageName, string> = {
  "tablet-trading-chart": "A hand pointing at a rising price chart on a tablet",
  "city-skyline-candlesticks": "A city skyline at night overlaid with candlestick bars",
  "candlestick-bokeh": "Candlestick bars glowing against a dark blue background",
  "laptop-chart-review": "Someone pointing at a price chart on a laptop screen",
  "analyst-rising-chart": "An analyst in a suit drawing on a rising market chart",
  "desk-reports-planning": "Two people reviewing printed reports beside a laptop chart",
  "silhouettes-market-grid": "Silhouettes of people talking in front of a market chart grid",
  "bitcoin-circuit-board": "Gold bitcoin coins resting on a circuit board",
  "dollar-rising-arrow": "US dollar notes behind a rising white arrow",
  "dollar-rate-arrow": "Dollar notes and exchange-rate figures under an upward arrow",
  "cartoon-trader-charts": "A cheerful cartoon trader pointing at market charts",
  "figures-climbing-chart": "Small white figures lifting a rising orange trend line",
  "crypto-coins-workstation": "A crypto trading desk with coins on the wall and charts on screens",
  "hand-candlestick-chart": "A hand holding a pen in front of a candlestick chart",
  "trading-screens-wall": "A wall of trading screens showing price lines",
  "market-data-screens": "Monitors full of blue market data and price charts",
};

export interface LessonSpec {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  image: ImageName;
  videoUrl?: string;
  externalUrl?: string;
  objectives: string[];
  content: string;
  seoTitle: string;
  seoDescription: string;
  keyword: string;
}

export interface CourseSpec {
  slug: string;
  track: "forex" | "crypto";
  title: string;
  summary: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  hours: number;
  image: ImageName;
  featured: boolean;
  description: string;
  seoTitle: string;
  seoDescription: string;
  keyword: string;
  sections: { title: string; description: string; lessons: LessonSpec[] }[];
  /** A generated one-page PDF attached to the LAST lesson. */
  cheatSheet: { title: string; label: string; lines: string[] };
}

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`;

function faq(items: [string, string][]): string {
  return (
    "<h2>Frequently asked questions</h2>" +
    items.map(([q, a]) => `<h3>${q}</h3><p>${a}</p>`).join("")
  );
}

// ─── Courses ─────────────────────────────────────────────────

export const COURSES: CourseSpec[] = [
  {
    slug: "forex-market-sessions-and-drivers",
    track: "forex",
    title: "How the Forex Market Moves: Sessions and Drivers",
    summary:
      "Who trades currencies, when the market is busiest, and the handful of forces that move exchange rates day to day.",
    difficulty: "BEGINNER",
    hours: 2,
    image: "city-skyline-candlesticks",
    featured: true,
    seoTitle: "How the Forex Market Moves: Sessions & Drivers",
    seoDescription:
      "A beginner course on forex market participants, trading sessions, interest rates and economic data — what really moves currency prices.",
    keyword: "forex trading sessions",
    description:
      "<h2>About this course</h2>" +
      "<p>The foreign exchange market never closes on a weekday, but it is not equally busy around the clock. This course explains who is on the other side of your trade, why liquidity rises and falls with the sun, and which pieces of news are worth your attention.</p>" +
      "<h2>What you will learn</h2><ul>" +
      "<li>The main participants — banks, companies, funds and retail traders — and why each one trades</li>" +
      "<li>The Sydney, Tokyo, London and New York sessions, and why the overlaps matter</li>" +
      "<li>How interest-rate decisions and economic releases move a currency</li>" +
      "<li>How to read an economic calendar without reacting to every headline</li></ul>" +
      "<h2>Who this course is for</h2><p>Anyone who has learned what a currency pair is and now wants to understand <em>why</em> prices move. No prior trading experience is needed.</p>" +
      "<h2>Further reading</h2><ul>" +
      '<li><a href="https://www.bis.org/statistics/rpfx22.htm" target="_blank" rel="noopener noreferrer">BIS Triennial Central Bank Survey</a> — the reference source for how much currency trades each day</li>' +
      '<li><a href="https://www.federalreserve.gov/monetarypolicy.htm" target="_blank" rel="noopener noreferrer">Federal Reserve: monetary policy</a></li>' +
      '<li><a href="https://www.ecb.europa.eu/mopo/html/index.en.html" target="_blank" rel="noopener noreferrer">European Central Bank: monetary policy</a></li></ul>' +
      faq([
        [
          "Do I need to trade every session?",
          "No. Most traders pick the one or two sessions that fit their day and the pairs they follow. Trading tired, at a quiet hour, usually means wider spreads and weaker decisions.",
        ],
        [
          "Is forex open at weekends?",
          "The retail market closes from Friday evening to Sunday evening (New York time). Prices can open at a different level on Monday — a weekend gap.",
        ],
        [
          "Which news matters most?",
          "Central-bank rate decisions and the statements around them, inflation figures and employment reports tend to move currencies the most. The calendar tells you when they are due.",
        ],
      ]),
    sections: [
      {
        title: "Who trades and when",
        description: "The market's participants and its daily rhythm.",
        lessons: [
          {
            slug: "who-trades-forex",
            title: "Who Trades Forex, and Why",
            summary:
              "Banks, businesses, investors and individuals all exchange currency for different reasons — and that mix shapes how prices behave.",
            minutes: 12,
            image: "silhouettes-market-grid",
            videoUrl: yt("_KRelepN4Ek"),
            objectives: [
              "Name the four main groups of forex participants",
              "Explain the difference between trading for business and trading for profit",
              "Describe what liquidity means for a retail trader",
            ],
            seoTitle: "Who Trades Forex and Why",
            seoDescription:
              "Meet the forex market's participants — banks, corporations, funds and retail traders — and learn how their activity creates liquidity.",
            keyword: "forex market participants",
            content:
              "<h2>A market made of many motives</h2>" +
              "<p>Every currency trade has two sides, and the people on those sides rarely want the same thing. A car maker converting overseas sales back into its home currency is not speculating at all; a hedge fund buying the same currency may be betting on an interest-rate change. Understanding who is active helps you understand why prices move the way they do.</p>" +
              "<h2>The main participants</h2>" +
              "<h3>Banks and dealers</h3><p>Large banks quote prices to each other and to their clients all day. Together they form the core of the market, and the prices you see on a trading platform ultimately trace back to them.</p>" +
              "<h3>Companies</h3><p>Importers, exporters and multinationals exchange currency to pay suppliers and bring profits home. They often <strong>hedge</strong> — locking in a rate today for a payment months away — which is risk reduction, not speculation.</p>" +
              "<h3>Investment funds and central banks</h3><p>Asset managers buy currencies when they buy foreign shares and bonds. Central banks manage reserves and, occasionally, intervene to steady their currency.</p>" +
              "<h3>Retail traders</h3><p>Individuals trading through a broker are a small share of total volume, but they are the group this site is written for.</p>" +
              "<h2>Why this matters to you</h2>" +
              "<p>So many participants, trading for so many reasons, is what makes major pairs <strong>liquid</strong>: you can usually buy or sell quickly, in normal size, close to the quoted price. Liquidity is thinner in exotic pairs and at quiet hours, which shows up as wider spreads and sharper jumps.</p>" +
              "<blockquote><p>Liquidity is not a guarantee. Around major news, even the most traded pairs can move several pips before an order is filled.</p></blockquote>",
          },
          {
            slug: "forex-trading-sessions-and-overlaps",
            title: "The Four Sessions and Their Overlaps",
            summary:
              "Sydney, Tokyo, London and New York hand the market around the globe. The hours where two of them are open together are usually the busiest.",
            minutes: 10,
            image: "market-data-screens",
            objectives: [
              "List the four major trading sessions in order",
              "Identify the London–New York overlap and why it is active",
              "Match pairs to the sessions in which they tend to move most",
            ],
            seoTitle: "Forex Trading Sessions and Overlaps Explained",
            seoDescription:
              "Learn the Sydney, Tokyo, London and New York forex sessions, when they overlap, and which currency pairs are most active in each.",
            keyword: "forex trading sessions",
            content:
              "<h2>A market that follows the sun</h2>" +
              "<p>Forex has no single exchange building. Trading passes from one financial centre to the next as each one opens for business, which is why the market runs from Sunday evening to Friday evening (New York time) without a daily close.</p>" +
              "<h2>The four sessions</h2>" +
              "<table><thead><tr><th>Session</th><th>Main centre</th><th>Pairs that tend to be active</th></tr></thead><tbody>" +
              "<tr><td>Sydney</td><td>Australia</td><td>AUD/USD, NZD/USD</td></tr>" +
              "<tr><td>Tokyo</td><td>Japan</td><td>USD/JPY, AUD/JPY</td></tr>" +
              "<tr><td>London</td><td>United Kingdom</td><td>EUR/USD, GBP/USD, EUR/GBP</td></tr>" +
              "<tr><td>New York</td><td>United States</td><td>EUR/USD, USD/CAD, USD/JPY</td></tr>" +
              "</tbody></table>" +
              '<p>Exact hours shift twice a year when daylight saving time starts and ends, and not every country changes on the same date. The <a href="/tools/market-hours">market hours tool</a> shows the current times in your own time zone.</p>' +
              "<h2>Why overlaps matter</h2>" +
              "<p>When two centres are open at once, more participants are trading, so volume rises and spreads on the major pairs usually tighten. The <strong>London–New York overlap</strong> is typically the most active window of the day. The Asian session is often calmer, with ranges that later sessions break out of.</p>" +
              "<h2>Practical takeaways</h2><ul>" +
              "<li>Trade the pairs that are awake: a yen pair at the London close is a different animal from the same pair in Tokyo hours.</li>" +
              "<li>Expect wider spreads around the daily rollover and at the weekly open.</li>" +
              "<li>Choose sessions that fit your life — consistency beats catching every move.</li></ul>",
          },
        ],
      },
      {
        title: "What moves exchange rates",
        description: "Interest rates, economic data and how to follow them.",
        lessons: [
          {
            slug: "interest-rates-and-currencies",
            title: "Interest Rates: The Biggest Driver",
            summary:
              "Money flows toward higher expected returns, so central-bank policy — and what markets expect it to be — sits behind most major currency trends.",
            minutes: 14,
            image: "dollar-rate-arrow",
            externalUrl: "https://www.federalreserve.gov/monetarypolicy.htm",
            objectives: [
              "Explain why higher expected interest rates can support a currency",
              "Distinguish a rate decision from the guidance around it",
              "Describe an interest-rate differential",
            ],
            seoTitle: "How Interest Rates Move Currency Prices",
            seoDescription:
              "Why central-bank interest rates and expectations about them are the single biggest driver of exchange rates, explained for beginners.",
            keyword: "interest rates and forex",
            content:
              "<h2>Why rates matter</h2>" +
              "<p>Holding a currency means holding deposits or bonds in it, and those pay interest. When one central bank is expected to keep rates higher than another, investors have a reason to prefer its currency. That preference, spread across trillions in daily turnover, is what turns a policy decision into a price move.</p>" +
              "<h2>Expectations move first</h2>" +
              "<p>Markets trade what they <em>expect</em> to happen. If everyone already expects a rate rise, the currency may barely move when it arrives — or even fall if the accompanying statement sounds cautious. The surprise, not the decision itself, is what moves prices.</p>" +
              "<h3>Forward guidance</h3><p>Central banks publish statements and hold press conferences explaining how they see the economy. A change in a single phrase can shift expectations for months ahead.</p>" +
              "<h2>The interest-rate differential</h2>" +
              "<p>For a currency pair, what matters is the <strong>gap</strong> between the two countries' rates. If the gap is expected to widen in favour of the base currency, the pair tends to rise; if it narrows, the pair tends to fall.</p>" +
              '<h2>Where to follow policy</h2><p>Each central bank publishes its decisions and meeting calendar. The Federal Reserve\'s monetary-policy page is linked from this lesson as an external resource, and the <a href="/economic-calendar">economic calendar</a> lists upcoming decisions for every major bank.</p>',
          },
          {
            slug: "reading-the-economic-calendar",
            title: "Reading the Economic Calendar",
            summary:
              "Inflation, jobs and growth figures arrive on a schedule. Knowing when they land — and how much they matter — keeps you out of avoidable surprises.",
            minutes: 12,
            image: "desk-reports-planning",
            objectives: [
              "Read the columns of an economic calendar",
              "Explain the difference between forecast, previous and actual",
              "Plan around high-impact releases",
            ],
            seoTitle: "How to Read a Forex Economic Calendar",
            seoDescription:
              "Learn to read an economic calendar — impact levels, forecasts and actual figures — and plan your forex trading around major releases.",
            keyword: "economic calendar forex",
            content:
              "<h2>What the calendar shows</h2>" +
              "<p>An economic calendar lists scheduled releases: the time, the country, the event and usually three numbers — the <strong>previous</strong> reading, the <strong>forecast</strong> (the consensus of economists) and, once released, the <strong>actual</strong> figure.</p>" +
              "<h2>Surprise is what moves prices</h2>" +
              "<p>A strong number that matches the forecast often changes little, because it was already expected. When the actual figure lands far from the forecast, prices adjust quickly. The larger the surprise and the more important the release, the bigger the reaction tends to be.</p>" +
              "<h2>Releases worth knowing</h2><ul>" +
              "<li><strong>Interest-rate decisions</strong> and the statements that come with them</li>" +
              "<li><strong>Inflation</strong> (consumer price index) — it shapes what central banks do next</li>" +
              "<li><strong>Employment</strong>, such as the US non-farm payrolls report</li>" +
              "<li><strong>Growth</strong> figures (GDP) and business surveys (PMIs)</li></ul>" +
              "<h2>A simple routine</h2><ol>" +
              "<li>Check the week's high-impact events on Monday.</li>" +
              "<li>Note which of them affect the pairs you trade.</li>" +
              "<li>Decide in advance whether you will be flat, reduce size or widen stops around them.</li></ol>" +
              '<p>Open the site\'s <a href="/economic-calendar">economic calendar</a> and filter it to the currencies you follow to practise.</p>',
          },
        ],
      },
    ],
    cheatSheet: {
      title: "Forex Sessions & Drivers - Cheat Sheet",
      label: "Sessions & drivers cheat sheet (PDF)",
      lines: [
        "# The four sessions",
        "Sydney -> Tokyo -> London -> New York. The London-New York overlap is usually the busiest window of the day.",
        "Hours shift with daylight saving time; check a session clock in your own time zone.",
        "# What moves currencies",
        "1. Interest-rate decisions and the guidance around them.",
        "2. Inflation data - it shapes what central banks do next.",
        "3. Employment and growth figures.",
        "4. Risk sentiment - the mood across all markets.",
        "# Calendar routine",
        "Every Monday: list the high-impact events for your pairs. Decide beforehand whether you will stay flat, trade smaller or widen stops.",
        "The surprise (actual versus forecast) moves prices, not the number itself.",
        "Educational material only - not investment advice.",
      ],
    },
  },
  {
    slug: "forex-risk-management-and-psychology",
    track: "forex",
    title: "Risk Management and Trading Psychology",
    summary:
      "Position sizing, stop placement, risk-reward and the habits that keep a trading account alive long enough to learn.",
    difficulty: "INTERMEDIATE",
    hours: 3,
    image: "hand-candlestick-chart",
    featured: false,
    seoTitle: "Forex Risk Management & Trading Psychology Course",
    seoDescription:
      "Learn position sizing, stop-loss placement, risk-reward and expectancy, and the psychological habits that protect a forex trading account.",
    keyword: "forex risk management",
    description:
      "<h2>About this course</h2>" +
      "<p>Most traders who fail do not fail because they never found a good trade. They fail because one or two bad trades were too large. This course is about the part of trading you fully control: how much you risk, where you get out, and how you behave when a trade goes against you.</p>" +
      "<h2>What you will learn</h2><ul>" +
      "<li>How to size a position from your account, your risk percentage and your stop distance</li>" +
      "<li>Where to place a stop-loss so it reflects the chart, not your pain threshold</li>" +
      "<li>Risk-reward and expectancy — why a 40% win rate can still be profitable</li>" +
      "<li>A trading journal and the habits that keep emotion out of decisions</li></ul>" +
      '<h2>Tools you will use</h2><p>The <a href="/tools/position-size">position size calculator</a>, <a href="/tools/pip-value">pip calculator</a> and <a href="/tools/risk-reward">risk-reward calculator</a> do the arithmetic in this course for you.</p>' +
      faq([
        [
          "How much should I risk per trade?",
          "Many educators suggest a small fixed percentage — often 1–2% of the account — so that a run of losses cannot do serious damage. The right number is the one you can lose ten times in a row and still follow your plan.",
        ],
        [
          "Is a tighter stop-loss always safer?",
          "No. A stop placed inside normal price noise is hit more often. A better stop sits where your trade idea is proven wrong, and the position size is then reduced to keep the risk the same.",
        ],
        [
          "Why keep a journal?",
          "Memory is kind to our decisions. A written record of why you entered, where you exited and how you felt is the only honest way to find what to improve.",
        ],
      ]),
    sections: [
      {
        title: "Sizing and protecting a trade",
        description: "The arithmetic of risk.",
        lessons: [
          {
            slug: "position-sizing-the-one-percent-rule",
            title: "Position Sizing and the 1% Rule",
            summary:
              "Decide what you will lose if you are wrong, then let the stop distance tell you how big the trade can be.",
            minutes: 15,
            image: "figures-climbing-chart",
            videoUrl: yt("pSWzuugtQOY"),
            objectives: [
              "Calculate a position size from account, risk % and stop distance",
              "Convert a lot size into a value per pip",
              "Explain why size, not win rate, decides survival",
            ],
            seoTitle: "Forex Position Sizing and the 1% Rule",
            seoDescription:
              "Step-by-step forex position sizing: fix your risk per trade, measure your stop in pips and calculate the correct lot size.",
            keyword: "forex position sizing",
            content:
              "<h2>Start with the loss, not the profit</h2>" +
              "<p>Before you enter, decide how much of your account you are willing to lose if the trade fails. Many traders use a fixed percentage — commonly 1% — so each loss is small and a losing streak stays survivable.</p>" +
              "<h2>The three inputs</h2><ol>" +
              "<li><strong>Account balance</strong> — say $5,000.</li>" +
              "<li><strong>Risk per trade</strong> — 1% of $5,000 is $50.</li>" +
              "<li><strong>Stop distance</strong> — the gap between entry and stop, in pips. Say 25 pips.</li></ol>" +
              "<h2>The calculation</h2>" +
              "<p>Divide the money at risk by the stop distance: $50 ÷ 25 pips = <strong>$2 per pip</strong>. On EUR/USD with a US-dollar account, one standard lot (100,000 units) is worth about $10 per pip, so $2 per pip is <strong>0.20 lots</strong> — two mini lots.</p>" +
              "<table><thead><tr><th>Lot</th><th>Units</th><th>Approx. value per pip on EUR/USD</th></tr></thead><tbody>" +
              "<tr><td>Standard</td><td>100,000</td><td>$10</td></tr><tr><td>Mini</td><td>10,000</td><td>$1</td></tr><tr><td>Micro</td><td>1,000</td><td>$0.10</td></tr></tbody></table>" +
              "<h2>Why it works</h2><p>With 1% risk, ten losses in a row cost roughly a tenth of the account — painful, but recoverable. With 10% risk, the same streak can end the account. Survival is decided by size far more than by how often you are right.</p>" +
              '<p>Try the numbers yourself in the <a href="/tools/position-size">position size calculator</a>.</p>',
          },
          {
            slug: "placing-a-stop-loss-with-purpose",
            title: "Placing a Stop-Loss With Purpose",
            summary:
              "A stop belongs where your trade idea is proven wrong — beyond structure and normal noise — not at a round number you can stomach.",
            minutes: 12,
            image: "candlestick-bokeh",
            objectives: [
              "Place a stop beyond a support or resistance level",
              "Account for spread and normal volatility",
              "Adjust size, not the stop, to keep risk constant",
            ],
            seoTitle: "How to Place a Stop-Loss in Forex",
            seoDescription:
              "Place forex stop-losses where your idea is invalidated: beyond structure, outside normal volatility, with size adjusted to keep risk fixed.",
            keyword: "stop loss placement",
            content:
              "<h2>What a stop is for</h2>" +
              "<p>A stop-loss is an instruction to close a trade automatically at a chosen price. Its job is to take you out when the reason you entered is no longer true — not to cap how much discomfort you feel.</p>" +
              "<h2>Anchor it to the chart</h2><ul>" +
              "<li>For a buy, place the stop a little <strong>below</strong> the support or swing low your idea relies on.</li>" +
              "<li>For a sell, place it a little <strong>above</strong> the resistance or swing high.</li>" +
              "<li>Leave room for the spread and for the pair's normal movement; a stop two pips beyond a level is often clipped by noise.</li></ul>" +
              "<h2>Keep the risk, change the size</h2>" +
              "<p>If the logical stop is 60 pips away instead of 25, do not squeeze it closer. Keep the money at risk the same and trade a smaller position. The stop describes the market; the size describes your risk.</p>" +
              "<h2>Things a stop cannot do</h2><p>In a fast market or over a weekend gap, a stop can be filled worse than its price — this is <strong>slippage</strong>. It is one more reason to keep each position modest.</p>",
          },
        ],
      },
      {
        title: "Thinking in probabilities",
        description: "Expectancy, records and discipline.",
        lessons: [
          {
            slug: "risk-reward-and-expectancy",
            title: "Risk-Reward and Expectancy",
            summary:
              "Win rate on its own tells you little. Combined with how much you make when right and lose when wrong, it tells you whether a strategy can work.",
            minutes: 14,
            image: "analyst-rising-chart",
            videoUrl: yt("fSBQ_1p9NPk"),
            objectives: [
              "Express a trade's target and stop as a risk-reward ratio",
              "Calculate expectancy in R multiples",
              "Explain why a lower win rate can still be profitable",
            ],
            seoTitle: "Risk-Reward Ratio and Trading Expectancy",
            seoDescription:
              "Understand risk-reward ratios and expectancy, and see why a strategy that wins only 40% of the time can still make money.",
            keyword: "risk reward ratio",
            content:
              "<h2>Measuring in R</h2>" +
              "<p>Call the amount you risk on a trade <strong>1R</strong>. A trade that targets twice its risk has a reward of 2R — a risk-reward ratio of 1:2.</p>" +
              "<h2>Expectancy</h2>" +
              "<p>Expectancy is the average result per trade over many trades:</p>" +
              "<p><strong>Expectancy = (win rate × average win) − (loss rate × average loss)</strong></p>" +
              "<p>With a 40% win rate, 2R wins and 1R losses: (0.40 × 2) − (0.60 × 1) = <strong>+0.2R per trade</strong>. Over 100 trades risking $50 each, that is a positive result of about $1,000 before costs — even though six trades in ten lost.</p>" +
              "<h2>The trade-off</h2><p>Larger targets are hit less often. A strategy is not improved by stretching every target to 5R if that makes the win rate collapse. Test both numbers together and keep records, so the figures come from your trades rather than hope.</p>" +
              '<p>The <a href="/tools/risk-reward">risk-reward calculator</a> works out the ratio from entry, stop and target prices.</p>',
          },
          {
            slug: "trading-journal-and-discipline",
            title: "Your Trading Journal and Discipline",
            summary:
              "A written record of every trade — and how you felt placing it — turns experience into improvement.",
            minutes: 10,
            image: "laptop-chart-review",
            objectives: [
              "List the fields a useful trading journal records",
              "Recognise revenge trading and overtrading",
              "Set rules that stop one bad day becoming a bad month",
            ],
            seoTitle: "Trading Journal and Trading Discipline",
            seoDescription:
              "Build a trading journal, recognise emotional mistakes like revenge trading, and set simple rules that protect your account.",
            keyword: "trading journal",
            content:
              "<h2>What to record</h2><ul>" +
              "<li>Date, pair, direction, entry, stop, target and size</li>" +
              "<li>Why you took the trade — the setup in one sentence</li>" +
              "<li>The result in R, and whether you followed your plan</li>" +
              "<li>How you felt before and after: calm, rushed, frustrated</li></ul>" +
              "<h2>Common emotional traps</h2>" +
              '<h3>Revenge trading</h3><p>Entering straight after a loss to "win it back", usually larger and with less thought.</p>' +
              "<h3>Overtrading</h3><p>Taking setups that do not meet your rules because sitting still feels like missing out.</p>" +
              '<h3>Moving the stop</h3><p>Widening a stop so the trade "has room" — which turns a planned 1R loss into an unplanned bigger one.</p>' +
              "<h2>Rules that help</h2><ol>" +
              "<li>A daily loss limit — for example, stop for the day after two losses.</li>" +
              "<li>A weekly review of your journal, looking for patterns, not individual trades.</li>" +
              "<li>No trading during the first minutes after a high-impact release unless that is your tested strategy.</li></ol>" +
              "<p>The attached cheat sheet summarises the whole course on one printable page.</p>",
          },
        ],
      },
    ],
    cheatSheet: {
      title: "Risk Management - Cheat Sheet",
      label: "Risk management cheat sheet (PDF)",
      lines: [
        "# Position size in three steps",
        "1. Money at risk = balance x risk %. Example: $5,000 x 1% = $50.",
        "2. Value per pip = money at risk / stop in pips. Example: $50 / 25 = $2 per pip.",
        "3. Lots = value per pip / pip value of 1 lot. On EUR/USD 1 standard lot ~ $10 per pip, so $2 = 0.20 lots.",
        "# Stops",
        "Place the stop where the idea is proven wrong, beyond structure and normal noise. Change the size, never the stop, to keep risk constant.",
        "# Expectancy",
        "Expectancy = (win rate x average win) - (loss rate x average loss). 40% wins at 2R, 60% losses at 1R = +0.2R per trade.",
        "# Discipline",
        "Journal every trade. Set a daily loss limit. Review weekly for patterns.",
        "Educational material only - not investment advice.",
      ],
    },
  },
  {
    slug: "bitcoin-for-beginners",
    track: "crypto",
    title: "Bitcoin for Beginners",
    summary:
      "What Bitcoin is, how transactions are confirmed without a bank, why its supply is capped, and how to buy and hold it safely.",
    difficulty: "BEGINNER",
    hours: 2,
    image: "bitcoin-circuit-board",
    featured: true,
    seoTitle: "Bitcoin for Beginners: How Bitcoin Works",
    seoDescription:
      "A plain-English beginner course on Bitcoin: blocks, mining, the 21 million supply cap, halvings, and how to buy and store bitcoin safely.",
    keyword: "bitcoin for beginners",
    description:
      "<h2>About this course</h2>" +
      "<p>Bitcoin is often discussed and rarely explained. This course starts from the problem it was designed to solve — sending value online without trusting a middleman — and builds up to the practical questions: how a transaction is confirmed, where new coins come from, and how to keep your own safe.</p>" +
      "<h2>What you will learn</h2><ul>" +
      "<li>What a blockchain records and why it is hard to rewrite</li>" +
      "<li>How mining and proof of work secure the network</li>" +
      "<li>The 21 million supply limit and the halving schedule</li>" +
      "<li>The difference between an exchange account and a wallet you control</li></ul>" +
      "<h2>Primary sources</h2><ul>" +
      '<li><a href="https://bitcoin.org/bitcoin.pdf" target="_blank" rel="noopener noreferrer">Bitcoin: A Peer-to-Peer Electronic Cash System</a> — the original 2008 white paper</li>' +
      '<li><a href="https://bitcoin.org/en/how-it-works" target="_blank" rel="noopener noreferrer">bitcoin.org: How it works</a></li></ul>' +
      faq([
        [
          "Do I need to buy a whole bitcoin?",
          "No. A bitcoin divides into 100 million satoshis, so you can hold a small fraction.",
        ],
        [
          "Who controls Bitcoin?",
          "No single company or government. The rules are enforced by the software thousands of independent computers run, and changing them needs broad agreement.",
        ],
        [
          "Is Bitcoin anonymous?",
          "It is pseudonymous. Every transaction is public on the blockchain; what is hidden is the real-world identity behind an address — until something links the two.",
        ],
      ]),
    sections: [
      {
        title: "How Bitcoin works",
        description: "The ledger, the miners and the rules.",
        lessons: [
          {
            slug: "what-bitcoin-is-and-why-it-exists",
            title: "What Bitcoin Is and Why It Exists",
            summary:
              "A way to send value over the internet that does not depend on a bank or payment company keeping the books.",
            minutes: 12,
            image: "crypto-coins-workstation",
            videoUrl: yt("bBC-nXj3Ng4"),
            objectives: [
              "Describe the double-spending problem",
              "Explain what a shared public ledger replaces",
              "Name who published the Bitcoin white paper and when",
            ],
            seoTitle: "What Is Bitcoin and Why Does It Exist?",
            seoDescription:
              "Learn what Bitcoin is, the double-spending problem it solves, and how a shared public ledger replaces a trusted middleman.",
            keyword: "what is bitcoin",
            content:
              "<h2>The problem</h2>" +
              "<p>Digital information can be copied. That is fine for a photo, but not for money: if you could copy a digital coin, you could spend it twice. Traditionally a bank or payment company solves this <strong>double-spending problem</strong> by keeping the only authoritative record of who owns what.</p>" +
              "<h2>Bitcoin's answer</h2>" +
              "<p>In 2008 a person or group using the name <strong>Satoshi Nakamoto</strong> published a white paper describing a different approach: keep the record on thousands of computers at once, and use a public competition to decide which new transactions are added. The network launched in January 2009.</p>" +
              "<h2>What you actually own</h2>" +
              "<p>There are no coin files. The ledger — the <strong>blockchain</strong> — records amounts assigned to addresses. Owning bitcoin means holding the <strong>private key</strong> that can authorise spending from an address. Lose the key and the coins are unreachable; share it and anyone can move them.</p>" +
              "<h2>Why people use it</h2><ul>" +
              "<li>Transfers that settle without an intermediary approving them</li>" +
              "<li>A supply fixed by software rather than by a central bank</li>" +
              "<li>Open access — anyone with an internet connection can participate</li></ul>" +
              "<blockquote><p>Bitcoin's price is highly volatile. Understanding how it works is not the same as knowing what it will be worth.</p></blockquote>",
          },
          {
            slug: "blocks-mining-and-proof-of-work",
            title: "Blocks, Mining and Proof of Work",
            summary:
              "Miners bundle transactions into blocks and compete to add them. The energy spent is what makes rewriting history impractical.",
            minutes: 14,
            image: "trading-screens-wall",
            videoUrl: yt("_160oMzblY8"),
            objectives: [
              "Explain what a block contains and how blocks link",
              "Describe proof of work in one paragraph",
              "State the target time between Bitcoin blocks",
            ],
            seoTitle: "Bitcoin Blocks, Mining and Proof of Work",
            seoDescription:
              "How Bitcoin miners build blocks, what proof of work is, and why linked blocks make the blockchain so hard to rewrite.",
            keyword: "bitcoin mining explained",
            content:
              "<h2>Blocks and the chain</h2>" +
              "<p>New transactions are grouped into a <strong>block</strong>. Each block includes a fingerprint — a <em>hash</em> — of the block before it. Change anything in an old block and its fingerprint changes, breaking the link to every block after it. That chain of fingerprints is the blockchain.</p>" +
              "<h2>Mining</h2>" +
              "<p>To add a block, a miner must find a number that makes the block's hash fall below a target. There is no shortcut: computers simply try enormous numbers of guesses. The first to succeed broadcasts the block, other nodes check it, and the miner earns newly created bitcoin plus the transaction fees. This is <strong>proof of work</strong>.</p>" +
              "<h2>The ten-minute rhythm</h2>" +
              "<p>The network adjusts the difficulty roughly every two weeks so that, on average, a block is found about every <strong>ten minutes</strong>, however much computing power joins or leaves.</p>" +
              "<h2>Why it is secure</h2><p>To rewrite a past transaction, an attacker would have to redo the work for that block and every block after it, faster than the rest of the network combined. For a large network, the cost makes this impractical — which is why a transaction with several confirmations is treated as final.</p>",
          },
        ],
      },
      {
        title: "Owning bitcoin safely",
        description: "Supply, buying and custody.",
        lessons: [
          {
            slug: "bitcoin-supply-and-the-halving",
            title: "The 21 Million Cap and the Halving",
            summary:
              "New bitcoin enters circulation on a published schedule that halves roughly every four years, until the supply approaches 21 million.",
            minutes: 10,
            image: "figures-climbing-chart",
            objectives: [
              "State Bitcoin's maximum supply",
              "Explain what a halving changes",
              "Define a satoshi",
            ],
            seoTitle: "Bitcoin's 21 Million Cap and the Halving",
            seoDescription:
              "Why Bitcoin's supply is capped at 21 million, how the halving cuts new issuance every 210,000 blocks, and what a satoshi is.",
            keyword: "bitcoin halving",
            content:
              "<h2>A fixed schedule</h2>" +
              "<p>The only way new bitcoin is created is the reward paid to the miner of each block. The software sets that reward and cuts it in half every <strong>210,000 blocks</strong> — about every four years. This event is called the <strong>halving</strong>.</p>" +
              "<h2>The cap</h2>" +
              "<p>Because the reward keeps halving, total issuance approaches but never exceeds <strong>21 million bitcoin</strong>. After the final fractions are mined, miners will be paid by transaction fees alone.</p>" +
              "<h2>Small units</h2><p>One bitcoin divides into 100,000,000 <strong>satoshis</strong> (0.00000001 BTC each), so a capped supply does not stop anyone holding a small amount.</p>" +
              "<h2>What the halving does — and does not — do</h2><ul>" +
              "<li>It reduces how quickly new coins reach the market.</li>" +
              "<li>It reduces miners' income in bitcoin terms, which can push less efficient miners out.</li>" +
              "<li>It does <strong>not</strong> guarantee any price outcome. Past cycles are not a forecast.</li></ul>",
          },
          {
            slug: "buying-and-storing-bitcoin-safely",
            title: "Buying and Storing Bitcoin Safely",
            summary:
              "An exchange account, a software wallet and a hardware wallet trade convenience for control in different ways. Know which one you are using.",
            minutes: 14,
            image: "crypto-coins-workstation",
            videoUrl: yt("GSTiKjnBaes"),
            externalUrl: "https://www.fca.org.uk/consumers/cryptoassets",
            objectives: [
              "Distinguish custodial from self-custody storage",
              "Explain what a seed phrase is and how to protect it",
              "Recognise the most common crypto scams",
            ],
            seoTitle: "How to Buy and Store Bitcoin Safely",
            seoDescription:
              "Custodial exchanges, software wallets and hardware wallets compared — plus seed-phrase safety and the scams every beginner should know.",
            keyword: "store bitcoin safely",
            content:
              "<h2>Where your bitcoin can live</h2>" +
              "<table><thead><tr><th>Option</th><th>Who holds the keys</th><th>Trade-off</th></tr></thead><tbody>" +
              "<tr><td>Exchange account</td><td>The exchange</td><td>Convenient; you rely on the company staying solvent and secure</td></tr>" +
              "<tr><td>Software wallet</td><td>You, on a phone or computer</td><td>You control the keys; the device can be hacked or lost</td></tr>" +
              "<tr><td>Hardware wallet</td><td>You, on a dedicated offline device</td><td>Strong protection for savings; less convenient for frequent use</td></tr>" +
              "</tbody></table>" +
              "<h2>The seed phrase</h2>" +
              "<p>A self-custody wallet gives you a <strong>seed phrase</strong> — usually 12 or 24 words — that can rebuild every key in it. Write it down on paper, store it somewhere safe and private, and never type it into a website or share it with anyone. Nobody legitimate will ever ask for it.</p>" +
              "<h2>Scams to recognise</h2><ul>" +
              '<li>"Support staff" who ask for your seed phrase or remote access</li>' +
              "<li>Promises of guaranteed or doubled returns</li>" +
              "<li>Fake apps and look-alike websites</li>" +
              "<li>Pressure to act immediately</li></ul>" +
              "<p>The UK Financial Conduct Authority's consumer guidance on cryptoassets is linked from this lesson. The printable safety checklist is attached below.</p>",
          },
        ],
      },
    ],
    cheatSheet: {
      title: "Bitcoin Safety Checklist",
      label: "Bitcoin safety checklist (PDF)",
      lines: [
        "# Key facts",
        "Maximum supply: 21 million BTC. 1 BTC = 100,000,000 satoshis.",
        "A new block roughly every 10 minutes; the block reward halves every 210,000 blocks (about 4 years).",
        "Confirmed transactions are effectively irreversible - check the address before you send.",
        "# Custody",
        "Exchange account: the exchange holds the keys. Wallet: you hold the keys.",
        "Keep long-term savings in self-custody you understand, such as a hardware wallet.",
        "# Seed phrase",
        "Write it on paper. Store it privately. Never photograph it, type it into a website or share it.",
        "Nobody legitimate will ever ask for your seed phrase.",
        "# Red flags",
        "Guaranteed returns. Pressure to act now. Unsolicited 'support' contact. Look-alike apps and sites.",
        "Educational material only - not investment advice.",
      ],
    },
  },
  {
    slug: "crypto-trading-essentials",
    track: "crypto",
    title: "Crypto Trading Essentials",
    summary:
      "Spot versus derivatives, reading an order book, stablecoins, fees, and managing risk in a market that never closes.",
    difficulty: "INTERMEDIATE",
    hours: 3,
    image: "tablet-trading-chart",
    featured: false,
    seoTitle: "Crypto Trading Essentials for Beginners",
    seoDescription:
      "Learn crypto spot and derivatives trading, order books, stablecoins and fees, and how to manage risk in a 24/7 volatile market.",
    keyword: "crypto trading basics",
    description:
      "<h2>About this course</h2>" +
      "<p>Trading crypto looks like trading anything else — until it runs through a weekend, drops 15% overnight or charges a fee you did not notice. This course covers the mechanics that are specific to crypto markets and the risk habits they demand.</p>" +
      "<h2>What you will learn</h2><ul>" +
      "<li>The difference between buying a coin and trading a contract on it</li>" +
      "<li>How to read an order book, spreads and depth</li>" +
      "<li>What stablecoins are and the risks they still carry</li>" +
      "<li>Position sizing for a volatile, always-open market</li></ul>" +
      "<h2>Further reading</h2><ul>" +
      '<li><a href="https://ethereum.org/en/what-is-ethereum/" target="_blank" rel="noopener noreferrer">ethereum.org: What is Ethereum?</a></li>' +
      '<li><a href="https://www.fca.org.uk/consumers/cryptoassets" target="_blank" rel="noopener noreferrer">FCA: Cryptoassets — consumer guidance</a></li></ul>' +
      faq([
        [
          "Is crypto trading riskier than forex?",
          "Price swings are typically much larger, markets trade around the clock, and many platforms are lightly regulated. Smaller positions are the usual answer.",
        ],
        [
          "What is a perpetual future?",
          "A derivative contract with no expiry date that tracks a coin's price through a periodic funding payment between long and short traders. It usually involves leverage.",
        ],
        [
          "Are stablecoins risk-free?",
          "No. A stablecoin is only as good as the reserves or mechanism behind it, and several have lost their peg in the past.",
        ],
      ]),
    sections: [
      {
        title: "Market mechanics",
        description: "What you are trading and how orders meet.",
        lessons: [
          {
            slug: "spot-versus-derivatives-in-crypto",
            title: "Spot Versus Derivatives",
            summary:
              "Buying a coin outright and trading a leveraged contract on its price carry very different risks.",
            minutes: 12,
            image: "cartoon-trader-charts",
            objectives: [
              "Distinguish spot trading from futures and perpetual contracts",
              "Explain how leverage magnifies losses as well as gains",
              "Describe liquidation",
            ],
            seoTitle: "Crypto Spot vs Derivatives Trading",
            seoDescription:
              "The difference between spot crypto trading and futures or perpetual contracts, and how leverage and liquidation work.",
            keyword: "crypto spot vs futures",
            content:
              "<h2>Spot</h2>" +
              "<p>A <strong>spot</strong> trade exchanges one asset for another now: you pay dollars or a stablecoin and receive the coin. You can withdraw it to your own wallet, and the most you can lose is what you paid.</p>" +
              "<h2>Derivatives</h2>" +
              "<p>A <strong>futures</strong> contract is an agreement on a price for later. Crypto platforms popularised the <strong>perpetual</strong> contract, which never expires; a periodic <em>funding payment</em> between buyers and sellers keeps its price close to spot. You never own the coin — only exposure to its price.</p>" +
              "<h2>Leverage and liquidation</h2>" +
              "<p>Derivatives usually let you control a position larger than your deposit. At 10× leverage, a 10% move against you wipes out the margin, and the platform <strong>liquidates</strong> — closes the position automatically. In a market that can move that far in hours, high leverage turns ordinary volatility into total loss.</p>" +
              "<h2>A sensible default</h2><p>Learn on spot, in small size. If you later use derivatives, treat leverage as a way to post less collateral, not as a way to take a bigger position.</p>",
          },
          {
            slug: "reading-a-crypto-order-book",
            title: "Reading an Order Book",
            summary:
              "Bids, asks, the spread and market depth show you what it will actually cost to get in and out.",
            minutes: 12,
            image: "market-data-screens",
            objectives: [
              "Identify bids, asks and the spread",
              "Explain market depth and slippage",
              "Choose between market and limit orders",
            ],
            seoTitle: "How to Read a Crypto Order Book",
            seoDescription:
              "Read a crypto order book: bids, asks, spreads, depth and slippage — and when to use market or limit orders.",
            keyword: "crypto order book",
            content:
              "<h2>Two queues</h2>" +
              "<p>An order book lists everyone waiting to trade. <strong>Bids</strong> are offers to buy, highest first; <strong>asks</strong> are offers to sell, lowest first. The gap between the best bid and the best ask is the <strong>spread</strong>.</p>" +
              "<h2>Depth</h2>" +
              "<p>Each price level shows a quantity. Lots of size near the best prices means a <em>deep</em> book: you can trade meaningful amounts without moving the price. A thin book means a large market order eats through several levels and fills at a worse average — <strong>slippage</strong>.</p>" +
              "<h2>Market or limit?</h2><ul>" +
              "<li>A <strong>market order</strong> fills immediately at the best available prices. Fast, but you accept the spread and any slippage.</li>" +
              "<li>A <strong>limit order</strong> waits at your price. You control the price, but it may never fill.</li></ul>" +
              "<h2>Fees</h2><p>Many exchanges charge <em>takers</em> (market orders) more than <em>makers</em> (limit orders that add liquidity). On frequent small trades, fees and spreads can outweigh the moves you are trying to catch.</p>",
          },
        ],
      },
      {
        title: "Managing crypto risk",
        description: "Stablecoins, volatility and sizing.",
        lessons: [
          {
            slug: "stablecoins-explained",
            title: "Stablecoins Explained",
            summary:
              "Tokens designed to hold a steady value, usually one US dollar — useful for moving between trades, and not without risk.",
            minutes: 10,
            image: "dollar-rising-arrow",
            objectives: [
              "Explain what a stablecoin is designed to do",
              "Distinguish reserve-backed from algorithmic designs",
              "Name the main risks of holding stablecoins",
            ],
            seoTitle: "Stablecoins Explained for Crypto Traders",
            seoDescription:
              "What stablecoins are, how reserve-backed and algorithmic designs differ, and the risks traders should understand before holding them.",
            keyword: "stablecoins explained",
            content:
              "<h2>What they are for</h2>" +
              "<p>A <strong>stablecoin</strong> is a crypto token designed to track a reference asset — most often the US dollar. Traders use them to park value between trades without leaving the crypto system, and to price other coins.</p>" +
              "<h2>How they hold their value</h2>" +
              "<h3>Reserve-backed</h3><p>The issuer holds cash and short-term assets and promises to redeem tokens one-for-one. Trust rests on the quality of the reserves and the issuer's disclosures.</p>" +
              "<h3>Crypto-collateralised</h3><p>Tokens are backed by other crypto deposited in excess of their value, managed by smart contracts.</p>" +
              "<h3>Algorithmic</h3><p>Supply is expanded or contracted by rules rather than backed by reserves. Some designs of this kind have failed dramatically.</p>" +
              "<h2>Risks</h2><ul>" +
              "<li><strong>De-pegging</strong> — the price can slip below its target in stress</li>" +
              "<li><strong>Issuer and reserve risk</strong> — what is actually held, and where</li>" +
              "<li><strong>Regulatory risk</strong> — rules are still being written in many countries</li></ul>",
          },
          {
            slug: "managing-risk-in-a-24-7-market",
            title: "Managing Risk in a 24/7 Market",
            summary:
              "Crypto never closes and routinely moves several percent a day. Size, stops and time away from the screen all need adjusting.",
            minutes: 12,
            image: "silhouettes-market-grid",
            videoUrl: yt("p_LWJgTBIFs"),
            objectives: [
              "Size a crypto position for its higher volatility",
              "Plan for moves that happen while you sleep",
              "Keep exchange and custody risk separate from market risk",
            ],
            seoTitle: "Crypto Risk Management in a 24/7 Market",
            seoDescription:
              "Position sizing, stop orders and custody habits for crypto markets that trade around the clock and move far more than currencies.",
            keyword: "crypto risk management",
            content:
              "<h2>Volatility changes the arithmetic</h2>" +
              "<p>A major currency pair might move well under 1% on a typical day; a large cryptocurrency can move several times that. If you use the same stop distance in percentage terms, you will be stopped out constantly — so stops are wider and <strong>positions are smaller</strong> for the same money at risk.</p>" +
              "<h2>No closing bell</h2><ul>" +
              "<li>Decide before you sleep what would make you exit, and place that order.</li>" +
              "<li>Weekends can be thin: fewer participants, larger jumps.</li>" +
              "<li>Set price alerts rather than watching every candle.</li></ul>" +
              "<h2>Risks that are not price</h2>" +
              "<p>Crypto adds risks a chart does not show: an exchange can halt withdrawals, a token contract can have a bug, and a transfer to the wrong address cannot be reversed. Keep only trading funds on an exchange and the rest in custody you control.</p>" +
              '<p>The <a href="/tools/position-size">position size calculator</a> applies to crypto as well: enter your stop distance in price terms and your risk amount.</p>',
          },
        ],
      },
    ],
    cheatSheet: {
      title: "Crypto Trading Essentials - Cheat Sheet",
      label: "Crypto trading cheat sheet (PDF)",
      lines: [
        "# Spot vs derivatives",
        "Spot: you own the coin; the most you can lose is what you paid. Derivatives: price exposure only, usually leveraged, and positions can be liquidated.",
        "At 10x leverage a 10% move against you wipes out the margin.",
        "# Order book",
        "Bids = buyers (highest first). Asks = sellers (lowest first). Spread = best ask - best bid.",
        "Market orders are immediate but pay the spread and slippage; limit orders control price but may not fill.",
        "# Stablecoins",
        "Designed to track a reference asset such as USD. Risks: de-pegging, reserves, regulation.",
        "# Risk habits",
        "Smaller positions and wider stops for higher volatility. Place exit orders before you step away. Keep only trading funds on an exchange.",
        "Educational material only - not investment advice.",
      ],
    },
  },
];

/** Pictures for the regular seed's demo content, filled where a slot is empty. */
export const DEMO_COURSE_COVERS: Record<string, ImageName> = {
  "forex-fundamentals": "dollar-rate-arrow",
  "crypto-foundations": "crypto-coins-workstation",
};

export const DEMO_LESSON_HEROES: Record<string, ImageName> = {
  "the-foreign-exchange-market": "city-skyline-candlesticks",
  "currency-pairs-and-quotes": "dollar-rising-arrow",
  "pips-lots-and-leverage": "figures-climbing-chart",
  "candlesticks-explained": "candlestick-bokeh",
  "support-and-resistance": "hand-candlestick-chart",
  "order-types": "laptop-chart-review",
  "risk-and-position-sizing": "analyst-rising-chart",
  "further-reading-bis-survey": "desk-reports-planning",
  "what-a-blockchain-is": "bitcoin-circuit-board",
  "wallets-keys-and-custody": "crypto-coins-workstation",
  "exchanges-and-liquidity": "market-data-screens",
  "volatility-and-position-sizing": "trading-screens-wall",
  "common-scams-and-red-flags": "silhouettes-market-grid",
};

export const DEMO_QUIZ_COVERS: Record<string, ImageName> = {
  "forex-basics-check": "tablet-trading-chart",
  "crypto-basics-check": "bitcoin-circuit-board",
};

export const DEMO_VIDEO_COVERS: Record<string, ImageName> = {
  "reading-your-first-candlestick-chart": "candlestick-bokeh",
  "placing-a-stop-loss-that-survives-noise": "hand-candlestick-chart",
  "building-a-weekly-trading-plan": "desk-reports-planning",
  "what-a-blockchain-actually-records": "bitcoin-circuit-board",
  "custody-and-why-keys-matter": "crypto-coins-workstation",
  "reading-on-chain-volume-honestly": "market-data-screens",
};

export const GLOSSARY_TOPIC_COVERS: Record<string, ImageName> = {
  "trading-basics": "laptop-chart-review",
  "orders-and-execution": "tablet-trading-chart",
  "risk-management": "analyst-rising-chart",
  "technical-analysis": "candlestick-bokeh",
  "market-fundamentals": "dollar-rate-arrow",
  crypto: "bitcoin-circuit-board",
};

/** Cover and header for seeded articles with none, cycled in slug order. */
export const ARTICLE_IMAGES: ImageName[] = [
  "analyst-rising-chart",
  "dollar-rate-arrow",
  "market-data-screens",
  "desk-reports-planning",
  "city-skyline-candlesticks",
  "trading-screens-wall",
  "hand-candlestick-chart",
  "dollar-rising-arrow",
];

// ─── Quizzes ─────────────────────────────────────────────────

export interface QuizSpec {
  slug: string;
  track: "forex" | "crypto";
  title: string;
  description: string;
  category: string;
  image: ImageName;
  questions: {
    type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
    prompt: string;
    options: string[];
    correctAnswer: number | number[];
    explanations: string[];
  }[];
}

export const QUIZZES: QuizSpec[] = [
  {
    slug: "forex-pips-lots-and-risk-quiz",
    track: "forex",
    title: "Forex Pips, Lots and Risk Quiz",
    description:
      "Ten questions on pips, lot sizes, margin, position sizing and expectancy. Every answer comes with a worked explanation.",
    category: "risk-management",
    image: "hand-candlestick-chart",
    questions: [
      {
        type: "SINGLE_CHOICE",
        prompt: "On EUR/USD, how large is one pip?",
        options: ["0.01", "0.001", "0.0001", "1.0"],
        correctAnswer: 2,
        explanations: [
          "0.01 is a pip on yen pairs such as USD/JPY, not on EUR/USD.",
          "0.001 is ten pips on EUR/USD.",
          "Correct. For most pairs a pip is the fourth decimal place, 0.0001.",
          "1.0 would be ten thousand pips.",
        ],
      },
      {
        type: "SINGLE_CHOICE",
        prompt: "On USD/JPY, how large is one pip?",
        options: ["0.0001", "0.01", "0.1", "1"],
        correctAnswer: 1,
        explanations: [
          "That is a pip on most non-yen pairs.",
          "Correct. Yen pairs are quoted to two decimal places, so a pip is 0.01.",
          "0.1 is ten pips on a yen pair.",
          "1 is a hundred pips on a yen pair.",
        ],
      },
      {
        type: "SINGLE_CHOICE",
        prompt: "How many units of the base currency is one standard lot?",
        options: ["1,000", "10,000", "100,000", "1,000,000"],
        correctAnswer: 2,
        explanations: [
          "1,000 units is a micro lot.",
          "10,000 units is a mini lot.",
          "Correct. A standard lot is 100,000 units.",
          "No common lot name refers to a million units.",
        ],
      },
      {
        type: "SINGLE_CHOICE",
        prompt:
          "With a US-dollar account, roughly what is one pip worth on one standard lot of EUR/USD?",
        options: ["$0.10", "$1", "$10", "$100"],
        correctAnswer: 2,
        explanations: [
          "$0.10 per pip is a micro lot.",
          "$1 per pip is a mini lot.",
          "Correct. 100,000 × 0.0001 = 10 US dollars per pip.",
          "That would need a position ten times a standard lot.",
        ],
      },
      {
        type: "SINGLE_CHOICE",
        prompt: "In the pair GBP/USD, which currency is the base currency?",
        options: ["GBP", "USD", "Neither — both are quote currencies", "It depends on the broker"],
        correctAnswer: 0,
        explanations: [
          "Correct. The first currency in a pair is the base; the quote tells you how much of the second currency one unit of it costs.",
          "USD is the quote currency here.",
          "Every pair has exactly one base and one quote currency.",
          "The convention is the same everywhere.",
        ],
      },
      {
        type: "SINGLE_CHOICE",
        prompt: "What margin is required to open a $100,000 position at 1:50 leverage?",
        options: ["$500", "$2,000", "$5,000", "$50,000"],
        correctAnswer: 1,
        explanations: [
          "$500 would be 1:200 leverage.",
          "Correct. $100,000 ÷ 50 = $2,000.",
          "$5,000 would be 1:20 leverage.",
          "$50,000 would be 1:2 leverage.",
        ],
      },
      {
        type: "SINGLE_CHOICE",
        prompt:
          "You have $5,000, risk 1% per trade and your stop is 25 pips away on EUR/USD (USD account). What position size keeps the risk at 1%?",
        options: ["0.02 lots", "0.20 lots", "2.0 lots", "0.50 lots"],
        correctAnswer: 1,
        explanations: [
          "0.02 lots risks only about $5.",
          "Correct. $50 ÷ 25 pips = $2 per pip; one standard lot is $10 per pip, so 0.20 lots.",
          "2.0 lots risks about $500 — 10% of the account.",
          "0.50 lots risks about $125 — 2.5% of the account.",
        ],
      },
      {
        type: "SINGLE_CHOICE",
        prompt:
          "A strategy wins 40% of the time. Winners average 2R and losers 1R. What is its expectancy per trade?",
        options: ["−0.2R", "0R", "+0.2R", "+0.8R"],
        correctAnswer: 2,
        explanations: [
          "The positive wins outweigh the losses here.",
          "It would break even only at a 33% win rate with these payoffs.",
          "Correct. (0.4 × 2) − (0.6 × 1) = 0.8 − 0.6 = +0.2R.",
          "0.8R counts the wins but forgets to subtract the losses.",
        ],
      },
      {
        type: "SINGLE_CHOICE",
        prompt: "Which session overlap is usually the most active for major pairs?",
        options: ["Sydney–Tokyo", "Tokyo–London", "London–New York", "New York–Sydney"],
        correctAnswer: 2,
        explanations: [
          "The Asian overlap is usually one of the quieter windows.",
          "There is only a short overlap here, and it is less active.",
          "Correct. Europe's and North America's biggest centres overlap, so volume peaks.",
          "The late New York hours are among the quietest of the day.",
        ],
      },
      {
        type: "TRUE_FALSE",
        prompt:
          "True or false: if your logical stop is further away than usual, you should keep the same position size and move the stop closer.",
        options: ["True", "False"],
        correctAnswer: 1,
        explanations: [
          "Moving the stop inside normal price noise makes it more likely to be hit for no reason.",
          "Correct. Keep the stop where the idea is invalidated and reduce the position size so the money at risk stays the same.",
        ],
      },
    ],
  },
  {
    slug: "bitcoin-and-wallet-safety-quiz",
    track: "crypto",
    title: "Bitcoin and Wallet Safety Quiz",
    description:
      "Ten questions on how Bitcoin works, its supply schedule and how to keep your coins safe.",
    category: "crypto-security",
    image: "bitcoin-circuit-board",
    questions: [
      {
        type: "SINGLE_CHOICE",
        prompt: "What is the maximum number of bitcoin that will ever exist?",
        options: ["1 million", "21 million", "100 million", "There is no limit"],
        correctAnswer: 1,
        explanations: [
          "The cap is much higher than that.",
          "Correct. The issuance schedule approaches but never exceeds 21 million BTC.",
          "100 million is the number of satoshis in ONE bitcoin.",
          "Bitcoin's supply is capped by its protocol rules.",
        ],
      },
      {
        type: "SINGLE_CHOICE",
        prompt: "How often does the Bitcoin block reward halve?",
        options: [
          "Every year",
          "Every 210,000 blocks (about four years)",
          "Every 21,000 blocks",
          "Whenever miners vote for it",
        ],
        correctAnswer: 1,
        explanations: [
          "The interval is set in blocks, and it is about four years, not one.",
          "Correct. At roughly ten minutes a block, 210,000 blocks is about four years.",
          "That would be about five months.",
          "The schedule is fixed in the software; it is not voted on.",
        ],
      },
      {
        type: "SINGLE_CHOICE",
        prompt: "What is the smallest unit of bitcoin called?",
        options: ["A wei", "A gwei", "A satoshi", "A bit"],
        correctAnswer: 2,
        explanations: [
          "Wei is the smallest unit of ether, on Ethereum.",
          "Gwei is a billion wei — also an Ethereum unit.",
          "Correct. One satoshi is 0.00000001 BTC.",
          '"Bit" is sometimes used informally for a millionth of a bitcoin, but it is not the smallest unit.',
        ],
      },
      {
        type: "SINGLE_CHOICE",
        prompt: "On average, how often is a new Bitcoin block added?",
        options: ["Every 10 seconds", "Every minute", "About every 10 minutes", "Once a day"],
        correctAnswer: 2,
        explanations: [
          "Much faster than Bitcoin's design target.",
          "Still ten times faster than the target.",
          "Correct. Difficulty adjusts so blocks arrive about every ten minutes on average.",
          "That is far slower than the target.",
        ],
      },
      {
        type: "SINGLE_CHOICE",
        prompt: "Which mechanism does Bitcoin use to agree on new blocks?",
        options: ["Proof of stake", "Proof of work", "Proof of authority", "A central server"],
        correctAnswer: 1,
        explanations: [
          "Proof of stake is used by other networks, including Ethereum since 2022.",
          "Correct. Miners expend computing work to find a valid block hash.",
          "Proof of authority relies on approved validators; Bitcoin has none.",
          "Bitcoin has no central server.",
        ],
      },
      {
        type: "SINGLE_CHOICE",
        prompt: "Someone who has your wallet's seed phrase can…",
        options: [
          "Only view your balance",
          "Move all the funds in that wallet",
          "Nothing without your password",
          "Only receive coins to your address",
        ],
        correctAnswer: 1,
        explanations: [
          "A seed phrase gives far more than view access.",
          "Correct. The seed phrase can rebuild every private key in the wallet, so it controls the funds.",
          "An app password protects one device; the seed phrase restores the wallet anywhere without it.",
          "Anyone can send coins to your address; the seed phrase is what lets coins leave it.",
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "Which of these are warning signs of a crypto scam? Select all that apply.",
        options: [
          "A promise of guaranteed returns",
          '"Support staff" asking for your seed phrase',
          "Pressure to act immediately",
          "A hardware wallet bought directly from its manufacturer",
        ],
        correctAnswer: [0, 1, 2],
        explanations: [
          "Correct — no genuine investment guarantees a return.",
          "Correct — no legitimate service ever needs your seed phrase.",
          "Correct — urgency is used to stop you thinking it through.",
          "Buying a hardware wallet from its manufacturer is a sensible precaution, not a warning sign.",
        ],
      },
      {
        type: "SINGLE_CHOICE",
        prompt: "What is a hardware wallet mainly used for?",
        options: [
          "Mining bitcoin faster",
          "Keeping private keys offline",
          "Earning interest on deposits",
          "Converting crypto to cash",
        ],
        correctAnswer: 1,
        explanations: [
          "Mining uses specialised machines, not wallets.",
          "Correct. It signs transactions without the keys ever touching an internet-connected computer.",
          "A wallet stores keys; it does not pay interest.",
          "Conversion happens on an exchange or payment service.",
        ],
      },
      {
        type: "TRUE_FALSE",
        prompt:
          "True or false: a Bitcoin transaction with several confirmations can be reversed by contacting the network's support team.",
        options: ["True", "False"],
        correctAnswer: 1,
        explanations: [
          "There is no support team that can reverse a confirmed transaction.",
          "Correct. Confirmed transactions are effectively final, which is why you check the address before sending.",
        ],
      },
      {
        type: "SINGLE_CHOICE",
        prompt: "In what year was the Bitcoin white paper published?",
        options: ["2004", "2008", "2011", "2015"],
        correctAnswer: 1,
        explanations: [
          "Bitcoin did not exist yet.",
          "Correct. Satoshi Nakamoto published it in 2008, and the network launched in January 2009.",
          "By 2011 the network had already been running for two years.",
          "2015 is when Ethereum launched.",
        ],
      },
    ],
  },
];

// ─── Video topics ────────────────────────────────────────────

export interface VideoTopicSpec {
  slug: string;
  track: "forex" | "crypto";
  /** Existing seeded category slug; absent or unknown ⇒ uncategorised. */
  category?: string;
  title: string;
  summary: string;
  image: ImageName;
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  keyword: string;
  videos: { url: string; title: string }[];
  /** What to watch for — the body stays about the videos (owner, changes-46). */
  watchFor: string[];
  links: { label: string; path?: string; url?: string }[];
}

export const VIDEO_TOPICS: VideoTopicSpec[] = [
  {
    slug: "how-the-forex-market-works-video",
    track: "forex",
    category: "getting-started",
    title: "How the Forex Market Works",
    summary:
      "Two beginner walk-throughs of what forex is, who trades it and how a currency pair is quoted.",
    image: "city-skyline-candlesticks",
    featured: true,
    seoTitle: "How the Forex Market Works — Video Lesson",
    seoDescription:
      "Watch beginner video explanations of the forex market: currency pairs, quotes, participants and how trading actually works.",
    keyword: "forex for beginners video",
    videos: [
      { url: yt("_KRelepN4Ek"), title: "What is forex trading and how does it work — Rayner Teo" },
      { url: yt("Wyzwd8vwGKo"), title: "What is forex trading? Explained for beginners" },
    ],
    watchFor: [
      "How a currency pair is read: base currency first, quote currency second",
      "Why the market runs 24 hours a day on weekdays",
      "The difference between the bid and the ask price",
    ],
    links: [
      {
        label: "Course: How the Forex Market Moves",
        path: "/learn/forex/forex-market-sessions-and-drivers",
      },
      { label: "Glossary: base currency", path: "/glossary/base-currency" },
      { label: "Market hours tool", path: "/tools/market-hours" },
    ],
  },
  {
    slug: "pips-lots-and-leverage-video",
    track: "forex",
    category: "getting-started",
    title: "Pips, Lots and Leverage Explained",
    summary: "Two videos that turn pips, lot sizes and leverage into numbers you can calculate.",
    image: "figures-climbing-chart",
    featured: false,
    seoTitle: "Pips, Lots and Leverage — Forex Video Lesson",
    seoDescription:
      "Video explanations of forex pips, standard, mini and micro lots, and how leverage and margin affect your position.",
    keyword: "pips lots leverage video",
    videos: [
      { url: yt("GJ-Bjq1Xvks"), title: "Forex leverage for beginners (lot sizes and pips)" },
      { url: yt("hocLuXtyvXA"), title: "Understanding pips, lots and leverage" },
    ],
    watchFor: [
      "Why a pip is 0.0001 on most pairs and 0.01 on yen pairs",
      "How lot size changes the value of each pip",
      "Why leverage changes the margin you post, not the risk of the trade",
    ],
    links: [
      { label: "Pip calculator", path: "/tools/pip-value" },
      { label: "Margin calculator", path: "/tools/margin" },
      { label: "Glossary: leverage", path: "/glossary/leverage" },
    ],
  },
  {
    slug: "forex-risk-and-position-sizing-video",
    track: "forex",
    category: "strategy-and-analysis",
    title: "Risk Management and Position Sizing",
    summary: "How much to risk per trade, and how to turn that decision into a position size.",
    image: "analyst-rising-chart",
    featured: false,
    seoTitle: "Forex Risk Management & Position Sizing — Video",
    seoDescription:
      "Watch how to choose a risk per trade, place a stop and calculate a forex position size that keeps losses small.",
    keyword: "position sizing video",
    videos: [
      { url: yt("pSWzuugtQOY"), title: "The ultimate guide to position sizing" },
      { url: yt("fSBQ_1p9NPk"), title: "Forex risk management course" },
    ],
    watchFor: [
      "Risk is decided before entry, as a percentage of the account",
      "The stop distance, not the lot size, is fixed by the chart",
      "How drawdowns compound when risk per trade is too high",
    ],
    links: [
      {
        label: "Course: Risk Management and Trading Psychology",
        path: "/learn/forex/forex-risk-management-and-psychology",
      },
      { label: "Position size calculator", path: "/tools/position-size" },
      { label: "Risk-reward calculator", path: "/tools/risk-reward" },
    ],
  },
  {
    slug: "how-bitcoin-actually-works-video",
    track: "crypto",
    category: "getting-started",
    title: "How Bitcoin Actually Works",
    summary: "A clear visual explanation of digital signatures, the ledger and proof of work.",
    image: "bitcoin-circuit-board",
    featured: true,
    seoTitle: "How Bitcoin Actually Works — Video Lesson",
    seoDescription:
      "A visual video explanation of how Bitcoin works: signatures, a shared ledger, blocks and proof of work.",
    keyword: "how bitcoin works video",
    videos: [
      { url: yt("bBC-nXj3Ng4"), title: "But how does bitcoin actually work? — 3Blue1Brown" },
    ],
    watchFor: [
      "Why a shared ledger needs digital signatures",
      "How proof of work makes the longest chain the trusted one",
      "Why rewriting history gets harder with every new block",
    ],
    links: [
      { label: "Course: Bitcoin for Beginners", path: "/learn/crypto/bitcoin-for-beginners" },
      { label: "Glossary: blockchain", path: "/glossary/blockchain" },
      { label: "The Bitcoin white paper", url: "https://bitcoin.org/bitcoin.pdf" },
    ],
  },
  {
    slug: "blockchain-explained-visually-video",
    track: "crypto",
    category: "getting-started",
    title: "Blockchain Explained Visually",
    summary:
      "Two short demonstrations of hashes, blocks and why a chain of them resists tampering.",
    image: "trading-screens-wall",
    featured: false,
    seoTitle: "Blockchain Explained Visually — Video Lesson",
    seoDescription:
      "Watch visual demonstrations of how hashes and blocks link into a blockchain, and why changing one block breaks the chain.",
    keyword: "blockchain explained video",
    videos: [
      { url: yt("_160oMzblY8"), title: "Blockchain 101 — a visual demo" },
      { url: yt("SSo_EIwHSd4"), title: "How does a blockchain work — Simply Explained" },
    ],
    watchFor: [
      "What a hash is and why a tiny change alters it completely",
      "How each block stores the previous block's hash",
      "Why a distributed copy of the chain exposes tampering",
    ],
    links: [
      {
        label: "Lesson: Blocks, Mining and Proof of Work",
        path: "/learn/crypto/bitcoin-for-beginners/blocks-mining-and-proof-of-work",
      },
      { label: "Glossary: blockchain", path: "/glossary/blockchain" },
    ],
  },
  {
    slug: "crypto-wallets-and-private-keys-video",
    track: "crypto",
    category: "strategy-and-analysis",
    title: "Crypto Wallets and Private Keys",
    summary:
      "What a wallet really stores, how public and private keys relate, and why the seed phrase is everything.",
    image: "crypto-coins-workstation",
    featured: false,
    seoTitle: "Crypto Wallets & Private Keys — Video Lesson",
    seoDescription:
      "Video explanations of how crypto wallets work, public versus private keys, and how to keep your seed phrase safe.",
    keyword: "crypto wallet private key video",
    videos: [
      { url: yt("GSTiKjnBaes"), title: "How Bitcoin wallets work — public and private keys" },
      {
        url: yt("p_LWJgTBIFs"),
        title: "Cryptocurrency wallets — public and private keys, animated",
      },
    ],
    watchFor: [
      "A wallet stores keys, not coins",
      "Your address is derived from a public key; the private key must stay secret",
      "Whoever holds the seed phrase controls the funds",
    ],
    links: [
      {
        label: "Lesson: Buying and Storing Bitcoin Safely",
        path: "/learn/crypto/bitcoin-for-beginners/buying-and-storing-bitcoin-safely",
      },
      {
        label: "Crypto safety guidance (FCA)",
        url: "https://www.fca.org.uk/consumers/cryptoassets",
      },
    ],
  },
];
