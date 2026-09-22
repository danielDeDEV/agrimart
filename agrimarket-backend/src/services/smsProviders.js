const axios = require('axios');
const env = require('../config/env');
const logger = require('../utils/logger');
const { toInternational, normalizePhone } = require('../utils/helpers');

/**
 * Every provider exposes the same shape:
 *   send({ to, message, senderId })        -> { success, messageId, cost, raw, error }
 *   sendMany({ to: [...], message })       -> { success, results: [...], raw }   (optional)
 *   balance()                              -> { success, balance, currency }      (optional)
 *
 * The "mock" provider is the default so the whole platform — registration OTPs,
 * order alerts, price digests — works end to end on a laptop with XAMPP and no
 * telecom account. Swap SMS_PROVIDER in .env once real credentials exist.
 */

const mock = {
  name: 'mock',
  async send({ to, message }) {
    const messageId = `MOCK-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    logger.sms(`→ ${to}: ${message.replace(/\n/g, ' | ').substring(0, 120)}`);
    return {
      success: true,
      messageId,
      cost: 0.035,
      raw: { simulated: true, deliveredAt: new Date().toISOString() },
    };
  },
  async balance() {
    return { success: true, balance: null, currency: 'GHS', simulated: true };
  },
};

/**
 * Africa's Talking — the gateway this platform is built around.
 *
 * One request can carry many recipients, which is how a 06:30 price digest to
 * a few thousand farmers stays inside the rate limits. `enqueue` lets AT spool
 * large batches itself rather than answering slowly.
 * Docs: https://developers.africastalking.com/docs/sms/sending/bulk
 */

/** Per-recipient status codes AT returns, turned into something a person can act on. */
const AT_STATUS = {
  100: 'Processed',
  101: 'Sent',
  102: 'Queued by the gateway',
  401: 'Held for risk review by Africa\'s Talking',
  402: 'Sender ID is not valid or not approved for this account',
  403: 'Invalid phone number',
  404: 'This number type is not supported',
  405: 'Insufficient Africa\'s Talking credit — top up your account',
  406: 'This number is on your blacklist (the subscriber sent STOP)',
  407: 'Could not route the message to this network',
  409: 'Do-not-disturb rejection',
  500: 'Africa\'s Talking internal error',
  501: 'Gateway error',
  502: 'Rejected by the mobile network',
};
const AT_ACCEPTED = [100, 101, 102];

/** Remembers the last balance answer: see balance() for why this matters. */
let balanceCache = { value: null, at: 0, blockedUntil: 0, last: null };

const africastalking = {
  name: 'africastalking',

  /** Sandbox and live are different hosts; the username decides which. */
  host() {
    const { username, sandbox } = env.sms.africastalking;
    return sandbox || username === 'sandbox'
      ? 'https://api.sandbox.africastalking.com'
      : 'https://api.africastalking.com';
  },

  async request(path, body) {
    const { apiKey } = env.sms.africastalking;
    if (!apiKey) throw new Error('AT_API_KEY is not set in .env');
    const { data } = await axios.post(`${this.host()}${path}`, body.toString(), {
      headers: {
        apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      timeout: 30000,
    });
    return data;
  },

  /** Normalises one entry of AT's Recipients array. */
  readRecipient(r) {
    const code = Number(r?.statusCode);
    const accepted = AT_ACCEPTED.includes(code) || ['Success', 'Sent'].includes(r?.status);
    return {
      to: r?.number,
      success: accepted,
      messageId: r?.messageId,
      // AT reports cost as "GHS 0.0400" (or "0" when it did not charge)
      cost: parseFloat(String(r?.cost || '0').replace(/[^\d.]/g, '')) || 0,
      statusCode: code,
      error: accepted ? undefined : AT_STATUS[code] || r?.status || 'Rejected by the gateway',
    };
  },

  async send({ to, message, senderId }) {
    const { username } = env.sms.africastalking;
    try {
      const body = new URLSearchParams({
        username,
        to: toInternational(to),
        message,
        ...(senderId ? { from: senderId } : {}),
      });
      const data = await this.request('/version1/messaging', body);
      const recipient = data?.SMSMessageData?.Recipients?.[0];
      if (!recipient) {
        // No recipients back usually means the whole request was rejected
        return { success: false, error: data?.SMSMessageData?.Message || 'The gateway accepted no recipients', raw: data };
      }
      return { ...this.readRecipient(recipient), raw: data };
    } catch (err) {
      return { success: false, error: describeAxiosError(err) };
    }
  },

  /** One request for many numbers — used by broadcasts and the daily digest. */
  async sendMany({ to, message, senderId }) {
    const { username } = env.sms.africastalking;
    const numbers = to.map(toInternational).filter(Boolean);
    if (!numbers.length) return { success: false, error: 'No valid recipients', results: [] };

    try {
      const body = new URLSearchParams({
        username,
        to: numbers.join(','),
        message,
        bulkSMSMode: '1',
        enqueue: '1',
        ...(senderId ? { from: senderId } : {}),
      });
      const data = await this.request('/version1/messaging', body);
      const recipients = data?.SMSMessageData?.Recipients || [];
      const results = recipients.map((r) => this.readRecipient(r));
      if (!results.length) {
        return { success: false, error: data?.SMSMessageData?.Message || 'The gateway accepted no recipients', results: [], raw: data };
      }
      return { success: results.some((r) => r.success), results, raw: data };
    } catch (err) {
      return { success: false, error: describeAxiosError(err), results: [] };
    }
  },

  /** Remaining SMS credit, shown in the admin SMS centre. */
  async balance() {
    const { apiKey, username } = env.sms.africastalking;
    if (!apiKey) return { success: false, error: 'AT_API_KEY is not set in .env' };

    // Africa's Talking blocks an account for a while after repeated rejected
    // calls, which would take SMS sending down with it. Newer API keys often
    // cannot read the balance at all, so a refused balance check backs right
    // off instead of being retried on every admin page load.
    const now = Date.now();
    if (balanceCache.blockedUntil > now) return { ...balanceCache.last };
    if (balanceCache.value && now - balanceCache.at < 5 * 60 * 1000) return { ...balanceCache.value };

    try {
      const { data } = await axios.get(`${this.host()}/version1/user`, {
        params: { username },
        headers: { apiKey, Accept: 'application/json' },
        timeout: 20000,
      });
      // "GHS 4,213.5000"
      const raw = data?.UserData?.balance || '';
      const [currency, amount] = String(raw).split(/\s+/);
      const result = {
        success: !!raw,
        balance: amount ? Number(amount.replace(/,/g, '')) : null,
        currency: currency || 'GHS',
        raw: data,
      };
      balanceCache = { value: result, at: Date.now(), blockedUntil: 0, last: result };
      return result;
    } catch (err) {
      const denied = err.response?.status === 401;
      const result = {
        success: false,
        unsupported: denied,
        error: denied
          ? "This API key cannot read the account balance. Sending is unaffected — check your credit in the Africa's Talking dashboard."
          : describeAxiosError(err),
      };
      // Stop asking for an hour so we never trip the gateway's abuse guard
      balanceCache = { value: null, at: 0, blockedUntil: Date.now() + 60 * 60 * 1000, last: result };
      return result;
    }
  },
};

const hubtel = {
  name: 'hubtel',
  async send({ to, message, senderId }) {
    const { clientId, clientSecret } = env.sms.hubtel;
    if (!clientId || !clientSecret) return { success: false, error: 'Hubtel credentials are not configured' };

    try {
      const { data } = await axios.get('https://smsc.hubtel.com/v1/messages/send', {
        params: {
          clientid: clientId,
          clientsecret: clientSecret,
          from: senderId || env.sms.senderId,
          to: toInternational(to).replace('+', ''),
          content: message,
        },
        timeout: 20000,
      });
      return {
        success: data?.status === 0 || data?.Status === 0,
        messageId: data?.messageId || data?.MessageId,
        cost: data?.rate || 0,
        raw: data,
      };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || err.message };
    }
  },
};

const mnotify = {
  name: 'mnotify',
  async send({ to, message, senderId }) {
    const { apiKey } = env.sms.mnotify;
    if (!apiKey) return { success: false, error: 'MNOTIFY_API_KEY is not configured' };

    try {
      const { data } = await axios.post(
        `https://api.mnotify.com/api/sms/quick?key=${apiKey}`,
        {
          recipient: [normalizePhone(to)],
          sender: senderId || env.sms.senderId,
          message,
          is_schedule: false,
        },
        { timeout: 20000 }
      );
      return {
        success: data?.status === 'success',
        messageId: data?.summary?._id || data?.summary?.campaign_id,
        cost: data?.summary?.credit_used || 0,
        raw: data,
        error: data?.status === 'success' ? undefined : data?.message,
      };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || err.message };
    }
  },
};

const twilio = {
  name: 'twilio',
  async send({ to, message }) {
    const { accountSid, authToken, phoneNumber } = env.sms.twilio;
    if (!accountSid || !authToken) return { success: false, error: 'Twilio credentials are not configured' };

    try {
      const body = new URLSearchParams({
        To: toInternational(to),
        From: phoneNumber,
        Body: message,
      });
      const { data } = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        body.toString(),
        {
          auth: { username: accountSid, password: authToken },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 20000,
        }
      );
      return {
        success: ['queued', 'sent', 'accepted'].includes(data?.status),
        messageId: data?.sid,
        cost: Math.abs(parseFloat(data?.price || 0)),
        raw: data,
      };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || err.message };
    }
  },
};

/** Gateway errors arrive in several shapes; show the most useful one. */
function describeAxiosError(err) {
  const data = err.response?.data;
  const detail = typeof data === 'string' ? data : data?.SMSMessageData?.Message || data?.message || data?.error;
  if (err.response?.status === 401) {
    // Also what the gateway returns while an account is in a cooldown after
    // repeated rejected requests, so do not blame the key outright.
    return "Africa's Talking refused the request (401). Check AT_API_KEY and AT_USERNAME - or wait a few minutes if several sends were just rejected, as the gateway pauses an account after those.";
  }
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') return 'Could not reach the gateway — check the internet connection.';
  if (err.code === 'ECONNABORTED') return 'The gateway did not respond in time.';
  return detail || err.message;
}

const providers = { mock, africastalking, hubtel, mnotify, twilio };

function getProvider(name = env.sms.provider) {
  const provider = providers[String(name).toLowerCase()];
  if (!provider) {
    logger.warn(`Unknown SMS provider "${name}" — falling back to mock`);
    return mock;
  }
  return provider;
}

module.exports = { providers, getProvider };
