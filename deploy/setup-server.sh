#!/usr/bin/env bash
#
# One-time setup of a fresh Ubuntu server for AgriMart.
#
#   curl -fsSL https://raw.githubusercontent.com/YOUR/REPO/main/deploy/setup-server.sh | sudo bash
#   or:  sudo bash deploy/setup-server.sh
#
# Installs Node, PostgreSQL and Caddy, creates the service account and the
# database, adds swap if the machine is small, and closes the firewall to
# everything but SSH and the web. Safe to run twice: every step checks first.
#
# Works on Ubuntu 22.04 / 24.04, x86 or ARM — which covers the always-free
# tiers at Oracle Cloud, Google Cloud and AWS.

set -euo pipefail

APP_USER="${APP_USER:-agrimart}"
APP_DIR="${APP_DIR:-/opt/agrimart}"
DB_NAME="${DB_NAME:-agrimarket}"
DB_USER="${DB_USER:-agrimart}"
NODE_MAJOR="${NODE_MAJOR:-20}"

green() { printf '\033[32m%s\033[0m\n' "$1"; }
blue()  { printf '\033[34m%s\033[0m\n' "$1"; }
warn()  { printf '\033[33m%s\033[0m\n' "$1"; }
die()   { printf '\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run this with sudo."

blue "== AgriMart server setup =="
echo "   user      $APP_USER"
echo "   directory $APP_DIR"
echo "   database  $DB_NAME"
echo

# ── Packages ─────────────────────────────────────────────────────────
blue "-- System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git ufw ripgrep ncdu >/dev/null
green "   base packages ready"

# ── Swap, so `next build` does not run out of memory ─────────────────
TOTAL_MB=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_MB" -lt 4000 ] && [ ! -f /swapfile ]; then
  blue "-- Swap (this machine has ${TOTAL_MB}MB of RAM; the website build needs ~3GB)"
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  green "   4GB swap added"
else
  green "   swap not needed (${TOTAL_MB}MB of RAM)"
fi

# ── Node ─────────────────────────────────────────────────────────────
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  blue "-- Node.js ${NODE_MAJOR}"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
green "   node $(node -v), npm $(npm -v)"

# ── PostgreSQL ───────────────────────────────────────────────────────
if ! command -v psql >/dev/null; then
  blue "-- PostgreSQL"
  apt-get install -y -qq postgresql postgresql-contrib >/dev/null
fi
systemctl enable --now postgresql >/dev/null 2>&1 || true
green "   $(sudo -u postgres psql -tAc 'SHOW server_version;' | head -1 | xargs echo postgresql)"

# ── Caddy, for automatic HTTPS ───────────────────────────────────────
if ! command -v caddy >/dev/null; then
  blue "-- Caddy (automatic HTTPS)"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi
green "   $(caddy version | head -1)"

# ── Service account and application directory ────────────────────────
if ! id "$APP_USER" >/dev/null 2>&1; then
  blue "-- Service account"
  adduser --system --group --home "$APP_DIR" --shell /bin/bash "$APP_USER" >/dev/null
fi
mkdir -p "$APP_DIR" "$APP_DIR/backups" "$APP_DIR/logs"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
green "   $APP_USER owns $APP_DIR"

# ── Database and its user ────────────────────────────────────────────
blue "-- Database"
DB_PASSWORD_FILE="$APP_DIR/.db-password"
if [ -f "$DB_PASSWORD_FILE" ]; then
  DB_PASSWORD=$(cat "$DB_PASSWORD_FILE")
  green "   reusing the password in $DB_PASSWORD_FILE"
else
  DB_PASSWORD=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 28)
  umask 077 && printf '%s' "$DB_PASSWORD" > "$DB_PASSWORD_FILE"
  chown "$APP_USER:$APP_USER" "$DB_PASSWORD_FILE"
  green "   generated a database password"
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 >/dev/null <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASSWORD';
  ELSE
    ALTER ROLE $DB_USER WITH PASSWORD '$DB_PASSWORD';
  END IF;
END \$\$;
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  sudo -u postgres createdb -O "$DB_USER" -E UTF8 "$DB_NAME"
fi
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 >/dev/null <<SQL
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER SCHEMA public OWNER TO $DB_USER;
SQL
green "   database $DB_NAME owned by $DB_USER"

# ── Firewall ─────────────────────────────────────────────────────────
blue "-- Firewall"
ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
green "   only SSH, HTTP and HTTPS are open"
warn "   Oracle Cloud and AWS also have their own firewall — open 80 and 443 there too."

# ── What to do next ──────────────────────────────────────────────────
cat <<NEXT

$(green "The server is ready.")

  1. Put the code in place, as $APP_USER:
       sudo -u $APP_USER git clone YOUR_REPO_URL $APP_DIR/app

  2. Write $APP_DIR/app/agrimarket-backend/.env  (start from .env.example).
     The database line is already true for this machine:

       DB_DIALECT=postgres
       DB_HOST=127.0.0.1
       DB_PORT=5432
       DB_NAME=$DB_NAME
       DB_USER=$DB_USER
       DB_PASSWORD=$(cat "$DB_PASSWORD_FILE")

  3. Point your domains at this server's public IP (two A records:
     the site and api.yourdomain), then edit deploy/Caddyfile with them.

  4. Deploy:
       sudo bash $APP_DIR/app/deploy/install-services.sh
       sudo -u $APP_USER bash $APP_DIR/app/deploy/deploy.sh

NEXT
