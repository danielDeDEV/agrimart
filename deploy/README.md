# Deploying AgriMart

Everything here targets **one Ubuntu server running the whole platform** — the
API, the website, PostgreSQL and Caddy for HTTPS. That is deliberate: the USSD
callbacks must answer within seconds, farmers' photos need a real disk, and six
scheduled jobs need a process that never sleeps. One box satisfies all three,
and it fits inside the always-free tiers at Oracle Cloud, Google Cloud and AWS.

| File | What it does |
|---|---|
| `setup-server.sh` | One-time: Node, PostgreSQL, Caddy, swap, firewall, service account, database |
| `install-services.sh` | Installs the systemd units and the Caddy configuration |
| `deploy.sh` | Pull, install, check the config, build, restart, verify |
| `Caddyfile` | Reverse proxy and automatic HTTPS for both domains |
| `agrimart-api.service` | The API, restarted on failure and on boot |
| `agrimart-web.service` | The website, likewise |

## First deployment

**1. A server.** Ubuntu 22.04 or 24.04. On Oracle Cloud pick the ARM shape —
its free allowance has enough memory to build the website comfortably. Note the
public IP.

**2. DNS.** Two A records pointing at that IP:

```
agrimart.gh        ->  your.server.ip
api.agrimart.gh    ->  your.server.ip
```

Let the records propagate before step 5, or Caddy cannot prove you own the
domains and will not issue certificates.

**3. Prepare the server.**

```bash
ssh ubuntu@your.server.ip
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/YOUR/REPO/main/deploy/setup-server.sh)"
```

It prints the database password it generated. Keep it for the next step.

**4. The code and the configuration.**

```bash
sudo -u agrimart git clone https://github.com/YOUR/REPO.git /opt/agrimart/app
sudo -u agrimart cp /opt/agrimart/app/agrimarket-backend/.env.example \
                    /opt/agrimart/app/agrimarket-backend/.env
sudo -u agrimart nano /opt/agrimart/app/agrimarket-backend/.env
```

What must change from the template — `npm run check:env` refuses to start the
server until each one is right:

```bash
NODE_ENV=production
APP_URL=https://api.agrimart.gh
CLIENT_URL=https://agrimart.gh
CLIENT_URLS=https://www.agrimart.gh
PUBLIC_URL=https://api.agrimart.gh

DB_PASSWORD=          # the one setup-server.sh printed
JWT_SECRET=           # node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_REFRESH_SECRET=   # a different one
GATEWAY_SECRET=       # 24+ characters, also appended to the gateway callbacks
SEED_ADMIN_PASSWORD=  # your own, not the one in the README

SMS_PROVIDER=africastalking
AT_API_KEY=
AT_USERNAME=          # your live username, not "sandbox"
SMS_ALLOWLIST=        # must be empty, or only those numbers get messages
USSD_SERVICE_CODE="*920*268#"
```

And the website's build-time values, which are baked in and cannot be changed
afterwards without rebuilding:

```bash
sudo -u agrimart tee /opt/agrimart/app/agrimarket-frontend/.env.local >/dev/null <<'EOF'
NEXT_PUBLIC_API_URL=https://api.agrimart.gh/api/v1
NEXT_PUBLIC_SOCKET_URL=https://api.agrimart.gh
NEXT_PUBLIC_SITE_URL=https://agrimart.gh
NEXT_PUBLIC_USSD_CODE="*920*268#"
EOF
```

**5. Domains into Caddy, then the services.**

```bash
sudo -u agrimart nano /opt/agrimart/app/deploy/Caddyfile   # replace agrimart.gh
sudo bash /opt/agrimart/app/deploy/install-services.sh
```

**6. Deploy.**

```bash
sudo -u agrimart bash /opt/agrimart/app/deploy/deploy.sh --first-run
```

`--first-run` also builds the database: schema, reference data (regions,
districts, markets, produce, farm guides, settings) and your administrator
account. The marketplace opens empty.

**7. Point Africa's Talking at the server.** `npm run gateway:check` prints the
three callback URLs with your secret already in them. Paste them into the
dashboard, then dial the code from a real handset before telling anyone.

## Every deployment after that

```bash
sudo -u agrimart bash /opt/agrimart/app/deploy/deploy.sh
```

It checks the configuration before touching the running services, so a broken
`.env` stops the deploy rather than taking the platform down, and it does not
report success until both processes answer their health checks.

For a release that adds a whole table, set `DB_SYNC=true` in `.env` for that
one deploy, then set it back.

## Bringing an existing database across

If you already have data in MySQL:

```bash
cd /opt/agrimart/app/agrimarket-backend
npm run db:migrate-postgres              # shows what would move
npm run db:migrate-postgres -- --apply   # moves it
```

It reads MySQL through the same models that write to PostgreSQL, so enums,
JSON columns and dates arrive interpreted exactly as the application reads
them. The MySQL database is only ever read.

## Day to day

```bash
journalctl -u agrimart-api -f          # API logs, live
journalctl -u agrimart-web -f          # website logs
systemctl status agrimart-api          # is it running
npm run check:live                     # what a customer would find
npm run backup                         # database dump into /opt/agrimart/backups
```

Add the backup to the service account's crontab so it happens without you:

```bash
sudo -u agrimart crontab -e
# 15 2 * * *  cd /opt/agrimart/app/agrimarket-backend && /usr/bin/npm run backup -- --keep 14
```

The dump does **not** include `agrimarket-backend/uploads` — farmers' photos
live there. Copy that folder somewhere off this server too.

## Health endpoints

| Endpoint | Meaning |
|---|---|
| `GET /health` | The process is alive. Cheap, no database. |
| `GET /health/ready` | It can actually serve — checks the database round-trip. |

Point an uptime monitor at `/health/ready` and make sure the alert reaches
somebody who can act on it.

## When something is wrong

| Symptom | Where to look |
|---|---|
| USSD says "service unavailable" | `journalctl -u agrimart-api -n 50`; is the callback URL right, secret included |
| The site loads but has no data | `NEXT_PUBLIC_API_URL` was wrong when the site was built — fix `.env.local` and redeploy |
| No certificate | DNS is not pointing here yet, or 80/443 are closed in the provider's own firewall |
| The build is killed | Out of memory — `setup-server.sh` adds swap; check `free -h` |
| Farmers get no SMS | `npm run gateway:check` — provider, credit balance, and whether `SMS_ALLOWLIST` is still set |
