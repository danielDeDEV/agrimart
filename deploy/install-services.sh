#!/usr/bin/env bash
#
# Installs the systemd units and the Caddy configuration.
#
#   sudo bash deploy/install-services.sh
#
# Run once after setup-server.sh, and again whenever a unit file or the
# Caddyfile changes. It does not start the services — deploy.sh does that,
# once there is something built to run.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/agrimart}"
REPO_DIR="${REPO_DIR:-$APP_DIR/app}"

green() { printf '\033[32m%s\033[0m\n' "$1"; }
blue()  { printf '\033[34m%s\033[0m\n' "$1"; }
die()   { printf '\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run this with sudo."
[ -d "$REPO_DIR/deploy" ] || die "No deploy/ folder in $REPO_DIR — clone the repository there first."

blue "-- systemd units"
install -m 644 "$REPO_DIR/deploy/agrimart-api.service" /etc/systemd/system/agrimart-api.service
install -m 644 "$REPO_DIR/deploy/agrimart-web.service" /etc/systemd/system/agrimart-web.service
systemctl daemon-reload
systemctl enable agrimart-api agrimart-web >/dev/null
green "   agrimart-api and agrimart-web will start on boot"

blue "-- Caddy"
if grep -q 'agrimart\.gh' "$REPO_DIR/deploy/Caddyfile"; then
  printf '\033[33m%s\033[0m\n' "   The Caddyfile still has the example domains."
  printf '\033[33m%s\033[0m\n' "   Edit $REPO_DIR/deploy/Caddyfile, then run this again."
else
  mkdir -p /var/log/caddy
  chown caddy:caddy /var/log/caddy
  install -m 644 "$REPO_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
  caddy validate --config /etc/caddy/Caddyfile >/dev/null || die "The Caddyfile is not valid."
  systemctl reload caddy || systemctl restart caddy
  green "   Caddy is serving your domains with automatic HTTPS"
fi

cat <<NEXT

$(green "Services installed.")

  Deploy the code:   sudo -u agrimart bash $REPO_DIR/deploy/deploy.sh
  Watch the API:     journalctl -u agrimart-api -f
  Watch the site:    journalctl -u agrimart-web -f

NEXT
