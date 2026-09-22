# Tests

203 checks across 9 suites, run against a **running API and a real database**.
That is deliberate: the things most likely to break in this platform — the USSD
state machine, what the telecom gateway posts, who may remove an administrator,
what happens to a photo when an upload is refused — only behave truthfully
against the real stack. Mocks of them would prove nothing.

## Running them

```bash
npm run dev          # in one terminal: the API must be up
npm test             # in another
npm test -- ussd     # just the suites whose name matches
```

The runner checks the API is answering first and stops with a clear message if
it is not. Each suite runs in its own process, so one crash cannot take the
others with it.

## What each suite covers

| Suite | Checks | What it proves |
|---|---|---|
| `ussd` | 13 | The website's phone simulator is a sandbox: it cannot open a registered account, writes nothing, sends no SMS |
| `webhooks` | 18 | Exactly what Africa's Talking posts — USSD sessions, delivery reports, inbound SMS, the shared secret |
| `photos` | 42 | Every listing gets a picture, including USSD and SMS sellers; upload limits, ownership, and cleanup of refused uploads |
| `orders-payments` | 40 | Payment evidence, complaints with screenshots, suspension hiding a seller's produce, who may delete whom |
| `permissions` | 36 | The whole administrator rule set, including everything that protects the super administrator |
| `team` | 19 | Adding, editing, resetting, suspending and removing administrators |
| `user-deletion` | 15 | Deleting a seller: refused while orders are open, withdraws listings, leaves an audit trail |
| `marketplace` | 17 | How many listings one farmer may keep open, enforced on web and USSD alike |
| `support` | 3 | The public contact form, with and without screenshots |

## Two databases

The suites sign in as the seeded accounts and trade with them, so they need a
**demo database** — never the live one. Once a database has been through
`npm run purge:demo`, those accounts are gone and the runner stops with an
explanation instead of failing suite by suite.

Keep them apart:

| | Database | Used by |
|---|---|---|
| live | `agrimarket` | real farmers and buyers |
| demo | `agrimarket_demo` | development and these tests |

To set up the demo one and run against it:

```bash
DB_NAME=agrimarket_demo npm run setup                        # build it once
DB_NAME=agrimarket_demo PORT=5001 npm run dev                # API on 5001
DB_NAME=agrimarket_demo TEST_API_URL=http://localhost:5001/api/v1 npm test
```

On Windows PowerShell, set the variables first: `$env:DB_NAME='agrimarket_demo'`.

If `GATEWAY_SECRET` is set in `.env`, the suites sign their webhook calls with
it automatically, exactly as the telecom gateway does.

Each suite cleans up after itself. If a run is interrupted, leftovers are named
`Temp Admin`, `Test Administrator`, `Doomed Seller`, `Limit Test Farmer`, `Kofi Test` or carry a
`SIM-TEST-` / `PHOTO-TEST-` session id.

## Configuration

Everything is read from `.env` — API port, prefix, database name and user — so
the suites run on any machine. Two overrides, if you need them:

| Variable | Use |
|---|---|
| `TEST_API_URL` | Point the suites at a different API |
| `MYSQL_PATH` | Where `mysql` lives, if it is not on PATH (XAMPP: `C:/xampp/mysql/bin/mysql.exe`) |

## Adding a suite

Create `something.test.mjs` next to these; the runner picks it up by name.

```js
import { suite, call, sql, ACCOUNTS, login } from './helpers.mjs';

const t = suite('Something — what it proves');

const buyer = await login(...ACCOUNTS.buyer);
const r = await call('GET', '/listings?limit=1', { token: buyer.token });

t.section('The marketplace feed');
t.check('returns listings', Array.isArray(r.body), `${r.status} ${r.message}`);

t.done();   // prints the tally and sets the exit code
```
