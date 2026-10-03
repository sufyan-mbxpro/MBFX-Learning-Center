# Updating learn.mbxpro.com — the runbook

The short version of `deploy.md` §11 for the live host. Everything here runs
as `mbxpro-learn` over SSH. The script it describes is
`scripts/deploy-release.sh`; do not use `scripts/deploy.sh` (in place) there.

## The layout (checked 2026-10-03)

```
/home/mbxpro-learn/
├── htdocs/learn.mbxpro.com → releases/<stamp>-<sha>   live symlink; pm2's cwd goes through it
├── releases/
│   ├── 20261002190336-4f5a335/      one clone + node_modules + .next per deploy
│   ├── 20261002181151-59f5d52/      the previous one (what --rollback goes to)
│   └── initial/                     the pre-release-layout install; pruned in time
├── shared/
│   ├── .env                         the ONE environment, symlinked into each release
│   ├── uploads/                     UPLOADS_DIR — every uploaded file
│   ├── repo.git/                    local bare cache of GitHub
│   └── ecosystem.config.cjs         pm2 definition (app "mbx", port 3003)
└── backups/
    ├── databases/mbxlearning/       CloudPanel's nightly dumps (03:15)
    └── deploys/<release>.sql.gz     the dump taken before each deploy
```

This is the standard you described (clone into `releases/<stamp>`, symlink
`.env`, build there, switch the symlink, `pm2 reload`, keep three, roll back
by re-pointing the link) plus what the live host needs on top:

| Your script                       | `deploy-release.sh`                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `git clone` from GitHub each time | clones from `shared/repo.git`, fetching only new commits                                                   |
| `ln -s shared/.env`               | same                                                                                                       |
| build, then `db:deploy`           | **dump the DB**, `db:deploy`, `db:seed`, then build — the build prerenders pages that query the new schema |
| `ln -sfn` (unlink + create)       | atomic `rename()` of the link — never a moment with no site                                                |
| `pm2 reload mbx`                  | `pm2 reload mbx --update-env` with that build's `NEXT_DEPLOYMENT_ID`, then `pm2 save`                      |
| —                                 | health check (homepage + its stylesheet); **rolls back by itself** if it fails                             |
| "now purge Cloudflare"            | purges automatically when `CF_API_TOKEN` / `CF_ZONE_ID` are in `shared/.env`                               |
| keep last 3                       | same, but never the live release or the one it replaced                                                    |
| —                                 | refuses to run twice at once, with `SEED_ADMIN_PASSWORD` set, or with `UPLOADS_DIR` inside `releases/`     |

## Every update

On your machine:

```bash
git push origin main
```

On the server:

```bash
ssh mbxpro-learn@23.94.101.20
bash ~/htdocs/learn.mbxpro.com/scripts/deploy-release.sh
```

It prints the commits it is about to deploy, then: dump → migrate → seed →
build → switch → reload → health check → purge → prune. Until "Switching",
the live site is untouched; a failure there leaves the half-built release on
disk for inspection and changes nothing users see. It ends with
`Deployed <sha> on main — live: <release>`.

Deploy a different branch with `BRANCH=release bash …/deploy-release.sh`.

Then check the site: `https://learn.mbxpro.com`, `/keystone`, and one page
you changed.

## Rolling back

**Automatic.** If the new release fails its health check, the script switches
back and reloads the previous release itself.

**By command** (code only — the database stays as it is):

```bash
bash ~/htdocs/learn.mbxpro.com/scripts/deploy-release.sh --rollback
```

**By hand**, if the script itself is broken:

```bash
cd /home/mbxpro-learn
ls -dt releases/*/                                  # newest first; pick the previous
ln -sfn /home/mbxpro-learn/releases/<previous> htdocs/learn.mbxpro.com.next
mv -Tf htdocs/learn.mbxpro.com.next htdocs/learn.mbxpro.com
NEXT_DEPLOYMENT_ID="$(cat releases/<previous>/.deployment-id)" pm2 reload mbx --update-env
pm2 save
```

`NEXT_DEPLOYMENT_ID` must be the one that release was built with, or pages
link assets under the wrong `?dpl=` and the site loses its styles.

**When the DATABASE is the problem** (a migration or seed did damage — rare,
because migrations are reviewed to be backward compatible): restore the dump
taken just before that deploy. **This discards everything written since** —
sign-ups, progress, admin edits — so it is the last resort, not the default.

```bash
pm2 stop mbx
gunzip -c ~/backups/deploys/<release>.sql.gz | mariadb -u mbxlearning -p mbxlearning
bash ~/htdocs/learn.mbxpro.com/scripts/deploy-release.sh --rollback   # code that matches the restored schema
```

## What keeps live data safe

Production data lives in exactly two places, and no deploy replaces either:

- **The database** (`mbxlearning` on 127.0.0.1). Deploys only ever run
  `prisma migrate deploy` (committed migrations, forward only) and the seed.
  They never run `db:migrate`, `db:reset` or `db push`.
- **`shared/uploads/`**, outside every release. Pruning a release deletes code
  and `node_modules`, never an upload.

Rules for the code you push, so that stays true:

1. **Migrations are additive and backward compatible.** The old release keeps
   serving while they apply, and `--rollback` puts old code on the new schema.
   Add a nullable column or a table, deploy, start using it; drop or rename the
   old one in a LATER release once nothing reads it. Never edit a migration that
   has already run on live — add a new one.
2. **Data changes are migrations, bounded to the seeded value.** To change
   something an admin may have edited, write the `UPDATE … WHERE value = <old
seeded value>` the repo already uses (e.g. the footer and header-search
   migrations), so an admin's choice is left alone.
3. **The seed is create-only for anything an admin can edit** (ADR-183):
   settings values, system role names and grants, social links.
   A new seed write that uses `update: { … }` on admin-owned fields needs the
   same scrutiny as a migration.
4. **`seed:live` is a one-time install step.** It only adds what is missing,
   but it is not part of an update; never re-run it with `SEED_*` lines left in
   `shared/.env`.
5. **`SEED_ADMIN_PASSWORD` stays out of `shared/.env`.** The script refuses to
   run with it, because the seed would reset the admin's password.
6. **Secrets live only in `shared/.env`** — back it up separately. Without
   `EMAIL_SECRET_KEY`, `MARKET_SECRET_KEY`, `AI_SECRET_KEY`,
   `CAPTCHA_SECRET_KEY` and `TRANSLATE_SECRET_KEY`, a restored database's
   provider keys cannot be opened.

## Changing the environment

Edit `~/shared/.env`, then either deploy, or apply it to the running release:

```bash
cd ~/htdocs/learn.mbxpro.com
NEXT_DEPLOYMENT_ID="$(cat .deployment-id)" pm2 reload mbx --update-env && pm2 save
```

A `NEXT_PUBLIC_*` variable is baked in at build time and needs a deploy.

## When something looks wrong

```bash
pm2 status
pm2 logs mbx --lines 100
readlink -f ~/htdocs/learn.mbxpro.com          # which release is live
cat ~/htdocs/learn.mbxpro.com/.deployment-id   # which build it is
curl -sI http://localhost:3003/                # the origin, past nginx and Cloudflare
```

A site that renders unstyled after a deploy while `?cb=1` on the stylesheet
URL returns 200 is Cloudflare holding an old 404 — see `deploy.md` §11.
