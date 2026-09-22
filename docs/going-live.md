# Going live

Everything that has to be true before AgriMart carries real farmers, real
produce and real money — in the order you should do it. Two commands do most
of the checking for you:

```bash
cd agrimarket-backend
NODE_ENV=production npm run check:env    # is the configuration safe?
npm run check:live                       # is the database and gateway ready?
```

Both are read-only. The first refuses nothing but prints what a live server
would reject; the second inspects the database and tells you what a customer
would find. The API itself runs the first set of checks on every production
boot and **will not start** until they pass, so a bad deploy fails loudly at
2pm instead of quietly at 2am.

---

## 1. Get a server, a database and two domains

| Piece | What it is | Suggested |
|---|---|---|
| API | Node 18+ process on port 5000 | `api.yourdomain.gh` |
| Website | Next.js process on port 3000 | `www.yourdomain.gh` |
| Database | PostgreSQL 14+ | same host, or a managed/free Postgres |
| TLS | https on both domains | Caddy, Nginx + certbot, or the host's |

Both processes must run behind https. Passwords, admin sessions and farmers'
phone numbers travel over these connections, and Africa's Talking will not
send callbacks to an address it cannot verify.

Create a database user that can reach **only** this database:

```sql
CREATE DATABASE agrimarket ENCODING 'UTF8';
CREATE USER agrimart WITH PASSWORD 'a-long-random-password';
GRANT ALL PRIVILEGES ON DATABASE agrimarket TO agrimart;
\connect agrimarket
GRANT ALL ON SCHEMA public TO agrimart;
```

On a hosted Postgres (Neon, Supabase, Render and the like) the database and
user already exist — take the connection string they give you and put it in
`DATABASE_URL`, which overrides the individual `DB_*` values.

## 2. Write the production `.env`

Copy `agrimarket-backend/.env.example` to `.env` on the server and fill it in.
The values that matter most:

```bash
NODE_ENV=production
APP_URL=https://api.yourdomain.gh
CLIENT_URL=https://www.yourdomain.gh
CLIENT_URLS=https://yourdomain.gh          # any extra origins, comma separated
PUBLIC_URL=https://api.yourdomain.gh       # where Africa's Talking reaches you

DB_DIALECT=postgres
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=agrimarket
DB_USER=agrimart
DB_PASSWORD=a-long-random-password
DB_SSL=true                                # hosted Postgres requires TLS
# or, on a host that gives you one string:
# DATABASE_URL=postgres://user:pass@host/agrimarket?sslmode=require

JWT_SECRET=<48 random bytes>
JWT_REFRESH_SECRET=<a different 48 random bytes>
GATEWAY_SECRET=<24 random characters>
SEED_ADMIN_PASSWORD=<your own strong password>

SMS_PROVIDER=africastalking
AT_API_KEY=<live API key>
AT_USERNAME=<your live app username, not "sandbox">
SMS_SENDER_ID=AgriMart                     # only once AT has approved it
SMS_ALLOWLIST=                             # must be empty to reach everyone
USSD_SERVICE_CODE="*920*268#"              # keep the quotes
```

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Then confirm: `NODE_ENV=production npm run check:env` must print
**Ready for production**.

## 3. Build the database

For a brand new platform:

```bash
cd agrimarket-backend
npm ci --omit=dev
npm run db:production
```

That creates the schema and loads only what the platform cannot run without —
regions, districts, markets, produce categories, produce types, farm guides,
settings — plus your super administrator account. **No demo farmers, listings,
orders or prices.** The marketplace opens empty and fills with real trade.

`npm run setup` is the *demo* database and must never be used in production:
it creates accounts whose passwords are printed in the README.

Then fetch the catalogue photos so USSD and SMS listings have pictures:

```bash
npm run photos:sync
```

A production server never reshapes its own tables on boot. After a deploy that
adds a table or column, run `npm run db:sync` once, deliberately.

## 4. Build and configure the website

`NEXT_PUBLIC_*` values are baked in at build time, so they must be set
**before** `npm run build`, not after:

```bash
cd agrimarket-frontend
cat > .env.local <<'EOF'
NEXT_PUBLIC_API_URL=https://api.yourdomain.gh/api/v1
NEXT_PUBLIC_SOCKET_URL=https://api.yourdomain.gh
NEXT_PUBLIC_SITE_URL=https://www.yourdomain.gh
NEXT_PUBLIC_USSD_CODE="*920*268#"
EOF
npm ci
npm run build
npm start
```

`NEXT_PUBLIC_SITE_URL` is what the sitemap, share cards and canonical links
use. Get it wrong and Google indexes links to localhost — so the build checks
both values and **refuses to build** if either still points at localhost. To
produce a production build on your own machine for testing, run
`npm run build:local`, which skips that one check.

## 5. Keep both processes running

With pm2:

```bash
npm install -g pm2
cd agrimarket-backend  && pm2 start npm --name agrimart-api -- start
cd ../agrimarket-frontend && pm2 start npm --name agrimart-web -- start
pm2 save && pm2 startup
```

Point your reverse proxy at 5000 (API) and 3000 (website), and send
`/uploads` on the API domain straight through — that is where farmers' photos
are served from.

Health endpoints for your monitor:

- `GET /health` — is the process alive (cheap, no database)
- `GET /health/ready` — can it serve (checks the database round-trip)

## 6. Point Africa's Talking at the server

In the AT dashboard, set the callbacks — including the shared secret:

| Callback | URL |
|---|---|
| USSD | `https://api.yourdomain.gh/api/v1/ussd?secret=GATEWAY_SECRET` |
| Inbound SMS | `https://api.yourdomain.gh/api/v1/sms/inbound?secret=GATEWAY_SECRET` |
| Delivery reports | `https://api.yourdomain.gh/api/v1/sms/delivery-report?secret=GATEWAY_SECRET` |

`npm run gateway:check` prints these three URLs with your own domain and
secret already filled in — copy them from there rather than typing them, and it
also confirms the credentials and the credit balance. `npm run gateway:ussd`
then walks a session against the live engine.

Dial the code on a real handset before you tell anyone about it.

## 7. Set the platform's own details

Sign in at `https://www.yourdomain.gh/admin` and open **Settings**. These
drive the website, every SMS and every USSD screen — there is nothing
hard-coded to change in the code:

- platform name and tagline
- support phone and email, office address
- USSD code and SMS short code
- commission rate, minimum withdrawal, withdrawal fee
- listing expiry days, photos per listing
- maintenance mode, registration open

`npm run check:live` will tell you which of these are still placeholders.

## 8. Keep a demo database for development

The live database has no demo accounts once it is purged, and the test suites
need them. Keep a second database for development so you never test against
real farmers' data:

```bash
DB_NAME=agrimarket_demo npm run setup                        # once
DB_NAME=agrimarket_demo PORT=5001 npm run dev                # when developing
DB_NAME=agrimarket_demo TEST_API_URL=http://localhost:5001/api/v1 npm test
```

`npm test` against the live database stops with an explanation rather than
creating test accounts in it.

## 9. Back up from day one

```bash
npm run backup                  # ./backups/agrimarket-2026-09-21-0930.sql
npm run backup -- --keep 14     # and prune anything older than 14 days
```

Schedule it daily (cron, Task Scheduler) and set `BACKUP_DIR` to somewhere
that is not this server. The dump does **not** include `uploads/` — copy that
folder too; it holds every photo a farmer has taken.

Restore with `psql -U agrimart -d agrimarket -f backups/the-file.sql`.

---

## What is deliberately locked down

**The phone simulator on the website is a sandbox.** It drives the real state
machine, so what visitors see is exactly what a handset shows, but it cannot
open a registered account (a visitor could otherwise guess a farmer's 4-digit
PIN from a browser), it writes nothing, and it sends no SMS. It opens the demo
account named by `USSD_DEMO_PHONES` and treats any other number as a
registration walkthrough. Every closing screen says nothing was saved.

**Webhooks are signed.** With `GATEWAY_SECRET` set, a request without the
matching `?secret=` is rejected — otherwise anyone could post fake USSD
sessions and inbound SMS.

**The browser may only call the API from your own site.** `CLIENT_URL` and
`CLIENT_URLS` are the allowlist; in production, localhost is not on it.

**Administrators share every power except the owner's account.** Any admin can
manage users, listings, settings and the team; only a super administrator can
appoint, edit, suspend, demote, reset the password of, or remove another super
administrator.

## If you ever run more than one API process

The platform is built to run as **one API process and one website process**,
which comfortably serves a national pilot. Two things assume that, and both
need attention before you run a second copy behind a load balancer:

- **Rate limits** are counted in memory, so each process would allow the full
  quota on its own. Move them to a shared store (Redis) if you scale out.
- **Realtime updates** (the notification bell, the admin activity feed) are
  delivered per process. Socket.IO needs its Redis adapter, or sticky
  sessions, for a farmer to receive an update raised by the other process.

Uploaded photos are written to `agrimarket-backend/uploads` on local disk. A
second process on another machine would not see them — put that folder on
shared storage, or move uploads to object storage, before scaling out. The
same applies to a host with an ephemeral filesystem, where the folder is wiped
on every deploy.

## Still worth doing

Nothing here blocks a launch; each one makes the platform stronger once real
traffic arrives.

**Soon after launch**

- **Error tracking.** Warnings and errors are written to `logs/` per day, which
  you have to go and read. A service like Sentry would tell you about a
  failure before a farmer calls.
- **An uptime monitor** on `GET /health/ready`, alerting a person who can act.
- **A staging copy** — the same two processes against a second database — so a
  change can be tried before farmers see it.
- **Continuous integration.** `npm test` (203 checks) is the release gate;
  running it automatically on every change keeps it honest.

**When the platform grows**

- **Database migrations.** The schema is kept in step by `npm run db:sync` plus
  the in-place upgrades in `schemaPatches.js`. That is fine for one deployment;
  with several environments, a migration tool (Umzug, Sequelize CLI) gives you
  an ordered, reversible history.
- **Object storage for photos.** Uploads live on the server's disk, which ties
  the platform to one machine and one backup routine.
- **Redis** for rate limits and Socket.IO once more than one API process runs.
- **A mobile-money payout API.** Withdrawals are recorded and marked paid by an
  administrator today; an API would close the last manual loop.

**Product**

- **Self-service account closure.** The privacy policy says to call or email;
  a button in the farmer's settings would be better, and the deletion logic
  already exists in the admin console.
- **A second language.** The USSD engine is English-only (`ussd/i18n.js` is
  ready for more). Twi or Dagbani would widen reach considerably.
- **Delivery reports on the dashboard.** The SMS centre records them; farmers
  cannot see whether their own alerts arrived.

## Going-live checklist

- [ ] `NODE_ENV=production npm run check:env` prints *Ready for production*
- [ ] `npm run check:live` reports no blockers
- [ ] Database built with `npm run db:production`, not the demo seed
- [ ] No account from the README can sign in
- [ ] `SMS_ALLOWLIST` is empty and a test SMS reaches a phone that is not yours
- [ ] The USSD code works from a real handset on MTN and at least one other network
- [ ] Settings → support line, USSD code and platform name are your real details
- [ ] https on both domains, http redirects to it
- [ ] `npm run backup` runs on a schedule, to somewhere off this server
- [ ] Someone is watching `/health/ready` and knows who to call
- [ ] `npm test` passes against the staging database before each release
