# Connecting AgriMart to Africa's Talking

AgriMart talks to farmers over USSD and SMS through [Africa's Talking](https://africastalking.com). This guide takes you from a fresh account to a working short code, first on your own laptop with the sandbox, then live in Ghana.

Nothing here is optional reading: each step ends with a command that tells you whether it worked.

---

## 1. What you need

| What | Where it comes from | Goes into `.env` as |
|---|---|---|
| Username | The app name you create in the AT dashboard (`sandbox` for testing) | `AT_USERNAME` |
| API key | AT dashboard → **Settings → API Key** | `AT_API_KEY` |
| USSD service code | AT dashboard → **USSD → Service codes** (AT assigns it, e.g. `*384*12345#`) | `USSD_SERVICE_CODE` |
| SMS sender ID or short code | AT dashboard → **SMS → Sender IDs / Short codes** (needs approval) | `SMS_SENDER_ID`, `AT_SHORT_CODE` |
| A public address for this API | ngrok while testing, your server's domain in production | `PUBLIC_URL` |

The API key is shown **once**. Copy it straight into `.env`; if you lose it, generate a new one.

---

## 2. Test on your laptop (sandbox)

The sandbox is free, uses fake money and fake handsets, and needs no approval.

**a. Create the app.** Sign in, switch to **Sandbox** (top-right), open **Settings → API Key** and generate a key.

**b. Fill in `agrimarket-backend/.env`:**

```env
SMS_PROVIDER=africastalking
AT_USERNAME=sandbox
AT_API_KEY=paste_your_sandbox_key_here
AT_SANDBOX=true
SMS_SENDER_ID=                       # empty until AT approves a sender ID
USSD_SERVICE_CODE="*384*12345#"      # keep the quotes: an unquoted # is a comment
GATEWAY_SECRET=pick_a_long_random_string
```

**c. Let Africa's Talking reach your machine.** Their servers cannot see `localhost`, so open a tunnel:

```bash
ngrok http 5000
```

Copy the `https://…` address it prints into `.env` and restart the API:

```env
PUBLIC_URL=https://your-id.ngrok-free.app
```

**d. Register the callbacks.** In the AT dashboard:

| AT dashboard page | URL to paste |
|---|---|
| USSD → Create channel | `https://your-id.ngrok-free.app/api/v1/ussd?secret=YOUR_GATEWAY_SECRET` |
| SMS → Inbox → Callback URL | `https://your-id.ngrok-free.app/api/v1/sms/inbound?secret=YOUR_GATEWAY_SECRET` |
| SMS → Delivery reports | `https://your-id.ngrok-free.app/api/v1/sms/delivery-report?secret=YOUR_GATEWAY_SECRET` |

`npm run gateway:check` prints these three URLs with your own values already filled in — copy them from there. They also appear in the admin console under **SMS centre → Gateway**, with copy buttons.

**e. Dial from the AT simulator.** AT dashboard → **Launch simulator**, enter a test number such as `+233711223344`, dial your service code. You should see the AgriMart menu. Every step is recorded in the admin console under **USSD monitor**.

> Sandbox numbers only work in the simulator, and sandbox SMS never reaches a real phone.

---

## 3. Go live in Ghana

1. Switch the dashboard from Sandbox to **Live** and add credit (Payments → Top up).
2. **USSD:** apply for a service code under **USSD → Service codes**. Ghana's networks charge a monthly rental and take some days to approve. AT gives you the final code — put it in `USSD_SERVICE_CODE` and show it on the website via `NEXT_PUBLIC_USSD_CODE` in `agrimarket-frontend/.env.local`.
3. **SMS sender ID:** leave `SMS_SENDER_ID` **empty** until Africa's Talking approves one — messages then go out from their shared number and arrive normally. Apply under **SMS → Sender IDs** (e.g. `AgriMart`), and only fill the setting in once the dashboard shows it approved. Sending with an unapproved sender ID gets the message rejected.
4. **Short code** (optional, for farmers texting `PRICE MAIZE`): apply under **SMS → Short codes**, then set `AT_SHORT_CODE`.
5. Update `.env`:

```env
AT_USERNAME=your_live_app_username
AT_API_KEY=your_live_api_key
AT_SANDBOX=false
PUBLIC_URL=https://api.your-domain.com
```

6. Point the same three callback URLs at your live domain in the dashboard.

---

## 4. Things the gateway does that surprise people

- **Repeated rejected sends pause the account.** After a few refused requests (a wrong key, an invalid number), Africa's Talking answers `401 The supplied authentication is invalid` to *everything* for a few minutes, even with correct credentials. If sends suddenly fail in a burst, wait ten minutes and try once — do not loop.
- **Never test with a made-up number.** It looks harmless, but a run of `InvalidPhoneNumber` results is exactly what triggers the pause above. Test with a real handset you own.
- **A refused balance check is not retried.** If the credit check is ever refused (during the pause above, or because a key lacks that permission), the platform stops asking for an hour and carries on sending; the Gateway tab says *"See dashboard"* instead of a figure. Asking again on every page load would only prolong the pause.
- **The API key is invalidated the moment you generate a new one.** If you clicked *Generate* twice, only the newest key works.
- **The username is the app's username**, visible in the dashboard address: `account.africastalking.com/apps/`**`<username>`**`/`. It is case-sensitive and is usually not your display name.

---

## 5. Safe mode while you still have demo data

The seed data creates demo farmers and buyers with made-up numbers. With a live gateway, the 06:30 price digest, broadcasts and order alerts would try to text all of them — costing credit, possibly reaching strangers, and triggering the pause described above.

List the numbers that may receive real messages:

```env
SMS_ALLOWLIST=0593743065,0244123456
```

Messages to anyone else are still written to the message log — marked **Skipped (safe mode)** with the full text — but never reach the gateway, so you can show exactly what a farmer would receive without paying for it. Skipped messages do not count against the delivery rate.

`npm run gateway:check` and **SMS centre → Gateway** both say when safe mode is on. Empty the setting once every account belongs to a real person.

---

## 6. Check it works

From `agrimarket-backend`:

```bash
npm run gateway:check                  # settings, credit balance, callback URLs
npm run gateway:test -- 0244123456     # sends one real SMS to that number
npm run gateway:ussd -- 0244123456     # walks the USSD menu in your terminal
```

`gateway:check` warns you when `PUBLIC_URL` still points at localhost, when the API key is missing, and when `GATEWAY_SECRET` is empty.

In the admin console, **SMS centre → Gateway** shows the same information plus your remaining credit, and **SMS centre → Message log** shows every message with its delivery receipt.

---

## 7. What the platform sends

| Trigger | Message |
|---|---|
| Registration (USSD or web) | Welcome message |
| New listing | Confirmation with the listing code |
| New order | Alert to the farmer, confirmation to the buyer |
| Order accepted, paid, delivered, completed | Status updates to both sides |
| Offer, counter-offer, acceptance | Alerts to the other party |
| Price alert hit | The market and price that triggered it |
| 06:30 daily | Price digest to farmers who opted in |
| Mondays 07:00 | Re-engagement message to dormant farmers |
| Farmer texts `PRICE`, `SELL`, `BALANCE`, `HELP`, `STOP`, `START` | An immediate reply — **needs an SMS short code**; without one the website does not advertise these commands |

Broadcasts to many farmers go out in **one API call per batch of 100** identical messages, so a nationwide digest is a handful of requests rather than thousands. Personalised messages are sent individually.

`STOP` sets `smsNotifications = false` and the platform then skips that number for anything except order, payment and security messages.

---

## 8. When something fails

Failures appear in the message log with the reason, and in the API console.

| What you see | What it means | Fix |
|---|---|---|
| `Africa's Talking refused the request (401)` | Wrong key or username — **or** the account is in a short cooldown after rejected sends | Wait ten minutes and try one send. If it still fails, regenerate the key under Settings → API Key and check `AT_USERNAME` against the dashboard address |
| `This API key cannot read the account balance` | The key has no balance permission | Nothing to fix — sending is unaffected; read your credit in the dashboard |
| `Sender ID is not valid or not approved` | `SMS_SENDER_ID` is not approved for this account | Leave `SMS_SENDER_ID` empty until AT approves it |
| `Insufficient Africa's Talking credit` | The account is out of money | Top up; the balance also shows in the Gateway tab |
| `Invalid phone number` | Number is not in `+233…` form or does not exist | The platform converts local `0…` numbers itself; check the stored number |
| `This number is on your blacklist` | The subscriber texted STOP to your short code | Only they can undo it, by texting START |
| USSD says "service unavailable" on the handset | AT could not reach your callback, or it did not answer in time | Check the tunnel/domain is up and `npm run gateway:check` |
| Nothing arrives at the callback | URL not registered, or the secret does not match | Re-copy the URL from the Gateway tab, including `?secret=` |

---

## 9. Costs

Africa's Talking charges per SMS segment (160 GSM characters) and, for USSD, a monthly service-code rental plus a per-session fee. The platform keeps both down:

- every template is written to fit one segment;
- USSD screens are trimmed to 182 characters so no menu spills into an extra screen;
- opted-out farmers are filtered out before the gateway is called;
- the SMS centre shows the running cost per period.

Set `SMS_ENABLED=false` to stop all sending while leaving the rest of the platform working — useful when demonstrating the project without spending credit.
