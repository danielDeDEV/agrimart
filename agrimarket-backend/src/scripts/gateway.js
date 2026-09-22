/**
 * Gateway helper — checks the SMS/USSD configuration without starting the API.
 *
 *   npm run gateway:check                 show settings, credit and callback URLs
 *   npm run gateway:test -- 0244123456    send one real SMS to that number
 *   npm run gateway:ussd -- 0244123456    run a USSD session against the engine
 *
 * The test send goes through whichever SMS_PROVIDER is set in .env, so with
 * the default "mock" it only writes to the SMS log — switch to
 * africastalking first if you want the handset to ring.
 */
const env = require('../config/env');
const logger = require('../utils/logger');
const { connectDatabase, sequelize } = require('../config/database');
const smsService = require('../services/smsService');
const { ensureSchema } = require('../services/schemaPatches');

const line = (label, value) => console.log(`  ${String(label).padEnd(22)} ${value}`);

async function check() {
  const status = await smsService.gatewayStatus();
  console.log('\n  SMS gateway');
  line('Provider', status.provider + (status.environment ? ` (${status.environment})` : ''));
  line('Sending enabled', status.enabled ? 'yes' : 'no  (SMS_ENABLED=false)');
  line('Sender ID', status.senderId);
  if (status.shortCode) line('Short code', status.shortCode);
  if (status.username) line('AT username', status.username);
  line('Credentials', status.provider === 'mock'
    ? 'not needed (mock writes to the log only)'
    : status.configured ? 'set' : 'MISSING — set AT_API_KEY in .env');
  if (status.balance !== null) line('Credit', `${status.currency} ${status.balance}`);
  if (status.note) line('Note', status.note);
  if (status.error) line('Problem', status.error);
  line('Safe mode', status.safeMode
    ? `on — only ${status.allowlist.join(', ')} ${status.allowlist.length === 1 ? 'receives' : 'receive'} real messages`
    : status.provider === 'mock' ? 'not needed (mock)' : 'off — every number receives real messages');

  console.log('\n  USSD');
  line('Service code', status.ussdServiceCode);

  console.log('\n  Callback URLs for the Africa\'s Talking dashboard');
  line('USSD', status.callbacks.ussd);
  line('Incoming SMS', status.callbacks.inboundSms);
  line('Delivery reports', status.callbacks.deliveryReports);
  if (status.isLocalUrl) {
    console.log('\n  These point at localhost, which Africa\'s Talking cannot reach.');
    console.log('  Start a tunnel (ngrok http 5000) and set PUBLIC_URL in .env to the https URL it prints.');
  }
  if (!status.secretSet) {
    console.log('\n  GATEWAY_SECRET is empty, so anyone who finds these URLs can post to them.');
    console.log('  Set one in .env and add ?secret=THE_VALUE to each URL above.');
  }
  console.log('');
}

async function testSms(phone, text) {
  if (!phone) throw new Error('Give a phone number: npm run gateway:test -- 0244123456 "Your message"');
  const message = text || `This is a test message from ${env.appName}. If you can read this, the SMS gateway works.`;
  console.log(`\n  Sending to ${phone} through "${env.sms.provider}":`);
  console.log(`  "${message}"`);
  const result = await smsService.sendSms({ to: phone, message, type: 'system', force: true, raw: true });
  if (result.success) {
    console.log(`  Sent. Gateway id ${result.messageId || 'n/a'}, cost ${result.cost ?? 0}`);
    console.log('  Watch the delivery report in the admin SMS centre.\n');
  } else if (result.skipped && result.record) {
    console.log('  Not sent: safe mode is on and this number is not in SMS_ALLOWLIST.');
    console.log('  Add it to agrimarket-backend/.env (comma separated) and run this again.\n');
    process.exitCode = 1;
  } else {
    console.log(`  Failed: ${result.error}\n`);
    process.exitCode = 1;
  }
}

async function testUssd(phone) {
  if (!phone) throw new Error('Give a phone number: npm run gateway:ussd -- 0244123456');
  const { handleRequest } = require('../ussd/engine');
  const sessionId = `CLI-${Date.now()}`;
  const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => readline.question(q, resolve));

  console.log(`\n  Dialling ${env.ussd.serviceCode} as ${phone}. Type a reply and press Enter; Ctrl+C to hang up.\n`);
  let text = '';
  for (;;) {
    const { response } = await handleRequest({
      sessionId, phoneNumber: phone, text, serviceCode: env.ussd.serviceCode,
    });
    console.log('  ┌──────────────────────────────────────────────');
    response.substring(4).split('\n').forEach((l) => console.log(`  │ ${l}`));
    console.log('  └──────────────────────────────────────────────');
    if (response.startsWith('END')) break;
    const input = await ask('  > ');
    // Africa's Talking sends the whole trail; mirror that exactly
    text = text ? `${text}*${input}` : input;
  }
  readline.close();
  console.log('');
}

(async () => {
  const [command, arg, ...rest] = process.argv.slice(2);
  try {
    await connectDatabase();
    await ensureSchema();
    await require('../services/settingsService').load();
    if (command === 'test') await testSms(arg, rest.join(' ').trim());
    else if (command === 'ussd') await testUssd(arg);
    else await check();
    await sequelize.close();
    process.exit(process.exitCode || 0);
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }
})();
