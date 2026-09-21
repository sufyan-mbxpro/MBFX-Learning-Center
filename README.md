# MBX Learning Center

A forex and crypto learning platform: a public learning site and an admin
portal in **one Next.js app** (`apps/web`), built as a pnpm + Turborepo
monorepo.

- Public site: `/` (courses, quizzes, videos, glossary, news, tools)
- Admin portal: `/admin` (staff only)

This README gets you from zero to a running copy, **on your own machine and
on a live server**, using git and SSH. Deeper references:

| Document                                     | What it covers                                             |
| -------------------------------------------- | ---------------------------------------------------------- |
| [docs/ops/deploy.md](docs/ops/deploy.md)     | Full server runbook: env vars, nginx, pm2/systemd, backups |
| [docs/ops/cron.md](docs/ops/cron.md)         | The three scheduled jobs and how to call them              |
| [CLAUDE.md](CLAUDE.md)                       | Architecture and the project's rules                       |
| [docs/memory/stack.md](docs/memory/stack.md) | Exact tool and library versions                            |

---

## Contents

1. [What you need](#1-what-you-need)
2. [Run it on your machine (local)](#2-run-it-on-your-machine-local)
3. [Test accounts and credentials](#3-test-accounts-and-credentials)
4. [Working with git](#4-working-with-git)
5. [Set up SSH](#5-set-up-ssh)
6. [First install on the live server](#6-first-install-on-the-live-server)
7. [Deploying updates](#7-deploying-updates)
8. [Command cheat sheet](#8-command-cheat-sheet)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. What you need

| Tool           | Version                                          | Notes                                                  |
| -------------- | ------------------------------------------------ | ------------------------------------------------------ |
| Node.js        | **22.x LTS**, 22.13.0 or newer                   | `.nvmrc` says `22` (ADR-145). `nvm use` picks it up    |
| pnpm           | the version in `package.json` → `packageManager` | Install it with `corepack enable`, not `npm i -g pnpm` |
| Git            | any recent                                       |                                                        |
| MariaDB        | 11.x                                             | Locally this runs in Docker                            |
| Redis          | 7.x                                              | Required: sign-in sessions and rate limits use it      |
| Docker Desktop | local only                                       | Runs MariaDB, Redis and Mailpit for development        |

The app itself never runs in Docker. Docker only holds the database, Redis
and a mail catcher. The Next.js app runs directly on your machine or server.

---

## 2. Run it on your machine (local)

### 2.1 Clone

```bash
git clone git@github.com:sufyan-mbxpro/MBFX-Learning-Center.git
cd MBFX-Learning-Center
```

(Use the `https://github.com/...` URL instead if you have not set up an SSH
key yet — see [§5](#5-set-up-ssh).)

### 2.2 Start the infrastructure

```bash
docker compose up -d
docker compose ps        # wait until all three show "healthy"
```

| Service | Address          | Used for                                                |
| ------- | ---------------- | ------------------------------------------------------- |
| MariaDB | `localhost:3306` | user `user`, password `pass`, db `mbfx_learning_center` |
| Redis   | `localhost:6379` | sessions, rate limits                                   |
| Mailpit | `localhost:8025` | web inbox that catches every email sent locally         |

### 2.3 Create `.env`

```bash
cp .env.example .env
```

The `.env` file lives at the **repo root**, never inside `apps/web`. It is
git-ignored. Never commit it.

Fill in these values. Generate each secret separately:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```dotenv
DATABASE_URL="mysql://user:pass@localhost:3306/mbfx_learning_center"
REDIS_URL="redis://localhost:6379"

BETTER_AUTH_SECRET="<generated>"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_ADMIN_URL="http://localhost:3000/admin"

EMAIL_SECRET_KEY="<generated>"
MARKET_SECRET_KEY="<generated>"
AI_SECRET_KEY="<generated>"
CRON_SECRET="<generated>"

# Creates the local admin account on the first seed (see §3)
SEED_ADMIN_EMAIL="admin@mbxpro.com"
SEED_ADMIN_PASSWORD="LocalAdmin#2026"
```

### 2.4 Install, migrate, seed

```bash
corepack enable
pnpm install
pnpm db:generate     # builds the Prisma client
pnpm db:deploy       # creates the tables
pnpm db:seed         # roles, permissions, settings, menus, the admin user
pnpm seed:live       # optional: sample courses, quizzes, videos, images, theme
```

### 2.5 Start the app

```bash
pnpm dev                    # or: pnpm --filter web dev
```

Open:

- <http://localhost:3000> for the public site
- <http://localhost:3000/admin/sign-in> for the admin portal
- <http://localhost:8025> to read any email the app sent (Mailpit)

> **Windows:** if `pnpm dev` fails with `spawn UNKNOWN`, Windows Smart App
> Control is blocking `turbo.exe`. Run `pnpm --filter web dev` instead, which
> skips turbo.

### 2.6 Before you push

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm governance:check
```

CI runs the same checks on every push. See
[.github/workflows/ci.yml](.github/workflows/ci.yml).

---

## 3. Test accounts and credentials

There are **no built-in passwords** in this repo. The admin account is
created by `pnpm db:seed` from two lines in `.env`:

| Variable              | Default            | Meaning                                                   |
| --------------------- | ------------------ | --------------------------------------------------------- |
| `SEED_ADMIN_EMAIL`    | `admin@mbxpro.com` | The super admin's email                                   |
| `SEED_ADMIN_PASSWORD` | _(none)_           | Its password. If empty, the seed **skips** the admin user |

### Local (development only)

With the `.env` from §2.3:

| Role                  | Sign-in URL                           | Email              | Password          |
| --------------------- | ------------------------------------- | ------------------ | ----------------- |
| Super Admin (staff)   | <http://localhost:3000/admin/sign-in> | `admin@mbxpro.com` | `LocalAdmin#2026` |
| Learner (public user) | <http://localhost:3000/en/sign-up>    | any email you type | any 8–128 chars   |

- Learners register themselves at `/en/sign-up`. No email check is needed to
  sign in. The welcome/verification email appears in Mailpit.
- Staff and learners use **different sign-in pages**: staff at
  `/admin/sign-in`, learners at `/en/sign-in`. A learner account can never
  open `/admin`, even with a role.
- More staff accounts: sign in as the admin → **Users** / **Employees** →
  create a user and give it a role (for example Content Manager).
- `LocalAdmin#2026` is a **local test value only**. Never use it on the live
  server.

### Changing or resetting the admin password

- **Normal way:** sign in and change it at `/admin/profile`.
- **Forgot it (local):** set a new `SEED_ADMIN_PASSWORD` in `.env` and run
  `pnpm db:seed`. The seed resets the admin's password to that value.
- **Forgot it (live):** use `/admin/forgot-password` (needs working SMTP), or
  run the same one-off seed as in §6.6 and remove the line again afterwards.

### Live server

1. Choose a **strong, one-off** password. For example:
   `openssl rand -base64 18`.
2. Put it in the server's `.env` as `SEED_ADMIN_PASSWORD` for the **first
   seed only**.
3. Sign in at `https://your-domain.com/admin/sign-in`, then change the
   password at `/admin/profile`.
4. **Delete the `SEED_ADMIN_PASSWORD` line** from the server's `.env`.
   Otherwise every later `db:seed` resets the password back.
   `scripts/deploy.sh` refuses to run while that line is still set.

Keep live credentials in a password manager. Never put them in git, in
chat, or in this README.

---

## 4. Working with git

The remote is `origin` → `github.com/sufyan-mbxpro/MBFX-Learning-Center`. The
live server deploys the `main` branch.

### Everyday flow

```bash
git checkout main
git pull                              # get the latest
git checkout -b feature/short-name    # one branch per change

# ... edit, then check your work ...
pnpm lint && pnpm typecheck && pnpm test

git add -A
git commit -m "Explain what changed and why"
git push -u origin feature/short-name
```

Then open a Pull Request into `main` on GitHub. When CI is green, merge it
and [deploy](#7-deploying-updates).

### Rules that keep deploys safe

- **Never commit `.env`**, uploaded files (`storage/`), or build output.
  `.gitignore` already excludes them. Check `git status` before committing.
- **Database changes go through migrations.** Create one locally with
  `pnpm db:migrate`, then commit the new folder under
  `packages/db/prisma/migrations/`. The server only ever runs
  `pnpm db:deploy`, which applies committed migrations.
- **Never edit files directly on the server.** Every change is a commit
  pushed to GitHub and pulled on the server. `deploy.sh` stops if the
  server's checkout has local edits.
- If you changed anything under `packages/`, add an entry to
  `docs/logs/DEVLOG.md`. `pnpm governance:check` and CI require it.

### Useful commands

```bash
git status                     # what changed
git log --oneline -10          # recent commits
git diff                       # unstaged changes
git stash / git stash pop      # park changes temporarily
git fetch && git status        # is my branch behind origin?
```

---

## 5. Set up SSH

Two separate SSH connections are involved:

```
your laptop ──ssh──▶ live server          (you log in to deploy)
live server ──ssh──▶ GitHub               (the server pulls the code)
your laptop ──ssh──▶ GitHub               (you push code)
```

### 5.1 Your laptop → GitHub

```bash
ssh-keygen -t ed25519 -C "you@example.com"     # press Enter for the default path
cat ~/.ssh/id_ed25519.pub                       # copy this line
```

Add it on GitHub: **Settings → SSH and GPG keys → New SSH key**. Test it:

```bash
ssh -T git@github.com      # "Hi <user>! You've successfully authenticated"
```

Switch an existing HTTPS clone to SSH:

```bash
git remote set-url origin git@github.com:sufyan-mbxpro/MBFX-Learning-Center.git
```

### 5.2 Your laptop → the live server

```bash
ssh-copy-id root@SERVER_IP          # copies your public key to the server
ssh root@SERVER_IP                  # should log in without a password
```

Optional shortcut. Add this to `~/.ssh/config` on your laptop:

```
Host mbx-live
  HostName SERVER_IP
  User mbx
  IdentityFile ~/.ssh/id_ed25519
```

After that, `ssh mbx-live` is enough.

### 5.3 The server → GitHub (deploy key)

The server needs **read-only** access to the repository. Use a deploy key,
not your personal key.

On the server, as the app user `mbx` (created in §6.1):

```bash
sudo -iu mbx
ssh-keygen -t ed25519 -C "mbx-live-deploy" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

On GitHub: **repo → Settings → Deploy keys → Add deploy key**. Paste the key
and leave **Allow write access unticked**. Then test it on the server:

```bash
ssh -T git@github.com      # "Hi sufyan-mbxpro/MBFX-Learning-Center! ..."
```

---

## 6. First install on the live server

This is the short version for a fresh Ubuntu/Debian server. Every step is
explained in detail in [docs/ops/deploy.md](docs/ops/deploy.md). Replace
`example.com` with your domain throughout.

### 6.1 System packages and the app user

As root:

```bash
apt update && apt install -y git nginx mariadb-server redis-server curl
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v                                   # v22.x

adduser --system --group --shell /bin/bash --home /home/mbx mbx
install -d -o mbx -g mbx /srv/mbx /srv/mbx/shared /srv/mbx/shared/uploads
```

### 6.2 Database

```bash
mysql -u root
```

```sql
CREATE DATABASE mbfx_learning_center CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mbx'@'localhost' IDENTIFIED BY 'STRONG_DB_PASSWORD';
GRANT ALL PRIVILEGES ON mbfx_learning_center.* TO 'mbx'@'localhost';
FLUSH PRIVILEGES;
```

### 6.3 Clone the code

Set up the deploy key first ([§5.3](#53-the-server--github-deploy-key)).
Then, as `mbx`:

```bash
sudo -iu mbx
git clone git@github.com:sufyan-mbxpro/MBFX-Learning-Center.git /srv/mbx/app
cd /srv/mbx/app
corepack enable --install-directory ~/.local/bin   # or run `corepack enable` once as root
corepack install                                   # installs the pinned pnpm
pnpm --version
```

### 6.4 The environment file

Keep the real file **outside** the checkout and link it in:

```bash
cp /srv/mbx/app/.env.example /srv/mbx/shared/.env
chmod 600 /srv/mbx/shared/.env
ln -sfn /srv/mbx/shared/.env /srv/mbx/app/.env
nano /srv/mbx/shared/.env
```

Minimum values for production:

```dotenv
NODE_ENV="production"
DATABASE_URL="mysql://mbx:STRONG_DB_PASSWORD@localhost:3306/mbfx_learning_center"
REDIS_URL="redis://127.0.0.1:6379"

BETTER_AUTH_SECRET="<generated>"
BETTER_AUTH_URL="https://example.com"
NEXT_PUBLIC_SITE_URL="https://example.com"
NEXT_PUBLIC_ADMIN_URL="https://example.com/admin"

UPLOADS_DIR="/srv/mbx/shared/uploads"

EMAIL_SECRET_KEY="<generated>"
MARKET_SECRET_KEY="<generated>"
AI_SECRET_KEY="<generated>"
CRON_SECRET="<generated>"

HOME_CONTENT_MODE="real"     # hide the homepage's placeholder figures

# FIRST SEED ONLY: delete both lines after §6.6
SEED_ADMIN_EMAIL="admin@your-domain.com"
SEED_ADMIN_PASSWORD="<strong one-off password>"
```

> **Back up this file somewhere safe.** If you lose `EMAIL_SECRET_KEY`,
> `MARKET_SECRET_KEY` or `AI_SECRET_KEY`, the SMTP password and API keys
> stored in the database can no longer be read. They would have to be typed
> in again.

### 6.5 Install, migrate, seed, build

```bash
cd /srv/mbx/app
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:deploy          # NEVER db:migrate or db:reset on a live database
pnpm db:seed
pnpm seed:live          # sample corpus + theme + optional provider keys
pnpm --filter web build
```

### 6.6 Sign in once, then remove the seed password

1. Start the app (next step), then sign in at
   `https://example.com/admin/sign-in`.
2. Change the password at `/admin/profile`.
3. Delete the `SEED_ADMIN_PASSWORD` line (and any other `SEED_*` lines) from
   `/srv/mbx/shared/.env`.

### 6.7 Keep it running (pm2)

```bash
npm install -g pm2          # as root
```

As `mbx`, create `/srv/mbx/ecosystem.config.cjs`:

```js
module.exports = {
  apps: [
    {
      name: "mbx",
      cwd: "/srv/mbx/app/apps/web",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      env: { NODE_ENV: "production" },
      instances: 1,
      max_memory_restart: "1500M",
    },
  ],
};
```

```bash
pm2 start /srv/mbx/ecosystem.config.cjs
pm2 save
pm2 startup        # run the command it prints (as root) so it starts on boot
```

A systemd unit works too. See [deploy.md §5](docs/ops/deploy.md#5-build-and-start).

### 6.8 nginx + HTTPS

Put the server block from [deploy.md §6](docs/ops/deploy.md#6-nginx) in
`/etc/nginx/sites-available/mbx`, enable it, then add a certificate:

```bash
ln -s /etc/nginx/sites-available/mbx /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
apt install -y certbot python3-certbot-nginx
certbot --nginx -d example.com
```

Keep `client_max_body_size 110m;`. Without it, nginx rejects video uploads
before they reach the app.

### 6.9 Scheduled jobs

Create `/srv/mbx/cron.sh`. It reads only the token from `.env`, without
running the whole file as a shell script:

```bash
#!/usr/bin/env bash
# Usage: cron.sh market-sync | publish-due | housekeeping
S=$(grep -E '^CRON_SECRET=' /srv/mbx/shared/.env | cut -d= -f2- | tr -d '"\r')
curl -fsS -X POST "https://example.com/api/cron/$1" -H "Authorization: Bearer $S" >/dev/null
```

```bash
chmod 700 /srv/mbx/cron.sh
crontab -e        # as mbx
```

```cron
*/15 * * * * /srv/mbx/cron.sh market-sync
*/15 * * * * /srv/mbx/cron.sh publish-due
30 3 * * *   /srv/mbx/cron.sh housekeeping
```

Details and the expected responses are in [docs/ops/cron.md](docs/ops/cron.md).

### 6.10 Check it works

- `https://example.com` loads the homepage.
- `https://example.com/admin/sign-in` accepts the admin account.
- `pm2 logs mbx` shows no errors.
- **Admin → Settings → Email:** set SMTP and send a test mail. Password reset
  and newsletter emails need it.

---

## 7. Deploying updates

After a change is merged into `main` on GitHub, deploy it with **one
command from your laptop**:

```bash
ssh mbx@SERVER_IP 'bash /srv/mbx/app/scripts/deploy.sh'
# or, with the ~/.ssh/config shortcut:
ssh mbx-live 'bash /srv/mbx/app/scripts/deploy.sh'
```

[scripts/deploy.sh](scripts/deploy.sh) runs these steps on the server, in
this order. It stops at the first one that fails:

1. Refuses to run if `SEED_ADMIN_PASSWORD` is still in `.env`, or if someone
   edited files on the server.
2. `git pull --ff-only origin main`
3. `pnpm install --frozen-lockfile`
4. `pnpm db:generate`, then `pnpm db:deploy` (applies new migrations)
5. `pnpm db:seed` (safe to repeat; it only adds or repairs rows)
6. `pnpm --filter web build`
7. Restarts the app (`pm2 reload mbx`, or `systemctl restart mbx`)

Options:

```bash
BRANCH=hotfix bash scripts/deploy.sh                 # deploy another branch
SERVICE=mbx-staging bash scripts/deploy.sh           # another pm2/systemd name
RESTART_CMD="pm2 reload all" bash scripts/deploy.sh  # custom restart
```

### Rolling back

```bash
ssh mbx-live
cd /srv/mbx/app
git log --oneline -10                  # find the last good commit
git checkout <good-sha>
pnpm install --frozen-lockfile && pnpm db:generate && pnpm --filter web build
pm2 reload mbx
```

Then fix the problem on a branch, merge, and run `deploy.sh` again. It
switches back to `main`. A migration that already ran is **not** undone by a
rollback, so write migrations that the previous release can still work with.

---

## 8. Command cheat sheet

| Command                            | Where          | What it does                                    |
| ---------------------------------- | -------------- | ----------------------------------------------- |
| `docker compose up -d`             | local          | Start MariaDB, Redis, Mailpit                   |
| `pnpm dev`                         | local          | Dev server on :3000                             |
| `pnpm lint` / `typecheck` / `test` | local          | The CI checks                                   |
| `pnpm db:migrate`                  | **local only** | Create a new migration from a schema change     |
| `pnpm db:reset`                    | **local only** | Wipe and rebuild the local database             |
| `pnpm db:studio`                   | local          | Browse the database in a web UI                 |
| `pnpm db:deploy`                   | both           | Apply committed migrations                      |
| `pnpm db:seed`                     | both           | Roles, permissions, settings, menus, admin user |
| `pnpm seed:live`                   | both           | Sample content, images, theme, provider keys    |
| `pnpm --filter web build`          | server         | Production build                                |
| `bash scripts/deploy.sh`           | server         | Pull and redeploy `main`                        |
| `pm2 logs mbx` / `pm2 status`      | server         | App logs / process state                        |

---

## 9. Troubleshooting

| Symptom                                                 | Cause and fix                                                                                                                           |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `SKIPPED admin user` during seed                        | `SEED_ADMIN_PASSWORD` was empty. Set it and run `pnpm db:seed` again                                                                    |
| Admin sign-in says the credentials are wrong            | You may be on the learner page. Staff use `/admin/sign-in`                                                                              |
| Every page fails with a Redis or `ECONNREFUSED` error   | Redis is not running: `docker compose up -d` (local) or `systemctl status redis-server` (server)                                        |
| `Can't reach database server`                           | Check `DATABASE_URL` and that MariaDB is up                                                                                             |
| Changed `.env` but nothing happened                     | `.env` is read at startup. Restart the app. `NEXT_PUBLIC_*` values also need a rebuild                                                  |
| Upload fails with **413**                               | Raise `client_max_body_size` in nginx                                                                                                   |
| Uploaded images vanish after a redeploy                 | `UPLOADS_DIR` is blank or inside the checkout. Set it to `/srv/mbx/shared/uploads`                                                      |
| `deploy.sh`: "local modifications"                      | Someone edited files on the server. Look with `git diff`, move the change into a commit locally, then `git checkout -- .` on the server |
| `pnpm install --frozen-lockfile` fails                  | `pnpm-lock.yaml` is out of date. Run `pnpm install` locally, commit the lockfile, push                                                  |
| `Permission denied (publickey)` on `git pull`           | The server's deploy key is missing on GitHub. See [§5.3](#53-the-server--github-deploy-key)                                             |
| Every local route answers 500 with a JSON `SyntaxError` | Stop the dev server, delete `apps/web/.next`, start it again                                                                            |
