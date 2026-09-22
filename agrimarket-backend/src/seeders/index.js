/* eslint-disable no-await-in-loop */
const env = require('../config/env');
const db = require('../models');
const logger = require('../utils/logger');
const { slugify, generateCode, detectNetwork } = require('../utils/helpers');
const data = require('./data');
const { produceImage, categoryImage } = require('../utils/catalogPhotos');

const {
  Region, District, Market, Category, Produce, User, Listing, Order, Offer,
  MarketPrice, Transaction, Review, FarmingTip, Setting, ImpactRecord,
  UssdSession, SmsMessage, Notification, PriceAlert,
} = db;

/* ── small helpers ───────────────────────────────────────────────────── */
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickMany = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const chance = (p) => Math.random() < p;
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const dateStr = (d) => d.toISOString().slice(0, 10);
const round = (n, dp = 2) => Number(Number(n).toFixed(dp));

const MALE_NAMES = [
  'Kwame Mensah', 'Kofi Owusu', 'Yaw Boateng', 'Kwabena Asante', 'Kojo Antwi',
  'Kwaku Darko', 'Abdul-Rahman Mahama', 'Ibrahim Fuseini', 'Alhassan Sulemana',
  'Emmanuel Tetteh', 'Samuel Adjei', 'Isaac Ofori', 'Daniel Nkrumah',
  'Joseph Amponsah', 'Michael Agyeman', 'Prince Adu', 'Eric Baidoo',
  'Francis Quansah', 'Stephen Danso', 'Gideon Appiah', 'Musah Yakubu',
  'Seidu Abubakari', 'Elvis Ankomah', 'Bernard Osei', 'Nathaniel Armah',
];

const FEMALE_NAMES = [
  'Akosua Agyeiwaa', 'Ama Serwaa', 'Abena Konadu', 'Adwoa Pokuaa', 'Afia Nyarko',
  'Efua Mensimah', 'Esi Bonsu', 'Hawa Alhassan', 'Fatima Iddrisu', 'Comfort Ansah',
  'Grace Otoo', 'Mary Amoah', 'Cecilia Dzikunu', 'Vida Ahiabor', 'Rebecca Asiedu',
  'Janet Opoku', 'Patience Nartey', 'Gifty Boakye', 'Georgina Aidoo', 'Regina Bediako',
  'Salamatu Abdulai', 'Lydia Tetteh', 'Sandra Kyei', 'Doris Nyame', 'Beatrice Owusu',
];

const BUYERS = [
  { name: 'Nkoso Aggregators Ltd', contact: 'Richard Boadi', type: 'aggregator', region: 'Bono East' },
  { name: 'Golden Harvest Trading', contact: 'Selina Amankwah', type: 'wholesaler', region: 'Ashanti' },
  { name: 'Accra Fresh Foods', contact: 'Nii Ayitey Otoo', type: 'retailer', region: 'Greater Accra' },
  { name: 'Volta Agro Processing', contact: 'Elikem Dzeble', type: 'processor', region: 'Volta' },
  { name: 'Sahel Commodities Ltd', contact: 'Mohammed Tanko', type: 'aggregator', region: 'Northern' },
  { name: 'Kumasi Grain Traders', contact: 'Agnes Serwaa Bonsu', type: 'wholesaler', region: 'Ashanti' },
  { name: 'Premium Produce Exports', contact: 'Yvonne Asare', type: 'exporter', region: 'Greater Accra' },
  { name: 'Northern Star Commodities', contact: 'Iddrisu Bawa', type: 'aggregator', region: 'Upper East' },
  { name: 'GreenLeaf Wholesalers', contact: 'Paul Amissah', type: 'wholesaler', region: 'Central' },
  { name: 'Coastal Fisheries & Foods', contact: 'Ekow Sam', type: 'processor', region: 'Western' },
  { name: 'AgriLink Ghana', contact: 'Charlotte Adjei', type: 'aggregator', region: 'Eastern' },
  { name: 'Tamale Food Hub', contact: 'Rashida Alhassan', type: 'retailer', region: 'Northern' },
];

const COMMUNITIES = {
  'Greater Accra': ['Ada Foah', 'Prampram', 'Dodowa', 'Amasaman', 'Katamanso'],
  Ashanti: ['Ejura', 'Nkoranza Junction', 'Agogo', 'Wiamoase', 'Nobewam', 'Asuoso'],
  'Bono East': ['Tuobodom', 'Nkoranza', 'Amantin', 'Prang', 'Kwame Danso'],
  Bono: ['Dormaa Ahenkro', 'Berekum', 'Nsoatre', 'Chiraa', 'Odumase'],
  Northern: ['Tolon', 'Savelugu', 'Kumbungu', 'Nyankpala', 'Diare', 'Gushegu'],
  'Upper East': ['Navrongo', 'Zebilla', 'Sandema', 'Paga', 'Tongo'],
  'Upper West': ['Jirapa', 'Nandom', 'Tumu', 'Kaleo', 'Lambussie'],
  Eastern: ['Suhum', 'Asamankese', 'Begoro', 'Somanya', 'Akim Oda'],
  Volta: ['Kpando', 'Adidome', 'Sogakope', 'Dzodze', 'Have'],
  Central: ['Assin Fosu', 'Ajumako', 'Breman Asikuma', 'Abura Dunkwa'],
  Western: ['Agona Nkwanta', 'Axim', 'Bogoso', 'Elubo'],
  'Western North': ['Bibiani', 'Juaboso', 'Enchi', 'Akontombra'],
  Ahafo: ['Mim', 'Kukuom', 'Kenyasi', 'Hwidiem'],
  Savannah: ['Larabanga', 'Bole', 'Salaga', 'Buipe'],
  'North East': ['Walewale', 'Gambaga', 'Chereponi'],
  Oti: ['Kete Krachi', 'Nkwanta', 'Jasikan'],
};

let phoneCounter = 0;
const PREFIXES = ['024', '054', '055', '020', '050', '027', '026', '057', '059'];
function nextPhone() {
  phoneCounter += 1;
  const prefix = PREFIXES[phoneCounter % PREFIXES.length];
  return `${prefix}${String(1000000 + phoneCounter * 137).slice(0, 7)}`;
}

/* ── seed steps ──────────────────────────────────────────────────────── */

async function seedGeography() {
  const regions = await Region.bulkCreate(data.regions, { returning: true });
  const regionMap = Object.fromEntries(regions.map((r) => [r.name, r]));

  const districtRows = [];
  Object.entries(data.districts).forEach(([regionName, names]) => {
    const region = regionMap[regionName];
    if (!region) return;
    names.forEach((name) => districtRows.push({ regionId: region.id, name, capital: name }));
  });
  await District.bulkCreate(districtRows);

  const marketRows = data.markets.map((m) => ({
    name: m.name,
    slug: slugify(m.name),
    regionId: regionMap[m.region]?.id,
    type: m.type,
    marketDays: m.marketDays,
    description: m.description || null,
    isMajor: !!m.isMajor,
    latitude: regionMap[m.region]?.latitude,
    longitude: regionMap[m.region]?.longitude,
  }));
  await Market.bulkCreate(marketRows);

  logger.success(`Geography: ${regions.length} regions, ${districtRows.length} districts, ${marketRows.length} markets`);
  return regionMap;
}

async function seedProduce() {
  const categories = await Category.bulkCreate(
    data.categories.map((c) => ({ ...c, slug: slugify(c.name), imageUrl: categoryImage(slugify(c.name)) })),
    { returning: true }
  );
  const categoryMap = Object.fromEntries(categories.map((c) => [c.name, c]));

  const rows = data.produce.map((p, i) => ({
    categoryId: categoryMap[p.category]?.id,
    name: p.name,
    slug: slugify(p.name),
    localNames: p.localNames || null,
    scientificName: p.scientificName || null,
    defaultUnit: p.defaultUnit,
    units: p.units,
    imageUrl: produceImage(slugify(p.name)),
    seasonStart: p.seasonStart || null,
    seasonEnd: p.seasonEnd || null,
    shelfLifeDays: p.shelfLifeDays || null,
    isPerishable: !!p.isPerishable,
    ussdIndex: i + 1,
    description: `${p.name} traded across Ghanaian markets${p.localNames ? `. Known locally as ${p.localNames}` : ''}.`,
  }));

  const produce = await Produce.bulkCreate(rows, { returning: true });
  logger.success(`Produce: ${categories.length} categories, ${produce.length} produce types`);
  return { categories, produce, categoryMap };
}

async function seedUsers(regionMap) {
  const regions = Object.values(regionMap);
  const districtsByRegion = {};
  for (const region of regions) {
    districtsByRegion[region.id] = await District.findAll({ where: { regionId: region.id } });
  }

  // Administrators — the /admin console accounts
  const superAdmin = await User.create({
    fullName: 'System Administrator',
    phone: env.seed.adminPhone,
    email: env.seed.adminEmail,
    password: env.seed.adminPassword,
    role: 'superadmin',
    status: 'active',
    regionId: regionMap['Greater Accra'].id,
    registrationChannel: 'seed',
    isPhoneVerified: true,
    isEmailVerified: true,
    permissions: ['*'],
  });

  const admin = await User.create({
    fullName: 'Akua Boakye',
    phone: '0244000001',
    email: 'akua.boakye@agrimart.gh',
    password: 'Admin@2026',
    role: 'admin',
    status: 'active',
    regionId: regionMap['Greater Accra'].id,
    registrationChannel: 'seed',
    isPhoneVerified: true,
  });

  // Field agents who record market prices
  const agents = await User.bulkCreate([
    {
      fullName: 'Mensah Adjetey', phone: '0244000002', email: 'agent.techiman@agrimart.gh',
      password: 'Agent@2026', role: 'agent', regionId: regionMap['Bono East'].id,
      registrationChannel: 'seed', isPhoneVerified: true, status: 'active',
    },
    {
      fullName: 'Zuweira Mohammed', phone: '0244000003', email: 'agent.tamale@agrimart.gh',
      password: 'Agent@2026', role: 'agent', regionId: regionMap.Northern.id,
      registrationChannel: 'seed', isPhoneVerified: true, status: 'active',
    },
  ], { individualHooks: true, returning: true });

  // Farmers
  const names = [...MALE_NAMES, ...FEMALE_NAMES];
  const farmers = [];
  for (let i = 0; i < 46; i++) {
    const fullName = names[i % names.length];
    const isFemale = FEMALE_NAMES.includes(fullName);
    const region = pick(regions);
    const districts = districtsByRegion[region.id] || [];
    const phone = nextPhone();
    const viaUssd = chance(0.62); // most smallholders arrive over USSD

    farmers.push({
      fullName: i < names.length ? fullName : `${fullName.split(' ')[0]} ${pick(['Adjei', 'Mensah', 'Owusu', 'Iddrisu', 'Ampofo'])}`,
      phone,
      email: viaUssd ? null : `${slugify(fullName)}${i}@example.gh`,
      password: viaUssd ? null : 'Farmer@2026',
      pin: '1357',
      role: 'farmer',
      status: chance(0.96) ? 'active' : 'suspended',
      regionId: region.id,
      districtId: districts.length ? pick(districts).id : null,
      community: pick(COMMUNITIES[region.name] || [region.capital]),
      gender: isFemale ? 'female' : 'male',
      language: chance(0.55) ? 'en' : pick(['tw', 'ee', 'dag', 'ha']),
      network: detectNetwork(phone),
      farmSize: round(rand(1, 14), 1),
      farmingExperience: randInt(2, 32),
      cooperative: chance(0.4) ? pick(['Ejura Farmers Co-op', 'Northern Women Farmers Union', 'Volta Growers Association', 'Techiman Grain Producers']) : null,
      registrationChannel: viaUssd ? 'ussd' : chance(0.7) ? 'web' : 'agent',
      isPhoneVerified: true,
      isVerifiedSeller: chance(0.35),
      momoNumber: phone,
      momoProvider: pick(['mtn', 'telecel', 'airteltigo']),
      walletBalance: chance(0.5) ? round(rand(0, 4200)) : 0,
      lastUssdAt: viaUssd ? daysAgo(randInt(0, 30)) : null,
      ussdSessionCount: viaUssd ? randInt(3, 60) : randInt(0, 5),
      createdAt: daysAgo(randInt(1, 300)),
    });
  }
  // A fixed, documented demo farmer so the web dashboard and USSD can be tried straight away
  Object.assign(farmers[0], {
    fullName: 'Kwame Mensah',
    phone: '0244100200',
    email: 'farmer@agrimart.gh',
    password: 'Farmer@2026',
    pin: '1357',
    status: 'active',
    registrationChannel: 'web',
    regionId: regionMap.Ashanti.id,
    districtId: (districtsByRegion[regionMap.Ashanti.id] || [])[0]?.id || null,
    community: 'Ejura',
    language: 'en',
    isVerifiedSeller: true,
    walletBalance: 2450,
    momoNumber: '0244100200',
  });

  const farmerRows = await User.bulkCreate(farmers, { individualHooks: true, returning: true });

  // Buyers
  const buyerRows = await User.bulkCreate(
    BUYERS.map((b, i) => {
      const phone = nextPhone();
      return {
        fullName: b.contact,
        businessName: b.name,
        businessType: b.type,
        businessRegNumber: `CS${randInt(100000, 999999)}`,
        phone,
        email: i === 0 ? 'buyer@agrimart.gh' : `${slugify(b.name)}@example.gh`,
        password: 'Buyer@2026',
        pin: '2468',
        role: 'buyer',
        status: 'active',
        regionId: regionMap[b.region]?.id,
        network: detectNetwork(phone),
        registrationChannel: i % 4 === 0 ? 'ussd' : 'web',
        isPhoneVerified: true,
        isVerifiedSeller: chance(0.6),
        momoNumber: phone,
        momoProvider: pick(['mtn', 'telecel']),
        createdAt: daysAgo(randInt(10, 320)),
      };
    }),
    { individualHooks: true, returning: true }
  );

  logger.success(`Users: 2 admins, ${agents.length} agents, ${farmerRows.length} farmers, ${buyerRows.length} buyers`);
  return { superAdmin, admin, agents, farmers: farmerRows, buyers: buyerRows };
}

/**
 * Builds a price history per market so the trend charts and the "best market"
 * comparison have real series behind them rather than a single flat number.
 */
async function seedPrices(produce, agents) {
  const markets = await Market.findAll();
  const tracked = produce.filter((p) => p.ussdIndex <= 34); // the widely traded ones
  const rows = [];
  const WEEKS = 14;

  for (const market of markets) {
    const multiplier = data.marketMultipliers[market.name] || 1;
    const marketProduce = market.isMajor ? tracked : pickMany(tracked, 16);

    for (const p of marketProduce) {
      const base = (data.produce.find((d) => d.name === p.name)?.basePrice || 500) * multiplier;
      // Each produce follows its own gentle seasonal drift plus weekly noise
      const drift = rand(-0.22, 0.28);
      let previous = null;

      for (let w = WEEKS; w >= 0; w--) {
        const progress = (WEEKS - w) / WEEKS;
        const seasonal = 1 + drift * progress;
        const noise = rand(0.96, 1.04);
        const avg = base * seasonal * noise;
        const spread = avg * rand(0.06, 0.14);

        rows.push({
          produceId: p.id,
          marketId: market.id,
          regionId: market.regionId,
          unit: p.defaultUnit,
          minPrice: round(avg - spread),
          maxPrice: round(avg + spread),
          avgPrice: round(avg),
          previousAvgPrice: previous,
          changePercent: previous ? round(((avg - previous) / previous) * 100) : 0,
          trend: previous ? (avg > previous * 1.01 ? 'up' : avg < previous * 0.99 ? 'down' : 'stable') : 'stable',
          priceType: market.type === 'retail' ? 'retail' : market.type === 'farmgate' ? 'farmgate' : 'wholesale',
          priceDate: dateStr(daysAgo(w * 7 + randInt(0, 2))),
          source: pick(['agent', 'moFA', 'survey', 'admin']),
          isVerified: true,
          isPublished: true,
          recordedBy: pick(agents).id,
          createdAt: daysAgo(w * 7),
        });
        previous = round(avg);
      }
    }
  }

  // chunked to keep the single INSERT statements a sensible size for MySQL
  for (let i = 0; i < rows.length; i += 500) {
    await MarketPrice.bulkCreate(rows.slice(i, i + 500), { hooks: false });
  }
  logger.success(`Market prices: ${rows.length} observations across ${markets.length} markets`);
}

async function seedListings(farmers, produce) {
  const activeFarmers = farmers.filter((f) => f.status === 'active');
  const rows = [];

  for (let i = 0; i < 120; i++) {
    // the demo farmer gets a handful of listings so their dashboard is not empty
    const farmer = i < 8 ? activeFarmers[0] : pick(activeFarmers);
    const p = pick(produce);
    const meta = data.produce.find((d) => d.name === p.name);
    const base = meta?.basePrice || 500;
    const price = round(base * rand(0.82, 1.14));
    const quantity = p.defaultUnit.includes('tuber') || p.defaultUnit === 'piece'
      ? randInt(60, 900)
      : p.defaultUnit === 'head' || p.defaultUnit === 'bird'
        ? randInt(3, 40)
        : randInt(5, 140);

    const createdAt = daysAgo(randInt(0, 70));
    const statusRoll = Math.random();
    const status = statusRoll < 0.64 ? 'active'
      : statusRoll < 0.82 ? 'sold'
        : statusRoll < 0.9 ? 'expired'
          : statusRoll < 0.96 ? 'pending' : 'withdrawn';

    const sold = status === 'sold';
    const source = chance(0.55) ? 'ussd' : chance(0.72) ? 'web' : chance(0.6) ? 'sms' : 'agent';

    rows.push({
      code: generateCode('LST'),
      farmerId: farmer.id,
      produceId: p.id,
      categoryId: p.categoryId,
      title: `${p.name} — ${quantity} ${p.defaultUnit}`,
      description: chance(0.6)
        ? `Fresh ${p.name.toLowerCase()} harvested in ${farmer.community || 'our community'}. ${chance(0.5) ? 'Ready for immediate collection.' : 'Transport can be arranged at the buyer’s cost.'} Serious buyers only.`
        : null,
      quantity,
      quantityRemaining: sold ? 0 : chance(0.25) ? round(quantity * rand(0.3, 0.9)) : quantity,
      unit: p.defaultUnit,
      pricePerUnit: price,
      totalValue: round(quantity * price),
      minOrderQuantity: Math.max(1, Math.floor(quantity * 0.05)),
      negotiable: chance(0.75),
      qualityGrade: chance(0.6) ? 'A' : chance(0.75) ? 'B' : 'C',
      isOrganic: chance(0.18),
      harvestDate: dateStr(daysAgo(randInt(0, 30))),
      expiresAt: new Date(createdAt.getTime() + (meta?.isPerishable ? 7 : 45) * 86400000),
      regionId: farmer.regionId,
      districtId: farmer.districtId,
      location: farmer.community,
      // No farmer photos: the marketplace shows the produce's catalogue photo
      images: [],
      status,
      source,
      views: randInt(3, 480),
      inquiries: randInt(0, 28),
      offerCount: randInt(0, 6),
      isFeatured: chance(0.1),
      isUrgent: meta?.isPerishable && chance(0.3),
      soldAt: sold ? daysAgo(randInt(0, 20)) : null,
      createdAt,
      updatedAt: createdAt,
    });
  }

  const listings = await Listing.bulkCreate(rows, { hooks: false, returning: true });
  logger.success(`Listings: ${listings.length}`);
  return listings;
}

async function seedOrders(listings, buyers, farmers) {
  const sellable = listings.filter((l) => ['active', 'sold', 'reserved'].includes(l.status));
  const orders = [];
  const transactions = [];
  const reviews = [];

  const STATUS_WEIGHTS = [
    ['completed', 0.42], ['pending', 0.14], ['accepted', 0.12], ['in_transit', 0.07],
    ['delivered', 0.08], ['rejected', 0.06], ['cancelled', 0.06], ['paid', 0.05],
  ];
  const rollStatus = () => {
    let r = Math.random();
    for (const [status, weight] of STATUS_WEIGHTS) {
      if (r < weight) return status;
      r -= weight;
    }
    return 'completed';
  };

  for (let i = 0; i < 88; i++) {
    const listing = pick(sellable);
    const buyer = pick(buyers);
    const quantity = Math.max(1, Math.floor(Number(listing.quantity) * rand(0.15, 0.7)));
    const unitPrice = round(Number(listing.pricePerUnit) * rand(0.93, 1.02));
    const subtotal = round(quantity * unitPrice);
    const commission = round(subtotal * env.platform.commissionRate);
    const deliveryFee = chance(0.35) ? round(rand(60, 550)) : 0;
    const status = rollStatus();
    const createdAt = daysAgo(randInt(0, 90));

    const timeline = [{ status: 'pending', note: 'Order placed', actor: 'buyer', at: createdAt.toISOString() }];
    if (['accepted', 'paid', 'in_transit', 'delivered', 'completed'].includes(status)) {
      timeline.push({ status: 'accepted', note: 'Farmer accepted', actor: 'farmer', at: new Date(createdAt.getTime() + 3600000).toISOString() });
    }
    if (['delivered', 'completed'].includes(status)) {
      timeline.push({ status: 'delivered', note: 'Goods handed over', actor: 'farmer', at: new Date(createdAt.getTime() + 3 * 86400000).toISOString() });
    }
    if (status === 'completed') {
      timeline.push({ status: 'completed', note: 'Buyer confirmed receipt', actor: 'buyer', at: new Date(createdAt.getTime() + 4 * 86400000).toISOString() });
    }

    orders.push({
      code: generateCode('ORD'),
      listingId: listing.id,
      buyerId: buyer.id,
      farmerId: listing.farmerId,
      quantity,
      unit: listing.unit,
      unitPrice,
      subtotal,
      commission,
      deliveryFee,
      totalAmount: round(subtotal + deliveryFee),
      farmerPayout: round(subtotal - commission),
      status,
      paymentMethod: pick(['momo', 'momo', 'cash', 'bank']),
      paymentStatus: ['completed', 'paid', 'delivered'].includes(status) ? 'paid' : 'unpaid',
      deliveryMethod: deliveryFee ? 'delivery' : 'pickup',
      source: chance(0.45) ? 'ussd' : 'web',
      timeline,
      acceptedAt: timeline.length > 1 ? new Date(createdAt.getTime() + 3600000) : null,
      deliveredAt: ['delivered', 'completed'].includes(status) ? new Date(createdAt.getTime() + 3 * 86400000) : null,
      completedAt: status === 'completed' ? new Date(createdAt.getTime() + 4 * 86400000) : null,
      farmerRated: status === 'completed' && chance(0.6),
      buyerRated: status === 'completed' && chance(0.7),
      createdAt,
      updatedAt: createdAt,
    });
  }

  const created = await Order.bulkCreate(orders, { hooks: false, returning: true });

  // Money movements and reputation for the completed deals
  for (const order of created.filter((o) => o.status === 'completed')) {
    transactions.push({
      reference: generateCode('TXN', 8),
      userId: order.farmerId,
      orderId: order.id,
      type: 'payout',
      direction: 'credit',
      amount: order.farmerPayout,
      fee: order.commission,
      netAmount: order.farmerPayout,
      balanceAfter: round(rand(200, 6000)),
      method: order.paymentMethod === 'cash' ? 'cash' : 'momo',
      provider: 'internal',
      status: 'success',
      description: `Sale proceeds for order ${order.code}`,
      processedAt: order.completedAt,
      createdAt: order.completedAt,
    });

    if (order.buyerRated) {
      reviews.push({
        orderId: order.id,
        reviewerId: order.buyerId,
        revieweeId: order.farmerId,
        reviewerRole: 'buyer',
        rating: randInt(3, 5),
        qualityRating: randInt(3, 5),
        communicationRating: randInt(3, 5),
        punctualityRating: randInt(3, 5),
        comment: pick([
          'Produce was exactly as described. Weighed correctly and ready on time.',
          'Good quality and the farmer answered the phone every time. Will buy again.',
          'Grading was honest. Loading took longer than agreed but the goods were sound.',
          'Very reliable supplier. This is my third purchase from this farm.',
          'Quality was good overall, a small portion had to be sorted out.',
        ]),
        createdAt: order.completedAt,
      });
    }
    if (order.farmerRated) {
      reviews.push({
        orderId: order.id,
        reviewerId: order.farmerId,
        revieweeId: order.buyerId,
        reviewerRole: 'farmer',
        rating: randInt(3, 5),
        communicationRating: randInt(3, 5),
        punctualityRating: randInt(3, 5),
        comment: pick([
          'Paid on collection as agreed. No haggling at the scale.',
          'Serious buyer, came with his own transport. Recommended.',
          'Payment arrived same day by MoMo. Very professional.',
          'Good buyer, though collection was a day later than promised.',
        ]),
        createdAt: order.completedAt,
      });
    }
  }

  await Transaction.bulkCreate(transactions, { hooks: false });
  await Review.bulkCreate(reviews, { hooks: false });

  // Roll the reviews up into each user's rating
  const grouped = reviews.reduce((acc, r) => {
    (acc[r.revieweeId] = acc[r.revieweeId] || []).push(r.rating);
    return acc;
  }, {});
  for (const [userId, ratings] of Object.entries(grouped)) {
    await User.update(
      {
        ratingAvg: round(ratings.reduce((a, b) => a + b, 0) / ratings.length),
        ratingCount: ratings.length,
      },
      { where: { id: userId } }
    );
  }

  logger.success(`Orders: ${created.length}, transactions: ${transactions.length}, reviews: ${reviews.length}`);
  return created;
}

async function seedOffers(listings, buyers) {
  const active = listings.filter((l) => l.status === 'active' && l.negotiable);
  const rows = [];

  for (let i = 0; i < 34; i++) {
    const listing = pick(active);
    if (!listing) break;
    const buyer = pick(buyers);
    const createdAt = daysAgo(randInt(0, 25));
    const status = pick(['pending', 'pending', 'accepted', 'rejected', 'countered', 'expired']);

    rows.push({
      code: generateCode('OFR'),
      listingId: listing.id,
      buyerId: buyer.id,
      farmerId: listing.farmerId,
      offerPrice: round(Number(listing.pricePerUnit) * rand(0.78, 0.97)),
      quantity: Math.max(1, Math.floor(Number(listing.quantity) * rand(0.2, 0.8))),
      unit: listing.unit,
      message: chance(0.6) ? pick([
        'Can you do this price if I take the whole lot today?',
        'I collect with my own truck. Cash on collection.',
        'Need it by Friday for the Techiman market day.',
        'Regular buyer — can we agree a standing weekly volume?',
      ]) : null,
      counterPrice: status === 'countered' ? round(Number(listing.pricePerUnit) * rand(0.95, 1.0)) : null,
      status,
      source: chance(0.4) ? 'ussd' : 'web',
      expiresAt: new Date(createdAt.getTime() + 3 * 86400000),
      respondedAt: ['accepted', 'rejected', 'countered'].includes(status) ? new Date(createdAt.getTime() + 7200000) : null,
      createdAt,
    });
  }

  await Offer.bulkCreate(rows, { hooks: false });
  logger.success(`Offers: ${rows.length}`);
}

/** Realistic USSD and SMS traffic so the admin operations pages are meaningful. */
async function seedChannelActivity(farmers, buyers) {
  const all = [...farmers, ...buyers];
  const sessions = [];
  const messages = [];

  const OUTCOMES = ['registered', 'listing_created', 'price_checked', 'order_placed', 'offer_made', null];

  for (let i = 0; i < 420; i++) {
    const user = pick(all);
    const createdAt = daysAgo(randInt(0, 45));
    const status = chance(0.74) ? 'completed' : chance(0.6) ? 'timeout' : 'aborted';
    const steps = randInt(2, 11);

    sessions.push({
      sessionId: `ATUid_${Math.random().toString(36).slice(2, 14)}${i}`,
      phone: user.phone,
      userId: user.id,
      serviceCode: env.ussd.serviceCode,
      network: user.network || detectNetwork(user.phone),
      state: status === 'completed' ? 'MAIN_MENU' : pick(['SELL_QUANTITY', 'PRICE_RESULT', 'BUY_RESULTS', 'AUTH_PIN']),
      data: {},
      history: [],
      status,
      stepCount: steps,
      outcome: status === 'completed' ? pick(OUTCOMES) : null,
      durationSeconds: status === 'completed' ? randInt(25, 190) : randInt(60, 180),
      isSimulated: false,
      endedAt: new Date(createdAt.getTime() + randInt(30, 200) * 1000),
      createdAt,
      updatedAt: createdAt,
    });
  }

  const SMS_TYPES = ['otp', 'welcome', 'listing', 'order', 'price_digest', 'price_alert', 'reminder', 'broadcast'];
  for (let i = 0; i < 620; i++) {
    const user = pick(all);
    const createdAt = daysAgo(randInt(0, 45));
    const type = pick(SMS_TYPES);
    const delivered = chance(0.93);

    messages.push({
      direction: chance(0.92) ? 'outbound' : 'inbound',
      recipient: user.phone,
      sender: 'AgriMart',
      message: {
        otp: 'AgriMart: Your verification code is 483920. It expires in 10 minutes.',
        welcome: `Welcome to AgriMart Ghana! Dial ${env.ussd.serviceCode} anytime to list produce or check market prices.`,
        listing: 'AgriMart: Your listing is live. Buyers across Ghana can now see it.',
        order: `AgriMart: NEW ORDER. A buyer wants your produce. Dial ${env.ussd.serviceCode} option 5 to accept.`,
        price_digest: 'AgriMart PRICES - Techiman: Maize bag: GHS650 +2% | Yam tuber: GHS38 -1%',
        price_alert: 'AgriMart PRICE ALERT: Maize at Techiman is now GHS 760/bag, above your target.',
        reminder: `AgriMart: Buyers are looking for produce this week. Dial ${env.ussd.serviceCode} to list what you have.`,
        broadcast: 'AgriMart: Market day at Techiman is Wednesday. Prepare your produce early.',
      }[type],
      userId: user.id,
      type,
      status: delivered ? 'delivered' : chance(0.5) ? 'sent' : 'failed',
      provider: 'mock',
      network: user.network || detectNetwork(user.phone),
      segments: 1,
      cost: 0.035,
      errorMessage: delivered ? null : 'Handset unreachable',
      sentAt: createdAt,
      deliveredAt: delivered ? createdAt : null,
      createdAt,
      updatedAt: createdAt,
    });
  }

  for (let i = 0; i < sessions.length; i += 300) await UssdSession.bulkCreate(sessions.slice(i, i + 300), { hooks: false });
  for (let i = 0; i < messages.length; i += 300) await SmsMessage.bulkCreate(messages.slice(i, i + 300), { hooks: false });

  logger.success(`Channel activity: ${sessions.length} USSD sessions, ${messages.length} SMS messages`);
}

/** Objective 5 — baseline and endline survey rows behind the impact dashboard. */
async function seedImpact(farmers, agents) {
  const rows = [];
  const sample = pickMany(farmers.filter((f) => f.status === 'active'), 34);

  for (const farmer of sample) {
    const before = round(rand(280, 1100));
    const uplift = rand(1.08, 1.78); // the literature reports 10-60% gains
    rows.push({
      userId: farmer.id,
      period: pick(['2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2']),
      surveyType: pick(['baseline', 'midline', 'endline']),
      monthlyIncomeBefore: before,
      monthlyIncomeAfter: round(before * uplift),
      buyersReachedBefore: randInt(1, 3),
      buyersReachedAfter: randInt(3, 12),
      marketsAccessedBefore: randInt(1, 2),
      marketsAccessedAfter: randInt(2, 6),
      postHarvestLossBefore: round(rand(18, 34), 1),
      postHarvestLossAfter: round(rand(6, 17), 1),
      avgPriceReceivedBefore: round(rand(300, 700)),
      avgPriceReceivedAfter: round(rand(380, 880)),
      travelCostSaved: round(rand(40, 420)),
      soldThroughPlatform: chance(0.78),
      usesUssd: farmer.registrationChannel === 'ussd' || chance(0.7),
      usesSms: chance(0.85),
      usesWeb: chance(0.3),
      satisfactionScore: randInt(3, 5),
      wouldRecommend: chance(0.88),
      feedback: chance(0.5) ? pick([
        'Before, I sold everything to one middleman at his price. Now I know the Techiman price before he arrives.',
        'The SMS price alert saved me from selling maize two weeks too early.',
        'I do not have a smartphone, so dialling the code is what works for me.',
        'My daughter helps me read the messages, but I can dial the menu myself.',
        'I reached a buyer in Accra for the first time. He collected from the farm.',
      ]) : null,
      collectedBy: pick(agents).id,
      collectionMethod: pick(['field_agent', 'phone', 'ussd', 'sms']),
      createdAt: daysAgo(randInt(5, 180)),
    });
  }

  await ImpactRecord.bulkCreate(rows);
  logger.success(`Impact survey records: ${rows.length}`);
}

async function seedContent(produce, admin) {
  const tips = data.tips.map((t) => ({
    ...t,
    slug: slugify(t.title),
    isPublished: true,
    isFeatured: chance(0.4),
    views: randInt(20, 900),
    publishedAt: daysAgo(randInt(1, 120)),
    createdBy: admin.id,
    imageUrl: null,
    produceId: null,
  }));
  await FarmingTip.bulkCreate(tips);

  await Setting.bulkCreate(data.settings);
  logger.success(`Content: ${tips.length} articles, ${data.settings.length} settings`);
}

async function seedAlertsAndNotifications(farmers, produce) {
  const alerts = [];
  const notifications = [];
  const sample = pickMany(farmers.filter((f) => f.status === 'active'), 26);

  for (const farmer of sample) {
    const p = pick(produce);
    const base = data.produce.find((d) => d.name === p.name)?.basePrice || 500;
    alerts.push({
      userId: farmer.id,
      produceId: p.id,
      targetPrice: round(base * rand(1.02, 1.2)),
      unit: p.defaultUnit,
      direction: 'above',
      channel: 'both',
      regionId: farmer.regionId,
      source: chance(0.6) ? 'ussd' : 'web',
      isActive: true,
      createdAt: daysAgo(randInt(1, 60)),
    });

    notifications.push({
      userId: farmer.id,
      title: 'Market prices updated',
      message: `New ${p.name} prices have been published for markets in your region.`,
      type: 'price',
      icon: 'TrendingUp',
      link: '/prices',
      isRead: chance(0.5),
      createdAt: daysAgo(randInt(0, 14)),
    });
  }

  await PriceAlert.bulkCreate(alerts);
  await Notification.bulkCreate(notifications);
  logger.success(`Price alerts: ${alerts.length}, notifications: ${notifications.length}`);
}

/* ── entry point ─────────────────────────────────────────────────────── */

async function seed({ force = true } = {}) {
  const started = Date.now();
  logger.info('Seeding AgriMart Ghana…');

  if (force) {
    const { withoutForeignKeyChecks } = require('../config/database');
    await withoutForeignKeyChecks(() => db.sequelize.sync({ force: true }));
    logger.warn('Existing tables dropped and recreated');
  }

  const regionMap = await seedGeography();
  const { produce } = await seedProduce();
  const { superAdmin, admin, agents, farmers, buyers } = await seedUsers(regionMap);

  await seedPrices(produce, agents);
  const listings = await seedListings(farmers, produce);
  await seedOrders(listings, buyers, farmers);
  await seedOffers(listings, buyers);
  await seedChannelActivity(farmers, buyers);
  await seedImpact(farmers, agents);
  await seedContent(produce, admin);
  await seedAlertsAndNotifications(farmers, produce);

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  logger.success(`Seed complete in ${seconds}s`);

  console.log(`
  ┌──────────────────────────────────────────────────────────┐
  │  Sign-in details                                          │
  ├──────────────────────────────────────────────────────────┤
  │  Admin console   http://localhost:3000/admin              │
  │    email         ${env.seed.adminEmail.padEnd(38)}│
  │    password      ${env.seed.adminPassword.padEnd(38)}│
  │                                                           │
  │  Staff admin     akua.boakye@agrimart.gh / Admin@2026   │
  │  Field agent     agent.techiman@agrimart.gh / Agent@2026│
  │                                                           │
  │  Farmer (web)    farmer@agrimart.gh / Farmer@2026       │
  │  Buyer (web)     buyer@agrimart.gh / Buyer@2026         │
  │  Demo USSD       0244100200, PIN 1357                     │
  │                                                           │
  │  USSD PIN        farmers 1357   buyers 2468               │
  │  USSD code       ${env.ussd.serviceCode.padEnd(38)}│
  └──────────────────────────────────────────────────────────┘
  `);

  return { superAdmin, admin, farmers, buyers, listings };
}

/**
 * A production database: the reference data the platform cannot run without —
 * regions, districts, markets, categories, produce, farm guides and settings —
 * plus the owner's administrator account. No demo farmers, listings, orders or
 * prices, so the marketplace opens empty and fills with real trade.
 */
async function seedProduction() {
  const started = Date.now();
  logger.info('Preparing a production database…');

  const regionMap = await seedGeography();
  const { produce } = await seedProduce();

  const superAdmin = await User.create({
    fullName: 'System Administrator',
    phone: env.seed.adminPhone,
    email: env.seed.adminEmail,
    password: env.seed.adminPassword,
    role: 'superadmin',
    status: 'active',
    regionId: regionMap['Greater Accra'].id,
    registrationChannel: 'seed',
    isPhoneVerified: true,
    isEmailVerified: true,
    permissions: ['*'],
  });

  await seedContent(produce, superAdmin);

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  logger.success(`Production database ready in ${seconds}s`);
  return { superAdmin, produce };
}

module.exports = { seed, seedProduction };
