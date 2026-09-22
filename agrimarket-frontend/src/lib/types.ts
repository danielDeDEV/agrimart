export type UserRole = 'farmer' | 'buyer' | 'agent' | 'admin' | 'superadmin';
export type Channel = 'ussd' | 'web' | 'sms' | 'agent' | 'seed';

export interface Region {
  id: number;
  name: string;
  code: string;
  capital?: string;
  zone?: string;
  districts?: District[];
}

export interface District {
  id: number;
  regionId: number;
  name: string;
}

export interface Market {
  id: number;
  name: string;
  slug: string;
  regionId: number;
  type: 'wholesale' | 'retail' | 'farmgate' | 'export';
  marketDays?: string;
  description?: string;
  isMajor: boolean;
  region?: Region;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  color: string;
  imageUrl?: string | null;
  listingCount?: number;
  produces?: Produce[];
}

export interface Produce {
  id: number;
  categoryId: number;
  name: string;
  slug: string;
  localNames?: string;
  scientificName?: string;
  defaultUnit: string;
  units: string[];
  imageUrl?: string | null;
  isPerishable: boolean;
  shelfLifeDays?: number;
  seasonStart?: number;
  seasonEnd?: number;
  category?: Category;
  activeListings?: number;
  averagePrice?: number;
}

export interface User {
  id: number;
  uuid: string;
  fullName: string;
  phone: string;
  email?: string | null;
  role: UserRole;
  status: 'active' | 'pending' | 'suspended' | 'banned';
  regionId?: number | null;
  districtId?: number | null;
  community?: string | null;
  language: string;
  gender?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  farmSize?: number | null;
  farmingExperience?: number | null;
  primaryCrops?: string[];
  cooperative?: string | null;
  businessName?: string | null;
  businessType?: string | null;
  momoNumber?: string | null;
  momoProvider?: string | null;
  walletBalance: number;
  ratingAvg: number;
  ratingCount: number;
  totalSales?: number;
  totalPurchases?: number;
  isPhoneVerified: boolean;
  isVerifiedSeller: boolean;
  smsNotifications: boolean;
  priceAlerts: boolean;
  registrationChannel: Channel;
  lastLoginAt?: string | null;
  lastUssdAt?: string | null;
  ussdSessionCount?: number;
  createdAt: string;
  region?: Region;
  district?: District;
}

export interface Listing {
  id: number;
  code: string;
  farmerId: number;
  produceId: number;
  categoryId?: number;
  title?: string;
  description?: string | null;
  quantity: number;
  quantityRemaining: number;
  unit: string;
  pricePerUnit: number;
  totalValue: number;
  currency: string;
  minOrderQuantity: number;
  negotiable: boolean;
  qualityGrade: 'A' | 'B' | 'C';
  isOrganic: boolean;
  harvestDate?: string | null;
  expiresAt?: string | null;
  regionId?: number;
  location?: string | null;
  /** The farmer's own uploads only — see listingPhotos() for what to display. */
  images: string[];
  coverImage?: string | null;
  photoSource?: 'farmer' | 'catalogue' | 'none';
  status: 'pending' | 'active' | 'reserved' | 'sold' | 'expired' | 'rejected' | 'withdrawn';
  source: Channel;
  views: number;
  inquiries: number;
  offerCount: number;
  isFeatured: boolean;
  isUrgent: boolean;
  rejectionReason?: string | null;
  createdAt: string;
  produce?: Produce;
  category?: Category;
  region?: Region;
  district?: District;
  farmer?: User;
  isFavorited?: boolean;
}

export type OrderStatus =
  | 'pending' | 'accepted' | 'rejected' | 'paid' | 'in_transit'
  | 'delivered' | 'completed' | 'cancelled' | 'disputed';

export interface TimelineEntry {
  status: string;
  note?: string | null;
  actor: string;
  at: string;
}

export interface Order {
  id: number;
  code: string;
  listingId: number;
  buyerId: number;
  farmerId: number;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
  commission: number;
  deliveryFee: number;
  totalAmount: number;
  farmerPayout: number;
  status: OrderStatus;
  paymentMethod: 'momo' | 'cash' | 'bank' | 'wallet';
  paymentStatus: 'unpaid' | 'pending' | 'paid' | 'refunded' | 'failed';
  paymentReference?: string | null;
  /** What the buyer says they paid, with screenshots — the platform moves no money. */
  paymentProof?: {
    reference?: string | null;
    method?: string;
    amount?: number;
    note?: string | null;
    images?: string[];
    recordedAt?: string;
  } | null;
  deliveryMethod: 'pickup' | 'delivery' | 'transporter';
  deliveryAddress?: string | null;
  notes?: string | null;
  source: Channel;
  timeline: TimelineEntry[];
  createdAt: string;
  completedAt?: string | null;
  farmerRated?: boolean;
  buyerRated?: boolean;
  listing?: Listing;
  buyer?: User;
  farmer?: User;
}

export interface Offer {
  id: number;
  code: string;
  listingId: number;
  buyerId: number;
  farmerId: number;
  offerPrice: number;
  quantity: number;
  unit: string;
  message?: string | null;
  counterPrice?: number | null;
  counterMessage?: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'withdrawn' | 'expired';
  source: Channel;
  expiresAt?: string | null;
  createdAt: string;
  listing?: Listing;
  buyer?: User;
  farmer?: User;
}

export interface MarketPrice {
  id: number;
  produceId: number;
  marketId: number;
  regionId?: number;
  unit: string;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  previousAvgPrice?: number | null;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  priceType: 'wholesale' | 'retail' | 'farmgate';
  priceDate: string;
  source: string;
  isVerified: boolean;
  produce?: Produce;
  market?: Market;
  region?: Region;
}

export interface NationalPrice {
  produceId: number;
  produce: Produce;
  unit: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  marketCount: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface PriceAlert {
  id: number;
  userId: number;
  produceId: number;
  marketId?: number | null;
  targetPrice: number;
  unit: string;
  direction: 'above' | 'below';
  channel: 'sms' | 'in_app' | 'both';
  isActive: boolean;
  triggerCount: number;
  lastTriggeredAt?: string | null;
  produce?: Produce;
  market?: Market;
}

export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  priority: string;
  icon: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface SmsMessage {
  id: number;
  direction: 'outbound' | 'inbound';
  recipient: string;
  sender?: string;
  message: string;
  type: string;
  /** skipped = logged but deliberately not sent (safe mode) */
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'rejected' | 'skipped';
  provider: string;
  network?: string;
  segments: number;
  cost: number;
  errorMessage?: string | null;
  createdAt: string;
  user?: Pick<User, 'id' | 'fullName' | 'role'>;
}

export interface UssdSession {
  id: number;
  sessionId: string;
  phone: string;
  userId?: number | null;
  serviceCode: string;
  network?: string;
  state: string;
  status: 'active' | 'completed' | 'timeout' | 'aborted' | 'error';
  stepCount: number;
  outcome?: string | null;
  durationSeconds: number;
  history: { step: number; input: string; output: string; at: string }[];
  isSimulated: boolean;
  createdAt: string;
  user?: Pick<User, 'id' | 'fullName' | 'role'>;
}

export interface Transaction {
  id: number;
  reference: string;
  userId: number;
  orderId?: number | null;
  type: string;
  direction: 'credit' | 'debit';
  amount: number;
  fee: number;
  netAmount: number;
  balanceAfter?: number;
  method: string;
  provider: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'reversed';
  description?: string;
  createdAt: string;
  user?: User;
  order?: Pick<Order, 'id' | 'code'>;
}

export interface Review {
  id: number;
  orderId: number;
  reviewerId: number;
  revieweeId: number;
  reviewerRole: 'farmer' | 'buyer';
  rating: number;
  qualityRating?: number;
  communicationRating?: number;
  punctualityRating?: number;
  comment?: string | null;
  createdAt: string;
  reviewer?: Pick<User, 'id' | 'fullName' | 'avatarUrl' | 'role'>;
}

export interface FarmingTip {
  id: number;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  smsVersion?: string;
  category: string;
  readMinutes: number;
  views: number;
  author: string;
  isPublished: boolean;
  isFeatured: boolean;
  publishedAt: string;
  imageUrl?: string | null;
  produce?: Produce;
  region?: Region;
}

export interface SupportTicket {
  id: number;
  code: string;
  userId?: number | null;
  name?: string;
  phone?: string;
  email?: string;
  subject: string;
  category: string;
  message: string;
  channel: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  response?: string | null;
  createdAt: string;
  /** Screenshots the person attached: MoMo confirmations, photos of the goods. */
  attachments?: string[];
  orderId?: number | null;
  order?: Pick<Order, 'id' | 'code' | 'status' | 'totalAmount' | 'paymentProof'>;
  user?: User;
  assignee?: Pick<User, 'id' | 'fullName'>;
}

export interface AuditLog {
  id: number;
  userId?: number | null;
  actorName: string;
  actorRole: string;
  action: string;
  entity?: string;
  entityId?: number;
  description?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
  actor?: Pick<User, 'id' | 'fullName' | 'avatarUrl' | 'role'>;
}

export interface Broadcast {
  id: number;
  title: string;
  message: string;
  audience: string;
  channel: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  estimatedCost: number;
  status: string;
  scheduledAt?: string | null;
  sentAt?: string | null;
  createdAt: string;
  creator?: Pick<User, 'id' | 'fullName'>;
}

export interface ImpactRecord {
  id: number;
  userId: number;
  period: string;
  surveyType: 'baseline' | 'midline' | 'endline';
  monthlyIncomeBefore?: number;
  monthlyIncomeAfter?: number;
  incomeChangePercent?: number;
  buyersReachedBefore?: number;
  buyersReachedAfter?: number;
  postHarvestLossBefore?: number;
  postHarvestLossAfter?: number;
  travelCostSaved?: number;
  satisfactionScore?: number;
  wouldRecommend?: boolean;
  feedback?: string | null;
  createdAt: string;
  farmer?: User;
}

export interface PublicStats {
  farmers: number;
  buyers: number;
  users: number;
  listings: number;
  activeListings: number;
  completedOrders: number;
  tradeValue: number;
  markets: number;
  regions: number;
  produceTypes: number;
  ussdSessions: number;
  smsSent: number;
}
