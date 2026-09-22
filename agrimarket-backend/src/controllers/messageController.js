const { Conversation, Message, User, Listing, Produce, Op } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created, paginated } = require('../utils/response');
const { paginate } = require('../utils/helpers');
const { sendSms } = require('../services/smsService');
const { emitToUser } = require('../sockets/io');
const { notify } = require('../services/notificationService');

const CONVERSATION_INCLUDES = [
  { model: User, as: 'buyer', attributes: ['id', 'fullName', 'avatarUrl', 'phone', 'businessName'] },
  { model: User, as: 'farmer', attributes: ['id', 'fullName', 'avatarUrl', 'phone', 'community'] },
  {
    model: Listing,
    as: 'listing',
    attributes: ['id', 'code', 'unit', 'pricePerUnit', 'images'],
    include: [{ model: Produce, as: 'produce', attributes: ['name', 'imageUrl'] }],
  },
];

/** GET /messages/conversations */
exports.conversations = asyncHandler(async (req, res) => {
  const rows = await Conversation.findAll({
    where: { [Op.or]: [{ buyerId: req.user.id }, { farmerId: req.user.id }], isArchived: false },
    include: CONVERSATION_INCLUDES,
    order: [['lastMessageAt', 'DESC']],
  });

  const data = rows.map((c) => {
    const isBuyer = c.buyerId === req.user.id;
    return {
      ...c.toJSON(),
      counterpart: isBuyer ? c.farmer : c.buyer,
      unread: isBuyer ? c.buyerUnread : c.farmerUnread,
    };
  });

  return ok(res, data);
});

/** POST /messages/conversations — start or reuse a thread about a listing. */
exports.startConversation = asyncHandler(async (req, res) => {
  const { listingId, message } = req.body;

  const listing = await Listing.findByPk(listingId, { include: [{ model: Produce, as: 'produce' }] });
  if (!listing) throw ApiError.notFound('Listing not found');
  if (listing.farmerId === req.user.id) throw ApiError.badRequest('You cannot message yourself');

  let conversation = await Conversation.findOne({
    where: { listingId, buyerId: req.user.id, farmerId: listing.farmerId },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      listingId,
      buyerId: req.user.id,
      farmerId: listing.farmerId,
    });
    await listing.increment('inquiries');
  }

  if (message) await postMessage(conversation, req.user, message, listing);

  const full = await Conversation.findByPk(conversation.id, { include: CONVERSATION_INCLUDES });
  return created(res, full, 'Conversation started');
});

/** GET /messages/conversations/:id */
exports.messages = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query, { limit: 50 });
  const conversation = await Conversation.findByPk(req.params.id, { include: CONVERSATION_INCLUDES });
  if (!conversation) throw ApiError.notFound('Conversation not found');

  const isBuyer = conversation.buyerId === req.user.id;
  const isFarmer = conversation.farmerId === req.user.id;
  if (!isBuyer && !isFarmer) throw ApiError.forbidden('This conversation is not yours');

  const { rows, count } = await Message.findAndCountAll({
    where: { conversationId: conversation.id },
    include: [{ model: User, as: 'sender', attributes: ['id', 'fullName', 'avatarUrl'] }],
    order: [['createdAt', 'ASC']],
    limit,
    offset,
  });

  // Clear this side's unread counter
  await conversation.update(isBuyer ? { buyerUnread: 0 } : { farmerUnread: 0 });
  await Message.update(
    { isRead: true, readAt: new Date() },
    { where: { conversationId: conversation.id, senderId: { [Op.ne]: req.user.id }, isRead: false } }
  );

  return paginated(res, { conversation, messages: rows }, { page, limit, total: count });
});

/** POST /messages/conversations/:id */
exports.send = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findByPk(req.params.id, {
    include: [{ model: Listing, as: 'listing', include: [{ model: Produce, as: 'produce' }] }],
  });
  if (!conversation) throw ApiError.notFound('Conversation not found');

  const isParty = [conversation.buyerId, conversation.farmerId].includes(req.user.id);
  if (!isParty) throw ApiError.forbidden('This conversation is not yours');

  const message = await postMessage(conversation, req.user, req.body.body, conversation.listing);
  return created(res, message, 'Message sent');
});

/**
 * Writes the message, bumps the thread, pushes it over the socket, and mirrors
 * it to SMS when the recipient is a farmer who may not be on the website.
 */
async function postMessage(conversation, sender, body, listing) {
  const isBuyer = conversation.buyerId === sender.id;
  const recipientId = isBuyer ? conversation.farmerId : conversation.buyerId;

  const message = await Message.create({
    conversationId: conversation.id,
    senderId: sender.id,
    body: String(body).substring(0, 2000),
  });

  await conversation.update({
    lastMessage: String(body).substring(0, 200),
    lastMessageAt: new Date(),
    ...(isBuyer ? { farmerUnread: conversation.farmerUnread + 1 } : { buyerUnread: conversation.buyerUnread + 1 }),
  });

  emitToUser(recipientId, 'message', {
    conversationId: conversation.id,
    message: message.toJSON(),
    from: { id: sender.id, fullName: sender.fullName, avatarUrl: sender.avatarUrl },
  });

  const recipient = await User.findByPk(recipientId);
  await notify({
    userId: recipientId,
    title: `Message from ${sender.fullName}`,
    message: String(body).substring(0, 150),
    type: 'system',
    icon: 'MessageSquare',
    link: `/dashboard/messages/${conversation.id}`,
  });

  // Farmers who registered over USSD get the message as an SMS instead
  if (recipient && recipient.registrationChannel === 'ussd' && recipient.smsNotifications) {
    await sendSms({
      to: recipient.phone,
      userId: recipient.id,
      message: `AgriMart - ${sender.fullName} (${listing?.produce?.name || 'your listing'}): ${String(body).substring(0, 100)}. Call ${sender.phone} to reply.`,
      type: 'system',
    });
    await message.update({ mirroredToSms: true });
  }

  return message;
}
