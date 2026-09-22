# AgriMart Ghana

**Development of an Integrated USSD/SMS Web-Based Platform for Smallholder Farmers in Ghana**

AgriMart connects smallholder farmers directly to buyers. Farmers list produce and check live market prices by dialling a USSD code on any phone — no smartphone or internet needed — while buyers, aggregators and administrators use a full web platform. Every order, offer and price alert is delivered by SMS.

| | |
|---|---|
| `agrimarket-backend/` | Node.js + Express REST API, USSD state machine, SMS gateway, realtime sockets, scheduled jobs, PostgreSQL (Sequelize) |
| `agrimarket-frontend/` | Next.js 15 + React 19 + Tailwind CSS web app: public site, farmer/buyer dashboard, admin console, USSD phone simulator |

---

## Quick start (Windows)

**You need:** [Node.js 18 or newer](https://nodejs.org) and [PostgreSQL 14 or newer](https://www.postgresql.org/download/). During the PostgreSQL install, note the password you set for the `postgres` user — you will need it once.

1. Make sure the PostgreSQL service is running (it starts automatically after installation).
2. Double-click **`setup-agrimarket.bat`** (first time only). It installs packages, creates the `agrimarket` database and loads the seed data.
3. Double-click **`start-agrimarket.bat`**. It starts both servers and opens the website.

| Open | Address |
|---|---|
| Website | http://localhost:3000 |
| Admin console | http://localhost:3000/admin |
| USSD phone simulator | http://localhost:3000/ussd |
| API | http://localhost:5000/api/v1 |
| Database (pgAdmin) | installed with PostgreSQL → database `agrimarket` |

### Manual setup (any OS)

```bash
# Terminal 1 — API
cd agrimarket-backend
npm install
npm run setup      # creates the database, tables and seed data
npm run dev        # http://localhost:5000

# Terminal 2 — website
cd agrimarket-frontend
npm install
npm run dev        # http://localhost:3000
```

The API creates the database and tables itself on first start, so there is no SQL to import. `npm run setup` (or `npm run db:seed`) **drops all tables** and reloads the seed data — use it to reset.

Moving an existing MySQL database across? `npm run db:migrate-postgres` copies every row into PostgreSQL through the same models, and shows you what it will move before it writes anything.

---

## Sign-in accounts (demo database only)

> These exist in the **demo** database created by `npm run setup`. A live
> database built with `npm run db:production`, or cleaned with
> `npm run purge:demo`, has none of them — only the administrator account you
> set up with `SEED_ADMIN_PASSWORD`.


| Role | Where to sign in | Login | Password |
|---|---|---|---|
| Super administrator | `/admin/login` | `admin@agrimart.gh` | `Admin@2026` |
| Administrator | `/admin/login` | `akua.boakye@agrimart.gh` | `Admin@2026` |
| Farmer | `/login` | `farmer@agrimart.gh` | `Farmer@2026` |
| Buyer | `/login` | `buyer@agrimart.gh` | `Buyer@2026` |
| Field agent | `/login` | `agent.techiman@agrimart.gh` | `Agent@2026` |

**USSD:** the demo farmer's number is `0244100200` with PIN `1357`. Other seeded farmers use PIN `1357`, buyers `2468`. Any number that is not registered goes through USSD registration.

Administrators and farmers/buyers are deliberately **separate**: the admin console has its own login page, its own sign-in endpoint and its own session. An admin cannot sign in through the public login, and a farmer's session never opens `/admin`.

**Managing people.** Any administrator can add an account (they get a one-time password to hand over), suspend one — a suspended seller's produce leaves the marketplace at once and returns if they are reinstated — and delete one, from the person's profile page: it asks for the name to be typed back, refuses while orders are still open, withdraws their listings, cancels their open offers and records the whole thing in the audit log. Administrator accounts are not deleted there; they are managed on the Admin team page.

**Admin team (`/admin/team`):** administrators run the platform between them — any of them can add an administrator (with a generated one-time password), edit them, reset their password, suspend, reactivate and remove them, and change platform settings. What is protected is the owner's account: **only a super administrator** can appoint another one, or edit, suspend, demote, reset the password of or remove a super administrator — so an administrator cannot promote an ally and lock the owner out. Nobody can change their own role or suspend or remove themselves; a super administrator must be changed to Admin before they can be removed, and the last active one can be neither demoted nor suspended, so the platform always keeps one. Every change is recorded in the audit log.

**Change `SEED_ADMIN_PASSWORD` and the JWT secrets in `agrimarket-backend/.env` before deploying anywhere public.**

---

## How the study objectives are implemented

| # | Objective | Where it lives |
|---|---|---|
| 1 | USSD interface for listing produce and market services without internet | `agrimarket-backend/src/ussd/` — a state machine with registration, selling, prices, listings, buying, orders, wallet, PIN, language and help. A numbered menu. Try it at `/ussd`. |
| 2 | SMS notifications between farmers and buyers | `src/services/smsService.js`, `smsProviders.js`, `smsTemplates.js` — order/offer/payment alerts, price alerts, daily price digest, broadcasts, and inbound keyword commands (`PRICE MAIZE`, `SELL MAIZE 20 450`, `BALANCE`, `HELP`, `STOP`). Admin: **SMS centre**. |
| 3 | Real-time market price information | `src/services/priceService.js` — 29 Ghanaian markets, trend history, market comparison, price alerts, SMS digest. Public page `/prices`; admin **Market prices** with market-day bulk entry. |
| 4 | Backend managing transactions, users and interactions | Transactional order handling with stock reservation, a status graph, wallet ledger and payouts, audit log, realtime sockets, and scheduled jobs (`src/jobs/`). |
| 5 | Evaluating effect on market participation and income | Admin **Impact analytics** (`/admin/analytics`) compares baseline/endline surveys (**Survey records**) with live platform data: income change, participation funnel, channel reach, price gaps between markets. Exports CSV. |

---

## Features

**Public website:** landing page with a live USSD handset, marketplace with filters, listing pages with ordering and price negotiation, market prices with charts, farm guides, how it works, FAQ, contact, dark mode.

**Farmer / buyer dashboard:** overview, listings (with market-price guidance while pricing), orders with timeline and ratings, offers and counter-offers, messages (mirrored to SMS for USSD farmers), saved listings, wallet and mobile-money withdrawal, price alerts, notifications with an SMS inbox, profile, USSD PIN and password settings, support tickets.

**Admin console (`/admin`):** platform dashboard with a live activity feed, users (verify, suspend, register in the field), listing moderation, orders with dispute handling, transactions and payout settlement, market prices, produce/markets catalog, SMS centre (logs, stats, broadcast campaigns), USSD monitor with session replay, support desk, farm-guide editor with SMS push, survey records, impact analytics, audit log, settings. Users, listings, orders and transactions export to CSV — the rows currently filtered, not just the page on screen.

---

## Payments and complaints

AgriMart never holds or moves money. Buyers pay farmers directly by mobile money or cash, so the platform's job is to make that safe and reviewable:

- **Before paying.** The order dialog and the order page say plainly that the platform takes no payment, and show the other party's phone number so the two can agree collection and payment first.
- **Recording a payment.** The buyer enters the mobile-money reference and attaches a screenshot of the confirmation. Nothing is marked paid yet — the farmer is texted what to look for.
- **Confirming it.** Only the farmer can mark the money as received, once they have checked their own mobile-money messages.
- **Reporting a problem.** Either side can report an order with up to 4 screenshots. That opens a support ticket linked to the order and puts the order on hold.
- **Reviewing it.** Under **Support desk**, each ticket shows the message, the attached screenshots, the order and the payment evidence recorded against it — so an administrator sees both sides before deciding. From there they can reply (by SMS and in-app), resolve, suspend an account or remove it.

Screenshots are stored in `agrimarket-backend/uploads/evidence/` and are never shown in the marketplace.

---

## Platform settings

**Admin → Settings** is live: what you save there is what the platform uses immediately — no restart, no redeploy.

| Setting | What it changes |
|---|---|
| Platform name, tagline | Page titles, footer, metadata |
| Support line, email, office address | Website, SMS wording ("Contact support on …"), USSD help screen |
| USSD service code | Every screen, SMS and page that tells a farmer what to dial |
| SMS short code | If empty, the site stops advertising two-way SMS commands |
| Commission | Order maths and what the farmer sees they receive |
| Minimum withdrawal, withdrawal fee | Wallet withdrawals on the web and USSD |
| Listing lifetime, perishable lifetime | How long new listings stay live |
| Publish listings without review | Off means new listings wait for moderation, and farmers are told so |
| Photos per listing | How many photos a farmer may attach |
| Open listings per farmer | How many listings one farmer may keep on the marketplace at once (0 = no limit), enforced on web, USSD and SMS alike |
| Daily price digest | Whether the 06:30 SMS digest runs |
| Maintenance mode | A banner on the website; USSD answers "briefly unavailable" |
| Allow new registrations | Off closes sign-ups on the website and over USSD |

Values in `.env` are the defaults for a fresh install; the settings saved in the console take precedence while the platform runs.

---

## Produce photos (automatic for USSD and SMS sellers)

A farmer selling by USSD or SMS cannot attach a picture. So every produce type and category has a **catalogue photo**, stored with the website in `agrimarket-frontend/public/images/`.

- A listing with no photos of its own shows its produce's catalogue photo. A farmer who dials `*920*1234#`, chooses *Maize* and publishes gets a maize picture on the marketplace straight away. The USSD confirmation tells them so.
- The photo is looked up when the listing is shown, not copied onto it. If an admin changes the Maize photo, every listing that relies on it changes too.
- Buyers see a small **Catalogue photo** label, so a stock picture is never mistaken for the actual harvest.
- Farmers can replace it with their own photos (up to 5) at any time: **My listings → Add photos**, or from the listing page. This includes listings they first created over USSD.
- Admins can upload a different photo for any produce type or category, or restore the library photo, under **Produce & markets**. A new produce type starts with no photo until one is uploaded.
- The photos come from Wikimedia Commons under free licences. Photographers and licences are listed at `/credits`, which is linked in the footer.
- `agrimarket-backend/src/data/catalogPhotos.json` lists which photo belongs to which produce or category. The API applies it to existing databases each time it starts. You can also run `npm run photos:sync`.

---

## USSD and SMS through Africa's Talking

Out of the box `SMS_PROVIDER=mock`: every message is written to the SMS centre and marked delivered, but nothing is sent or billed, and the simulator at `/ussd` drives the real USSD engine. That is enough to demonstrate the whole platform offline.

To reach real handsets, fill in `agrimarket-backend/.env` and restart the API:

```env
SMS_PROVIDER=africastalking
AT_USERNAME=your_app_username        # "sandbox" while testing
AT_API_KEY=your_api_key
AT_SANDBOX=false                     # true for the sandbox
SMS_SENDER_ID=AgriMart               # only once Africa's Talking approves it
AT_SHORT_CODE=1234                   # if you have one, for inbound keywords
USSD_SERVICE_CODE="*384*12345#"      # keep the quotes — an unquoted # is a comment
PUBLIC_URL=https://your-domain       # or the ngrok address while testing
GATEWAY_SECRET=a_long_random_string
SMS_ALLOWLIST=0593743065             # safe mode: only these numbers get real SMS
```

**Safe mode.** While the database still has demo accounts with made-up numbers, set `SMS_ALLOWLIST` to your own number(s). Every other message is still written to the SMS log — marked *Skipped (safe mode)*, with its full text — but never reaches the gateway, so demos cost nothing and nobody is texted by accident. Empty it once every account belongs to a real person.

Then register three callback URLs in the Africa's Talking dashboard:

| Purpose | URL |
|---|---|
| USSD callback | `PUBLIC_URL/api/v1/ussd?secret=GATEWAY_SECRET` |
| Incoming SMS | `PUBLIC_URL/api/v1/sms/inbound?secret=GATEWAY_SECRET` |
| Delivery reports | `PUBLIC_URL/api/v1/sms/delivery-report?secret=GATEWAY_SECRET` |

`npm run gateway:check` prints them with your own values filled in, along with your credit balance and any misconfiguration. The same panel is in the admin console under **SMS centre → Gateway**, with copy buttons.

Check the connection without leaving the terminal:

```bash
npm run gateway:check                  # settings, credit, callback URLs
npm run gateway:test -- 0244123456     # send one real SMS
npm run gateway:ussd -- 0244123456     # walk the USSD menu in the terminal
```

**Step-by-step setup, going live in Ghana, and a table of gateway errors: [docs/africas-talking-setup.md](docs/africas-talking-setup.md).**

Broadcasts and the daily digest go out in one API call per batch of 100 identical messages. Farmers who texted STOP are filtered out before the gateway is called, except for order, payment and security messages. The USSD endpoint also accepts Hubtel and Nalo field names and always answers in the standard `CON …` / `END …` plain-text format — including when something fails, so a farmer never sees a raw error mid-session.

---

## Scheduled jobs

Started automatically with the API (set `DISABLE_CRON=true` to turn them off):

| Job | When |
|---|---|
| Close abandoned USSD sessions | every 5 minutes |
| Expire old listings, offers and codes | hourly |
| Remind farmers about unanswered orders | every 10 minutes |
| Send scheduled broadcasts | every minute |
| Daily price digest SMS to farmers | 06:30 Africa/Accra |
| Re-engage farmers who have not listed recently | Mondays 07:00 |

---

## Project structure

```
agrimarket-backend/
  src/
    config/        environment and database connection (creates the DB on first run)
    models/        26 Sequelize models and their associations
    controllers/   request handlers per area
    routes/        REST routes — admin routes are guarded in one place
    services/      orders, listings, prices, SMS, notifications, audit
    ussd/          engine, screens (states.js), menu helpers, translations
    jobs/          scheduled tasks
    sockets/       realtime notifications and admin activity feed
    seeders/       Ghana regions, districts, markets, produce, prices and demo data
    data/          catalogue photo manifest (which photo belongs to which produce)
    scripts/       setup, seed, sync and reset commands
  uploads/         farmers' listing photos, avatars, admin-uploaded catalogue photos

agrimarket-frontend/
  src/
    app/(site)/        public website and /dashboard
    app/(auth)/        login, register, password reset
    app/admin/         admin console (separate layout and session)
    components/ui/     design system (Radix + Tailwind, shadcn-style)
    components/charts/ accessible chart components (legend, tooltip, table view)
    components/shared/ USSD simulator, listing card, price ticker
    lib/               API client, auth, sockets, types, constants, photo credits
  public/images/       catalogue photos for produce and categories
```

## Useful commands

| Where | Command | What it does |
|---|---|---|
| backend | `npm run dev` | API with auto-reload |
| backend | `npm run setup` | Create database and load seed data (**drops existing tables**) |
| backend | `npm run db:sync` | Update tables to match the models without deleting data |
| backend | `npm run db:reset` | Empty the database (tables recreated, no data) |
| backend | `npm run photos:sync` | Apply the photo library to an existing database (also runs on API start) |
| backend | `npm run gateway:check` | Show SMS/USSD settings, credit and callback URLs |
| backend | `npm run gateway:test -- 0244123456` | Send one real test SMS |
| backend | `npm run gateway:ussd -- 0244123456` | Walk the USSD menu in the terminal |
| backend | `npm run db:production` | Build a **live** database: reference data and your admin account, no demo records |
| backend | `NODE_ENV=production npm run check:env` | Check the configuration is safe to go live |
| backend | `npm run check:live` | Audit the database and gateway for go-live blockers |
| backend | `npm run backup` | Back up the database to `backups/` |
| backend | `npm run purge:demo` | Show what demo data would be removed (changes nothing) |
| backend | `npm run purge:demo -- --apply` | Remove the demo accounts, listings, orders and logs |
| backend | `npm test` | 203 checks against the running API (see [tests/](agrimarket-backend/tests/README.md)) |
| frontend | `npm run dev` | Website with hot reload |
| frontend | `npm run build && npm start` | Production build (refuses to build if the API/site URLs still point at localhost) |
| frontend | `npm run build:local` | Production build on this machine, for testing |

## Tests

```bash
cd agrimarket-backend
npm run dev      # the API must be running
npm test         # 203 checks, 9 suites, ~50 seconds
```

They run against the real API and a real database, because that is where this
platform can actually go wrong: the USSD state machine, what the telecom
gateway posts, who may remove an administrator, what happens to a photo when an
upload is refused. [tests/README.md](agrimarket-backend/tests/README.md) says
what each suite covers.

## Going to production

Read **[docs/going-live.md](docs/going-live.md)** — server, domains, TLS, the production `.env`, gateway callbacks, backups and a final checklist.

Three things the code does for you:

- **The API refuses to start** on a production `.env` that still has development values — a placeholder JWT secret, an empty database password, localhost URLs, no gateway secret, the demo admin password. It names each one instead of booting insecurely. Check it any time with `NODE_ENV=production npm run check:env`.
- **`npm run db:production`** builds a live database with reference data (regions, districts, markets, produce, guides, settings) and your administrator account only. The marketplace opens empty. `npm run setup` is the demo database and must never be used live — its passwords are in this README.
- **`npm run purge:demo`** clears the demonstration data out of a database that already has it — every seeded account and everything it owns — while keeping the reference data and your settings. It shows you exactly what would go before it does anything.
- **`npm run check:live`** audits a database the way a customer would: can anyone still sign in with a README password, is the support line still a placeholder, will SMS actually be delivered, is the gateway pointed here.

The phone simulator on the website is a **sandbox**: it drives the real USSD engine so the demo is honest, but it cannot open a registered account, it writes nothing and it sends no SMS.

## Notes

- **Produce photos** are served from the website itself, so they load without reaching an outside site. If a photo is ever missing, the site shows a designed placeholder instead of a broken image.
- **USSD PINs** are any four digits the farmer chooses — no pattern rules, because a rule a farmer cannot remember is worse than a weak PIN. Three wrong entries end the session, which is what actually slows guessing.
- **Seed data** uses real Ghanaian regions, districts, markets and crops. Prices sit in realistic ranges, but people, listings, orders and survey responses are demo records. For a real launch, build the database with `npm run db:production` instead — it loads the reference data without any of them.
- **Payments:** withdrawals are recorded and shown as *processing*. Administrators mark them paid or failed under **Transactions**. Connecting a mobile-money payout API is the next step for live money movement.
