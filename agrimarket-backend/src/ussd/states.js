/* eslint-disable no-use-before-define */
const env = require('../config/env');
const {
  User, Region, District, Category, Produce, Listing, Order, Market,
  PriceAlert, SupportTicket, Op,
} = require('../models');
const {
  CON, END, paginatedScreen, readNavigation, pick,
  isDecimal, isPin, fit, fitWithFooter, shortName,
} = require('./menu');
const { t } = require('./i18n');
const { createListing } = require('../services/listingService');
const { createOrder, updateOrderStatus } = require('../services/orderService');
const { latestPrices, buildPriceDigest } = require('../services/priceService');
const { sendSms } = require('../services/smsService');
const { demoEnd } = require('./demo');
const { formatMoneyShort, generateCode, normalizePhone } = require('../utils/helpers');
const logger = require('../utils/logger');
const { supportLine, get: setting } = require('../services/settingsService');

/**
 * Every screen of the AgriMart USSD service.
 *
 * A state is `{ render(ctx), handle(ctx) }`:
 *   render — the text shown when the farmer arrives at this screen
 *   handle — interprets the digits they typed and returns a directive:
 *              { goto: 'STATE', data }   move on (data merges into the session)
 *              { end: 'text' }           close the session with a final screen
 *              { repeat: 'error' }       redraw this screen with an error on top
 *
 * `ctx` carries { input, user, data, session, lang, set(patch) }.
 */

/* ────────────────────────────── helpers ─────────────────────────────── */

const money = (n) => formatMoneyShort(n);

/** Routes to AUTH_PIN first when the account has a PIN set. */
const requirePin = (ctx, nextState, extra = {}) => {
  if (ctx.data.authed || !ctx.user?.pin) return { goto: nextState, data: extra };
  return { goto: 'AUTH_PIN', data: { ...extra, pinNext: nextState } };
};

const backToMenu = () => ({ goto: 'MAIN_MENU' });

async function loadRegions() {
  const rows = await Region.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });
  return rows.map((r) => ({ id: r.id, label: r.name }));
}

async function loadDistricts(regionId) {
  const rows = await District.findAll({ where: { regionId, isActive: true }, order: [['name', 'ASC']] });
  return rows.map((r) => ({ id: r.id, label: r.name }));
}

async function loadCategories() {
  const rows = await Category.findAll({ where: { isActive: true }, order: [['sortOrder', 'ASC'], ['name', 'ASC']] });
  return rows.map((r) => ({ id: r.id, label: r.name }));
}

async function loadProduce(categoryId) {
  const rows = await Produce.findAll({
    where: { categoryId, isActive: true },
    order: [['ussdIndex', 'ASC'], ['name', 'ASC']],
  });
  return rows.map((r) => ({ id: r.id, label: r.name, unit: r.defaultUnit, units: r.units }));
}

/**
 * Generic paginated picker. Used by every "choose from a list" screen so
 * navigation (99 next / 98 prev / 0 back) behaves identically everywhere.
 */
function picker({ title, listKey, loader, onPick, backState, emptyMessage }) {
  const pageKey = `${listKey}Page`;
  return {
    async render(ctx) {
      const items = await loader(ctx);
      // Only the page number is kept in the session — re-querying on the next
      // step keeps USSD session rows tiny and always in step with the database.
      ctx.set({ [pageKey]: ctx.data[pageKey] || 0 });
      if (!items.length) return CON(`${emptyMessage || 'Nothing available right now.'}\n0. ${t('back', ctx.lang)}`);
      const screen = paginatedScreen(title, items, ctx.data[pageKey] || 0);
      return CON(fit(screen.text));
    },
    async handle(ctx) {
      const items = await loader(ctx);
      const page = ctx.data[pageKey] || 0;
      const totalPages = Math.max(1, Math.ceil(items.length / 5));
      const nav = readNavigation(ctx.input, page, totalPages);

      if (nav.type === 'back') return { goto: backState, data: { [pageKey]: 0 } };
      if (nav.type === 'next' || nav.type === 'prev') {
        return { redraw: true, data: { [pageKey]: nav.page } };
      }

      const visible = items.slice(page * 5, page * 5 + 5);
      const chosen = pick(visible, ctx.input);
      if (!chosen) return { repeat: t('invalidOption', ctx.lang) };
      return onPick(ctx, chosen);
    },
  };
}

/* ───────────────────────────── the states ───────────────────────────── */

const states = {};

/* — Entry for people we have never seen before — */
states.WELCOME_NEW = {
  render(ctx) {
    return CON(
      `Welcome to AgriMart Ghana\n` +
      `Sell your farm produce to buyers nationwide. No internet needed.\n\n` +
      `1. Register (free)\n2. Check market prices\n3. About AgriMart`
    );
  },
  handle(ctx) {
    switch (ctx.input) {
      case '1':
        if (!setting('registration_open')) {
          return { end: 'New registrations are paused at the moment. Please try again later.' };
        }
        return { goto: 'REG_NAME' };
      case '2': return { goto: 'PRICE_CATEGORY', data: { priceGuest: true } };
      case '3':
        return {
          end:
            'AgriMart Ghana connects smallholder farmers directly to buyers. ' +
            'List produce, see live market prices and get SMS alerts - all on a basic phone. ' +
            `Dial ${env.ussd.serviceCode} to register free.`,
        };
      default: return { repeat: 'Invalid choice.' };
    }
  },
};

/* — Registration — */
states.REG_NAME = {
  render() { return CON(`${t('enterName')}\n(e.g. Kwame Mensah)`); },
  handle(ctx) {
    const name = String(ctx.input || '').trim();
    if (name.length < 3 || !/[a-zA-Z]/.test(name)) return { repeat: 'Please enter your full name.' };
    return { goto: 'REG_ROLE', data: { regName: name.substring(0, 100) } };
  },
};

states.REG_ROLE = {
  render(ctx) {
    return CON(`Hello ${String(ctx.data.regName).split(' ')[0]}, what do you do?\n1. I am a Farmer (I sell produce)\n2. I am a Buyer (I buy produce)`);
  },
  handle(ctx) {
    const role = { 1: 'farmer', 2: 'buyer' }[ctx.input];
    if (!role) return { repeat: 'Invalid choice.' };
    return { goto: 'REG_REGION', data: { regRole: role } };
  },
};

states.REG_REGION = picker({
  title: 'Select your region:',
  listKey: 'regionList',
  loader: () => loadRegions(),
  backState: 'WELCOME_NEW',
  onPick: (ctx, chosen) => ({ goto: 'REG_DISTRICT', data: { regRegionId: chosen.id, regRegionName: chosen.label } }),
});

states.REG_DISTRICT = picker({
  title: 'Select your district:',
  listKey: 'districtList',
  loader: (ctx) => loadDistricts(ctx.data.regRegionId),
  backState: 'REG_REGION',
  emptyMessage: 'No districts listed for that region.',
  onPick: (ctx, chosen) => ({ goto: 'REG_COMMUNITY', data: { regDistrictId: chosen.id, regDistrictName: chosen.label } }),
});

states.REG_COMMUNITY = {
  render(ctx) { return CON(`Enter your town or community name\n(e.g. Ejura)\n\n0. Skip`); },
  handle(ctx) {
    const value = String(ctx.input || '').trim();
    return { goto: 'REG_PIN', data: { regCommunity: value === '0' ? null : value.substring(0, 100) } };
  },
};

states.REG_PIN = {
  render() { return CON(`${t('createPin')}\nYou will use this PIN to sell and buy.`); },
  handle(ctx) {
    // Any four digits the farmer chooses — no pattern rules to memorise
    if (!isPin(ctx.input)) return { repeat: 'PIN must be exactly 4 digits.' };
    return { goto: 'REG_PIN_CONFIRM', data: { regPin: ctx.input } };
  },
};

states.REG_PIN_CONFIRM = {
  render() { return CON(t('confirmPin')); },
  async handle(ctx) {
    if (ctx.input !== ctx.data.regPin) {
      return { goto: 'REG_PIN', data: { regPin: null }, notice: 'PINs did not match. Try again.' };
    }

    const d = ctx.data;
    if (ctx.demo) {
      return demoEnd(`Registration complete! Welcome ${d.regName}.\nYour PIN is set and you can now sell and buy.`);
    }
    const user = await User.create({
      fullName: d.regName,
      phone: ctx.phone,
      role: d.regRole,
      pin: d.regPin,
      regionId: d.regRegionId,
      districtId: d.regDistrictId,
      community: d.regCommunity,
      language: 'en',
      network: ctx.network,
      isPhoneVerified: true,
      registrationChannel: 'ussd',
      status: 'active',
    });

    await sendSms({
      to: user.phone,
      userId: user.id,
      template: d.regRole === 'farmer' ? 'welcomeFarmer' : 'welcomeBuyer',
      data: { name: user.firstName(), serviceCode: env.ussd.serviceCode },
      type: 'welcome',
      force: true,
    });

    ctx.session.userId = user.id;
    ctx.session.outcome = 'registered';
    ctx.user = user;

    return {
      goto: 'MAIN_MENU',
      data: { authed: true, justRegistered: true },
      notice: `Registration successful! Welcome ${user.firstName()}.`,
    };
  },
};

/* — PIN gate — */
states.AUTH_PIN = {
  render(ctx) { return CON(`${t('enterPin', ctx.lang)}:`); },
  async handle(ctx) {
    if (!isPin(ctx.input)) return { repeat: 'PIN must be 4 digits.' };
    const ok = await ctx.user.comparePin(ctx.input);
    if (!ok) {
      const attempts = (ctx.data.pinAttempts || 0) + 1;
      if (attempts >= 3) {
        return { end: `Incorrect PIN entered 3 times. For your security this session has ended. Dial ${env.ussd.serviceCode} to try again.` };
      }
      return { repeat: `Incorrect PIN. ${3 - attempts} attempt(s) left.`, data: { pinAttempts: attempts } };
    }
    return { goto: ctx.data.pinNext || 'MAIN_MENU', data: { authed: true, pinAttempts: 0 } };
  },
};

/* — Main menu — */
states.MAIN_MENU = {
  render(ctx) {
    const name = ctx.user ? ctx.user.firstName() : '';
    const lang = ctx.lang;
    const isFarmer = ctx.user?.role !== 'buyer';
    const rows = isFarmer
      ? [t('sell', lang), t('prices', lang), t('myListings', lang), t('buy', lang), t('myOrders', lang), t('account', lang), t('help', lang)]
      : [t('buy', lang), t('prices', lang), t('myOrders', lang), t('sell', lang), t('myListings', lang), t('account', lang), t('help', lang)];

    return CON(`AgriMart - Hi ${name}\n${rows.map((r, i) => `${i + 1}. ${r}`).join('\n')}`);
  },
  handle(ctx) {
    const isFarmer = ctx.user?.role !== 'buyer';
    const farmerMap = {
      1: () => requirePin(ctx, 'SELL_CATEGORY'),
      2: () => ({ goto: 'PRICE_CATEGORY' }),
      3: () => ({ goto: 'MY_LISTINGS' }),
      4: () => ({ goto: 'BUY_CATEGORY' }),
      5: () => ({ goto: 'MY_ORDERS' }),
      6: () => requirePin(ctx, 'ACCOUNT_MENU'),
      7: () => ({ goto: 'HELP_MENU' }),
    };
    const buyerMap = {
      1: () => ({ goto: 'BUY_CATEGORY' }),
      2: () => ({ goto: 'PRICE_CATEGORY' }),
      3: () => ({ goto: 'MY_ORDERS' }),
      4: () => requirePin(ctx, 'SELL_CATEGORY'),
      5: () => ({ goto: 'MY_LISTINGS' }),
      6: () => requirePin(ctx, 'ACCOUNT_MENU'),
      7: () => ({ goto: 'HELP_MENU' }),
    };
    const fn = (isFarmer ? farmerMap : buyerMap)[ctx.input];
    if (!fn) return { repeat: t('invalidOption', ctx.lang) };
    return fn();
  },
};

/* — Sell flow (objective 1) — */
states.SELL_CATEGORY = picker({
  title: 'What are you selling?',
  listKey: 'sellCats',
  loader: () => loadCategories(),
  backState: 'MAIN_MENU',
  onPick: (ctx, chosen) => ({ goto: 'SELL_PRODUCE', data: { sellCategoryId: chosen.id, sellProducePage: 0 } }),
});

states.SELL_PRODUCE = picker({
  title: 'Select produce:',
  listKey: 'sellProduce',
  loader: (ctx) => loadProduce(ctx.data.sellCategoryId),
  backState: 'SELL_CATEGORY',
  emptyMessage: 'No produce in that category yet.',
  onPick: (ctx, chosen) => ({
    goto: 'SELL_UNIT',
    data: { sellProduceId: chosen.id, sellProduceName: chosen.label, sellUnits: chosen.units || ['bag', 'kg'] },
  }),
});

states.SELL_UNIT = {
  render(ctx) {
    const units = ctx.data.sellUnits || ['bag', 'kg'];
    return CON(`${ctx.data.sellProduceName} - choose unit:\n${units.map((u, i) => `${i + 1}. ${u}`).join('\n')}`);
  },
  handle(ctx) {
    const units = ctx.data.sellUnits || ['bag', 'kg'];
    const unit = units[parseInt(ctx.input, 10) - 1];
    if (!unit) return { repeat: t('invalidOption', ctx.lang) };
    return { goto: 'SELL_QUANTITY', data: { sellUnit: unit } };
  },
};

states.SELL_QUANTITY = {
  render(ctx) { return CON(`How many ${ctx.data.sellUnit} of ${ctx.data.sellProduceName} do you have?\nEnter a number:`); },
  handle(ctx) {
    if (!isDecimal(ctx.input) || Number(ctx.input) <= 0) return { repeat: 'Enter a valid quantity, e.g. 25' };
    if (Number(ctx.input) > 100000) return { repeat: 'That quantity is too large. Enter a realistic number.' };
    return { goto: 'SELL_PRICE', data: { sellQuantity: Number(ctx.input) } };
  },
};

states.SELL_PRICE = {
  async render(ctx) {
    // Show the prevailing market price so the farmer prices with information,
    // not guesswork — this is objective 3 doing its job inside the sell flow.
    let hint = '';
    try {
      const rows = await latestPrices({ produceId: ctx.data.sellProduceId, limit: 5 });
      const match = rows.find((r) => r.unit === ctx.data.sellUnit) || rows[0];
      if (match) hint = `\nMarket today: ${money(match.avgPrice)}/${match.unit} at ${match.market?.name}`;
    } catch { /* pricing hint is best-effort */ }

    return CON(`Price per ${ctx.data.sellUnit} in GHS?${hint}\nEnter amount:`);
  },
  handle(ctx) {
    if (!isDecimal(ctx.input) || Number(ctx.input) <= 0) return { repeat: 'Enter a valid price, e.g. 450' };
    return { goto: 'SELL_QUALITY', data: { sellPrice: Number(ctx.input) } };
  },
};

states.SELL_QUALITY = {
  render() { return CON('Quality grade:\n1. Grade A (best)\n2. Grade B (good)\n3. Grade C (fair)'); },
  handle(ctx) {
    const grade = { 1: 'A', 2: 'B', 3: 'C' }[ctx.input];
    if (!grade) return { repeat: 'Choose 1, 2 or 3.' };
    return { goto: 'SELL_CONFIRM', data: { sellGrade: grade } };
  },
};

states.SELL_CONFIRM = {
  render(ctx) {
    const d = ctx.data;
    const total = d.sellQuantity * d.sellPrice;
    return CON(
      `Confirm your listing:\n` +
      `${d.sellProduceName}\n` +
      `${d.sellQuantity} ${d.sellUnit} at ${money(d.sellPrice)}/${d.sellUnit}\n` +
      `Grade ${d.sellGrade}. Total ${money(total)}\n\n1. Publish\n2. Cancel`
    );
  },
  async handle(ctx) {
    if (ctx.input === '2') return { end: `Listing cancelled. Dial ${env.ussd.serviceCode} when you are ready.` };
    if (ctx.input !== '1') return { repeat: 'Press 1 to publish or 2 to cancel.' };

    const d = ctx.data;
    if (ctx.demo) {
      return demoEnd(`Your ${d.sellProduceName} is now listed!\nCode: LST-DEMO\nBuyers see it online with a photo of ${d.sellProduceName}.`);
    }
    try {
      const listing = await createListing({
        farmerId: ctx.user.id,
        produceId: d.sellProduceId,
        quantity: d.sellQuantity,
        unit: d.sellUnit,
        pricePerUnit: d.sellPrice,
        qualityGrade: d.sellGrade,
        harvestDate: new Date().toISOString().slice(0, 10),
      }, { channel: 'ussd' });

      ctx.session.outcome = 'listing_created';

      return {
        end:
          listing.status === 'pending'
            ? `Listing received!\nCode: ${listing.code}\nOur team reviews it shortly, then buyers can see your ${d.sellProduceName}. We will SMS you.`
            : `Your ${d.sellProduceName} is now listed!\n` +
              `Code: ${listing.code}\n` +
              `Buyers see it online with a photo of ${d.sellProduceName}. We will SMS you when someone orders.`,
      };
    } catch (err) {
      logger.error('USSD listing failed:', err.message);
      return { end: `Sorry, we could not publish your listing: ${err.message}` };
    }
  },
};

/* — Market prices (objective 3) — */
states.PRICE_CATEGORY = picker({
  title: 'Check prices for:',
  listKey: 'priceCats',
  loader: () => loadCategories(),
  backState: 'MAIN_MENU',
  onPick: (ctx, chosen) => ({ goto: 'PRICE_PRODUCE', data: { priceCategoryId: chosen.id, priceProducePage: 0 } }),
});

states.PRICE_PRODUCE = picker({
  title: 'Select produce:',
  listKey: 'priceProduce',
  loader: (ctx) => loadProduce(ctx.data.priceCategoryId),
  backState: 'PRICE_CATEGORY',
  onPick: (ctx, chosen) => ({ goto: 'PRICE_SCOPE', data: { priceProduceId: chosen.id, priceProduceName: chosen.label } }),
});

states.PRICE_SCOPE = {
  render(ctx) {
    const region = ctx.user?.regionId ? 'my region' : 'nearest region';
    return CON(`${ctx.data.priceProduceName} prices:\n1. Major markets\n2. In ${region}\n3. Best price nationwide`);
  },
  handle(ctx) {
    if (!['1', '2', '3'].includes(ctx.input)) return { repeat: t('invalidOption', ctx.lang) };
    return { goto: 'PRICE_RESULT', data: { priceScope: ctx.input } };
  },
};

states.PRICE_RESULT = {
  async render(ctx) {
    const d = ctx.data;
    const filter = { produceId: d.priceProduceId, limit: 50 };
    if (d.priceScope === '2' && ctx.user?.regionId) filter.regionId = ctx.user.regionId;

    let rows = await latestPrices(filter);
    if (!rows.length && filter.regionId) rows = await latestPrices({ produceId: d.priceProduceId, limit: 50 });
    if (!rows.length) return CON(`No price data for ${d.priceProduceName} yet.\n\n0. Main menu`);

    rows.sort((a, b) => (d.priceScope === '3' ? b.avgPrice - a.avgPrice : 0));
    const top = rows.slice(0, 4);

    const bodyLines = top.map((r) => {
      const arrow = r.trend === 'up' ? '+' : r.trend === 'down' ? '-' : '=';
      return `${shortName(r.market?.name)} ${Math.round(r.avgPrice)}${arrow}`;
    });

    ctx.session.outcome = 'price_checked';

    return CON(
      fitWithFooter(
        `${d.priceProduceName} GHS/${top[0]?.unit || 'unit'}:`,
        bodyLines,
        ['1. SMS me this list', '2. Set a price alert', '0. Main menu']
      )
    );
  },
  async handle(ctx) {
    if (ctx.input === '0') return backToMenu();

    if (ctx.input === '1') {
      if (!ctx.user) return { end: `Register first to receive SMS price updates. Dial ${env.ussd.serviceCode} and choose 1.` };
      if (ctx.demo) return demoEnd(`Prices for ${ctx.data.priceProduceName} have been sent to ${ctx.phone} by SMS.`);
      const digest = await buildPriceDigest({ produceIds: [ctx.data.priceProduceId], limit: 6 });
      await sendSms({
        to: ctx.phone,
        userId: ctx.user.id,
        template: 'priceDigest',
        data: digest,
        type: 'price_digest',
      });
      return { end: `Prices for ${ctx.data.priceProduceName} have been sent to ${ctx.phone} by SMS. Check your inbox.` };
    }

    if (ctx.input === '2') {
      if (!ctx.user) return { end: `Register first to use price alerts. Dial ${env.ussd.serviceCode} and choose 1.` };
      return { goto: 'ALERT_TARGET' };
    }

    return { repeat: t('invalidOption', ctx.lang) };
  },
};

states.ALERT_TARGET = {
  render(ctx) {
    return CON(`Price alert for ${ctx.data.priceProduceName}.\nTell us the price in GHS and we will SMS you when the market reaches it.\n\nEnter target price:`);
  },
  handle(ctx) {
    if (!isDecimal(ctx.input) || Number(ctx.input) <= 0) return { repeat: 'Enter a valid amount, e.g. 500' };
    return { goto: 'ALERT_DIRECTION', data: { alertTarget: Number(ctx.input) } };
  },
};

states.ALERT_DIRECTION = {
  render(ctx) {
    return CON(`Alert me when ${ctx.data.priceProduceName} price is:\n1. ${money(ctx.data.alertTarget)} or ABOVE (good to sell)\n2. ${money(ctx.data.alertTarget)} or BELOW (good to buy)`);
  },
  async handle(ctx) {
    const direction = { 1: 'above', 2: 'below' }[ctx.input];
    if (!direction) return { repeat: t('invalidOption', ctx.lang) };

    if (ctx.demo) {
      return demoEnd(`Alert saved. We will SMS you when ${ctx.data.priceProduceName} goes ${direction} ${money(ctx.data.alertTarget)}.`);
    }

    await PriceAlert.create({
      userId: ctx.user.id,
      produceId: ctx.data.priceProduceId,
      targetPrice: ctx.data.alertTarget,
      direction,
      regionId: ctx.user.regionId,
      source: 'ussd',
    });

    return {
      end: `Alert saved. We will SMS you when ${ctx.data.priceProduceName} goes ${direction} ${money(ctx.data.alertTarget)}.`,
    };
  },
};

/* — My listings — */
states.MY_LISTINGS = picker({
  title: 'Your listings:',
  listKey: 'myListings',
  backState: 'MAIN_MENU',
  emptyMessage: 'You have no active listings. Choose 1 from the main menu to sell.',
  loader: async (ctx) => {
    const rows = await Listing.findAll({
      where: { farmerId: ctx.user.id, status: ['active', 'reserved', 'pending'] },
      include: [{ model: Produce, as: 'produce', attributes: ['name'] }],
      order: [['createdAt', 'DESC']],
      limit: 30,
    });
    return rows.map((r) => ({
      id: r.id,
      label: `${r.produce?.name} ${r.quantityRemaining}${r.unit} @${Math.round(r.pricePerUnit)}`,
      code: r.code,
    }));
  },
  onPick: (ctx, chosen) => ({ goto: 'LISTING_DETAIL', data: { listingId: chosen.id } }),
});

states.LISTING_DETAIL = {
  async render(ctx) {
    const l = await Listing.findByPk(ctx.data.listingId, { include: [{ model: Produce, as: 'produce' }] });
    if (!l) return CON('Listing not found.\n0. Back');
    const orders = await Order.count({ where: { listingId: l.id, status: 'pending' } });
    return CON(fitWithFooter(
      `${l.code} ${l.produce?.name}`,
      [
        `${l.quantityRemaining}/${l.quantity} ${l.unit} left`,
        `${money(l.pricePerUnit)}/${l.unit}`,
        `${l.views} views, ${orders} pending order(s)`,
      ],
      ['1. Change price', '2. Mark as sold', '3. Remove listing', '0. Back']
    ));
  },
  async handle(ctx) {
    switch (ctx.input) {
      case '0': return { goto: 'MY_LISTINGS' };
      case '1': return { goto: 'LISTING_NEW_PRICE' };
      case '2': {
        const l = await Listing.findByPk(ctx.data.listingId);
        if (ctx.demo) return demoEnd(`${l.code} marked as sold. Well done!`);
        await l.update({ status: 'sold', soldAt: new Date(), quantityRemaining: 0 });
        return { end: `${l.code} marked as sold. Well done!` };
      }
      case '3': {
        const l = await Listing.findByPk(ctx.data.listingId);
        if (ctx.demo) return demoEnd(`${l.code} has been removed from the marketplace.`);
        await l.update({ status: 'withdrawn' });
        return { end: `${l.code} has been removed from the marketplace.` };
      }
      default: return { repeat: t('invalidOption', ctx.lang) };
    }
  },
};

states.LISTING_NEW_PRICE = {
  render() { return CON('Enter the new price per unit in GHS:'); },
  async handle(ctx) {
    if (!isDecimal(ctx.input) || Number(ctx.input) <= 0) return { repeat: 'Enter a valid price.' };
    const l = await Listing.findByPk(ctx.data.listingId);
    if (ctx.demo) return demoEnd(`Price for ${l.code} updated to ${money(ctx.input)} per ${l.unit}.`);
    await l.update({ pricePerUnit: Number(ctx.input) });
    return { end: `Price for ${l.code} updated to ${money(ctx.input)} per ${l.unit}.` };
  },
};

/* — Buy flow — */
states.BUY_CATEGORY = picker({
  title: 'What do you want to buy?',
  listKey: 'buyCats',
  loader: () => loadCategories(),
  backState: 'MAIN_MENU',
  onPick: (ctx, chosen) => ({ goto: 'BUY_PRODUCE', data: { buyCategoryId: chosen.id, buyProducePage: 0 } }),
});

states.BUY_PRODUCE = picker({
  title: 'Select produce:',
  listKey: 'buyProduce',
  loader: (ctx) => loadProduce(ctx.data.buyCategoryId),
  backState: 'BUY_CATEGORY',
  onPick: (ctx, chosen) => ({
    goto: 'BUY_RESULTS',
    data: { buyProduceId: chosen.id, buyProduceName: chosen.label, buyResultsPage: 0 },
  }),
});

states.BUY_RESULTS = picker({
  title: 'Available now:',
  listKey: 'buyResults',
  backState: 'BUY_PRODUCE',
  emptyMessage: 'No farmer is selling that right now. Try another produce.',
  loader: async (ctx) => {
    const rows = await Listing.findAll({
      where: { produceId: ctx.data.buyProduceId, status: 'active', farmerId: { [Op.ne]: ctx.user?.id || 0 } },
      include: [
        { model: User, as: 'farmer', attributes: ['fullName', 'phone', 'community'] },
        { model: Region, as: 'region', attributes: ['name'] },
      ],
      order: [['pricePerUnit', 'ASC']],
      limit: 25,
    });
    return rows.map((r) => ({
      id: r.id,
      label: `${Math.round(r.pricePerUnit)}/${r.unit} ${r.region?.name?.split(' ')[0] || ''} ${r.quantityRemaining}${r.unit}`,
    }));
  },
  onPick: (ctx, chosen) => ({ goto: 'BUY_DETAIL', data: { buyListingId: chosen.id } }),
});

states.BUY_DETAIL = {
  async render(ctx) {
    const l = await Listing.findByPk(ctx.data.buyListingId, {
      include: [
        { model: Produce, as: 'produce' },
        { model: User, as: 'farmer', attributes: ['fullName', 'phone', 'community', 'ratingAvg'] },
        { model: Region, as: 'region', attributes: ['name'] },
      ],
    });
    if (!l) return CON('That listing is gone.\n0. Back');
    await l.increment('views');
    ctx.set({
      buyUnit: l.unit,
      buyPrice: Number(l.pricePerUnit),
      buyAvailable: Number(l.quantityRemaining),
      buyMin: Number(l.minOrderQuantity) || 1,
    });

    return CON(fitWithFooter(
      `${l.produce?.name} Grade ${l.qualityGrade}`,
      [
        `${money(l.pricePerUnit)}/${l.unit}`,
        `${l.quantityRemaining} ${l.unit} available`,
        `${l.farmer?.fullName}, ${l.location || l.region?.name}`,
      ],
      ['1. Place order', '2. Make an offer', '3. Get farmer number', '0. Back']
    ));
  },
  async handle(ctx) {
    if (ctx.input === '0') return { goto: 'BUY_RESULTS' };
    if (!ctx.user) return { end: `Please register first to trade. Dial ${env.ussd.serviceCode} and choose 1.` };

    switch (ctx.input) {
      case '1': return requirePin(ctx, 'BUY_QUANTITY');
      case '2': return requirePin(ctx, 'OFFER_PRICE');
      case '3': {
        const l = await Listing.findByPk(ctx.data.buyListingId, {
          include: [{ model: User, as: 'farmer' }, { model: Produce, as: 'produce' }],
        });
        if (ctx.demo) return demoEnd(`${l.farmer.fullName}: ${l.farmer.phone}\nWe have also sent this to you by SMS.`);
        await l.increment('inquiries');
        await sendSms({
          to: ctx.phone,
          userId: ctx.user.id,
          message: `AgriMart: ${l.farmer.fullName} sells ${l.produce.name} at ${money(l.pricePerUnit)}/${l.unit}. Call ${l.farmer.phone}. Listing ${l.code}.`,
          type: 'listing',
          relatedType: 'listing',
          relatedId: l.id,
        });
        return { end: `${l.farmer.fullName}: ${l.farmer.phone}\nWe have also sent this to you by SMS.` };
      }
      default: return { repeat: t('invalidOption', ctx.lang) };
    }
  },
};

states.BUY_QUANTITY = {
  render(ctx) {
    return CON(`How many ${ctx.data.buyUnit} do you want?\n(${ctx.data.buyAvailable} available at ${money(ctx.data.buyPrice)} each)`);
  },
  handle(ctx) {
    const qty = Number(ctx.input);
    if (!isDecimal(ctx.input) || qty <= 0) return { repeat: 'Enter a valid quantity.' };
    if (qty > ctx.data.buyAvailable) return { repeat: `Only ${ctx.data.buyAvailable} ${ctx.data.buyUnit} available.` };
    if (qty < (ctx.data.buyMin || 1)) return { repeat: `Minimum order is ${ctx.data.buyMin} ${ctx.data.buyUnit}.` };
    return { goto: 'BUY_CONFIRM', data: { buyQuantity: qty } };
  },
};

states.BUY_CONFIRM = {
  render(ctx) {
    const total = ctx.data.buyQuantity * ctx.data.buyPrice;
    return CON(
      `Confirm order:\n${ctx.data.buyQuantity} ${ctx.data.buyUnit} at ${money(ctx.data.buyPrice)}\n` +
      `Total: ${money(total)}\nPayment on pickup.\n\n1. Place order\n2. Cancel`
    );
  },
  async handle(ctx) {
    if (ctx.input === '2') return { end: 'Order cancelled.' };
    if (ctx.input !== '1') return { repeat: 'Press 1 to order or 2 to cancel.' };

    if (ctx.demo) {
      const total = ctx.data.buyQuantity * ctx.data.buyPrice;
      return demoEnd(`Order ORD-DEMO placed!\nThe farmer has been alerted by SMS and will contact you on ${ctx.phone}. Total ${money(total)}.`);
    }
    try {
      const order = await createOrder({
        listingId: ctx.data.buyListingId,
        buyerId: ctx.user.id,
        quantity: ctx.data.buyQuantity,
        paymentMethod: 'cash',
        deliveryMethod: 'pickup',
      }, { channel: 'ussd' });

      ctx.session.outcome = 'order_placed';
      return {
        end: `Order ${order.code} placed!\nThe farmer has been alerted by SMS and will contact you on ${ctx.phone}. Total ${money(order.totalAmount)}.`,
      };
    } catch (err) {
      return { end: `Could not place order: ${err.message}` };
    }
  },
};

states.OFFER_PRICE = {
  render(ctx) { return CON(`Asking price is ${money(ctx.data.buyPrice)}/${ctx.data.buyUnit}.\nEnter your offer per ${ctx.data.buyUnit} (GHS):`); },
  handle(ctx) {
    if (!isDecimal(ctx.input) || Number(ctx.input) <= 0) return { repeat: 'Enter a valid amount.' };
    return { goto: 'OFFER_QUANTITY', data: { offerPrice: Number(ctx.input) } };
  },
};

states.OFFER_QUANTITY = {
  render(ctx) { return CON(`How many ${ctx.data.buyUnit} at ${money(ctx.data.offerPrice)} each?`); },
  async handle(ctx) {
    const qty = Number(ctx.input);
    if (!isDecimal(ctx.input) || qty <= 0) return { repeat: 'Enter a valid quantity.' };
    if (qty > ctx.data.buyAvailable) return { repeat: `Only ${ctx.data.buyAvailable} available.` };
    if (qty < (ctx.data.buyMin || 1)) return { repeat: `Minimum order is ${ctx.data.buyMin} ${ctx.data.buyUnit}.` };

    const { Offer } = require('../models');
    const listing = await Listing.findByPk(ctx.data.buyListingId, {
      include: [{ model: Produce, as: 'produce' }, { model: User, as: 'farmer' }],
    });

    if (ctx.demo) {
      return demoEnd(`Offer sent to ${listing.farmer.fullName}. We will SMS you their response. Ref OFR-DEMO.`);
    }

    const offer = await Offer.create({
      code: generateCode('OFR'),
      listingId: listing.id,
      buyerId: ctx.user.id,
      farmerId: listing.farmerId,
      offerPrice: ctx.data.offerPrice,
      quantity: qty,
      unit: listing.unit,
      source: 'ussd',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
    await listing.increment('offerCount');

    await sendSms({
      to: listing.farmer.phone,
      userId: listing.farmerId,
      template: 'newOffer',
      data: {
        listingCode: listing.code,
        produce: listing.produce.name,
        offerPrice: offer.offerPrice,
        unit: listing.unit,
        quantity: qty,
        buyerName: ctx.user.fullName,
      },
      type: 'offer',
      relatedType: 'offer',
      relatedId: offer.id,
    });

    ctx.session.outcome = 'offer_made';
    return { end: `Offer sent to ${listing.farmer.fullName}. We will SMS you their response. Ref ${offer.code}.` };
  },
};

/* — Orders — */
states.MY_ORDERS = picker({
  title: 'Your orders:',
  listKey: 'myOrders',
  backState: 'MAIN_MENU',
  emptyMessage: 'You have no orders yet.',
  loader: async (ctx) => {
    const rows = await Order.findAll({
      where: { [Op.or]: [{ buyerId: ctx.user.id }, { farmerId: ctx.user.id }] },
      include: [{ model: Listing, as: 'listing', include: [{ model: Produce, as: 'produce', attributes: ['name'] }] }],
      order: [['createdAt', 'DESC']],
      limit: 20,
    });
    return rows.map((r) => ({
      id: r.id,
      label: `${r.code.replace('ORD-', '')} ${r.listing?.produce?.name || ''} ${r.status}`,
    }));
  },
  onPick: (ctx, chosen) => ({ goto: 'ORDER_DETAIL', data: { orderId: chosen.id } }),
});

states.ORDER_DETAIL = {
  async render(ctx) {
    const o = await Order.findByPk(ctx.data.orderId, {
      include: [
        { model: Listing, as: 'listing', include: [{ model: Produce, as: 'produce' }] },
        { model: User, as: 'buyer', attributes: ['fullName', 'phone'] },
        { model: User, as: 'farmer', attributes: ['fullName', 'phone'] },
      ],
    });
    if (!o) return CON('Order not found.\n0. Back');

    const isFarmer = o.farmerId === ctx.user.id;
    const other = isFarmer ? o.buyer : o.farmer;
    ctx.set({ orderIsFarmer: isFarmer, orderStatus: o.status });

    const actions = [];
    if (isFarmer && o.status === 'pending') actions.push('1. Accept order', '2. Decline order');
    if (!isFarmer && o.status === 'pending') actions.push('1. Cancel order');
    if (o.status === 'accepted') actions.push('1. Mark as delivered');
    if (o.status === 'delivered' && !isFarmer) actions.push('1. Confirm & complete');
    actions.push('0. Back');

    return CON(fitWithFooter(
      `${o.code} - ${o.status.toUpperCase()}`,
      [
        `${o.quantity} ${o.unit} ${o.listing?.produce?.name}`,
        `Total ${money(o.totalAmount)}`,
        `${isFarmer ? 'Buyer' : 'Farmer'}: ${other.fullName}`,
        other.phone,
      ],
      actions
    ));
  },
  async handle(ctx) {
    if (ctx.input === '0') return { goto: 'MY_ORDERS' };

    const o = await Order.findByPk(ctx.data.orderId);
    if (!o) return { end: 'Order not found.' };
    const isFarmer = ctx.data.orderIsFarmer;

    try {
      if (isFarmer && o.status === 'pending') {
        if (ctx.input === '1') {
          await updateOrderStatus(o.id, 'accepted', { actor: 'farmer', note: 'Accepted over USSD' });
          return { end: `Order ${o.code} accepted. The buyer has been notified by SMS and will contact you.` };
        }
        if (ctx.input === '2') {
          await updateOrderStatus(o.id, 'rejected', { actor: 'farmer', reason: 'Declined by farmer over USSD' });
          return { end: `Order ${o.code} declined. The buyer has been informed.` };
        }
      }
      if (!isFarmer && o.status === 'pending' && ctx.input === '1') {
        await updateOrderStatus(o.id, 'cancelled', { actor: 'buyer', reason: 'Cancelled by buyer over USSD' });
        return { end: `Order ${o.code} cancelled.` };
      }
      if (o.status === 'accepted' && ctx.input === '1') {
        await updateOrderStatus(o.id, 'delivered', { actor: isFarmer ? 'farmer' : 'buyer', note: 'Marked delivered over USSD' });
        return { end: `Order ${o.code} marked as delivered.` };
      }
      if (o.status === 'delivered' && !isFarmer && ctx.input === '1') {
        await updateOrderStatus(o.id, 'completed', { actor: 'buyer', note: 'Completed over USSD' });
        return { end: `Order ${o.code} completed. Thank you for trading on AgriMart.` };
      }
    } catch (err) {
      return { end: `Could not update the order: ${err.message}` };
    }

    return { repeat: t('invalidOption', ctx.lang) };
  },
};

/* — Account — */
states.ACCOUNT_MENU = {
  render(ctx) {
    return CON(
      `My Account\n1. My profile\n2. My wallet\n3. Change PIN\n4. My price alerts\n5. SMS settings\n0. Back`
    );
  },
  handle(ctx) {
    const map = {
      1: 'ACC_PROFILE', 2: 'ACC_WALLET', 3: 'ACC_PIN_NEW',
      4: 'ACC_ALERTS', 5: 'ACC_SMS',
    };
    if (ctx.input === '0') return backToMenu();
    const next = map[ctx.input];
    if (!next) return { repeat: t('invalidOption', ctx.lang) };
    return { goto: next };
  },
};

states.ACC_PROFILE = {
  async render(ctx) {
    const u = await User.findByPk(ctx.user.id, {
      include: [{ model: Region, as: 'region', attributes: ['name'] }, { model: District, as: 'district', attributes: ['name'] }],
    });
    const listings = await Listing.count({ where: { farmerId: u.id } });
    const orders = await Order.count({ where: { [Op.or]: [{ buyerId: u.id }, { farmerId: u.id }] } });
    return END(fit(
      `${u.fullName}\n${u.phone} (${u.role})\n${u.community || ''} ${u.district?.name || ''}, ${u.region?.name || ''}\n` +
      `Listings: ${listings}  Orders: ${orders}\nRating: ${Number(u.ratingAvg).toFixed(1)}/5\nMember since ${new Date(u.createdAt).toLocaleDateString('en-GB')}`
    ));
  },
  handle() { return { end: t('sessionEnd', 'en') }; },
};

states.ACC_WALLET = {
  async render(ctx) {
    const u = await User.findByPk(ctx.user.id);
    return CON(
      `Wallet balance: ${money(u.walletBalance)}\nTotal sales: ${money(u.totalSales)}\n\n` +
      `1. Withdraw to MoMo\n0. Back`
    );
  },
  async handle(ctx) {
    if (ctx.input === '0') return { goto: 'ACCOUNT_MENU' };
    if (ctx.input === '1') {
      const u = await User.findByPk(ctx.user.id);
      const minimum = Number(setting('min_withdrawal'));
      if (Number(u.walletBalance) < minimum) return { end: `Minimum withdrawal is ${money(minimum)}. Keep selling!` };
      return { goto: 'ACC_WITHDRAW' };
    }
    return { repeat: t('invalidOption', ctx.lang) };
  },
};

states.ACC_WITHDRAW = {
  async render(ctx) {
    const u = await User.findByPk(ctx.user.id);
    return CON(`Available: ${money(u.walletBalance)}\nEnter amount to send to ${u.momoNumber || u.phone}:`);
  },
  async handle(ctx) {
    const { Transaction } = require('../models');
    const u = await User.findByPk(ctx.user.id);
    const amount = Number(ctx.input);
    const minimum = Number(setting('min_withdrawal'));
    if (!isDecimal(ctx.input) || amount < minimum) return { repeat: `Minimum withdrawal is ${money(minimum)}.` };
    if (amount > Number(u.walletBalance)) return { repeat: `You only have ${money(u.walletBalance)}.` };

    const fee = Number((amount * Number(setting('withdrawal_fee_rate'))).toFixed(2));
    const balance = Number(u.walletBalance) - amount;

    if (ctx.demo) {
      return demoEnd(`${money(amount - fee)} is on its way to ${u.momoNumber || u.phone}. Ref TXN-DEMO. Fee ${money(fee)}.`);
    }

    const tx = await Transaction.create({
      reference: generateCode('TXN', 8),
      userId: u.id,
      type: 'withdrawal',
      direction: 'debit',
      amount,
      fee,
      balanceAfter: balance,
      method: 'momo',
      provider: (u.momoProvider || 'mtn'),
      accountNumber: u.momoNumber || u.phone,
      accountName: u.fullName,
      status: 'processing',
      description: 'Wallet withdrawal requested over USSD',
    });
    await u.update({ walletBalance: balance });

    await sendSms({
      to: u.phone, userId: u.id, template: 'payoutSent',
      data: { amount: amount - fee, reference: tx.reference, momoNumber: u.momoNumber || u.phone },
      type: 'payment', force: true,
    });

    return { end: `${money(amount - fee)} is on its way to ${u.momoNumber || u.phone}. Ref ${tx.reference}. Fee ${money(fee)}.` };
  },
};

states.ACC_PIN_NEW = {
  render() { return CON('Enter your NEW 4-digit PIN:'); },
  handle(ctx) {
    if (!isPin(ctx.input)) return { repeat: 'PIN must be 4 digits.' };
    return { goto: 'ACC_PIN_CONFIRM', data: { newPin: ctx.input } };
  },
};

states.ACC_PIN_CONFIRM = {
  render() { return CON('Re-enter your new PIN:'); },
  async handle(ctx) {
    if (ctx.input !== ctx.data.newPin) return { goto: 'ACC_PIN_NEW', notice: 'PINs did not match.' };
    if (ctx.demo) return demoEnd('Your PIN has been changed. Keep it secret.');
    const u = await User.findByPk(ctx.user.id);
    u.pin = ctx.data.newPin;
    await u.save();
    return { end: 'Your PIN has been changed. Keep it secret.' };
  },
};

states.ACC_SMS = {
  async render(ctx) {
    const u = await User.findByPk(ctx.user.id);
    return CON(`SMS notifications are ${u.smsNotifications ? 'ON' : 'OFF'}\n\n1. Turn ${u.smsNotifications ? 'OFF' : 'ON'}\n0. Back`);
  },
  async handle(ctx) {
    if (ctx.input === '0') return { goto: 'ACCOUNT_MENU' };
    if (ctx.input !== '1') return { repeat: t('invalidOption', ctx.lang) };
    const u = await User.findByPk(ctx.user.id);
    if (ctx.demo) return demoEnd(`SMS notifications are now ${u.smsNotifications ? 'OFF' : 'ON'}.`);
    await u.update({ smsNotifications: !u.smsNotifications });
    return { end: `SMS notifications are now ${u.smsNotifications ? 'ON' : 'OFF'}.` };
  },
};

/* — Help & support — */
states.HELP_MENU = {
  render() {
    return CON('Help & Support\n1. How to sell produce\n2. How to buy produce\n3. Talk to support\n4. Report a problem\n0. Back');
  },
  handle(ctx) {
    switch (ctx.input) {
      case '0': return backToMenu();
      case '1':
        return { end: `To sell: dial ${env.ussd.serviceCode}, choose 1, pick your crop, enter quantity and price. Your produce goes live immediately and buyers call you. It is free.` };
      case '2':
        return { end: `To buy: dial ${env.ussd.serviceCode}, choose Buy Produce, pick a crop and see farmers with stock near you. Place an order and the farmer is alerted by SMS.` };
      case '3':
        return {
          end: `Call AgriMart support on ${supportLine()} (Mon-Sat, 7am-7pm)` +
            (env.sms.shortCode ? ` or send an SMS with HELP to ${env.sms.shortCode}.` : '.'),
        };
      case '4': return { goto: 'HELP_REPORT' };
      default: return { repeat: 'Invalid choice.' };
    }
  },
};

states.HELP_REPORT = {
  render() { return CON('Describe the problem in one message:'); },
  async handle(ctx) {
    const text = String(ctx.input || '').trim();
    if (text.length < 5) return { repeat: 'Please describe the problem.' };
    if (ctx.demo) return demoEnd('Thank you. Your report TKT-DEMO has been received. Our team will call you within 24 hours.');
    const ticket = await SupportTicket.create({
      code: generateCode('TKT'),
      userId: ctx.user?.id || null,
      name: ctx.user?.fullName || null,
      phone: ctx.phone,
      subject: 'Problem reported over USSD',
      category: 'ussd',
      message: text.substring(0, 1000),
      channel: 'ussd',
    });
    await sendSms({ to: ctx.phone, userId: ctx.user?.id, template: 'supportTicket', data: { code: ticket.code }, type: 'support' });
    return { end: `Thank you. Your report ${ticket.code} has been received. Our team will call you within 24 hours.` };
  },
};

module.exports = states;
