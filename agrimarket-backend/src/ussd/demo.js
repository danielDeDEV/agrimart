const env = require('../config/env');

/**
 * Demo mode for the phone simulator on the website.
 *
 * The simulator drives the very same state machine as a real handset, which is
 * what makes it a convincing demonstration — but it is reachable by anyone on
 * the internet, with no SIM card to prove who is dialling. So a simulated
 * session is sandboxed:
 *
 *  - It can never open a real person's account. A visitor could otherwise sit
 *    and guess a farmer's 4-digit PIN from a browser, which is impossible on a
 *    real handset without their SIM.
 *  - It never writes: no accounts, listings, offers, orders, alerts, wallet
 *    movements or support tickets.
 *  - It never sends SMS, so nobody can use the demo to text strangers at the
 *    company's expense.
 *
 * Everything still renders exactly as it does on a phone; the closing screen
 * says plainly that nothing was saved.
 */

/**
 * Accounts the simulator may open: the published demo logins, nobody else.
 *
 * An explicitly empty setting means there is no demo account — the right
 * answer for a live platform. The simulator then walks any number through
 * registration and, as always, saves nothing.
 */
const demoPhones = () => {
  const configured = process.env.USSD_DEMO_PHONES ?? process.env.USSD_DEMO_PHONE;
  const value = configured === undefined ? '0244100200,0244200300' : configured;
  return value.split(/[\s,;]+/).filter(Boolean);
};

const isDemoPhone = (phone) => demoPhones().includes(phone);

/** Closing line appended to every simulated confirmation. */
const footer = () => `\n\nThis is a demo — nothing was saved. Dial ${env.ussd.serviceCode} on your phone to do this for real.`;

/**
 * Ends a simulated session where a real one would have written something.
 * `screen` is the confirmation the farmer would have seen, so the demo still
 * shows the real outcome of the flow.
 */
const demoEnd = (screen) => ({ end: `${screen}${footer()}` });

/** Refusal shown when a visitor points the simulator at a real account. */
const refuseRealAccount = () => {
  const demo = demoPhones()[0];
  return (
    `That number belongs to a registered account, so the demo cannot open it.\n\n` +
    (demo ? `Try the demo number ${demo}, an unregistered number, ` : 'Try a number that is not registered, ') +
    `or dial ${env.ussd.serviceCode} on your own phone.`
  );
};

module.exports = { demoPhones, isDemoPhone, demoEnd, refuseRealAccount, footer };
