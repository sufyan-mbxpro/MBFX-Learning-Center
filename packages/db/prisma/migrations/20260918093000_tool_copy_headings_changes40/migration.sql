-- changes-40: every tool's copy opens on a definition, then says how to use it.
--
-- A DATA migration, like the settings ones before it, and for the same reason:
-- the tool upsert's `update: {}` deliberately never touches a translation, so
-- a change to `TOOL_SEEDS` reaches a FRESH install only. An existing database
-- would keep eleven pages of headless paragraphs.
--
-- ── Why the copy changed ─────────────────────────────────────────────────
--
-- ADR-114 put each tool's explainer BESIDE its calculator. The explainer's
-- first card opened on a bare `<p>`, so the band read as two unlabelled blocks
-- of prose next to a form. It now opens on a definition under its own `<h2>`
-- ("What is a pip?", "What is margin?"), and the second card leads with "How
-- to use this calculator" and numbered steps — the shape of the owner's own
-- reference page, and the shape the "why use this" cards below already assume.
--
-- ── The bound ────────────────────────────────────────────────────────────
--
-- `intro NOT LIKE '<h2>%'` — the row still shows the defect. A translation
-- whose intro already opens on a heading has either been migrated or was
-- written that way by a person, and neither is ours to overwrite. It is the
-- same discipline as `20260916150000`'s JSON_CONTAINS bounds: match the value
-- the seed wrote, never every row.
--
-- `locale = 'en'` — this is source copy. A human translation into another
-- locale is that translator's work, and a machine one is ADR-097's, and this
-- migration is neither.
--
-- Generated from `TOOL_SEEDS`, so the SQL and the seed cannot drift.

-- position-size
UPDATE `tool_translations` tr
JOIN `tools` t ON t.id = tr.toolId
SET tr.intro = '<h2>What is position size?</h2><p>Position size is how much of a currency pair a trade buys or sells. It is the one part of a trade that is entirely yours to decide: the market decides whether the trade wins, and the size decides what it costs you when it loses.</p><p>Sizing from risk means choosing that cost first — a share of your balance you are willing to lose — and letting the number of units follow from it, rather than trading a round lot and finding out afterwards what the lot was risking.</p>',
    tr.body = '<h2>How to use this calculator</h2><ol><li>Select your account currency</li><li>Choose the currency pair you want to trade</li><li>Enter your account balance and the share of it you are willing to risk</li><li>Enter how far away your stop loss sits, in pips</li><li>Read off the position size, and the amount at risk it is built from</li></ol><h2>How the figure is worked out</h2><p>The amount at risk is your balance multiplied by your risk percentage. Divide that by the stop-loss distance in pips, and again by the value of one pip, and what is left is the position size that makes those two numbers agree.</p><p>When your account currency is not the pair\'s quote currency, one more step is needed: the pip value has to be converted. We show that conversion rather than folding it away, because it is the step most spreadsheets get wrong.</p>'
WHERE t.`key` = 'position-size'
  AND tr.locale = 'en'
  AND tr.intro NOT LIKE '<h2>%';

-- pip-value
UPDATE `tool_translations` tr
JOIN `tools` t ON t.id = tr.toolId
SET tr.intro = '<h2>What is a pip?</h2><p>A pip is the smallest price move a currency pair ordinarily makes. For most pairs that is the fourth decimal place, 0.0001. For pairs quoted in Japanese yen it is the second, 0.01, because the yen is quoted to two decimal places rather than four.</p><p>What a pip is <em>worth</em> is a different question. It depends on how much you are trading and what currency your account is held in, which is why the same one-pip move can be ten dollars or nine euros. That figure is what turns a stop-loss distance on a chart into an amount of money.</p>',
    tr.body = '<h2>How to use this calculator</h2><ol><li>Select your account currency</li><li>Choose the currency pair you want to trade</li><li>Enter your trade size in units, and read off the value of one pip</li></ol><h2>How the figure is worked out</h2><p>Multiply the pip size for the pair by your position size in units, and you have the value of a pip in the pair\'s quote currency.</p><p>If your account is held in a different currency, that figure is converted at the stored exchange rate, and the page prints the day that rate is from.</p>'
WHERE t.`key` = 'pip-value'
  AND tr.locale = 'en'
  AND tr.intro NOT LIKE '<h2>%';

-- margin
UPDATE `tool_translations` tr
JOIN `tools` t ON t.id = tr.toolId
SET tr.intro = '<h2>What is margin?</h2><p>Margin is the deposit a position needs while it is open. It is not a fee and it is not what the trade can lose: it is your own money, set aside while the position is running and released when it closes.</p><p>How much is set aside depends on the leverage you trade at. At 1:100 a 100,000-unit position ties up 1,000 units of the base currency; at 1:500 the same position ties up 200. What each pip costs you does not change with it.</p>',
    tr.body = '<h2>How to use this calculator</h2><ol><li>Select your account currency</li><li>Choose the currency pair and enter your trade size in units</li><li>Enter your account balance and pick your leverage</li><li>Read off the required margin, the free margin left, and your margin level</li></ol><h2>Understanding Margin</h2><ul><li><strong>Required Margin:</strong> The amount needed to open a position</li><li><strong>Free Margin:</strong> Available funds for new positions</li><li><strong>Margin Level:</strong> (Equity / Used Margin) &times; 100</li><li><strong>Margin Call:</strong> Usually occurs at 100% margin level</li></ul><h2>How the figure is worked out</h2><p>A position of 100,000 units is 100,000 of the pair\'s base currency. At 1:100 leverage the deposit is a hundredth of that: 1,000 of the base currency, converted into your account currency at the stored rate.</p><p>Before a position is open, your equity is the same as your balance, so that is what the margin level here is measured against. Once a trade moves, its profit or loss moves your equity, and your margin level with it.</p><p>Leverage changes the deposit, not the risk. A 50-pip move costs the same on a 100,000-unit position at 1:50 as it does at 1:500.</p>'
WHERE t.`key` = 'margin'
  AND tr.locale = 'en'
  AND tr.intro NOT LIKE '<h2>%';

-- profit-loss
UPDATE `tool_translations` tr
JOIN `tools` t ON t.id = tr.toolId
SET tr.intro = '<h2>What is profit and loss on a forex trade?</h2><p>A forex trade makes or loses the distance the price moved multiplied by the size of the position. The distance is measured in pips; the money is measured first in the pair\'s quote currency and then in yours.</p><p>The same fifty-pip move is a few dollars on a micro lot and a few hundred on a standard one, which is why a result in pips and a result in money are two different answers to two different questions. A buy profits when the price rises and a sell when it falls.</p>',
    tr.body = '<h2>How to use this calculator</h2><ol><li>Select your account currency</li><li>Choose the currency pair you want to trade</li><li>Select trade type (Buy/Sell)</li><li>Enter lot size and open/close prices</li><li>See your profit or loss update as you type</li></ol><h2>Trading Tips</h2><ul><li>Always calculate potential profit/loss before entering trades</li><li>Use proper risk management with stop losses</li><li>Consider the risk-reward ratio for each trade</li><li>Factor in spread costs when calculating profits</li></ul><h2>How the figure is worked out</h2><p>The difference between the close and the open price, multiplied by the position size in units, is the result in the pair\'s quote currency. On a buy, a higher close is a profit; on a sell, a lower one is.</p><p>That figure is then converted into your account currency at the stored exchange rate. Spreads, commissions and swaps are not included, so a real trade will do slightly worse than the figure shown.</p>'
WHERE t.`key` = 'profit-loss'
  AND tr.locale = 'en'
  AND tr.intro NOT LIKE '<h2>%';

-- risk-reward
UPDATE `tool_translations` tr
JOIN `tools` t ON t.id = tr.toolId
SET tr.intro = '<h2>What is risk-reward?</h2><p>Risk is the distance from your entry to your stop loss, in money. Reward is the distance from your entry to your take profit, in the same money. The ratio between the two is what decides whether a strategy can survive being wrong more often than it is right.</p><p>At 1:2 — a target paying twice what the stop costs — winning one trade in three roughly breaks even before costs. At 1:1 you have to be right more than half the time for the same result.</p>',
    tr.body = '<h2>How to use this calculator</h2><ol><li>Select your account currency and the currency pair</li><li>Enter your account balance and the share of it you are willing to risk</li><li>Enter your entry, stop loss and take profit as prices, the way they appear on a chart</li><li>Read off the amount at risk, the position size it allows, and the risk-reward ratio</li></ol><h2>Risk Management Tips</h2><ul><li><strong>2% Rule:</strong> Never risk more than 2% per trade</li><li><strong>Risk:Reward:</strong> Aim for minimum 1:2 ratio</li><li><strong>Position Size:</strong> Adjust based on stop loss distance</li><li><strong>Consistency:</strong> Use same risk % for all trades</li></ul><h2>How the figures are worked out</h2><p>The amount at risk is your balance multiplied by your risk percentage. The distance from the entry to the stop loss, in pips, sets how big a position that amount can carry.</p><p>The distance from the entry to the take profit, divided by the distance to the stop, is the risk-reward ratio. A ratio of 1:2 means the target pays twice what the stop costs.</p><p>A stop below the entry is read as a buy and a stop above it as a sell, so the take profit belongs on the other side.</p>'
WHERE t.`key` = 'risk-reward'
  AND tr.locale = 'en'
  AND tr.intro NOT LIKE '<h2>%';

-- gain-loss
UPDATE `tool_translations` tr
JOIN `tools` t ON t.id = tr.toolId
SET tr.intro = '<h2>What is a gain or loss percentage?</h2><p>A percentage gain or loss is the change in a balance measured against the balance it started from. That last part is what makes the two asymmetrical: a loss is measured against the larger balance you had, and the gain that would undo it is measured against the smaller one you are left with.</p><p>Lose 50% and a 50% gain does not restore the account. You need 100%, because the gain is earned on what is left.</p>',
    tr.body = '<h2>How to use this calculator</h2><ol><li>Enter the balance you started from</li><li>Enter any ONE of the other three: the amount made or lost, the percentage, or the balance you ended with</li><li>Read off the two figures it fills in, and what it takes to get back to level</li></ol><h2>About gains, losses, and getting back to even</h2><p>The asymmetry above is the whole argument for position sizing. A string of small, survivable losses is recoverable arithmetic. A large one is not.</p><p>Nothing here needs a market rate, so this calculator answers the same way on a laptop with no connection at all.</p>'
WHERE t.`key` = 'gain-loss'
  AND tr.locale = 'en'
  AND tr.intro NOT LIKE '<h2>%';

-- pivot-points
UPDATE `tool_translations` tr
JOIN `tools` t ON t.id = tr.toolId
SET tr.intro = '<h2>What are pivot points?</h2><p>A pivot point is a price worked out from the previous period\'s high, low and close, and used as the axis for the period that follows. The levels above it are read as resistance, the levels below it as support.</p><p>They are arithmetic rather than a forecast: the same four numbers always give the same levels. That is also why they are watched — a great many traders are looking at exactly the same lines.</p>',
    tr.body = '<h2>How to use this calculator</h2><ol><li>Choose a symbol and an interval — daily, weekly, monthly or yearly</li><li>The open, high, low and close of the last completed period are filled in for you where the platform has them; type your own over the top at any time</li><li>Read the table: every method, side by side, for the same four prices</li></ol><h2>About Pivot Points</h2><p>Five methods are offered, and they disagree with each other on purpose.</p><p><strong>Floor</strong> is the classic: the pivot is the average of the high, the low and the close, and the supports and resistances are reflected around it.</p><p><strong>Woodie</strong> weights the opening price double, so the pivot leans toward where the period began rather than where it ended.</p><p><strong>Camarilla</strong> is the only method with four levels a side, and its levels are measured from the close rather than from the pivot.</p><p><strong>DeMark</strong> gives one level a side, and which formula it uses depends on whether the period closed above or below its open.</p><p><strong>Fibonacci</strong> places its levels at 38.2%, 61.8% and 100% of the period\'s range, measured from the pivot.</p><p>Levels are computed from the last COMPLETED period, never from one still trading. A level recalculated every hour out of a half-formed bar is not a level anyone can plan against.</p>'
WHERE t.`key` = 'pivot-points'
  AND tr.locale = 'en'
  AND tr.intro NOT LIKE '<h2>%';

-- market-hours
UPDATE `tool_translations` tr
JOIN `tools` t ON t.id = tr.toolId
SET tr.intro = '<h2>When is the forex market open?</h2><p>The currency market runs around the clock from Sydney\'s Sunday open to New York\'s Friday close. It has no single exchange and no opening bell: it is four regional sessions handing over to one another.</p><p>It is not equally busy throughout. Where two sessions are open at once there are twice as many people trading the same pairs, and that is where most of the day\'s movement happens.</p>',
    tr.body = '<h2>How to use this page</h2><ol><li>Check the clock at the top — it is your own local time, read from your device</li><li>See which sessions are open now, and how long each has left</li><li>Look at the overlaps to find the busiest windows of your own day</li></ol><h2>About the trading sessions</h2><p>All four session times are shown in the timezone you pick, and they follow daylight saving automatically — which is why London\'s hours shift against Tokyo\'s twice a year even though Tokyo never changes its clocks.</p><p>The busiest window is the London/New York overlap, when the two largest sessions are open at once. The quietest is the gap between the New York close and the Tokyo open.</p><p>The market is shut across the weekend. The gap is bounded by two local times, not by a UTC midnight, so it opens and closes at a different clock hour depending where you are reading this.</p>'
WHERE t.`key` = 'market-hours'
  AND tr.locale = 'en'
  AND tr.intro NOT LIKE '<h2>%';

-- currency-converter
UPDATE `tool_translations` tr
JOIN `tools` t ON t.id = tr.toolId
SET tr.intro = '<h2>What is the mid-market rate?</h2><p>The mid-market rate is the midpoint between what buyers are offering for a currency and what sellers are asking for it. It is the rate quoted in the news, and it is the rate every other rate is measured against.</p><p>It is also not a rate anybody will hand you. What a bank, an ATM, a card or an airport kiosk gives you is that rate less a markup, and the size of the markup is usually larger than people expect.</p>',
    tr.body = '<h2>How to use this converter</h2><ol><li>Pick the currency you are converting from and the one you want</li><li>Enter the amount</li><li>Read the mid-market result, then compare it with what each kind of provider would typically hand you</li></ol><h2>About the rates you are shown</h2><p>The four comparison options apply a typical markup to the mid-market rate. They are estimates, not quotes, and they are not attributed to any named provider — what a particular bank or kiosk charges you on a particular day is between you and them. The figures exist to show the SHAPE of the cost.</p><p>Rates come from the last completed daily close, and the page says when that was.</p>'
WHERE t.`key` = 'currency-converter'
  AND tr.locale = 'en'
  AND tr.intro NOT LIKE '<h2>%';

-- correlation
UPDATE `tool_translations` tr
JOIN `tools` t ON t.id = tr.toolId
SET tr.intro = '<h2>What is currency correlation?</h2><p>Correlation measures how closely two pairs have moved together. At +1 they have moved in lockstep, at &minus;1 exactly opposite, and near 0 their day-to-day moves have had nothing to do with each other.</p><p>It matters because two positions in strongly correlated pairs are closer to one position than to two. An account holding EUR/USD and GBP/USD is largely holding one bet against the dollar, at twice the size the position sizing assumed.</p>',
    tr.body = '<h2>How to use this grid</h2><ol><li>Pick a window — the number of trading days the figures are measured over</li><li>Read a cell as the relationship between the pair on its row and the pair on its column</li><li>Check the pairs you already hold against the one you are about to open</li></ol><h2>What the numbers mean</h2><p>We correlate daily <em>returns</em>, not prices. That distinction matters more than it sounds: two pairs that are both drifting upward will look correlated at the price level even when their day-to-day moves have nothing to do with each other.</p><p>A cell with too little history shows a dash rather than a number. A coefficient computed from a handful of days is not a small measurement, it is a wrong one.</p><p>These figures describe a window that has already closed. They are updated once a day and are not a forecast.</p>'
WHERE t.`key` = 'correlation'
  AND tr.locale = 'en'
  AND tr.intro NOT LIKE '<h2>%';

-- risk-sentiment
UPDATE `tool_translations` tr
JOIN `tools` t ON t.id = tr.toolId
SET tr.intro = '<h2>What is risk-on and risk-off?</h2><p>Risk-on and risk-off describe which way money has been moving. When investors are willing to take risk, money moves toward equities and the commodity currencies; when they are not, it moves toward gold, the yen and the franc.</p><p>The meter is a single score from 0 to 100 built from how a basket of those markets has moved relative to its own recent history. High is risk-on; low is risk-off.</p>',
    tr.body = '<h2>How to read this meter</h2><ol><li>Read the score first: above the upper band is risk-on, below the lower one risk-off, and the middle is neither</li><li>Look at the components to see which markets are carrying the score</li><li>Check the date it was last worked out — it describes a day that has closed</li></ol><h2>How the score is built</h2><p>Each market in the basket is scored by where its latest move sits within its own recent range — its percentile rank. A market that usually moves half a percent and has just moved two ranks near the top of its own history, whatever the absolute number.</p><p>Markets that rise when risk is being taken on — equity indices, commodity currencies — score as they rank. Markets that rise when risk is coming off — gold, the yen — have their rank flipped before it is counted. The weighted average of what is left is the score.</p><p>A market with too little history is left out and counted, never filled in with a zero. A zero would be a claim that the market was neutral; leaving it out is the truth, which is that we do not know.</p><p>The score is updated once a day. It describes what has already happened, it is not a forecast, and it is not a recommendation to do anything.</p>'
WHERE t.`key` = 'risk-sentiment'
  AND tr.locale = 'en'
  AND tr.intro NOT LIKE '<h2>%';

-- The pip page takes its reference page's own title and tagline (changes-40),
-- the treatment ADR-135 gave margin, profit and risk. Bounded on the title the
-- seed wrote: an admin who has renamed it keeps their name. The URL is
-- untouched — the registry key is the segment (ADR-086 #3) and a title is data.
UPDATE `tool_translations` tr
JOIN `tools` t ON t.id = tr.toolId
SET tr.title = 'Pip Calculator',
    tr.tagline = 'Calculate the value of a pip for any currency pair and trade size. Essential tool for risk management and position sizing.',
    tr.seoTitle = 'Pip Calculator',
    tr.seoDescription = 'Calculate the value of a pip for any currency pair and trade size. Essential tool for risk management and position sizing.'
WHERE t.`key` = 'pip-value'
  AND tr.locale = 'en'
  AND tr.title = 'Pip Value Calculator';
