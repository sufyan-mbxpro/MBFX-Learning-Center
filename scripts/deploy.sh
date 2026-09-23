#!/usr/bin/env bash
# Update a live install from git. Runs ON THE SERVER, as the app user, from
# anywhere:
#
#   bash /srv/mbx/app/scripts/deploy.sh            # deploy origin/main
#   BRANCH=release bash /srv/mbx/app/scripts/deploy.sh
#
# or from a laptop, over SSH:
#
#   ssh mbx@example.com 'bash /srv/mbx/app/scripts/deploy.sh'
#
# It is the "Updating a live install" sequence of docs/ops/deploy.md §11 in
# one place, so the order cannot drift between whoever deploys: pull →
# install → generate → migrate deploy → seed → build → restart. It never runs
# `db:migrate` or `db:reset` — those can create migrations or drop data.
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BRANCH="${BRANCH:-main}"
SERVICE="${SERVICE:-mbx}"
# This install serves on 3003; the host's :3000 is a different app. Next's own
# default is 3000, so the port is always passed explicitly — in the pm2 args,
# in the systemd unit, in nginx's proxy_pass, and here for the health check
# below (docs/ops/deploy.md §5).
PORT="${PORT:-3003}"
export PORT

cd "$APP_DIR"
log() { printf '\n==> %s\n' "$*"; }

if [ ! -f .env ]; then
  echo "No .env in $APP_DIR (expected a symlink to /srv/mbx/shared/.env). Aborting." >&2
  exit 1
fi

# db:seed RESETS the admin's password to SEED_ADMIN_PASSWORD when it is set,
# so a forgotten line would silently undo the password change the admin made
# after first sign-in. Refuse rather than warn.
if grep -Eq '^[[:space:]]*SEED_ADMIN_PASSWORD=["'"'"']?[^"'"'"'[:space:]]' .env; then
  echo "SEED_ADMIN_PASSWORD is set in .env — a seed would reset the admin password." >&2
  echo "Remove that line (it is first-install only) and run again." >&2
  exit 1
fi

# A dirty tree on the server means someone edited files in place; pulling over
# it either fails half-way or ships changes nobody reviewed.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "The checkout has local modifications. Commit them locally and push instead:" >&2
  git status --short --untracked-files=no >&2
  exit 1
fi

log "Fetching origin/$BRANCH"
git fetch --prune origin
git checkout "$BRANCH"
BEFORE="$(git rev-parse HEAD)"
git pull --ff-only origin "$BRANCH"
AFTER="$(git rev-parse HEAD)"
if [ "$BEFORE" = "$AFTER" ]; then
  echo "Already at $(git rev-parse --short HEAD); rebuilding anyway."
else
  git --no-pager log --oneline "$BEFORE..$AFTER"
fi

log "Installing dependencies"
pnpm install --frozen-lockfile

log "Generating the Prisma client"
pnpm db:generate

log "Applying committed migrations"
pnpm db:deploy

log "Seeding (idempotent upserts)"
pnpm db:seed

log "Building"
# Every static asset URL gets `?dpl=<sha>` appended (Next reads
# NEXT_DEPLOYMENT_ID straight from the environment — do NOT also set
# `deploymentId` in next.config.ts, the build refuses on a mismatch). A CDN
# caches by URL, so a chunk it stored as a 404 during a previous build window
# stays 404 for as long as it holds the entry, whatever the origin now serves;
# giving each deploy its own asset URLs means a poisoned entry cannot outlive
# the deploy that created it, with no purge credentials involved. It is also
# version-skew protection: a client still on the old deployment reloads
# instead of mixing chunks from two builds. The cost is that the id is part of
# the `"use cache"` key, so every deploy starts those caches cold — which is
# what a fresh build does anyway.
NEXT_DEPLOYMENT_ID="$(git rev-parse --short HEAD)"
export NEXT_DEPLOYMENT_ID
pnpm --filter web build

log "Restarting"
if [ -n "${RESTART_CMD:-}" ]; then
  eval "$RESTART_CMD"
elif command -v pm2 >/dev/null 2>&1 && pm2 describe "$SERVICE" >/dev/null 2>&1; then
  pm2 reload "$SERVICE"
elif systemctl cat "$SERVICE.service" >/dev/null 2>&1; then
  sudo systemctl restart "$SERVICE"
else
  echo "No pm2 process or systemd unit named '$SERVICE'. Start the app yourself," >&2
  echo "or set RESTART_CMD. The build is complete." >&2
  exit 1
fi


# A reload that half-starts is invisible otherwise: pm2 reports `online` for a
# process that is listening and erroring, and the CDN in front caches whatever
# it gets — including a 404 with a year of stale-while-revalidate on it, which
# is how one missing stylesheet took the site down on 2026-09-23. `localhost`,
# never 127.0.0.1: on this host it resolves to ::1 and the server binds there
# (docs/ops/deploy.md §5).
log "Checking http://localhost:$PORT/"
HEALTHY=0
STATUS=""
for _ in 1 2 3 4 5 6 7 8 9 10; do
  STATUS="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://localhost:$PORT/" || true)"
  case "$STATUS" in
    2??|3??) HEALTHY=1; break ;;
  esac
  sleep 2
done
if [ "$HEALTHY" = 1 ]; then
  echo "OK ($STATUS)"
else
  echo "The app is NOT answering on port $PORT (last status: ${STATUS:-no response})." >&2
  echo "  pm2 logs $SERVICE --lines 50" >&2
fi

# Cloudflare serves back whatever the origin told it to cache, 404s included.
# `next build` rewrites .next/static IN PLACE while the old process is still
# serving traffic, so a request for a hashed chunk that lands in that window
# gets Next's not-found page instead of the file — and that page is a
# prerendered route, so it answers with ITS cache headers (s-maxage=300 and a
# year of stale-while-revalidate). The edge pins that 404 and keeps serving it
# long after the file is back, which renders the whole site unstyled; it
# happened to the one stylesheet holding Tailwind on 2026-09-23. Purging after
# the restart is what closes the window. Optional, and never fatal: the build
# is already live by this point, so a missing token skips the step and a failed
# purge warns instead of failing the deploy.
env_value() {
  sed -n "s/^[[:space:]]*$1=//p" .env | head -n 1 | tr -d "'" | tr -d '"'
}

CF_API_TOKEN="${CF_API_TOKEN:-$(env_value CF_API_TOKEN)}"
CF_ZONE_ID="${CF_ZONE_ID:-$(env_value CF_ZONE_ID)}"

if [ -n "$CF_API_TOKEN" ] && [ -n "$CF_ZONE_ID" ]; then
  log "Purging the Cloudflare cache"
  PURGE="$(curl -sS --max-time 30 -X POST \
    "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"purge_everything":true}' 2>&1)" || PURGE="request failed: $PURGE"
  case "$PURGE" in
    *'"success":true'*|*'"success": true'*)
      echo "Purged." ;;
    *)
      echo "Cloudflare purge FAILED — purge by hand, or the edge may keep" >&2
      echo "serving assets from before this deploy:" >&2
      echo "  $PURGE" >&2 ;;
  esac
else
  log "Skipping the Cloudflare purge (CF_API_TOKEN and CF_ZONE_ID are unset)"
fi

if [ "$HEALTHY" = 1 ]; then
  log "Deployed $(git rev-parse --short HEAD) on $BRANCH"
else
  log "Deployed $(git rev-parse --short HEAD) on $BRANCH, but it is not answering on :$PORT"
  exit 1
fi
