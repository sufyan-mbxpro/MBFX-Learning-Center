// The starter glossary (ADR-069): six topics and the terms filed under them.
// Its own module, like `seed-articles.ts`, so `arabic-seed.test.ts` can compare
// the Arabic against it; `seed.ts` writes it (see the note there).

export const GLOSSARY_TOPICS = [
  {
    slug: "trading-basics",
    name: "Trading basics",
    description: "The vocabulary every new trader meets in the first week.",
  },
  {
    slug: "orders-and-execution",
    name: "Orders & execution",
    description: "How an instruction becomes a position, and what can happen in between.",
  },
  {
    slug: "risk-management",
    name: "Risk management",
    description: "Sizing a position, protecting it, and measuring what went wrong.",
  },
  {
    slug: "technical-analysis",
    name: "Technical analysis",
    description: "Reading price itself — charts, levels and the patterns traders watch.",
  },
  {
    slug: "market-fundamentals",
    name: "Market fundamentals",
    description: "The economics behind a price: rates, data releases and capital flows.",
  },
  {
    slug: "crypto",
    name: "Crypto",
    description: "Terms specific to digital assets and the networks they settle on.",
  },
];

export interface SeedGlossaryTerm {
  slug: string;
  term: string;
  /** A GLOSSARY_TOPICS slug, or null for unfiled. */
  topic: string | null;
  /** A LEARN_TRACKS key, or null for "every school". */
  track: string | null;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  simple: string;
  detailed?: string;
  advanced?: string;
  example?: string;
  formula?: string;
  faq?: { question: string; answer: string }[];
}

export const GLOSSARY_TERMS: SeedGlossaryTerm[] = [
  {
    slug: "accrual",
    term: "Accrual",
    topic: null,
    track: "forex",
    difficulty: "ADVANCED",
    simple:
      "<p>Accrual is the apportionment of premiums or discounts on a forward foreign exchange contract over the life of that contract, rather than all at once.</p>",
  },
  {
    slug: "altcoin",
    term: "Altcoin",
    topic: "crypto",
    track: "crypto",
    difficulty: "BEGINNER",
    simple:
      "<p>An altcoin is any cryptocurrency other than Bitcoin. The term covers everything from large established networks to tokens with almost no trading activity.</p>",
    detailed:
      "<p>The label says nothing about quality. It is a category defined by exclusion, so it groups assets with very different technology, liquidity and risk under one word.</p>",
  },
  {
    slug: "arbitrage",
    term: "Arbitrage",
    topic: "market-fundamentals",
    track: null,
    difficulty: "ADVANCED",
    simple:
      "<p>Arbitrage is buying and selling the same asset in two places at once to capture a price difference between them.</p>",
    detailed:
      "<p>True arbitrage is close to riskless in theory and rare in practice: the price gaps that make it possible are small, short-lived, and usually closed by automated systems before a manual trader can act.</p>",
    advanced:
      "<p>Execution risk is what turns a textbook arbitrage into a loss. If one leg fills and the other does not, the position is no longer hedged — it is an outright directional bet nobody intended to take.</p>",
  },
  {
    slug: "ask",
    term: "Ask",
    topic: "trading-basics",
    track: null,
    difficulty: "BEGINNER",
    simple:
      "<p>The ask, also called the offer, is the price at which you can buy a market. It is always the higher of the two prices on a quote.</p>",
    example:
      "<p>If EUR/USD is quoted 1.0850 / 1.0851, the ask is 1.0851 — that is what you pay to open a buy.</p>",
  },
  {
    slug: "base-currency",
    term: "Base currency",
    topic: "trading-basics",
    track: "forex",
    difficulty: "BEGINNER",
    simple:
      "<p>The base currency is the first currency named in a pair. The price shows how much of the second currency one unit of the base is worth.</p>",
    example:
      "<p>In EUR/USD the base is the euro. A price of 1.0850 means one euro buys 1.0850 US dollars.</p>",
  },
  {
    slug: "bear-market",
    term: "Bear market",
    topic: "market-fundamentals",
    track: null,
    difficulty: "BEGINNER",
    simple:
      "<p>A bear market is a sustained period of falling prices, usually accompanied by weak sentiment and falling participation.</p>",
    detailed:
      "<p>A common rule of thumb is a decline of 20% or more from a recent peak, but the threshold is a convention rather than a definition — what matters is the direction and persistence of the trend.</p>",
  },
  {
    slug: "bid",
    term: "Bid",
    topic: "trading-basics",
    track: null,
    difficulty: "BEGINNER",
    simple:
      "<p>The bid is the price at which you can sell a market. It is always the lower of the two prices on a quote.</p>",
    example:
      "<p>If EUR/USD is quoted 1.0850 / 1.0851, the bid is 1.0850 — that is what you receive if you sell.</p>",
  },
  {
    slug: "blockchain",
    term: "Blockchain",
    topic: "crypto",
    track: "crypto",
    difficulty: "BEGINNER",
    simple:
      "<p>A blockchain is a shared record of transactions maintained by a network of computers rather than by a single institution.</p>",
    detailed:
      "<p>Transactions are grouped into blocks, and each block references the one before it. Rewriting an old block would mean redoing every block after it, which is what makes settled history expensive to alter.</p>",
    faq: [
      {
        question: "Is a blockchain the same thing as a cryptocurrency?",
        answer:
          "No. The blockchain is the ledger; the cryptocurrency is one asset recorded on it. A network can carry many assets.",
      },
    ],
  },
  {
    slug: "bull-market",
    term: "Bull market",
    topic: "market-fundamentals",
    track: null,
    difficulty: "BEGINNER",
    simple:
      "<p>A bull market is a sustained period of rising prices, usually accompanied by improving sentiment and broad participation.</p>",
  },
  {
    slug: "candlestick",
    term: "Candlestick",
    topic: "technical-analysis",
    track: null,
    difficulty: "BEGINNER",
    simple:
      "<p>A candlestick summarises the price action of one time period as a single shape showing the open, high, low and close.</p>",
    detailed:
      "<p>The body spans the open and close; the thin wicks above and below show the extremes the price reached but did not hold. A long wick therefore records a level that was tested and rejected.</p>",
  },
  {
    slug: "cfd",
    term: "CFD",
    topic: "trading-basics",
    track: null,
    difficulty: "INTERMEDIATE",
    simple:
      "<p>A contract for difference (CFD) is an agreement to exchange the difference in an asset's price between opening and closing a position, without owning the asset itself.</p>",
    detailed:
      "<p>Because there is no delivery, CFDs can be traded in both directions and are usually leveraged. That also means you hold a contract with a provider rather than the underlying instrument.</p>",
    advanced:
      "<p>CFDs are not available to retail traders in every jurisdiction, and where they are, leverage limits and margin close-out rules differ. Availability is a regulatory question, not a product one.</p>",
  },
  {
    slug: "cross-rate",
    term: "Cross rate",
    topic: "trading-basics",
    track: "forex",
    difficulty: "INTERMEDIATE",
    simple:
      "<p>A cross rate is the exchange rate between two currencies where neither is the US dollar.</p>",
    example: "<p>EUR/GBP and AUD/JPY are cross rates; EUR/USD is not.</p>",
  },
  {
    slug: "divergence",
    term: "Divergence",
    topic: "technical-analysis",
    track: null,
    difficulty: "ADVANCED",
    simple:
      "<p>Divergence is when price and an indicator move in opposite directions — for example price making a higher high while the indicator makes a lower one.</p>",
    detailed:
      "<p>It is read as a sign that the move is losing momentum. It is not a signal on its own: divergence can persist for a long time while a strong trend continues.</p>",
  },
  {
    slug: "drawdown",
    term: "Drawdown",
    topic: "risk-management",
    track: null,
    difficulty: "INTERMEDIATE",
    simple:
      "<p>Drawdown is the decline from a peak in account value to the lowest point that follows, before a new peak is reached.</p>",
    detailed:
      "<p>It is usually quoted as a percentage, and it measures the worst stretch an account actually lived through rather than its end result.</p>",
    advanced:
      "<p>Recovery is not symmetric with the loss. A 50% drawdown needs a 100% gain to get back to even, which is why limiting the depth of a drawdown matters more than the speed of the recovery.</p>",
    example:
      "<p>An account that grows to $12,000, falls to $9,000, then recovers has suffered a 25% drawdown.</p>",
  },
  {
    slug: "equity",
    term: "Equity",
    topic: "risk-management",
    track: null,
    difficulty: "BEGINNER",
    simple:
      "<p>Equity is the current value of a trading account: the cash balance plus or minus the profit and loss on every position still open.</p>",
    detailed:
      "<p>Balance only changes when a position is closed. Equity moves with the market, which is why margin is measured against equity and not against balance.</p>",
    formula: "equity = balance + unrealised profit/loss",
  },
  {
    slug: "exotic-pair",
    term: "Exotic pair",
    topic: "trading-basics",
    track: "forex",
    difficulty: "INTERMEDIATE",
    simple:
      "<p>An exotic pair couples a major currency with one from a smaller or less heavily traded economy.</p>",
    detailed:
      "<p>Exotics typically carry wider spreads and thinner liquidity than majors, so the cost of entering and the risk of slippage are both higher.</p>",
  },
  {
    slug: "fill",
    term: "Fill",
    topic: "orders-and-execution",
    track: null,
    difficulty: "BEGINNER",
    simple:
      "<p>A fill is the execution of an order. An order is filled when it has been matched at a price and the position exists.</p>",
    detailed:
      "<p>An order can also be partially filled, where only some of the requested size is executed because there was not enough available at that price.</p>",
  },
  {
    slug: "forex",
    term: "Forex",
    topic: "trading-basics",
    track: null,
    difficulty: "BEGINNER",
    simple:
      "<p>Forex, also known as foreign exchange or FX, is the conversion of one country's currency into another. It forms the basis of forex trading, one of the world's most-traded asset classes.</p>",
    detailed:
      "<p>Foreign exchange happens globally between a network of banks, brokers and other institutions. Unlike a stock exchange there is no central venue — trades take place directly between two parties, which is why the market runs 24 hours a day, five days a week.</p><p>While the market is used by companies and travellers who genuinely need the currency, most participants are trading it to profit from changes in the rate rather than to take delivery.</p>",
    faq: [
      {
        question: "When is the forex market open?",
        answer:
          "Continuously from Sunday evening to Friday evening, moving between the Asian, European and North American sessions. It closes over the weekend.",
      },
      {
        question: "Which pair is traded most?",
        answer: "EUR/USD is consistently the most heavily traded currency pair.",
      },
    ],
  },
  {
    slug: "fundamental-analysis",
    term: "Fundamental analysis",
    topic: "market-fundamentals",
    track: null,
    difficulty: "INTERMEDIATE",
    simple:
      "<p>Fundamental analysis studies the economic conditions behind a price — interest rates, growth, inflation and policy — to judge what an asset should be worth.</p>",
    detailed:
      "<p>For currencies it centres on relative conditions: a currency is strong or weak against another, so what matters is the difference between two economies rather than the state of either alone.</p>",
  },
  {
    slug: "gap",
    term: "Gap",
    topic: "technical-analysis",
    track: null,
    difficulty: "INTERMEDIATE",
    simple:
      "<p>A gap is a jump in price with no trading in between, leaving a visible break on the chart.</p>",
    detailed:
      "<p>In forex, gaps most often appear at the Sunday open after news over the weekend. A stop-loss cannot protect against the gap itself: the next available price may be well beyond the level set.</p>",
  },
  {
    slug: "hedging",
    term: "Hedging",
    topic: "risk-management",
    track: null,
    difficulty: "ADVANCED",
    simple:
      "<p>Hedging is opening a position designed to offset the risk of another one, reducing exposure rather than seeking profit.</p>",
    detailed:
      "<p>A hedge has a cost — the spread, the financing, or the gains given up if the original position was right. It buys a reduction in uncertainty, not a better expected outcome.</p>",
  },
  {
    slug: "interest-rate-differential",
    term: "Interest rate differential",
    topic: "market-fundamentals",
    track: "forex",
    difficulty: "ADVANCED",
    simple:
      "<p>The interest rate differential is the gap between the policy interest rates of the two economies in a currency pair.</p>",
    detailed:
      "<p>It is the main driver of the financing charged or paid for holding a position overnight, and a long-running influence on the direction of the pair itself.</p>",
  },
  {
    slug: "leverage",
    term: "Leverage",
    topic: "risk-management",
    track: null,
    difficulty: "INTERMEDIATE",
    simple:
      "<p>Leverage lets you control a position larger than your own capital would allow, with the balance effectively provided by your broker.</p>",
    detailed:
      "<p>It is expressed as a ratio. At 1:30, one unit of your own money controls thirty units of the market. The ratio applies to gains and losses equally.</p>",
    advanced:
      "<p>Higher leverage does not raise expected return; it raises variance. What it reliably shortens is the distance between the entry price and a margin close-out, which is why a leveraged position can be closed at a loss by a move the trader would otherwise have survived.</p>",
    example:
      "<p>With $1,000 and 1:30 leverage you can open a $30,000 position. A 1% move against you is a $300 loss — 30% of your capital.</p>",
    faq: [
      {
        question: "Does more leverage mean more profit?",
        answer:
          "No. It magnifies profit and loss by the same factor, and it brings a margin close-out closer.",
      },
    ],
  },
  {
    slug: "limit-order",
    term: "Limit order",
    topic: "orders-and-execution",
    track: null,
    difficulty: "BEGINNER",
    simple:
      "<p>A limit order is an instruction to trade at a specified price or better, and never worse.</p>",
    detailed:
      "<p>It controls the price you get but not whether you trade at all: if the market never reaches the level, the order simply does not fill.</p>",
    example:
      "<p>With EUR/USD at 1.0850, a buy limit at 1.0800 waits for the price to fall. It executes at 1.0800 or lower, or not at all.</p>",
  },
  {
    slug: "liquidity",
    term: "Liquidity",
    topic: "trading-basics",
    track: null,
    difficulty: "INTERMEDIATE",
    simple:
      "<p>Liquidity is how easily a market can absorb a trade without the price moving much against you.</p>",
    detailed:
      "<p>Liquid markets show tight spreads and reliable fills. Liquidity is not constant: it thins around major news, public holidays and the daily rollover, which is when slippage is most likely.</p>",
  },
  {
    slug: "long-position",
    term: "Long position",
    topic: "trading-basics",
    track: null,
    difficulty: "BEGINNER",
    simple:
      "<p>A long position profits if the price rises. Going long means buying with the expectation of selling higher.</p>",
  },
  {
    slug: "lot",
    term: "Lot",
    topic: "trading-basics",
    track: "forex",
    difficulty: "BEGINNER",
    simple: "<p>A lot is the standard unit of trade size in forex.</p>",
    detailed:
      "<p>A standard lot is 100,000 units of the base currency. A mini lot is 10,000 and a micro lot is 1,000, which is what lets a small account take a position at all.</p>",
  },
  {
    slug: "margin",
    term: "Margin",
    topic: "risk-management",
    track: null,
    difficulty: "INTERMEDIATE",
    simple:
      "<p>Margin is the portion of your own capital a broker requires you to set aside as collateral to keep a leveraged position open.</p>",
    detailed:
      "<p>It is not a fee and it is not spent. It is your money, held aside while the position is open and released when it closes.</p>",
  },
  {
    slug: "margin-call",
    term: "Margin call",
    topic: "risk-management",
    track: null,
    difficulty: "INTERMEDIATE",
    simple:
      "<p>A margin call is the warning that your account equity has fallen too close to the margin required to keep your positions open.</p>",
    detailed:
      "<p>If equity keeps falling, positions are closed automatically at a level set by the broker. The close-out is not a request — it happens whether or not the warning was seen.</p>",
  },
  {
    slug: "market-order",
    term: "Market order",
    topic: "orders-and-execution",
    track: null,
    difficulty: "BEGINNER",
    simple:
      "<p>A market order is an instruction to trade immediately at the best price currently available.</p>",
    detailed:
      "<p>It is the mirror image of a limit order: it guarantees that you trade, but not the price you get. In a fast market the fill can differ from the price on screen.</p>",
  },
  {
    slug: "moving-average",
    term: "Moving average",
    topic: "technical-analysis",
    track: null,
    difficulty: "BEGINNER",
    simple:
      "<p>A moving average is the average price over a set number of recent periods, recalculated as each new period closes.</p>",
    detailed:
      "<p>It smooths short-term noise to make the underlying direction easier to read. Every moving average lags by design — it describes what price has already done.</p>",
  },
  {
    slug: "non-farm-payrolls",
    term: "Non-farm payrolls",
    topic: "market-fundamentals",
    track: null,
    difficulty: "INTERMEDIATE",
    simple:
      "<p>Non-farm payrolls (NFP) is a monthly United States employment report counting jobs added or lost outside farming, private households and non-profits.</p>",
    detailed:
      "<p>It is released on the first Friday of most months and is one of the most closely watched data points in the calendar, because employment feeds directly into expectations for interest rates.</p>",
  },
  {
    slug: "order-book",
    term: "Order book",
    topic: "orders-and-execution",
    track: null,
    difficulty: "ADVANCED",
    simple:
      "<p>An order book is the list of outstanding buy and sell orders for a market, arranged by price.</p>",
    detailed:
      "<p>It shows where resting interest sits on each side. Because forex trades over the counter rather than on one central exchange, no single complete order book for a currency pair exists.</p>",
  },
  {
    slug: "pip",
    term: "Pip",
    topic: "trading-basics",
    track: "forex",
    difficulty: "BEGINNER",
    simple:
      "<p>A pip is the smallest standard increment by which a currency pair's price is quoted — normally the fourth decimal place.</p>",
    detailed:
      "<p>For most pairs one pip is 0.0001. For pairs quoted against the Japanese yen it is 0.01, because those are quoted to two decimal places rather than four.</p>",
    example:
      "<p>EUR/USD moving from 1.0850 to 1.0851 is a one-pip move. On a standard lot of 100,000 units that is about $10.</p>",
    formula: "pip value = (one pip / exchange rate) x position size",
    faq: [
      {
        question: "What is a pipette?",
        answer:
          "A tenth of a pip — the fifth decimal place on most pairs. Many brokers quote it for finer pricing.",
      },
    ],
  },
  {
    slug: "position-sizing",
    term: "Position sizing",
    topic: "risk-management",
    track: null,
    difficulty: "INTERMEDIATE",
    simple:
      "<p>Position sizing is deciding how large a trade should be, based on how much you are prepared to lose if it goes wrong.</p>",
    detailed:
      "<p>The size follows from the stop, not the other way round: fix the risk per trade and the distance to the stop, and the correct size is whatever satisfies both.</p>",
    formula: "position size = (account risk amount) / (stop distance x value per unit)",
  },
  {
    slug: "pullback",
    term: "Pullback",
    topic: "technical-analysis",
    track: null,
    difficulty: "INTERMEDIATE",
    simple:
      "<p>A pullback is a temporary move against the prevailing trend before that trend resumes.</p>",
    detailed:
      "<p>The difficulty is that a pullback and the start of a reversal look identical while they are happening. The distinction is only clear afterwards.</p>",
  },
  {
    slug: "quote-currency",
    term: "Quote currency",
    topic: "trading-basics",
    track: "forex",
    difficulty: "BEGINNER",
    simple:
      "<p>The quote currency is the second currency named in a pair — the one the price is expressed in.</p>",
    example: "<p>In EUR/USD the quote currency is the US dollar, so the price is in dollars.</p>",
  },
  {
    slug: "resistance",
    term: "Resistance",
    topic: "technical-analysis",
    track: null,
    difficulty: "BEGINNER",
    simple:
      "<p>Resistance is a price area where selling has repeatedly been strong enough to stop a rise.</p>",
    detailed:
      "<p>Resistance that gives way often acts as support afterwards, as traders who expected the level to hold reassess it.</p>",
  },
  {
    slug: "risk-reward-ratio",
    term: "Risk-reward ratio",
    topic: "risk-management",
    track: null,
    difficulty: "INTERMEDIATE",
    simple:
      "<p>The risk-reward ratio compares what a trade stands to lose if the stop is hit with what it stands to gain if the target is reached.</p>",
    advanced:
      "<p>The ratio is meaningless without a win rate beside it. A 1:3 setup that works one time in five loses money; a 1:1 setup that works two times in three makes it.</p>",
    formula: "risk-reward = (target distance) : (stop distance)",
  },
  {
    slug: "rollover",
    term: "Rollover",
    topic: "trading-basics",
    track: "forex",
    difficulty: "ADVANCED",
    simple:
      "<p>Rollover is the process of carrying an open position past the end of the trading day, which incurs an interest adjustment known as a swap.</p>",
    detailed:
      "<p>The adjustment reflects the interest rate difference between the two currencies. Depending on the direction of the position it can be a charge or a credit.</p>",
  },
  {
    slug: "scalping",
    term: "Scalping",
    topic: "trading-basics",
    track: null,
    difficulty: "ADVANCED",
    simple:
      "<p>Scalping is a style of trading that takes many small profits from very short holding periods.</p>",
    detailed:
      "<p>Because each target is small, transaction costs dominate the outcome. A spread that is negligible for a position held for weeks can make a scalping strategy unprofitable outright.</p>",
  },
  {
    slug: "short-selling",
    term: "Short selling",
    topic: "trading-basics",
    track: null,
    difficulty: "INTERMEDIATE",
    simple:
      "<p>Short selling is taking a position that profits if the price falls. In forex, selling one currency is always buying the other.</p>",
  },
  {
    slug: "slippage",
    term: "Slippage",
    topic: "orders-and-execution",
    track: null,
    difficulty: "INTERMEDIATE",
    simple:
      "<p>Slippage is the difference between the price you expected and the price your order actually filled at.</p>",
    detailed:
      "<p>It happens when the market moves between sending an order and executing it, and it is most common around news releases and at thin points in the session. It can go either way, though it is noticed more often when it goes against you.</p>",
  },
  {
    slug: "spread",
    term: "Spread",
    topic: "trading-basics",
    track: null,
    difficulty: "BEGINNER",
    simple:
      "<p>The spread is the difference between the bid and the ask — in practice, the cost of opening a trade.</p>",
    detailed:
      "<p>A position starts slightly behind by the width of the spread, and has to move that far in your favour to break even. Spreads widen when liquidity falls, such as around major news or at the daily rollover.</p>",
    example:
      "<p>A quote of 1.0850 / 1.0851 is a one-pip spread. Buy at the ask and the position shows a one-pip loss immediately.</p>",
  },
  {
    slug: "stablecoin",
    term: "Stablecoin",
    topic: "crypto",
    track: "crypto",
    difficulty: "INTERMEDIATE",
    simple:
      "<p>A stablecoin is a cryptocurrency designed to hold a steady value, usually by tracking a national currency such as the US dollar.</p>",
    detailed:
      "<p>Different stablecoins hold their peg in different ways — reserves of cash and bonds, collateral in other crypto assets, or an algorithm. The mechanism is what determines the risk, and pegs have failed before.</p>",
  },
  {
    slug: "stop-loss-order",
    term: "Stop-loss order",
    topic: "orders-and-execution",
    track: null,
    difficulty: "BEGINNER",
    simple:
      "<p>A stop-loss order closes a position automatically once the price reaches a level you set against you, capping the loss on that trade.</p>",
    detailed:
      "<p>A standard stop becomes a market order when triggered, so the fill can be worse than the level in a fast market or over a weekend gap. A guaranteed stop removes that risk for a fee.</p>",
    faq: [
      {
        question: "Does a stop-loss guarantee my maximum loss?",
        answer:
          "Not on its own. A standard stop is filled at the next available price, which can be beyond your level if the market gaps.",
      },
    ],
  },
  {
    slug: "support",
    term: "Support",
    topic: "technical-analysis",
    track: null,
    difficulty: "BEGINNER",
    simple:
      "<p>Support is a price area where buying has repeatedly been strong enough to halt a decline.</p>",
    detailed:
      "<p>Support that breaks often becomes resistance afterwards — the same level, read from the other side.</p>",
  },
  {
    slug: "take-profit-order",
    term: "Take-profit order",
    topic: "orders-and-execution",
    track: null,
    difficulty: "BEGINNER",
    simple:
      "<p>A take-profit order closes a position automatically once the price reaches a level in your favour, banking the gain without you having to watch.</p>",
  },
  {
    slug: "technical-analysis",
    term: "Technical analysis",
    topic: "technical-analysis",
    track: null,
    difficulty: "INTERMEDIATE",
    simple:
      "<p>Technical analysis studies price and volume history itself — through charts, levels and indicators — rather than the economics behind the price.</p>",
    detailed:
      "<p>It rests on the premise that price already reflects what is known, and that the behaviour of participants leaves repeatable patterns. Every technical tool is descriptive of the past; none of them is a forecast.</p>",
  },
  {
    slug: "trend",
    term: "Trend",
    topic: "technical-analysis",
    track: null,
    difficulty: "BEGINNER",
    simple:
      "<p>A trend is a sustained direction in price — a series of higher highs and higher lows upward, or lower highs and lower lows downward.</p>",
  },
  {
    slug: "volatility",
    term: "Volatility",
    topic: "risk-management",
    track: null,
    difficulty: "INTERMEDIATE",
    simple:
      "<p>Volatility measures how much and how quickly a price moves over a period. High volatility means larger swings in both directions.</p>",
    detailed:
      "<p>Realised volatility looks backwards at what a price actually did. Implied volatility is what the options market expects it to do next.</p>",
    advanced:
      "<p>Volatility clusters: large moves tend to be followed by large moves, and quiet periods by quiet ones. A fixed position size therefore carries very different real risk in different regimes, which is the argument for sizing against volatility rather than against account balance.</p>",
  },
  {
    slug: "volume",
    term: "Volume",
    topic: "technical-analysis",
    track: null,
    difficulty: "INTERMEDIATE",
    simple: "<p>Volume is the amount traded in a market over a given period.</p>",
    detailed:
      "<p>Because forex has no central exchange, the volume shown on a chart is the broker's or platform's own activity rather than the whole market. It is a sample, and a useful one, but not a total.</p>",
  },
  {
    slug: "wallet",
    term: "Wallet",
    topic: "crypto",
    track: "crypto",
    difficulty: "BEGINNER",
    simple:
      "<p>A crypto wallet stores the private keys that prove ownership of assets on a blockchain. The assets stay on the network; the wallet holds the means to move them.</p>",
    detailed:
      "<p>A hot wallet is connected to the internet and convenient; a cold wallet is kept offline and harder to compromise. Losing the keys means losing access, and no one can restore them for you.</p>",
    faq: [
      {
        question: "Can anyone recover my wallet if I lose the seed phrase?",
        answer:
          "No. There is no reset and no support line that can restore it. Anyone claiming otherwise is attempting fraud.",
      },
    ],
  },
  {
    slug: "yield",
    term: "Yield",
    topic: "market-fundamentals",
    track: null,
    difficulty: "INTERMEDIATE",
    simple: "<p>Yield is the return an asset produces, expressed as a percentage of its price.</p>",
    detailed:
      "<p>Government bond yields matter to currency traders because they price the market's expectations for interest rates, and rate expectations are one of the strongest influences on exchange rates.</p>",
  },
];
