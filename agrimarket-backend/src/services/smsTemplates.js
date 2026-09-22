const { formatMoneyShort, maskPhone } = require('../utils/helpers');
const env = require('../config/env');
const { supportLine } = require('./settingsService');

/**
 * SMS copy for feature phones. Rules we follow everywhere in this file:
 *  - stay inside 160 GSM-7 characters where possible (1 paid segment)
 *  - lead with the AgriMart tag, for when messages go out from a shared
 *    number; smsService drops it when an approved sender ID already shows
 *    "AgriMart" as the sender (see withBrand)
 *  - always include the short code (LST-XXXX / ORD-XXXX) that can be replied with
 *  - no emoji or curly quotes: they force UCS-2 and halve the segment length
 */

const tag = 'AgriMart';

const templates = {
  otp: ({ code, purpose }) =>
    `${tag}: Your ${purpose === 'login' ? 'login' : 'verification'} code is ${code}. It expires in 10 minutes. Do not share it with anyone.`,

  welcomeFarmer: ({ name, serviceCode }) =>
    `Welcome to ${tag}, ${name}! You can now sell your produce to buyers across Ghana. Dial ${serviceCode} anytime to list produce or check market prices. No internet needed.`,

  welcomeBuyer: ({ name, serviceCode }) =>
    `Welcome to ${tag}, ${name}! Browse verified farm produce from across Ghana. Dial ${serviceCode} to search produce and place orders.`,

  listingCreated: ({ code, produce, quantity, unit, price }) =>
    `${tag}: Your listing is live. ${code} - ${quantity} ${unit} of ${produce} at ${formatMoneyShort(price)}/${unit}. Buyers will contact you. Dial ${env.ussd.serviceCode} to manage.`,

  listingPending: ({ code, produce, quantity, unit }) =>
    `${tag}: We received your listing ${code} - ${quantity} ${unit} of ${produce}. It goes live as soon as our team reviews it, usually within a few hours.`,

  listingApproved: ({ code, produce }) =>
    `${tag}: Your ${produce} listing ${code} has been approved and is now visible to buyers nationwide.`,

  listingRejected: ({ code, reason }) =>
    `${tag}: Listing ${code} was not approved. Reason: ${reason}. Dial ${env.ussd.serviceCode} to edit and resubmit.`,

  newOrderFarmer: ({ orderCode, produce, quantity, unit, amount, buyerName, buyerPhone }) =>
    `${tag}: NEW ORDER ${orderCode}. ${buyerName} wants ${quantity} ${unit} of ${produce} for ${formatMoneyShort(amount)}. Call ${buyerPhone}. Dial ${env.ussd.serviceCode} and choose 5 to accept.`,

  orderPlacedBuyer: ({ orderCode, produce, quantity, unit, amount, farmerName }) =>
    `${tag}: Order ${orderCode} placed. ${quantity} ${unit} of ${produce} from ${farmerName}, total ${formatMoneyShort(amount)}. You will be notified when the farmer responds.`,

  orderAccepted: ({ orderCode, farmerName, farmerPhone, produce }) =>
    `${tag}: Good news! ${farmerName} accepted order ${orderCode} for your ${produce}. Contact the farmer on ${farmerPhone} to arrange pickup and payment.`,

  orderRejected: ({ orderCode, reason }) =>
    `${tag}: Order ${orderCode} was declined by the farmer.${reason ? ` Reason: ${reason}.` : ''} Browse other listings by dialling ${env.ussd.serviceCode}.`,

  orderCompleted: ({ orderCode, amount }) =>
    `${tag}: Order ${orderCode} is complete. Amount: ${formatMoneyShort(amount)}. Thank you for trading on ${tag}. Reply with a rating on the website.`,

  orderCancelled: ({ orderCode, reason }) =>
    `${tag}: Order ${orderCode} has been cancelled.${reason ? ` Reason: ${reason}.` : ''}`,

  newOffer: ({ listingCode, produce, offerPrice, unit, quantity, buyerName }) =>
    `${tag}: ${buyerName} offered ${formatMoneyShort(offerPrice)}/${unit} for ${quantity} ${unit} of your ${produce} (${listingCode}). Dial ${env.ussd.serviceCode} choose 3 to respond.`,

  offerAccepted: ({ listingCode, produce, price, farmerPhone }) =>
    `${tag}: Your offer on ${listingCode} (${produce}) at ${formatMoneyShort(price)} was ACCEPTED. Call the farmer on ${farmerPhone} to complete the deal.`,

  offerRejected: ({ listingCode, produce }) =>
    `${tag}: Your offer on ${listingCode} (${produce}) was declined. You can send a new offer or browse other listings.`,

  priceAlert: ({ produce, market, price, unit, direction, target }) =>
    `${tag} PRICE ALERT: ${produce} at ${market} is now ${formatMoneyShort(price)}/${unit}, ${direction} your target of ${formatMoneyShort(target)}. Good time to ${direction === 'above' ? 'sell' : 'buy'}.`,

  priceDigest: ({ marketName, lines, date }) =>
    `${tag} PRICES ${date} - ${marketName}:\n${lines.join('\n')}\nDial ${env.ussd.serviceCode} for more markets.`,

  paymentReceived: ({ orderCode, amount, balance }) =>
    `${tag}: Payment of ${formatMoneyShort(amount)} received for order ${orderCode}. Wallet balance: ${formatMoneyShort(balance)}.`,

  payoutSent: ({ amount, reference, momoNumber }) =>
    `${tag}: ${formatMoneyShort(amount)} has been sent to your MoMo ${maskPhone(momoNumber)}. Ref: ${reference}. Thank you for selling with us.`,

  pinReset: ({ code }) =>
    `${tag}: Your PIN reset code is ${code}. Dial ${env.ussd.serviceCode}, choose 6 then 3, and enter this code. Expires in 10 minutes.`,

  accountSuspended: ({ reason }) =>
    `${tag}: Your account has been suspended. Reason: ${reason}. Contact support on ${supportLine()} for help.`,

  accountReactivated: () =>
    `${tag}: Your account has been reactivated. Dial ${env.ussd.serviceCode} to continue trading. Support: ${supportLine()}.`,

  supportTicket: ({ code }) =>
    `${tag}: We received your request (${code}). Our team will respond within 24 hours. Thank you for your patience.`,

  farmingTip: ({ title, body }) => `${tag} TIP - ${title}: ${body}`,

  buyerLead: ({ produce, quantity, unit, region, buyerPhone }) =>
    `${tag} BUYER WANTED: Looking for ${quantity} ${unit} of ${produce} in ${region}. Call ${buyerPhone} if you can supply.`,
};

/** Render a template by name; unknown names fall back to the raw payload text. */
function render(name, payload = {}) {
  const fn = templates[name];
  if (!fn) return payload.message || '';
  return fn(payload);
}

module.exports = { templates, render };
