const { sequelize, Sequelize } = require('../config/database');
const { DataTypes } = Sequelize;

// ── Reference data ──────────────────────────────────────────────────────────
const Region = require('./Region')(sequelize, DataTypes);
const District = require('./District')(sequelize, DataTypes);
const Market = require('./Market')(sequelize, DataTypes);
const Category = require('./Category')(sequelize, DataTypes);
const Produce = require('./Produce')(sequelize, DataTypes);

// ── Core domain ─────────────────────────────────────────────────────────────
const User = require('./User')(sequelize, DataTypes);
const Listing = require('./Listing')(sequelize, DataTypes);
const Order = require('./Order')(sequelize, DataTypes);
const Offer = require('./Offer')(sequelize, DataTypes);
const MarketPrice = require('./MarketPrice')(sequelize, DataTypes);
const PriceAlert = require('./PriceAlert')(sequelize, DataTypes);
const Transaction = require('./Transaction')(sequelize, DataTypes);
const Review = require('./Review')(sequelize, DataTypes);
const Favorite = require('./Favorite')(sequelize, DataTypes);
const Conversation = require('./Conversation')(sequelize, DataTypes);
const Message = require('./Message')(sequelize, DataTypes);

// ── Channels & operations ───────────────────────────────────────────────────
const SmsMessage = require('./SmsMessage')(sequelize, DataTypes);
const UssdSession = require('./UssdSession')(sequelize, DataTypes);
const Notification = require('./Notification')(sequelize, DataTypes);
const Broadcast = require('./Broadcast')(sequelize, DataTypes);
const Otp = require('./Otp')(sequelize, DataTypes);
const SupportTicket = require('./SupportTicket')(sequelize, DataTypes);
const AuditLog = require('./AuditLog')(sequelize, DataTypes);
const Setting = require('./Setting')(sequelize, DataTypes);
const FarmingTip = require('./FarmingTip')(sequelize, DataTypes);
const ImpactRecord = require('./ImpactRecord')(sequelize, DataTypes);

/* ──────────────────────────────────────────────────────────────────────────
   Associations
   ────────────────────────────────────────────────────────────────────────── */

// Geography
Region.hasMany(District, { foreignKey: 'regionId', as: 'districts' });
District.belongsTo(Region, { foreignKey: 'regionId', as: 'region' });

Region.hasMany(Market, { foreignKey: 'regionId', as: 'markets' });
Market.belongsTo(Region, { foreignKey: 'regionId', as: 'region' });
Market.belongsTo(District, { foreignKey: 'districtId', as: 'district' });

// Produce taxonomy
Category.hasMany(Produce, { foreignKey: 'categoryId', as: 'produces' });
Produce.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

// Users
User.belongsTo(Region, { foreignKey: 'regionId', as: 'region' });
User.belongsTo(District, { foreignKey: 'districtId', as: 'district' });
Region.hasMany(User, { foreignKey: 'regionId', as: 'users' });

// Listings
User.hasMany(Listing, { foreignKey: 'farmerId', as: 'listings' });
Listing.belongsTo(User, { foreignKey: 'farmerId', as: 'farmer' });
Listing.belongsTo(Produce, { foreignKey: 'produceId', as: 'produce' });
Listing.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Listing.belongsTo(Region, { foreignKey: 'regionId', as: 'region' });
Listing.belongsTo(District, { foreignKey: 'districtId', as: 'district' });
Listing.belongsTo(User, { foreignKey: 'moderatedBy', as: 'moderator' });
Produce.hasMany(Listing, { foreignKey: 'produceId', as: 'listings' });

// Orders
Listing.hasMany(Order, { foreignKey: 'listingId', as: 'orders' });
Order.belongsTo(Listing, { foreignKey: 'listingId', as: 'listing' });
Order.belongsTo(User, { foreignKey: 'buyerId', as: 'buyer' });
Order.belongsTo(User, { foreignKey: 'farmerId', as: 'farmer' });
User.hasMany(Order, { foreignKey: 'buyerId', as: 'purchases' });
User.hasMany(Order, { foreignKey: 'farmerId', as: 'sales' });

// Offers
Listing.hasMany(Offer, { foreignKey: 'listingId', as: 'offers' });
Offer.belongsTo(Listing, { foreignKey: 'listingId', as: 'listing' });
Offer.belongsTo(User, { foreignKey: 'buyerId', as: 'buyer' });
Offer.belongsTo(User, { foreignKey: 'farmerId', as: 'farmer' });

// Market prices
MarketPrice.belongsTo(Produce, { foreignKey: 'produceId', as: 'produce' });
MarketPrice.belongsTo(Market, { foreignKey: 'marketId', as: 'market' });
MarketPrice.belongsTo(Region, { foreignKey: 'regionId', as: 'region' });
MarketPrice.belongsTo(User, { foreignKey: 'recordedBy', as: 'recorder' });
Produce.hasMany(MarketPrice, { foreignKey: 'produceId', as: 'prices' });
Market.hasMany(MarketPrice, { foreignKey: 'marketId', as: 'prices' });

// Price alerts
PriceAlert.belongsTo(User, { foreignKey: 'userId', as: 'user' });
PriceAlert.belongsTo(Produce, { foreignKey: 'produceId', as: 'produce' });
PriceAlert.belongsTo(Market, { foreignKey: 'marketId', as: 'market' });
// aliased "alerts" because User already has a priceAlerts boolean preference
User.hasMany(PriceAlert, { foreignKey: 'userId', as: 'alerts' });

// Transactions
Transaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Transaction.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
User.hasMany(Transaction, { foreignKey: 'userId', as: 'transactions' });
Order.hasMany(Transaction, { foreignKey: 'orderId', as: 'transactions' });

// Reviews
Review.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
Review.belongsTo(User, { foreignKey: 'reviewerId', as: 'reviewer' });
Review.belongsTo(User, { foreignKey: 'revieweeId', as: 'reviewee' });
User.hasMany(Review, { foreignKey: 'revieweeId', as: 'reviewsReceived' });

// Favorites
Favorite.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Favorite.belongsTo(Listing, { foreignKey: 'listingId', as: 'listing' });
User.hasMany(Favorite, { foreignKey: 'userId', as: 'favorites' });
Listing.hasMany(Favorite, { foreignKey: 'listingId', as: 'favoritedBy' });

// Messaging
Conversation.belongsTo(User, { foreignKey: 'buyerId', as: 'buyer' });
Conversation.belongsTo(User, { foreignKey: 'farmerId', as: 'farmer' });
Conversation.belongsTo(Listing, { foreignKey: 'listingId', as: 'listing' });
Conversation.hasMany(Message, { foreignKey: 'conversationId', as: 'messages' });
Message.belongsTo(Conversation, { foreignKey: 'conversationId', as: 'conversation' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

// Channels
SmsMessage.belongsTo(User, { foreignKey: 'userId', as: 'user' });
SmsMessage.belongsTo(Broadcast, { foreignKey: 'broadcastId', as: 'broadcast' });
Broadcast.hasMany(SmsMessage, { foreignKey: 'broadcastId', as: 'messages' });
Broadcast.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
UssdSession.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(UssdSession, { foreignKey: 'userId', as: 'ussdSessions' });

// Notifications
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });

// Support & audit
SupportTicket.belongsTo(User, { foreignKey: 'userId', as: 'user' });
SupportTicket.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignee' });
// A complaint raised from an order keeps that order alongside the evidence
SupportTicket.belongsTo(Order, { foreignKey: 'orderId', as: 'order', constraints: false });
Order.hasMany(SupportTicket, { foreignKey: 'orderId', as: 'tickets', constraints: false });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'actor' });

// Content
FarmingTip.belongsTo(Produce, { foreignKey: 'produceId', as: 'produce' });
FarmingTip.belongsTo(Region, { foreignKey: 'regionId', as: 'region' });

// Impact evaluation
ImpactRecord.belongsTo(User, { foreignKey: 'userId', as: 'farmer' });
User.hasMany(ImpactRecord, { foreignKey: 'userId', as: 'impactRecords' });

const db = {
  sequelize,
  Sequelize,
  Op: Sequelize.Op,
  Region, District, Market, Category, Produce,
  User, Listing, Order, Offer, MarketPrice, PriceAlert,
  Transaction, Review, Favorite, Conversation, Message,
  SmsMessage, UssdSession, Notification, Broadcast, Otp,
  SupportTicket, AuditLog, Setting, FarmingTip, ImpactRecord,
};

module.exports = db;
