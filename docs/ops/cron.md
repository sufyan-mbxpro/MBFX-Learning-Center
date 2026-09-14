# Running the scheduled jobs

Three routes do work on a timer. They share one bearer token, one shape and one
guarantee: **nothing on the site breaks if they never run.** A page falls back
to its last good data and says so. Schedule them because the data goes stale,
not because the site stops working.

| Route                         | What it does                                                           | Sensible cadence |
| ----------------------------- | ---------------------------------------------------------------------- | ---------------- |
| `POST /api/cron/market-sync`  | Fetches daily price bars for active instruments                        | every 15 min †   |
| `POST /api/cron/publish-due`  | Moves due scheduled content to `PUBLISHED`                             | every 15 min     |
| `POST /api/cron/housekeeping` | Deletes email deliveries > 90d, pending subs > 7d, AI usage rows > 90d | daily            |

† **Not a typo, and this is the part worth understanding.** `market-sync` asks
the database whether enough time has passed before it calls the data provider.
How often it actually fetches is **Sync interval** on `/admin/market/provider`
— a dropdown, not a deploy. Schedule the route often and let the setting
decide; a call that arrives early returns `{"swept": false, "reason":
"not_due"}` with HTTP 200 and spends nothing.

## Before anything: the token

Every route answers **503 `not_configured`** until `CRON_SECRET` is set. That is
deliberate — an unset variable must never mean "anyone may spend the provider's
request budget".

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Put it in `.env` (local) or the host's environment (production), then **restart
the app**. `.env` is read once at startup; editing it under a running server
changes nothing.

## Calling a route by hand

```bash
curl -fsS -X POST http://localhost:3000/api/cron/market-sync \
  -H "Authorization: Bearer $CRON_SECRET"
```

Add `?force=1` to skip the interval check and fetch immediately:

```bash
curl -fsS -X POST "http://localhost:3000/api/cron/market-sync?force=1" \
  -H "Authorization: Bearer $CRON_SECRET"
```

A successful sweep answers with what it did:

```json
{
  "swept": true,
  "forced": false,
  "sweptAt": "2026-09-14T22:05:11.004Z",
  "attempted": 28,
  "synced": 19,
  "barsWritten": 4712,
  "skipped": 0,
  "failures": [{ "symbol": "BTC/USD", "error": "Provider rate-limited" }]
}
```

`failures` is normal on a free plan and not a reason to alert. Instruments are
swept **stalest first**, so whatever failed is at the front of the next run.
Watch for `synced` trending to zero over days, not for a non-empty `failures`.

Responses to expect: **200** swept · **200** `not_due` · **401** wrong or
missing token · **503** no `CRON_SECRET` set.

## Local

You usually don't need a scheduler locally — press **Sync now** on
`/admin/market/provider`. If you want one anyway:

**Windows Task Scheduler**, every 15 minutes:

```powershell
$action  = New-ScheduledTaskAction -Execute "curl.exe" -Argument '-fsS -X POST http://localhost:3000/api/cron/market-sync -H "Authorization: Bearer PASTE_SECRET"'
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName "mbx-market-sync" -Action $action -Trigger $trigger
```

**macOS / Linux**, `crontab -e`:

```cron
*/15 * * * * curl -fsS -X POST http://localhost:3000/api/cron/market-sync -H "Authorization: Bearer PASTE_SECRET" >/dev/null
```

## Production

Pick whichever matches the host. All four do the same thing.

### Vercel Cron

`vercel.json` at the repo root. Vercel sends `Authorization: Bearer
$CRON_SECRET` automatically when that variable exists in the project, so no
token goes in this file:

```json
{
  "crons": [
    { "path": "/api/cron/market-sync", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/publish-due", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/housekeeping", "schedule": "30 3 * * *" }
  ]
}
```

**Check this before relying on it:** Vercel Cron issues **GET**, and these
routes export only `POST`. Either add a `GET` export that delegates to `POST`,
or drive them from an external scheduler. A cron that 405s is silent.

### GitHub Actions

Needs no infrastructure, but scheduled workflows are best-effort and can be
delayed by many minutes under load. Fine for a daily sweep, poor for 15.

```yaml
name: market-sync
on:
  schedule:
    - cron: "*/15 * * * *"
  workflow_dispatch:
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -X POST "$URL/api/cron/market-sync" -H "Authorization: Bearer $SECRET"
        env:
          URL: ${{ secrets.SITE_URL }}
          SECRET: ${{ secrets.CRON_SECRET }}
```

### A plain VPS: crontab

```cron
*/15 * * * * curl -fsS -X POST https://example.com/api/cron/market-sync -H "Authorization: Bearer $CRON_SECRET" >/dev/null 2>&1
30 3 * * *   curl -fsS -X POST https://example.com/api/cron/housekeeping -H "Authorization: Bearer $CRON_SECRET" >/dev/null 2>&1
```

Keep the secret in a root-only file that cron sources, not inline in the
crontab — a crontab is readable by more people than you think.

### systemd timer

Better logs, and no lost run after a reboot (`Persistent=true`).

```ini
# /etc/systemd/system/mbx-market-sync.service
[Unit]
Description=MBX market sync

[Service]
Type=oneshot
EnvironmentFile=/etc/mbx/cron.env
ExecStart=/usr/bin/curl -fsS -X POST https://example.com/api/cron/market-sync -H "Authorization: Bearer ${CRON_SECRET}"
```

```ini
# /etc/systemd/system/mbx-market-sync.timer
[Unit]
Description=MBX market sync every 15 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=15min
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
systemctl enable --now mbx-market-sync.timer
```

## Data provider limits

Alpha Vantage's free plan allows **25 requests per day** (their support page,
2026-09-14). The sweep spends **one request per active instrument**, so 28
active instruments cannot all sync on a free key — the tail comes back
rate-limited, which the driver reads as a failure rather than storing a bad
bar.

Two things follow:

- **Deactivate what you are not using.** `/admin/market` → Deactivate. A
  deactivated instrument keeps its stored history and is skipped by the sweep.
- **The bundled driver speaks `FX_DAILY`, which is forex only.** Metals
  (`XAU/USD`, `XAG/USD`), crypto (`BTC/USD`, `ETH/USD`), indices (`SPX/USD`,
  `NDX/USD`, `DXY/USD`) and commodities (`WTI/USD`) come from different Alpha
  Vantage endpoints and will fail every run until the driver learns them. They
  are seeded active — deactivate them, or expect them in `failures`.

## AI spend

`housekeeping` also deletes `AiUsage` rows older than **90 days** (ADR-097).
Two things about that are worth knowing before the first month rolls over:

- **The rollups are not deleted.** `AiUsageDaily` carries no `userId` and is
  kept forever, so a twelve-month spend chart keeps working after the raw rows
  behind it are gone. What the purge removes is the per-call detail — who spent
  it, and against which article — which is PII on a clock.
- **The budget is not a cron job.** The monthly cap lives in
  `AiBudgetPeriod`, keyed by UTC month, and a new month's row is created by the
  first call of that month. Nothing has to run on the 1st; a capped platform
  un-caps itself when the month turns, and the banner clears with it.

There is no AI equivalent of `market-sync`: nothing is fetched on a schedule,
and every AI call is something a member of staff pressed.

## When something looks wrong

| Symptom                                   | Cause                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 503 `not_configured`                      | `CRON_SECRET` unset — or set, but the app was not restarted                                      |
| 401                                       | Token mismatch; check for a trailing newline in the stored secret                                |
| `{"swept": false, "reason": "not_due"}`   | Working as intended. Shorten **Sync interval**, or pass `?force=1`                               |
| Every symbol in `failures`                | The provider rejected the key, or `MARKET_SECRET_KEY` changed and the stored key no longer opens |
| Tools show an empty state with an "as of" | No bars yet. Press **Sync now** — this is the pre-first-sync state                               |
| AI features are absent from every editor  | `ai.enabled` is off, the feature is off, or the month's budget is spent — `/admin/ai` says which |
| An AI call fails with `secret_unreadable` | `AI_SECRET_KEY` is unset or changed, so the stored provider key no longer opens                  |

The last sweep's outcome is also on `/admin/market/provider` (last run, last
error, next scheduled sync) and in the audit log as `market.sync` for an
unattended run or `market.sync.manual` for the button.
