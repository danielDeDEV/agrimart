#!/usr/bin/env bash
#
# Deploys the current code: pull, install, check the configuration, build,
# then restart the two services.
#
#   sudo -u agrimart bash deploy/deploy.sh              # deploy main
#   sudo -u agrimart bash deploy/deploy.sh --no-pull     # deploy what is here
#   sudo -u agrimart bash deploy/deploy.sh --first-run   # also build the database
#
# It refuses to restart anything if the production configuration checks fail,
# so a bad .env stops the deploy instead of taking the platform down. Run it as
# the service account, not as root, or the files end up owned by root and the
# services cannot write their uploads.

set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/agrimart/app}"
BACKEND="$REPO_DIR/agrimarket-backend"
FRONTEND="$REPO_DIR/agrimarket-frontend"
BRANCH="${BRANCH:-main}"

PULL=1
FIRST_RUN=0
for arg in "$@"; do
  case "$arg" in
    --no-pull) PULL=0 ;;
    --first-run) FIRST_RUN=1 ;;
    *) printf 'Unknown option: %s\n' "$arg" >&2; exit 1 ;;
  esac
done

green() { printf '\033[32m%s\033[0m\n' "$1"; }
blue()  { printf '\033[34m%s\033[0m\n' "$1"; }
warn()  { printf '\033[33m%s\033[0m\n' "$1"; }
die()   { printf '\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -ne 0 ] || die "Run this as the service account: sudo -u agrimart bash deploy/deploy.sh"
[ -f "$BACKEND/.env" ] || die "No $BACKEND/.env — copy .env.example and fill it in first."

cd "$REPO_DIR"
START=$(date +%s)

# ── Code ─────────────────────────────────────────────────────────────
if [ "$PULL" -eq 1 ]; then
  blue "-- Fetching $BRANCH"
  git fetch --quiet origin "$BRANCH"
  git checkout --quiet "$BRANCH"
  BEFORE=$(git rev-parse --short HEAD)
  git merge --ff-only --quiet "origin/$BRANCH"
  AFTER=$(git rev-parse --short HEAD)
  if [ "$BEFORE" = "$AFTER" ]; then green "   already at $AFTER"; else green "   $BEFORE -> $AFTER"; fi
fi

# ── Configuration ────────────────────────────────────────────────────
blue "-- Checking the production configuration"
cd "$BACKEND"
NODE_ENV=production node src/scripts/checkEnv.js || die "Fix .env and run the deploy again. Nothing was changed."

# ── Dependencies ─────────────────────────────────────────────────────
blue "-- Installing dependencies"
npm ci --omit=dev --silent
green "   API packages ready"

cd "$FRONTEND"
npm ci --silent           # the website needs its build tools
green "   website packages ready"

# ── Database ─────────────────────────────────────────────────────────
cd "$BACKEND"
if [ "$FIRST_RUN" -eq 1 ]; then
  blue "-- Building the database (first run)"
  node src/scripts/production.js
  node src/scripts/syncPhotos.js || warn "   photo sync skipped"
else
  blue "-- Applying any new columns"
  # ensureSchema() runs on boot; DB_SYNC=true is only for a release that adds
  # a whole table, and is deliberately not automatic
  if [ "${DB_SYNC:-false}" = "true" ]; then
    node src/scripts/sync.js
  else
    green "   nothing to do (set DB_SYNC=true for a release that adds tables)"
  fi
fi

# ── Build the website ────────────────────────────────────────────────
blue "-- Building the website"
cd "$FRONTEND"
# The build is the memory-hungry step; swap covers a small instance
NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}" npm run build
green "   build complete"

# ── Restart ──────────────────────────────────────────────────────────
blue "-- Restarting services"
sudo systemctl restart agrimart-api
sleep 3
sudo systemctl restart agrimart-web

# ── Prove it is actually up ──────────────────────────────────────────
blue "-- Health"
for i in $(seq 1 20); do
  if curl -fsS --max-time 3 http://127.0.0.1:5000/health/ready >/dev/null 2>&1; then
    green "   API ready"
    break
  fi
  [ "$i" -eq 20 ] && die "The API did not come up. Look at: journalctl -u agrimart-api -n 50"
  sleep 2
done

for i in $(seq 1 20); do
  if curl -fsS --max-time 3 -o /dev/null http://127.0.0.1:3000/ 2>/dev/null; then
    green "   website ready"
    break
  fi
  [ "$i" -eq 20 ] && die "The website did not come up. Look at: journalctl -u agrimart-web -n 50"
  sleep 2
done

SECONDS_TAKEN=$(( $(date +%s) - START ))
cat <<DONE

$(green "Deployed in ${SECONDS_TAKEN}s.")  $(cd "$REPO_DIR" && git rev-parse --short HEAD)

  Check what a customer would find:   cd $BACKEND && npm run check:live
  Confirm the gateway callbacks:      npm run gateway:check
  Watch the logs:                     journalctl -u agrimart-api -f

DONE
