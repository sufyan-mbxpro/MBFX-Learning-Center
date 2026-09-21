# Running the scheduled jobs

Three routes do work on a timer. They share one bearer token, one shape and one
guarantee: **no page breaks if they never run.** A page falls back to its last
good data and says so. Schedule `market-sync` and `publish-due` because data
goes stale; schedule `housekeeping` because it is a **retention obligation** —
if it never runs, email-delivery rows, unconfirmed newsletter addresses and
per-user AI usage rows (all PII) are kept forever.

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

All three routes export **only `POST`**. A `GET` answers **405**.

## Before anything: the token

Every route answers **503 `not_configured`** until `CRON_SECRET` is set. That is
deliberate — an unset variable must never mean "anyone may spend the provider's
request budget" or "anyone may delete rows".

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Put it in `.env` (local) or the host's environment (production), then **restart
the app**. `.env` is read once at startup; editing it under a running server
changes nothing.

## The routes, and how to verify each

Load the token into a shell variable without echoing it:

```bash
S=$(grep -E '^CRON_SECRET=' .env | cut -d= -f2- | tr -d '"\r')
BASE=http://localhost:3000   # or https://example.com
```

### `market-sync`

```bash
curl -fsS -X POST "$BASE/api/cron/market-sync" -H "Authorization: Bearer $S"
```

Add `?force=1` to skip the interval check and fetch immediately (spends
provider quota):

```bash
curl -fsS -X POST "$BASE/api/cron/market-sync?force=1" -H "Authorization: Bearer $S"
```

Not due yet (HTTP 200, nothing spent):

```json
{
  "swept": false,
  "reason": "not_due",
  "lastSyncAt": "…",
  "nextDueAt": "…",
  "intervalSeconds": 86400
}
```

A sweep answers with what it did:

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

**Verify:** `/admin/market/provider` shows last run, last error and the next
scheduled sync; every real sweep writes an audit row `market.sync` (no user,
entity `MarketProvider`) — the admin's **Sync now** button writes
`market.sync.manual` instead. A `not_due` answer writes nothing.

### `publish-due`

```bash
curl -fsS -X POST "$BASE/api/cron/publish-due" -H "Authorization: Bearer $S"
```

```json
{ "sweptAt": "2026-09-20T09:15:00.000Z", "articles": 0, "content": 2 }
```

`articles` counts news articles flipped to `PUBLISHED`; `content` counts
courses, lessons, glossary terms, quizzes and video topics. Scheduled content is
already public at its minute (visibility is decided in the query), so this is
bookkeeping: it makes `status` true and stamps `publishedAt` with the promised
time.

**Verify:** when something was due, the audit log has `articles.publishDue`
and/or `courses.publishDue`, `lessons.publishDue`, `glossary.publishDue`,
`quizzes.publishDue`, `videos.publishDue` (no user; `changes.after` lists the
ids). A run with nothing due writes no audit row.

### `housekeeping`

```bash
curl -fsS -X POST "$BASE/api/cron/housekeeping" -H "Authorization: Bearer $S"
```

```json
{ "sweptAt": "2026-09-20T03:30:00.000Z", "pendingSubscribers": 0, "deliveries": 0, "aiUsage": 0 }
```

Each number is rows deleted. **It writes no audit row** by design — an age
purge has no actor, and a row per purge would be a second copy of the
retention clock. Verify through the response, or check that the oldest row in
the delivery log (`/admin/settings/email/log`) is inside 90 days.

## Local

You usually don't need a scheduler locally — press **Sync now** on
`/admin/market/provider`. If you want one anyway, see
[Windows Task Scheduler](#windows-task-scheduler) or the crontab below with
`BASE=http://localhost:3000`.

## Production

Pick whichever matches the host. They all do the same thing: POST, bearer
token, fail loudly on non-2xx.

### Linux: a wrapper script (used by crontab and systemd)

Keep the token in a root-only file, never inline in a crontab or unit — a
crontab is readable by more people than you think, and a command line shows
up in `ps`.

```bash
# /etc/mbx/cron.env   (chmod 600, owner root)
CRON_SECRET=...
MBX_BASE_URL=https://example.com
```

```bash
#!/bin/sh
# /usr/local/bin/mbx-cron  (chmod 755) — usage: mbx-cron <market-sync|publish-due|housekeeping>
set -eu
. /etc/mbx/cron.env
case "$1" in
  market-sync|publish-due|housekeeping) ;;
  *) echo "unknown route: $1" >&2; exit 2 ;;
esac
# The token goes through a header file on stdin so it never appears in argv.
printf 'Authorization: Bearer %s\n' "$CRON_SECRET" |
  curl -fsS --max-time 300 -X POST -H @- "$MBX_BASE_URL/api/cron/$1"
echo
```

### Linux: crontab

`crontab -e` as root (the script reads a root-only file):

```cron
*/15 * * * * /usr/local/bin/mbx-cron market-sync  >>/var/log/mbx-cron.log 2>&1
*/15 * * * * /usr/local/bin/mbx-cron publish-due  >>/var/log/mbx-cron.log 2>&1
30 3 * * *   /usr/local/bin/mbx-cron housekeeping >>/var/log/mbx-cron.log 2>&1
```

### Linux: systemd timers

Better logs, and a run missed while the machine was off fires on boot (`Persistent=true` applies to `OnCalendar=` timers). One templated
service serves all three routes; the instance name is the route.

```ini
# /etc/systemd/system/mbx-cron@.service
[Unit]
Description=MBX cron: %i
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/mbx-cron %i
```

```ini
# /etc/systemd/system/mbx-cron@market-sync.timer
# (copy to mbx-cron@publish-due.timer with the same schedule)
[Unit]
Description=MBX cron: market-sync every 15 minutes

[Timer]
OnCalendar=*:0/15
Persistent=true

[Install]
WantedBy=timers.target
```

```ini
# /etc/systemd/system/mbx-cron@housekeeping.timer
[Unit]
Description=MBX cron: housekeeping daily

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
systemctl daemon-reload
systemctl enable --now mbx-cron@market-sync.timer mbx-cron@publish-due.timer mbx-cron@housekeeping.timer
systemctl list-timers 'mbx-cron@*'
journalctl -u 'mbx-cron@*' --since today
systemctl start mbx-cron@publish-due.service   # run one now
```

### Windows Task Scheduler

PowerShell (as the user the task runs under). The secret is read from an
environment variable at run time rather than stored in the task definition:

```powershell
[Environment]::SetEnvironmentVariable("CRON_SECRET", "PASTE_SECRET", "User")
$base = "http://localhost:3000"
$jobs = @(
  @{ Route = "market-sync";  Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 15) },
  @{ Route = "publish-due";  Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 15) },
  @{ Route = "housekeeping"; Trigger = New-ScheduledTaskTrigger -Daily -At 3:30am }
)
foreach ($j in $jobs) {
  $cmd = "curl.exe -fsS -X POST $base/api/cron/$($j.Route) -H ('Authorization: Bearer ' + `$env:CRON_SECRET)"
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -NonInteractive -Command `"$cmd`""
  Register-ScheduledTask -TaskName "mbx-$($j.Route)" -Action $action -Trigger $j.Trigger -Force
}
Start-ScheduledTask -TaskName "mbx-publish-due"   # run one now; check "Last Run Result"
```

### GitHub Actions

Needs no infrastructure, but scheduled workflows are best-effort and can be
delayed by many minutes under load. Fine for the daily sweep, loose for 15
minutes. Secrets: `SITE_URL`, `CRON_SECRET`.

```yaml
name: cron
on:
  schedule:
    - cron: "*/15 * * * *" # market-sync + publish-due
    - cron: "30 3 * * *" # housekeeping
  workflow_dispatch:
jobs:
  call:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        route: [market-sync, publish-due, housekeeping]
    steps:
      - name: POST /api/cron/${{ matrix.route }}
        # Every-15 ticks skip housekeeping; the daily tick runs all three.
        if: matrix.route != 'housekeeping' || github.event.schedule == '30 3 * * *' || github.event_name == 'workflow_dispatch'
        run: curl -fsS --max-time 300 -X POST "$URL/api/cron/${{ matrix.route }}" -H "Authorization: Bearer $SECRET"
        env:
          URL: ${{ secrets.SITE_URL }}
          SECRET: ${{ secrets.CRON_SECRET }}
```

### cron-job.org (or any hosted pinger)

Create one job per route:

| Field          | Value                                                                     |
| -------------- | ------------------------------------------------------------------------- |
| URL            | `https://example.com/api/cron/<route>`                                    |
| Request method | **POST** (the default GET gets 405)                                       |
| Headers        | `Authorization: Bearer <CRON_SECRET>`                                     |
| Schedule       | every 15 min (`market-sync`, `publish-due`), daily 03:30 (`housekeeping`) |
| Timeout        | the maximum the plan allows (`market-sync` can take a while)              |
| Notify on      | failure (non-2xx) — `not_due` is a 200 and will not alert                 |

The token is stored by the third party; rotate it if you stop using them.

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
routes export only `POST` (still true as of 2026-09-20). Either add a `GET`
export that delegates to `POST`, or drive them from an external scheduler. A
cron that 405s is silent.

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

| Symptom                                   | Cause / fix                                                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 503 `{"error":"not_configured"}`          | `CRON_SECRET` unset — or set, but the app was not restarted                                                                       |
| 401 `{"error":"unauthorized"}`            | Token missing or wrong. Check for a trailing newline/`\r` or quotes in the stored secret, and that the header is `Bearer <token>` |
| 405                                       | The scheduler sent GET (Vercel Cron, cron-job.org's default). Switch to POST                                                      |
| 404                                       | Wrong path or base URL (e.g. a locale prefix, or `/admin/api/...`). The routes are exactly `/api/cron/<route>`                    |
| 502 / 504 from nginx                      | The proxy, not the app: raise `proxy_read_timeout` (see [deploy.md](./deploy.md)) and the scheduler's timeout                     |
| curl exit 28 / scheduler "timeout"        | `market-sync` with many instruments on a slow provider. Raise the client timeout to 300 s; the next run resumes stalest-first     |
| `{"swept": false, "reason": "not_due"}`   | Working as intended. Shorten **Sync interval**, or pass `?force=1`                                                                |
| Every symbol in `failures`                | The provider rejected the key, or `MARKET_SECRET_KEY` changed and the stored key no longer opens                                  |
| Tools show an empty state with an "as of" | No bars yet. Press **Sync now** — this is the pre-first-sync state                                                                |
| AI features are absent from every editor  | `ai.enabled` is off, the feature is off, or the month's budget is spent — `/admin/ai` says which                                  |
| An AI call fails with `secret_unreadable` | `AI_SECRET_KEY` is unset or changed, so the stored provider key no longer opens                                                   |

The last sweep's outcome is also on `/admin/market/provider` (last run, last
error, next scheduled sync) and in the audit log as `market.sync` for an
unattended run or `market.sync.manual` for the button.
