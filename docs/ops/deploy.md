# Deploying to a live Linux server

A runbook for one Node process behind nginx, with MariaDB and Redis on the
same host or nearby. The order of a first install is fixed by ADR-144:
`db:deploy` → `db:seed` → `seed:live` → build → start.

Paths used below (change them, but keep the shape):

| Path                      | What                                                    |
| ------------------------- | ------------------------------------------------------- |
| `/srv/mbx/app`            | the checkout (release directory)                        |
| `/srv/mbx/shared/.env`    | the environment, `chmod 600`, owned by the app user     |
| `/srv/mbx/shared/uploads` | `UPLOADS_DIR` — uploaded media, OUTSIDE the release dir |
| `mbx`                     | the unprivileged system user that runs the app          |

## 1. Prerequisites

- **Node.js 22.x LTS**, 22.13.0 or later (`engines: >=22.13.0`, `.nvmrc` = 22, ADR-145).
- **pnpm via corepack**, at the version pinned in the root `package.json`
  `packageManager` field — never a globally installed pnpm of another version:

  ```bash
  corepack enable
  cd /srv/mbx/app && corepack install   # installs the pinned pnpm
  pnpm --version
  ```

- **MariaDB** (a database and a user with full rights on it — Prisma Migrate
  needs DDL).
- **Redis**. Better Auth keeps its session cache and rate-limit counters there
  (`secondaryStorage` is always configured), so treat `REDIS_URL` as required
  for sign-in. Only the app's own IP rate limiter has an in-process fallback.
- **nginx** (or any TLS-terminating reverse proxy) and a certificate.
- Optional: **ffmpeg** on the host, for video compression (ADR-144 §4).
- Build needs no extra toolchain: `sharp` and Prisma ship prebuilt binaries
  (`allowBuilds` in `pnpm-workspace.yaml`).

## 2. Environment

One file, at the repo root as `.env` — `next.config.ts` and
`packages/db/prisma.config.ts` both load `../../.env` explicitly, so a
`.env` inside `apps/web` is not what they read. Keep the real file in
`shared/` and symlink it into each release:

```bash
ln -sfn /srv/mbx/shared/.env /srv/mbx/app/.env
```

`.env.example` is the template. Names only below — **never commit values**.

**Required**

| Variable                | Notes                                                                  |
| ----------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`          | `mysql://user:pass@host:3306/db`                                       |
| `REDIS_URL`             | `redis://127.0.0.1:6379`                                               |
| `BETTER_AUTH_SECRET`    | `openssl rand -base64 32`; changing it signs everyone out              |
| `BETTER_AUTH_URL`       | the public origin, `https://example.com` — also the sitemap/RSS origin |
| `NEXT_PUBLIC_SITE_URL`  | same origin                                                            |
| `NEXT_PUBLIC_ADMIN_URL` | `https://example.com/admin`                                            |
| `UPLOADS_DIR`           | ABSOLUTE path, e.g. `/srv/mbx/shared/uploads` (see §7)                 |
| `NODE_ENV`              | `production` (set by the process manager)                              |

`NEXT_PUBLIC_*` values are inlined **at build time**: set them before
`build`, and rebuild if they change.

**Sealing keys** (security.md #10) — 32 bytes, base64, generate each with
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
Each seals one provider credential stored in the database. **Losing or
changing one makes the stored credential unreadable** — back them up with the
same care as the database.

| Variable             | Seals                                                    |
| -------------------- | -------------------------------------------------------- |
| `EMAIL_SECRET_KEY`   | the SMTP password (`EmailTransport`)                     |
| `MARKET_SECRET_KEY`  | the market data API key (`MarketProvider`)               |
| `AI_SECRET_KEY`      | the AI provider API key (`AiProvider`)                   |
| `CAPTCHA_SECRET_KEY` | Google's reCAPTCHA secret key (`CaptchaConfig`, ADR-156) |

**Scheduled jobs**

| Variable      | Notes                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `CRON_SECRET` | bearer token for `/api/cron/*`; unset ⇒ every cron route answers 503. See [cron.md](./cron.md) |

**Optional**

| Variable                                                       | Notes                                                                                                                                    |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `FFMPEG_PATH`                                                  | e.g. `/usr/bin/ffmpeg`. Set ⇒ uploaded video is re-encoded to H.264/AAC MP4 and kept only if smaller. Unset ⇒ stored as uploaded         |
| `HOME_CONTENT_MODE`                                            | `real` hides the homepage's placeholder figures/quotes/partners (ADR-103). Default `demo`                                                |
| `GOOGLE_CLIENT_ID` / `_SECRET`, `GITHUB_CLIENT_ID` / `_SECRET` | OAuth; there is no OAuth UI yet, leave empty                                                                                             |
| `CAPTCHA_DISABLED`                                             | any value but `0`/`false` switches reCAPTCHA off whatever Settings → General → reCAPTCHA says (ADR-156). Break-glass for a Google outage |
| `PORT`                                                         | `next start` port, default 3000                                                                                                          |

**Seed-time only** — present while seeding, then **removed from the file**:
`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and the `SEED_*` provider variables
in §4.

## 3. Install and migrate

```bash
cd /srv/mbx/app
pnpm install --frozen-lockfile     # dev deps included: the seeds run through tsx
pnpm db:generate                   # Prisma client
pnpm db:deploy                     # prisma migrate deploy
```

**Never `pnpm db:migrate` (migrate dev) or `pnpm db:reset` on a live
database.** `migrate deploy` only applies committed migrations; the other two
can create migrations or drop data.

## 4. Seed

```bash
pnpm db:seed      # permissions, roles, settings, flags, menus, the admin user
pnpm seed:live    # the demo corpus, theme/brand/settings, provider keys
```

**`pnpm db:seed`** is idempotent — every write is an upsert on a stable
business key, and it is written to repair drift without clobbering admin
edits. It creates the super-admin only when `SEED_ADMIN_PASSWORD` is set
(otherwise it logs `SKIPPED admin user`). **Caveat:** with
`SEED_ADMIN_PASSWORD` set, a re-run RESETS that admin's password to it.

**`pnpm seed:live`** (ADR-144 §1) runs after it and:

- creates the starting corpus — two courses per school on top of the demo
  course `db:seed` writes (so three each), two quizzes and six video topics —
  and attaches the committed images (`packages/core/seed-live/media/`) to every
  seeded course, lesson, quiz, video topic, glossary topic and article that has
  none. Each file is stored through `storeMedia()` into `UPLOADS_DIR`; run it
  with the **same `UPLOADS_DIR`** the app uses (blank means
  `apps/web/storage/uploads`, which is what `next start` uses when blank);
- applies `packages/core/seed-live/defaults.json` — theme, brand assets,
  non-secret settings and flags — **once per database**, so an admin's later
  change survives a re-run. The `ai.*` settings are held back until an AI
  provider has a key, so AI never switches on over the placeholder ECHO driver.
  Glossary terms and the tool FAQs come from `db:seed`;
- for each provider whose variables are set, seals the key under the matching
  sealing key and stores it:

  | Provider | Variables                                                                                                                                                | Needs               |
  | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
  | Market   | `SEED_MARKET_PROVIDER_KIND`, `SEED_MARKET_PROVIDER_API_KEY`                                                                                              | `MARKET_SECRET_KEY` |
  | AI       | `SEED_AI_PROVIDER_KIND`, `SEED_AI_PROVIDER_API_KEY`, `SEED_AI_PROVIDER_BASE_URL`, `SEED_AI_MODEL_LIGHT`, `SEED_AI_MODEL_STANDARD`, `SEED_AI_MODEL_HEAVY` | `AI_SECRET_KEY`     |
  | SMTP     | `SEED_SMTP_HOST`, `SEED_SMTP_PORT`, `SEED_SMTP_SECURITY`, `SEED_SMTP_USER`, `SEED_SMTP_PASSWORD`, `SEED_SMTP_FROM`                                       | `EMAIL_SECRET_KEY`  |

  Unset ⇒ that provider is skipped with a log line, never an error. A provider
  that already holds a key is left alone. Kind and model tiers default to what
  `defaults.json` recorded, so with the same AI vendor only the key is needed.

It is idempotent: a row it already created is left alone, so an admin's edit
survives a second run. **Afterwards delete every `SEED_*` line from
`/srv/mbx/shared/.env`.** The run ends with a summary line (courses per school,
quizzes, video topics, glossary terms) and warns if any tool is missing its FAQ.

`pnpm seed:export-defaults` is the other half: run it on a **dev machine**
against an install whose look you want to ship, commit the JSON it writes, and
deploy. It never runs on the server, and it refuses keys a sealed column owns.

## 5. Build and start

```bash
pnpm --filter web build     # next build → apps/web/.next
pnpm --filter web start     # next start, listens on $PORT (default 3000)
```

`start` runs with `apps/web` as its working directory. Bind it to loopback
only and let nginx face the internet (`PORT=3000`, and `-H localhost` if you
call `next start` directly).

**`-H localhost`, never `-H 127.0.0.1`.** Found on the first live deploy: the
proxy's next-intl rewrite (`/` → `/en`) is built on a `localhost` origin, and
with the server bound to `127.0.0.1` Next treats that as an EXTERNAL rewrite
and fetches it over HTTP. The fetched `/en` then gets next-intl's
strip-the-default-prefix redirect back to `/`, so every public page answers
`307 → itself` forever while `/admin` (which never reaches next-intl) works.
Check after any change to the start command:
`curl -s -o /dev/null -w '%{http_code}
' http://localhost:3000/` must be 200.

`localhost` may resolve to IPv6 only (`::1`) — it did on the first live host,
so `curl http://127.0.0.1:3000/` answered `000` while `localhost` answered 200. nginx must then proxy to `http://[::1]:3000` (on CloudPanel: edit the
site's Vhost, `proxy_pass http://[::1]:{{app_port}};`). Check which one the
server bound: `ss -ltn | grep :3000`.

### pm2

```js
// /srv/mbx/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "mbx",
      cwd: "/srv/mbx/app/apps/web",
      script: "node_modules/next/dist/bin/next",
      args: "start -H localhost -p 3000",
      exec_mode: "fork", // pm2 defaults to cluster when `instances` is set
      env: { NODE_ENV: "production" },
      instances: 1, // one process; see "zero downtime" below before raising this
      max_memory_restart: "1500M",
    },
  ],
};
```

```bash
pm2 start /srv/mbx/ecosystem.config.cjs && pm2 save && pm2 startup
```

### systemd

```ini
# /etc/systemd/system/mbx.service
[Unit]
Description=MBX Learning Center
After=network.target mariadb.service redis-server.service

[Service]
User=mbx
WorkingDirectory=/srv/mbx/app/apps/web
Environment=NODE_ENV=production PORT=3000
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -H localhost -p 3000
Restart=always
RestartSec=5
# The app reads /srv/mbx/app/.env itself (next.config.ts); no EnvironmentFile needed.

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now mbx
journalctl -u mbx -f
```

## 6. nginx

```nginx
server {
  listen 443 ssl http2;
  server_name example.com;

  ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

  # Video uploads: the seeded cap is 100 MiB (media.maxBytes.video). Keep this
  # above whatever Settings → Media says, or nginx answers 413 first.
  client_max_body_size 110m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade           $http_upgrade;
    proxy_set_header Connection        "upgrade";
    proxy_read_timeout  300s;   # video compression and market-sync can be slow
    proxy_send_timeout  300s;
    proxy_request_buffering off; # stream large uploads through
  }
}

server {
  listen 80;
  server_name example.com;
  return 301 https://$host$request_uri;
}
```

Other media caps (seeded, editable in Settings → Media): image 5 MiB, audio
and document 20 MiB.

**Security headers are the app's (ADR-146).** The proxy sets
`Content-Security-Policy`, `Strict-Transport-Security` (production),
`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and
`Permissions-Policy` on every response. Do not add them again in nginx: a
vhost that also has `add_header X-Frame-Options …` / `Referrer-Policy …`
lines (CloudPanel's default template does) sends each header twice, and two
`Referrer-Policy` values conflict. Remove those `add_header` lines from the
site's vhost. Keep `X-Real-IP $remote_addr` as above — Better Auth's per-IP
rate limit reads it first.

**The staff sign-in is `/keystone`** (ADR-146). `/admin/sign-in` answers
404, and so does any `/admin/*` address without a staff session. Bookmark
`https://example.com/keystone`.

## 7. Uploads

- `UPLOADS_DIR` must be an **absolute path outside the release directory**.
  Left blank, the local driver writes to `<cwd>/storage/uploads` — for
  `next start` that is `apps/web/storage/uploads`, inside the checkout, and
  it is lost on the next fresh clone. `seed:live` runs from `packages/core`;
  with a blank value it pins itself to `apps/web/storage/uploads` so its images
  land where `next start` reads, but set it explicitly in production.
- Owned by the app user: `install -d -o mbx -g mbx -m 750 /srv/mbx/shared/uploads`.
- Keys are `<category>/<random>.<ext>` (ADR-144 §3) — back up the whole tree.
- Files are served only through the `/uploads/...` route handler, never by
  nginx directly: do not add an nginx `location /uploads` alias.

## 8. Scheduled jobs

Set `CRON_SECRET`, restart, then schedule the three routes as described in
**[cron.md](./cron.md)** — `market-sync` and `publish-due` every 15 minutes,
`housekeeping` daily (housekeeping is the one that matters for privacy).

## 9. Backups

```bash
# Database — consistent dump without locking InnoDB tables
mysqldump --single-transaction --routines --triggers \
  -u backup -p mbfx_learning_center | gzip > /backup/db-$(date +%F).sql.gz

# Uploads
rsync -a --delete /srv/mbx/shared/uploads/ backup-host:/backup/mbx-uploads/
```

Back up `/srv/mbx/shared/.env` separately and securely: without the three
sealing keys a restored database's provider credentials cannot be opened
(they must then be re-entered in the admin).

## 10. First sign-in

1. Seed with `SEED_ADMIN_EMAIL` and a strong one-off `SEED_ADMIN_PASSWORD`.
2. Sign in at `https://example.com/keystone`.
3. Change the password at `/admin/profile`, then **remove `SEED_ADMIN_PASSWORD`** from
   the env file — a later `db:seed` with it still set resets the password.
4. Check `/admin/settings` (site identity, email), `/admin/market/provider`
   and `/admin/settings/ai` show the providers `seed:live` configured.

## 11. Updating a live install

```bash
cd /srv/mbx/app
git pull --ff-only
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:deploy
pnpm db:seed        # safe to re-run (upserts); make sure SEED_ADMIN_PASSWORD is NOT set
pnpm --filter web build
systemctl restart mbx          # or: pm2 reload mbx
```

`seed:live` does not need re-running on an update; running it again only adds
what is missing.

**Zero downtime.** `next build` writes into `apps/web/.next` under a running
server, and the old process can serve broken asset URLs until it restarts. For
no gap, deploy each release to its own directory
(`/srv/mbx/releases/<sha>`, `.env` symlinked in), build there, then switch a
`/srv/mbx/app` symlink and restart — or build with `NEXT_DIST_DIR` set to a
fresh directory. Migrations must stay backward compatible with the release
still running while they apply. Keep one instance: `revalidateTag` and the
in-process rate-limit fallback are per-process.
