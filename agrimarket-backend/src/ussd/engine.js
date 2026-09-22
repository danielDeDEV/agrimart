const env = require('../config/env');
const { UssdSession, User } = require('../models');
const states = require('./states');
const { CON, END } = require('./menu');
const { normalizePhone, detectNetwork } = require('../utils/helpers');
const logger = require('../utils/logger');
const { get: setting, supportLine } = require('../services/settingsService');
const { activity } = require('../sockets/io');
const { isDemoPhone, refuseRealAccount } = require('./demo');

/**
 * Drives the USSD state machine.
 *
 * Gateways differ in what they put in `text`: Africa's Talking sends the whole
 * trail ("1*2*450"), Nalo and Hubtel send only the latest keypress. Taking the
 * last segment of the trail is correct for both, and the authoritative state
 * lives in our own session row rather than in the gateway's string.
 */
async function handleRequest({
  sessionId,
  phoneNumber,
  text = '',
  serviceCode,
  networkCode,
  isSimulated = false,
}) {
  const phone = normalizePhone(phoneNumber);
  if (!phone) return { response: END('Invalid phone number.'), session: null };

  // Admin -> Settings can pause the service while work is going on
  if (setting('maintenance_mode')) {
    return {
      response: END(`AgriMart is briefly unavailable for maintenance. Please try again shortly. Help: ${supportLine()}`),
      session: null,
    };
  }

  const started = Date.now();
  const rawInput = String(text ?? '');
  const input = rawInput.includes('*') ? rawInput.split('*').pop() : rawInput;

  let session = await UssdSession.findOne({ where: { sessionId } });
  let isNewSession = false;

  // withSecrets, because the PIN gate needs the hash the default scope hides
  const user = await User.scope('withSecrets').findOne({ where: { phone } });

  // The website simulator has no SIM card to prove who is dialling, so it is
  // only ever allowed into the published demo accounts. Anything else would
  // let a visitor guess a real farmer's PIN from a browser.
  if (isSimulated && user && !isDemoPhone(phone)) {
    return { response: END(refuseRealAccount()), session: null };
  }

  if (!session) {
    isNewSession = true;
    session = await UssdSession.create({
      sessionId,
      phone,
      userId: user ? user.id : null,
      serviceCode: serviceCode || env.ussd.serviceCode,
      network: detectNetwork(phone),
      state: user ? 'MAIN_MENU' : 'WELCOME_NEW',
      data: {},
      history: [],
      status: 'active',
      isSimulated,
    });

    if (user) {
      await user.update({
        lastUssdAt: new Date(),
        ussdSessionCount: (user.ussdSessionCount || 0) + 1,
      });
    }
    activity('ussd.session', `${phone} dialled ${session.serviceCode}`, { sessionId, registered: !!user });
  } else if (session.status !== 'active') {
    // The gateway reused a closed session id — start clean rather than 500.
    await session.update({ state: user ? 'MAIN_MENU' : 'WELCOME_NEW', status: 'active', data: {} });
    isNewSession = true;
  }

  const ctx = buildContext({ session, user, phone, input, networkCode, isSimulated });

  let response;
  try {
    response = isNewSession
      ? await renderState(session.state, ctx)
      : await advance(session, ctx);
  } catch (err) {
    logger.error(`USSD error [${session.state}]:`, err.message, err.stack);
    await session.update({ status: 'error' });
    response = END(`Sorry, something went wrong. Please dial ${env.ussd.serviceCode} again.`);
  }

  // Persist whatever the handlers collected during this step
  session.data = ctx.data;
  session.changed('data', true);
  session.lastInput = input ? String(input).substring(0, 150) : null;
  session.stepCount = (session.stepCount || 0) + 1;
  session.pushHistory(isNewSession ? '(dial)' : input, response);
  session.changed('history', true);
  if (ctx.session.userId && !session.userId) session.userId = ctx.session.userId;
  if (ctx.session.outcome) session.outcome = ctx.session.outcome;

  if (response.startsWith('END')) {
    session.status = 'completed';
    session.endedAt = new Date();
    session.durationSeconds = Math.round((Date.now() - new Date(session.createdAt).getTime()) / 1000);
  }
  await session.save();

  logger.ussd(
    `${phone} [${session.state}] "${input}" -> ${response.split('\n')[0].substring(0, 60)} (${Date.now() - started}ms)`
  );

  return { response, session };
}

function buildContext({ session, user, phone, input, networkCode, isSimulated = false }) {
  const stored = session.data;
  const parsed = typeof stored === 'string' ? safeParse(stored) : stored;
  const data = { ...(parsed || {}) };
  return {
    input: String(input ?? '').trim(),
    phone,
    user,
    session,
    network: networkCode || session.network,
    // True for the website simulator: screens render, nothing is written or sent
    demo: !!isSimulated,
    lang: 'en', // the USSD service is English-only
    data,
    set(patch) { Object.assign(data, patch); },
  };
}

function safeParse(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function renderState(stateName, ctx, notice) {
  const state = states[stateName];
  if (!state) {
    logger.warn(`Unknown USSD state "${stateName}" — resetting to main menu`);
    return renderState(ctx.user ? 'MAIN_MENU' : 'WELCOME_NEW', ctx);
  }
  const screen = await state.render(ctx);
  if (!notice) return screen;

  // Prefix an error/notice line while keeping the CON/END verb intact
  const verb = screen.substring(0, 3);
  const body = screen.substring(4);
  return `${verb} ${notice}\n${body}`;
}

/** Runs the current state's handler and follows whatever directive it returns. */
async function advance(session, ctx) {
  const state = states[session.state];
  if (!state) {
    session.state = ctx.user ? 'MAIN_MENU' : 'WELCOME_NEW';
    return renderState(session.state, ctx);
  }

  const result = (await state.handle(ctx)) || {};

  if (result.data) ctx.set(result.data);

  if (result.end !== undefined) {
    return END(result.end);
  }

  if (result.repeat !== undefined) {
    return renderState(session.state, ctx, result.repeat);
  }

  if (result.redraw) {
    return renderState(session.state, ctx, result.notice);
  }

  if (result.goto) {
    session.previousState = session.state;
    session.state = result.goto;
    return renderState(result.goto, ctx, result.notice);
  }

  if (result.text) return result.text;

  return renderState(session.state, ctx, 'Please choose a valid option.');
}

/** Marks abandoned sessions so the admin analytics separate them from completions. */
async function expireStaleSessions() {
  const { Op } = require('../models');
  const cutoff = new Date(Date.now() - env.ussd.sessionTimeout * 1000);
  const [count] = await UssdSession.update(
    { status: 'timeout', endedAt: new Date() },
    { where: { status: 'active', updatedAt: { [Op.lt]: cutoff } } }
  );
  if (count) logger.debug(`Expired ${count} stale USSD session(s)`);
  return count;
}

module.exports = { handleRequest, expireStaleSessions, states };
