const env = require('../config/env');
/**
 * Reference data for AgriMart Ghana.
 *
 * Everything here is real: the 16 administrative regions created in 2019, the
 * physical markets traders actually use, the crops Ghanaian smallholders grow,
 * and price bands in the range these commodities trade at. Produce and
 * category photos come from the built-in library (see utils/catalogPhotos.js).
 */

/* ── Regions ─────────────────────────────────────────────────────────── */
const regions = [
  { name: 'Greater Accra', code: 'GA', capital: 'Accra', zone: 'Coastal', latitude: 5.6037, longitude: -0.1870 },
  { name: 'Ashanti', code: 'AS', capital: 'Kumasi', zone: 'Forest', latitude: 6.6885, longitude: -1.6244 },
  { name: 'Western', code: 'WR', capital: 'Sekondi-Takoradi', zone: 'Forest', latitude: 4.9344, longitude: -1.7133 },
  { name: 'Western North', code: 'WN', capital: 'Sefwi Wiawso', zone: 'Forest', latitude: 6.2100, longitude: -2.4850 },
  { name: 'Central', code: 'CR', capital: 'Cape Coast', zone: 'Coastal', latitude: 5.1053, longitude: -1.2466 },
  { name: 'Eastern', code: 'ER', capital: 'Koforidua', zone: 'Forest', latitude: 6.0940, longitude: -0.2590 },
  { name: 'Volta', code: 'VR', capital: 'Ho', zone: 'Coastal', latitude: 6.6100, longitude: 0.4700 },
  { name: 'Oti', code: 'OT', capital: 'Dambai', zone: 'Transitional', latitude: 8.0670, longitude: 0.1830 },
  { name: 'Northern', code: 'NR', capital: 'Tamale', zone: 'Savannah', latitude: 9.4034, longitude: -0.8424 },
  { name: 'Savannah', code: 'SV', capital: 'Damongo', zone: 'Savannah', latitude: 9.0830, longitude: -1.8170 },
  { name: 'North East', code: 'NE', capital: 'Nalerigu', zone: 'Savannah', latitude: 10.5240, longitude: -0.3660 },
  { name: 'Upper East', code: 'UE', capital: 'Bolgatanga', zone: 'Savannah', latitude: 10.7856, longitude: -0.8514 },
  { name: 'Upper West', code: 'UW', capital: 'Wa', zone: 'Savannah', latitude: 10.0601, longitude: -2.5099 },
  { name: 'Bono', code: 'BO', capital: 'Sunyani', zone: 'Transitional', latitude: 7.3349, longitude: -2.3123 },
  { name: 'Bono East', code: 'BE', capital: 'Techiman', zone: 'Transitional', latitude: 7.5907, longitude: -1.9390 },
  { name: 'Ahafo', code: 'AH', capital: 'Goaso', zone: 'Forest', latitude: 6.8000, longitude: -2.5170 },
];

/* ── Districts (a working subset of Ghana's 261 MMDAs) ───────────────── */
const districts = {
  'Greater Accra': ['Accra Metropolitan', 'Tema Metropolitan', 'Ga East', 'Ga West', 'Ga South', 'Ledzokuku', 'Adentan', 'Ashaiman', 'Ningo-Prampram', 'Shai-Osudoku'],
  Ashanti: ['Kumasi Metropolitan', 'Ejura-Sekyedumase', 'Mampong Municipal', 'Offinso Municipal', 'Ejisu Municipal', 'Asante Akim North', 'Atwima Nwabiagya', 'Sekyere East', 'Bekwai Municipal', 'Obuasi Municipal'],
  Western: ['Sekondi-Takoradi', 'Ahanta West', 'Nzema East', 'Ellembelle', 'Tarkwa-Nsuaem', 'Prestea-Huni Valley', 'Wassa East', 'Jomoro'],
  'Western North': ['Sefwi Wiawso', 'Bibiani-Anhwiaso-Bekwai', 'Aowin', 'Juaboso', 'Bia West', 'Suaman'],
  Central: ['Cape Coast Metropolitan', 'Mfantsiman', 'Agona West', 'Awutu Senya East', 'Komenda-Edina-Eguafo-Abirem', 'Assin North', 'Gomoa East', 'Twifo Atti-Morkwa'],
  Eastern: ['New Juaben South', 'Kwahu West', 'Akuapem North', 'Suhum', 'East Akim', 'West Akim', 'Fanteakwa North', 'Birim Central', 'Lower Manya Krobo'],
  Volta: ['Ho Municipal', 'Keta Municipal', 'Hohoe Municipal', 'Ketu South', 'South Tongu', 'North Tongu', 'Agotime-Ziope', 'Adaklu'],
  Oti: ['Krachi East', 'Krachi West', 'Nkwanta South', 'Nkwanta North', 'Jasikan', 'Kadjebi', 'Biakoye'],
  Northern: ['Tamale Metropolitan', 'Sagnarigu', 'Savelugu', 'Yendi Municipal', 'Tolon', 'Kumbungu', 'Gushegu', 'Karaga', 'Zabzugu', 'Nanumba North'],
  Savannah: ['West Gonja', 'East Gonja', 'Central Gonja', 'North Gonja', 'Bole', 'Sawla-Tuna-Kalba', 'North East Gonja'],
  'North East': ['East Mamprusi', 'West Mamprusi', 'Mamprugu Moagduri', 'Bunkpurugu-Nakpanduri', 'Chereponi', 'Yunyoo-Nasuan'],
  'Upper East': ['Bolgatanga Municipal', 'Kassena-Nankana Municipal', 'Bawku Municipal', 'Bongo', 'Talensi', 'Builsa North', 'Garu', 'Nabdam'],
  'Upper West': ['Wa Municipal', 'Nadowli-Kaleo', 'Jirapa Municipal', 'Lawra', 'Sissala East', 'Sissala West', 'Wa East', 'Daffiama-Bussie-Issa'],
  Bono: ['Sunyani Municipal', 'Berekum East', 'Dormaa Central', 'Wenchi Municipal', 'Jaman South', 'Tain', 'Banda'],
  'Bono East': ['Techiman Municipal', 'Kintampo North', 'Nkoranza South', 'Atebubu-Amantin', 'Pru East', 'Sene West', 'Kintampo South'],
  Ahafo: ['Asunafo North', 'Asunafo South', 'Asutifi North', 'Asutifi South', 'Tano North', 'Tano South'],
};

/* ── Markets ─────────────────────────────────────────────────────────── */
const markets = [
  { name: 'Agbogbloshie Market', region: 'Greater Accra', type: 'wholesale', isMajor: true, marketDays: 'Daily', description: "Ghana's largest food distribution hub, where produce from the north is broken down for Accra." },
  { name: 'Makola Market', region: 'Greater Accra', type: 'retail', isMajor: true, marketDays: 'Daily' },
  { name: 'Madina Market', region: 'Greater Accra', type: 'retail', marketDays: 'Daily' },
  { name: 'Kaneshie Market', region: 'Greater Accra', type: 'retail', marketDays: 'Daily' },
  { name: 'Ashaiman Market', region: 'Greater Accra', type: 'wholesale', marketDays: 'Tuesday, Friday' },
  { name: 'Kumasi Central Market', region: 'Ashanti', type: 'wholesale', isMajor: true, marketDays: 'Daily', description: 'West Africa’s largest open-air market, serving the whole middle belt.' },
  { name: 'Ejura Market', region: 'Ashanti', type: 'wholesale', isMajor: true, marketDays: 'Monday, Thursday', description: 'The grain market of the transition zone, best known for maize.' },
  { name: 'Mampong Market', region: 'Ashanti', type: 'wholesale', marketDays: 'Wednesday, Saturday' },
  { name: 'Techiman Market', region: 'Bono East', type: 'wholesale', isMajor: true, marketDays: 'Wednesday', description: 'The biggest weekly farm produce market in Ghana; prices set here move the country.' },
  { name: 'Kintampo Market', region: 'Bono East', type: 'wholesale', marketDays: 'Friday' },
  { name: 'Sunyani Central Market', region: 'Bono', type: 'wholesale', marketDays: 'Daily' },
  { name: 'Wenchi Market', region: 'Bono', type: 'farmgate', marketDays: 'Tuesday' },
  { name: 'Aboabo Market, Tamale', region: 'Northern', type: 'wholesale', isMajor: true, marketDays: 'Daily', description: 'The northern grain and legume hub for maize, rice, soya and cowpea.' },
  { name: 'Yendi Market', region: 'Northern', type: 'farmgate', marketDays: 'Friday' },
  { name: 'Bolgatanga Market', region: 'Upper East', type: 'wholesale', isMajor: true, marketDays: 'Every 3 days' },
  { name: 'Bawku Market', region: 'Upper East', type: 'wholesale', marketDays: 'Every 3 days', description: 'Cross-border trade with Burkina Faso, strong in onions and livestock.' },
  { name: 'Wa Central Market', region: 'Upper West', type: 'wholesale', isMajor: true, marketDays: 'Every 6 days' },
  { name: 'Damongo Market', region: 'Savannah', type: 'farmgate', marketDays: 'Saturday' },
  { name: 'Nalerigu Market', region: 'North East', type: 'farmgate', marketDays: 'Thursday' },
  { name: 'Kotokuraba Market', region: 'Central', type: 'retail', isMajor: true, marketDays: 'Daily' },
  { name: 'Mankessim Market', region: 'Central', type: 'wholesale', isMajor: true, marketDays: 'Tuesday, Friday', description: 'The coastal collection point for vegetables and fish heading to Accra.' },
  { name: 'Market Circle, Takoradi', region: 'Western', type: 'retail', isMajor: true, marketDays: 'Daily' },
  { name: 'Sefwi Wiawso Market', region: 'Western North', type: 'farmgate', marketDays: 'Saturday' },
  { name: 'Koforidua Central Market', region: 'Eastern', type: 'wholesale', isMajor: true, marketDays: 'Daily' },
  { name: 'Nkawkaw Market', region: 'Eastern', type: 'wholesale', marketDays: 'Monday, Thursday' },
  { name: 'Ho Central Market', region: 'Volta', type: 'wholesale', isMajor: true, marketDays: 'Daily' },
  { name: 'Denu Market', region: 'Volta', type: 'wholesale', marketDays: 'Wednesday, Saturday' },
  { name: 'Dambai Market', region: 'Oti', type: 'farmgate', marketDays: 'Friday' },
  { name: 'Goaso Market', region: 'Ahafo', type: 'farmgate', marketDays: 'Wednesday' },
];

/* ── Categories ──────────────────────────────────────────────────────── */
const categories = [
  { name: 'Cereals & Grains', icon: 'Wheat', color: '#d97706', sortOrder: 1, description: 'Maize, rice, millet and sorghum — the staples of the Ghanaian table.' },
  { name: 'Legumes & Pulses', icon: 'Bean', color: '#65a30d', sortOrder: 2, description: 'Cowpea, soybean and groundnut: protein crops that also fix nitrogen in the soil.' },
  { name: 'Roots & Tubers', icon: 'Carrot', color: '#b45309', sortOrder: 3, description: 'Cassava, yam and cocoyam — Ghana is among the world’s largest producers.' },
  { name: 'Vegetables', icon: 'Salad', color: '#16a34a', sortOrder: 4, description: 'Tomato, pepper, onion and leafy greens for daily markets.' },
  { name: 'Fruits', icon: 'Apple', color: '#ea580c', sortOrder: 5, description: 'Pineapple, mango, citrus and plantain for local sale and export.' },
  { name: 'Cash Crops', icon: 'TreePine', color: '#7c3aed', sortOrder: 6, description: 'Cocoa, cashew, shea and oil palm — Ghana’s export earners.' },
  { name: 'Livestock & Poultry', icon: 'Beef', color: '#dc2626', sortOrder: 7, description: 'Small ruminants, cattle, poultry and eggs.' },
  { name: 'Fish & Seafood', icon: 'Fish', color: '#0891b2', sortOrder: 8, description: 'Farmed tilapia and catfish plus coastal and Volta Lake catches.' },
  { name: 'Nuts & Oilseeds', icon: 'Nut', color: '#a16207', sortOrder: 9, description: 'Palm oil, shea, sesame and coconut.' },
];

/* ── Produce ─────────────────────────────────────────────────────────── */
/* basePrice is the national wholesale reference in GHS for the default unit. */
const produce = [
  // Cereals & Grains
  { name: 'Maize', category: 'Cereals & Grains', localNames: 'Aburo (Twi), Bli (Ewe), Kawana (Dagbani)', defaultUnit: 'bag (100kg)', units: ['bag (100kg)', 'bag (50kg)', 'kg', 'olonka'], basePrice: 760, seasonStart: 7, seasonEnd: 11, shelfLifeDays: 180, scientificName: 'Zea mays' },
  { name: 'Rice (Paddy)', category: 'Cereals & Grains', localNames: 'Emo (Twi), Mui (Dagbani)', defaultUnit: 'bag (100kg)', units: ['bag (100kg)', 'bag (50kg)', 'kg'], basePrice: 930, seasonStart: 9, seasonEnd: 12, shelfLifeDays: 240, scientificName: 'Oryza sativa' },
  { name: 'Millet', category: 'Cereals & Grains', localNames: 'Kanyua (Dagbani)', defaultUnit: 'bag (100kg)', units: ['bag (100kg)', 'kg', 'olonka'], basePrice: 820, seasonStart: 9, seasonEnd: 11, shelfLifeDays: 210 },
  { name: 'Sorghum', category: 'Cereals & Grains', localNames: 'Kazie (Dagbani)', defaultUnit: 'bag (100kg)', units: ['bag (100kg)', 'kg'], basePrice: 700, seasonStart: 10, seasonEnd: 12, shelfLifeDays: 210 },

  // Legumes & Pulses
  { name: 'Cowpea (Beans)', category: 'Legumes & Pulses', localNames: 'Adua (Twi), Tuya (Dagbani)', defaultUnit: 'bag (100kg)', units: ['bag (100kg)', 'bag (50kg)', 'kg', 'olonka'], basePrice: 1250, seasonStart: 8, seasonEnd: 11, shelfLifeDays: 300 },
  { name: 'Soybean', category: 'Legumes & Pulses', localNames: 'Soya', defaultUnit: 'bag (100kg)', units: ['bag (100kg)', 'kg'], basePrice: 880, seasonStart: 10, seasonEnd: 12, shelfLifeDays: 300 },
  { name: 'Groundnut', category: 'Legumes & Pulses', localNames: 'Nkate (Twi), Sinkaafa (Dagbani)', defaultUnit: 'bag (100kg)', units: ['bag (100kg)', 'bag (50kg)', 'kg', 'olonka'], basePrice: 1450, seasonStart: 9, seasonEnd: 12, shelfLifeDays: 240 },
  { name: 'Bambara Beans', category: 'Legumes & Pulses', localNames: 'Aboboe (Twi)', defaultUnit: 'bag (100kg)', units: ['bag (100kg)', 'kg', 'olonka'], basePrice: 1320, seasonStart: 10, seasonEnd: 12, shelfLifeDays: 270 },

  // Roots & Tubers
  { name: 'Cassava', category: 'Roots & Tubers', localNames: 'Bankye (Twi), Agbeli (Ewe)', defaultUnit: 'bag (100kg)', units: ['bag (100kg)', 'kg', 'ton'], basePrice: 360, isPerishable: true, shelfLifeDays: 5, scientificName: 'Manihot esculenta' },
  { name: 'Yam', category: 'Roots & Tubers', localNames: 'Bayere (Twi), Te (Ewe), Nyuya (Dagbani)', defaultUnit: 'tuber', units: ['tuber', '100 tubers', 'bag'], basePrice: 38, seasonStart: 8, seasonEnd: 1, shelfLifeDays: 90 },
  { name: 'Cocoyam', category: 'Roots & Tubers', localNames: 'Mankani (Twi)', defaultUnit: 'bag (100kg)', units: ['bag (100kg)', 'kg'], basePrice: 520, isPerishable: true, shelfLifeDays: 21 },
  { name: 'Sweet Potato', category: 'Roots & Tubers', localNames: 'Santom (Twi)', defaultUnit: 'bag (100kg)', units: ['bag (100kg)', 'kg', 'crate'], basePrice: 470, isPerishable: true, shelfLifeDays: 30 },
  { name: 'Irish Potato', category: 'Roots & Tubers', defaultUnit: 'bag (50kg)', units: ['bag (50kg)', 'kg'], basePrice: 690, isPerishable: true, shelfLifeDays: 45 },

  // Vegetables
  { name: 'Tomato', category: 'Vegetables', localNames: 'Ntoosi (Twi), Timatie (Dagbani)', defaultUnit: 'crate', units: ['crate', 'box', 'kg', 'basket'], basePrice: 1180, isPerishable: true, shelfLifeDays: 7, scientificName: 'Solanum lycopersicum' },
  { name: 'Onion', category: 'Vegetables', localNames: 'Gyeene (Twi), Alibasa (Dagbani)', defaultUnit: 'bag (100kg)', units: ['bag (100kg)', 'net', 'kg'], basePrice: 920, isPerishable: true, shelfLifeDays: 45 },
  { name: 'Chilli Pepper', category: 'Vegetables', localNames: 'Mako (Twi), Nanma (Dagbani)', defaultUnit: 'bag', units: ['bag', 'basket', 'kg'], basePrice: 1520, isPerishable: true, shelfLifeDays: 10 },
  { name: 'Garden Eggs', category: 'Vegetables', localNames: 'Nyaadewa (Twi)', defaultUnit: 'bag', units: ['bag', 'basket', 'crate', 'kg'], basePrice: 620, isPerishable: true, shelfLifeDays: 10 },
  { name: 'Okra', category: 'Vegetables', localNames: 'Nkruma (Twi), Fetri (Ewe)', defaultUnit: 'bag', units: ['bag', 'basket', 'kg'], basePrice: 710, isPerishable: true, shelfLifeDays: 5 },
  { name: 'Cabbage', category: 'Vegetables', defaultUnit: 'bag', units: ['bag', 'head', 'kg'], basePrice: 420, isPerishable: true, shelfLifeDays: 14 },
  { name: 'Carrot', category: 'Vegetables', defaultUnit: 'bag (50kg)', units: ['bag (50kg)', 'kg', 'crate'], basePrice: 660, isPerishable: true, shelfLifeDays: 21 },
  { name: 'Lettuce', category: 'Vegetables', defaultUnit: 'crate', units: ['crate', 'head', 'kg'], basePrice: 310, isPerishable: true, shelfLifeDays: 5 },

  // Fruits
  { name: 'Pineapple', category: 'Fruits', localNames: 'Aborobe (Twi)', defaultUnit: 'piece', units: ['piece', 'crate', 'dozen'], basePrice: 13, isPerishable: true, shelfLifeDays: 10 },
  { name: 'Mango', category: 'Fruits', localNames: 'Amango (Twi)', defaultUnit: 'crate', units: ['crate', 'basket', 'kg', 'dozen'], basePrice: 410, isPerishable: true, shelfLifeDays: 10, seasonStart: 3, seasonEnd: 7 },
  { name: 'Watermelon', category: 'Fruits', defaultUnit: 'piece', units: ['piece', 'kg'], basePrice: 27, isPerishable: true, shelfLifeDays: 14 },
  { name: 'Orange', category: 'Fruits', localNames: 'Ankaa (Twi)', defaultUnit: 'bag', units: ['bag', 'dozen', 'crate'], basePrice: 360, isPerishable: true, shelfLifeDays: 21, seasonStart: 10, seasonEnd: 2 },
  { name: 'Plantain', category: 'Fruits', localNames: 'Borode (Twi), Abladzo (Ewe)', defaultUnit: 'bunch', units: ['bunch', 'finger', 'bag'], basePrice: 95, isPerishable: true, shelfLifeDays: 10 },
  { name: 'Banana', category: 'Fruits', localNames: 'Kwadu (Twi)', defaultUnit: 'bunch', units: ['bunch', 'box', 'kg'], basePrice: 62, isPerishable: true, shelfLifeDays: 7 },
  { name: 'Pawpaw', category: 'Fruits', localNames: 'Borofere (Twi)', defaultUnit: 'piece', units: ['piece', 'crate', 'kg'], basePrice: 16, isPerishable: true, shelfLifeDays: 7 },
  { name: 'Avocado', category: 'Fruits', localNames: 'Paya (Twi)', defaultUnit: 'crate', units: ['crate', 'piece', 'kg'], basePrice: 320, isPerishable: true, shelfLifeDays: 10, seasonStart: 6, seasonEnd: 10 },

  // Cash Crops
  { name: 'Cocoa Beans', category: 'Cash Crops', localNames: 'Kookoo (Twi)', defaultUnit: 'bag (64kg)', units: ['bag (64kg)', 'kg', 'ton'], basePrice: 3100, seasonStart: 10, seasonEnd: 3, shelfLifeDays: 365, scientificName: 'Theobroma cacao' },
  { name: 'Cashew Nuts', category: 'Cash Crops', defaultUnit: 'bag (80kg)', units: ['bag (80kg)', 'kg', 'ton'], basePrice: 1150, seasonStart: 2, seasonEnd: 5, shelfLifeDays: 300 },
  { name: 'Shea Nuts', category: 'Cash Crops', localNames: 'Taanga (Dagbani)', defaultUnit: 'bag (85kg)', units: ['bag (85kg)', 'kg'], basePrice: 830, seasonStart: 5, seasonEnd: 8, shelfLifeDays: 300 },
  { name: 'Oil Palm Fruit', category: 'Cash Crops', localNames: 'Abe (Twi)', defaultUnit: 'bunch', units: ['bunch', 'ton', 'kg'], basePrice: 130, isPerishable: true, shelfLifeDays: 3 },
  { name: 'Coffee', category: 'Cash Crops', defaultUnit: 'bag (60kg)', units: ['bag (60kg)', 'kg'], basePrice: 1280, shelfLifeDays: 365 },

  // Livestock & Poultry
  { name: 'Broiler Chicken', category: 'Livestock & Poultry', localNames: 'Akoko (Twi)', defaultUnit: 'bird', units: ['bird', 'crate', 'kg'], basePrice: 95, isPerishable: true, shelfLifeDays: 2 },
  { name: 'Eggs', category: 'Livestock & Poultry', localNames: 'Kosua (Twi)', defaultUnit: 'crate (30)', units: ['crate (30)', 'dozen', 'piece'], basePrice: 62, isPerishable: true, shelfLifeDays: 21 },
  { name: 'Goat', category: 'Livestock & Poultry', localNames: 'Aponkye (Twi), Bua (Dagbani)', defaultUnit: 'head', units: ['head', 'kg'], basePrice: 920 },
  { name: 'Sheep', category: 'Livestock & Poultry', localNames: 'Oguan (Twi)', defaultUnit: 'head', units: ['head', 'kg'], basePrice: 1250 },
  { name: 'Cattle', category: 'Livestock & Poultry', localNames: 'Nantwi (Twi), Nahu (Dagbani)', defaultUnit: 'head', units: ['head', 'kg'], basePrice: 8200 },
  { name: 'Guinea Fowl', category: 'Livestock & Poultry', localNames: 'Kpaa (Dagbani)', defaultUnit: 'bird', units: ['bird', 'crate'], basePrice: 160 },
  { name: 'Pig', category: 'Livestock & Poultry', localNames: 'Prako (Twi)', defaultUnit: 'head', units: ['head', 'kg'], basePrice: 1600 },

  // Fish & Seafood
  { name: 'Tilapia', category: 'Fish & Seafood', localNames: 'Apatre (Twi)', defaultUnit: 'crate', units: ['crate', 'kg', 'basket'], basePrice: 940, isPerishable: true, shelfLifeDays: 2 },
  { name: 'Catfish', category: 'Fish & Seafood', localNames: 'Adwene (Twi)', defaultUnit: 'kg', units: ['kg', 'crate', 'basket'], basePrice: 48, isPerishable: true, shelfLifeDays: 2 },
  { name: 'Smoked Fish', category: 'Fish & Seafood', defaultUnit: 'basket', units: ['basket', 'kg', 'carton'], basePrice: 520, shelfLifeDays: 60 },

  // Nuts & Oilseeds
  { name: 'Palm Oil', category: 'Nuts & Oilseeds', localNames: 'Abe ngo (Twi)', defaultUnit: 'gallon (25L)', units: ['gallon (25L)', 'gallon (5L)', 'litre', 'drum'], basePrice: 470, shelfLifeDays: 365 },
  { name: 'Coconut', category: 'Nuts & Oilseeds', localNames: 'Kube (Twi)', defaultUnit: 'piece', units: ['piece', 'bag', 'dozen'], basePrice: 11, isPerishable: true, shelfLifeDays: 30 },
  { name: 'Sesame Seed', category: 'Nuts & Oilseeds', defaultUnit: 'bag (80kg)', units: ['bag (80kg)', 'kg'], basePrice: 940, shelfLifeDays: 300 },
  { name: 'Shea Butter', category: 'Nuts & Oilseeds', localNames: 'Nkuto (Twi)', defaultUnit: 'bucket', units: ['bucket', 'kg', 'carton'], basePrice: 330, shelfLifeDays: 365 },
];

/**
 * Regional price multipliers. Produce is cheapest at the farmgate in the north
 * and dearest in coastal retail markets — this is exactly the information
 * asymmetry the platform exists to close, so the seed data reflects it.
 */
const marketMultipliers = {
  'Agbogbloshie Market': 1.18,
  'Makola Market': 1.32,
  'Madina Market': 1.30,
  'Kaneshie Market': 1.28,
  'Ashaiman Market': 1.15,
  'Kumasi Central Market': 1.06,
  'Ejura Market': 0.88,
  'Mampong Market': 0.92,
  'Techiman Market': 0.86,
  'Kintampo Market': 0.87,
  'Sunyani Central Market': 0.98,
  'Wenchi Market': 0.85,
  'Aboabo Market, Tamale': 0.82,
  'Yendi Market': 0.79,
  'Bolgatanga Market': 0.84,
  'Bawku Market': 0.81,
  'Wa Central Market': 0.83,
  'Damongo Market': 0.80,
  'Nalerigu Market': 0.80,
  'Kotokuraba Market': 1.20,
  'Mankessim Market': 1.08,
  'Market Circle, Takoradi': 1.22,
  'Sefwi Wiawso Market': 0.94,
  'Koforidua Central Market': 1.10,
  'Nkawkaw Market': 1.02,
  'Ho Central Market': 1.05,
  'Denu Market': 1.03,
  'Dambai Market': 0.88,
  'Goaso Market': 0.93,
};

/* ── Farming knowledge base ──────────────────────────────────────────── */
const tips = [
  {
    title: 'Cut post-harvest maize losses with proper drying',
    category: 'storage',
    excerpt: 'Maize stored above 13.5% moisture attracts weevils and aflatoxin. Here is how to test moisture without a meter.',
    smsVersion: 'AgriMart TIP: Dry maize until a grain breaks cleanly when bitten (about 13% moisture) before bagging. Store on pallets, not on the floor, and turn bags monthly to stop weevils.',
    readMinutes: 4,
    content: `Post-harvest loss is the quietest thief on a Ghanaian farm. Between 15% and 30% of a maize harvest can be lost between the field and the market, and almost all of it comes down to moisture.

**Test moisture without a meter.** Bite a grain. If it breaks cleanly with a sharp crack, the moisture is around 13% and it is safe to bag. If it dents or feels soft, it needs another day on the drying floor.

**Dry on a raised surface.** Drying maize directly on bare ground pulls moisture back into the grain overnight and introduces soil fungi. Use a tarpaulin, a concrete floor, or raised drying racks.

**Bag and stack correctly.** Store bags on wooden pallets at least 10cm off the floor and 30cm away from walls. Air must move around every bag. Hermetic bags (PICS bags) cut weevil damage dramatically without chemicals and pay for themselves in a single season.

**Watch for aflatoxin.** Grain that has been rained on after maturity, or stored damp, develops aflatoxin — a toxin that buyers increasingly test for and that makes the grain unsellable to processors. Discard visibly mouldy cobs rather than mixing them into the good stock; one bad bag can contaminate a lot.

**Time your sale.** Prices for maize in Ghana typically bottom out in the two months after the major harvest and rise 30-60% by the lean season. If you can store safely, storage is one of the highest-return decisions available to you. Use the price alerts on AgriMart to be told when your target price is reached rather than guessing.`,
  },
  {
    title: 'When to sell tomatoes and when to hold',
    category: 'marketing',
    excerpt: 'Tomato prices in Ghana swing more than any other crop. Read the market, not the rumour.',
    smsVersion: `AgriMart TIP: Tomato prices peak Jun-Sep when Burkina imports stop. Check prices in 3 markets before you load a truck. Dial ${env.ussd.serviceCode} option 2.`,
    readMinutes: 3,
    content: `Tomato is the most volatile commodity in Ghanaian markets. A crate that fetches GHS 400 in December can fetch GHS 1,800 in July. Understanding why protects you from selling at the bottom.

**The import cycle drives the price.** Between November and March, large volumes arrive from Burkina Faso and prices fall. When those flows slow from June onwards, domestic prices climb sharply.

**Tomatoes will not wait for you.** With a shelf life of about a week, holding stock is rarely an option. What you can control is *where* you sell. The spread between Techiman and Makola on the same day is routinely 30-40%.

**Compare three markets before loading a truck.** Transport from Techiman to Accra costs money and time. If the Accra premium does not exceed transport plus spoilage, sell locally. The price comparison tool on AgriMart shows you the spread for the day so the decision is arithmetic rather than hope.

**Grade before you sell.** Separating firm, unblemished fruit into its own crate and selling it as Grade A regularly earns 20% more than selling a mixed crate, because the buyer does not have to price in the risk of what is underneath.`,
  },
  {
    title: 'Fall armyworm: identify it early, treat it cheaply',
    category: 'pest_control',
    excerpt: 'The window to save a maize crop from armyworm is about ten days. Know what to look for.',
    smsVersion: 'AgriMart TIP: Check maize funnels weekly for wet sawdust-like frass = fall armyworm. Treat at dawn or dusk when larvae feed. Contact your MoFA extension officer for approved pesticide.',
    readMinutes: 5,
    content: `Fall armyworm has been established in Ghana since 2016 and remains the single biggest pest threat to maize. Losses of 40% are common when it is caught late, and near zero when caught early.

**What to look for.** Inspect the funnel (the whorl at the centre of the plant) weekly from two weeks after emergence. The giveaway is frass — moist, sawdust-like droppings sitting in the whorl. Leaves show ragged, window-pane holes rather than clean bites.

**Identify the larva.** Fall armyworm has an inverted pale Y on the head capsule and four dark spots arranged in a square on the second-to-last segment. This matters because the treatment differs from stem borer.

**Timing beats dosage.** Larvae feed at dawn and dusk and hide deep in the whorl during the heat of the day. Spraying at midday wastes chemical and money. Apply early morning or late evening, directing the nozzle into the funnel rather than over the canopy.

**Low-cost options that work.** Where pesticide is unaffordable, a pinch of dry sand or wood ash dropped into the whorl abrades and kills small larvae. Neem seed extract at 50g per litre, applied twice a week apart, gives useful suppression. Intercropping with cowpea reduces egg-laying.

**Always consult your district MoFA extension officer** before using any pesticide, and observe the pre-harvest interval on the label. Residue above the limit will cost you an aggregator contract.`,
  },
  {
    title: 'Why a mobile money record is your route to credit',
    category: 'finance',
    excerpt: 'Formal lenders reject smallholders for lack of records. Your phone can build that record for free.',
    smsVersion: 'AgriMart TIP: Take payment through MoMo, not cash. A 6-month record of sales is what banks and MFIs ask for when you apply for input credit.',
    readMinutes: 4,
    content: `The most common reason a Ghanaian smallholder is refused a loan is not the size of the farm. It is the absence of any record that the farm earns money.

**Cash leaves no trace.** A farmer selling GHS 40,000 of maize a year entirely in cash appears, to a lender, to earn nothing. The same farmer taking payment through mobile money has a verifiable transaction history that rural and community banks now accept.

**Use one number consistently.** Switching between numbers fragments the history. Register your AgriMart account and your MoMo wallet on the same number so sales and receipts line up.

**Keep the sale on the platform.** Every completed order on AgriMart produces a dated record of what you sold, to whom, at what price. Printed from your dashboard, this is exactly the evidence an MFI asks for, and it costs you nothing to accumulate.

**What lenders look for.** Six months of consistent inflows, a balance that does not go to zero immediately after every deposit, and evidence of repeat buyers. Building this deliberately over one season changes what is available to you in the next.`,
  },
  {
    title: 'Planting with the rains: reading the season in the north',
    category: 'planting',
    excerpt: 'A false start costs a whole planting. Wait for the rain that stays.',
    smsVersion: 'AgriMart TIP: In N. Ghana wait for 2 rains over 20mm within 7 days before planting maize. Planting on the first rain risks losing the seed if a dry spell follows.',
    readMinutes: 4,
    content: `In the Guinea and Sudan savannah zones the single rainy season leaves no room for a second attempt. Planting on a false start is one of the most expensive mistakes available.

**Wait for the rain that stays.** The rule used by extension services is two rainfall events each above 20mm within a seven-day window. A single heavy downpour in April is very often followed by a two-week dry spell that kills germinating seed.

**Match the variety to the remaining season.** If planting is late, switch to a short-duration variety (90 days rather than 120). Planting a long-duration variety late guarantees that grain filling coincides with the end of the rains.

**Plant at the right spacing.** Maize at 75cm between rows and 40cm within rows, two seeds per hill, gives about 66,000 plants per hectare. Crowding reduces cob size far more than most farmers expect.

**Apply basal fertiliser at planting, not later.** Nitrogen applied at three weeks and again at six weeks (split application) consistently outperforms a single dose, because the plant cannot take up what it does not yet need and the rest leaches away.`,
  },
  {
    title: 'Grading produce: the cheapest way to raise your price',
    category: 'marketing',
    excerpt: 'Sorting costs you an afternoon and routinely adds 15-25% to the price you receive.',
    smsVersion: 'AgriMart TIP: Sort produce into Grade A and B before selling. Buyers pay more for a uniform crate because they can resell it without re-sorting.',
    readMinutes: 3,
    content: `Buyers do not pay for quality. They pay for *certainty* about quality — and grading is how you give it to them.

**Why a mixed load is discounted.** When an aggregator buys an ungraded crate, they must assume the worst of what is underneath and price accordingly. That discount is far larger than the value of the poor fruit you slipped in.

**Grade A, B, C.** Grade A is uniform in size, firm, unblemished and clean. Grade B has minor cosmetic defects but is sound. Grade C is for immediate processing. Sell them as three separate lots at three prices rather than one lot at the lowest.

**Present it properly.** Clean crates, consistent fill, and no stones or soil at the bottom. A buyer who finds filler once will discount everything you bring thereafter, and word travels quickly in a market.

**Record the grade on your listing.** On AgriMart the grade is shown to every buyer browsing, and Grade A listings are viewed substantially more often than ungraded ones.`,
  },
  {
    title: 'Storing yam so it lasts to the lean season',
    category: 'storage',
    excerpt: 'Yam prices double between harvest and March. Curing and a proper barn are what let you wait.',
    smsVersion: 'AgriMart TIP: Cure yam tubers 7 days in shade after harvest before storing. Keep in a ventilated barn off the ground. Remove any rotting tuber immediately.',
    readMinutes: 4,
    content: `Yam harvested in August and sold in August competes with everyone else's yam. The same tuber in February is worth roughly twice as much. Storage is the difference.

**Cure first.** Leave freshly harvested tubers in a shaded, well-ventilated place for five to seven days. Curing heals the small wounds from lifting, and an uncured wound is the entry point for rot.

**Handle as little as possible.** Every drop bruises the tuber. Bruised tubers rot first and then take their neighbours with them.

**Build a proper barn.** Traditional yam barns work: vertical poles with tubers tied individually, under a thatch or shade roof, raised off the ground. Air must circulate around every tuber. Heaping yam in a corner of a room guarantees losses.

**Inspect fortnightly.** Remove any tuber showing soft spots or mould at once. One rotting tuber left in place can spoil a dozen around it.

**Sprouting.** From around January tubers begin to sprout, which draws down the flesh. Rubbing off sprouts as they appear extends usable storage by several weeks.`,
  },
  {
    title: 'Selling to aggregators: what to agree before you load',
    category: 'marketing',
    excerpt: 'Most disputes come from three things left unsaid: moisture, weight and payment timing.',
    smsVersion: 'AgriMart TIP: Before selling to an aggregator agree moisture standard, who weighs, and when payment lands. Get it in writing or on the AgriMart order.',
    readMinutes: 3,
    content: `An aggregator contract can be the best price available to a smallholder, or the source of a season's worth of grief. The difference is what gets agreed before the truck is loaded.

**Moisture standard.** Agree the acceptable moisture percentage and who measures it, using whose meter. "We will deduct for moisture" without a number is an open invitation to deduct arbitrarily.

**Weighing.** Agree where weighing happens and whose scale is used. Weighing at the buyer's warehouse after transport, on their scale, with you absent, is how weight quietly disappears.

**Payment timing.** Cash on collection, or a stated number of days? If it is deferred, what happens if it is late? A verbal promise of "end of week" has no force.

**Rejection terms.** What happens to a load that is rejected on arrival? Who pays the return transport?

**Put it on the platform.** An AgriMart order records the quantity, unit price, grade and agreed total, timestamped, visible to both sides and to our support desk if a dispute arises. That record is worth having even when you have traded with the buyer for years.`,
  },
];

/* ── Platform settings ───────────────────────────────────────────────── */
const settings = [
  { key: 'platform_name', value: 'AgriMart Ghana', type: 'string', group: 'general', label: 'Platform name', isPublic: true },
  { key: 'platform_tagline', value: 'Every farmer, every market, every price — on any phone.', type: 'string', group: 'general', label: 'Tagline', isPublic: true },
  { key: 'support_phone', value: '0302000000', type: 'string', group: 'general', label: 'Support line', isPublic: true },
  { key: 'support_email', value: 'support@agrimart.gh', type: 'string', group: 'general', label: 'Support email', isPublic: true },
  { key: 'ussd_code', value: process.env.USSD_SERVICE_CODE || `${env.ussd.serviceCode}`, type: 'string', group: 'ussd', label: 'USSD short code', isPublic: true },
  { key: 'sms_short_code', value: '1234', type: 'string', group: 'sms', label: 'SMS short code', isPublic: true },
  { key: 'commission_rate', value: '0.03', type: 'number', group: 'marketplace', label: 'Platform commission', description: 'Fraction of each completed order retained by the platform' },
  { key: 'min_withdrawal', value: '10', type: 'number', group: 'payment', label: 'Minimum withdrawal (GHS)' },
  { key: 'withdrawal_fee_rate', value: '0.01', type: 'number', group: 'payment', label: 'Withdrawal fee' },
  { key: 'listing_expiry_days', value: '45', type: 'number', group: 'marketplace', label: 'Listing lifetime (days)' },
  { key: 'perishable_expiry_days', value: '7', type: 'number', group: 'marketplace', label: 'Perishable listing lifetime (days)' },
  { key: 'auto_approve_listings', value: 'true', type: 'boolean', group: 'marketplace', label: 'Publish listings without review', description: 'Farmers on USSD need instant confirmation; moderation happens after publication' },
  { key: 'max_active_listings', value: '25', type: 'number', group: 'marketplace', label: 'Open listings per farmer', description: 'How many listings one farmer may have on the marketplace at once. 0 removes the limit.' },
  { key: 'daily_digest_enabled', value: 'true', type: 'boolean', group: 'sms', label: 'Send the 06:30 price digest' },
  { key: 'sms_sender_id', value: 'AgriMart', type: 'string', group: 'sms', label: 'SMS sender ID' },
  { key: 'maintenance_mode', value: 'false', type: 'boolean', group: 'general', label: 'Maintenance mode', isPublic: true },
  { key: 'registration_open', value: 'true', type: 'boolean', group: 'security', label: 'Allow new registrations', isPublic: true },
  { key: 'max_listing_images', value: '5', type: 'number', group: 'marketplace', label: 'Images per listing' },
  { key: 'office_address', value: 'Agric Ridge, Accra, Ghana', type: 'string', group: 'general', label: 'Office address', isPublic: true },
];

module.exports = { regions, districts, markets, categories, produce, marketMultipliers, tips, settings };
