'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, BadgeCheck, Calendar, Camera, CheckCircle2, Clock, Eye, HandCoins, Heart, ImageIcon, Info, Leaf, MapPin,
  MessageSquare, Package, Phone, Share2, ShieldCheck, ShoppingCart, Smartphone, Star, Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatCurrency, formatDate, formatNumber, initials, timeAgo } from '@/lib/utils';
import { CHANNEL_META, QUALITY_GRADES } from '@/lib/constants';
import { listingPhotos } from '@/lib/images';
import { useSettings } from '@/components/settings-provider';
import {
  Avatar, AvatarFallback, AvatarImage, Badge, Button, Card, Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, ErrorState, Input, Label, Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue, Skeleton, SmartImage, Textarea,
} from '@/components/ui';
import { ListingCard } from '@/components/shared/listing-card';
import { ListingPhotosDialog } from '@/components/shared/listing-photos-dialog';
import type { Listing } from '@/lib/types';

export default function ListingDetailPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const site = useSettings();

  const [listing, setListing] = React.useState<Listing | null>(null);
  const [similar, setSimilar] = React.useState<Listing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeImage, setActiveImage] = React.useState(0);
  const [favorited, setFavorited] = React.useState(false);
  const [managingPhotos, setManagingPhotos] = React.useState(false);

  const [orderOpen, setOrderOpen] = React.useState(false);
  const [offerOpen, setOfferOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [order, setOrder] = React.useState({ quantity: '', paymentMethod: 'momo', deliveryMethod: 'pickup', deliveryAddress: '', notes: '' });
  const [offer, setOffer] = React.useState({ offerPrice: '', quantity: '', message: '' });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ listing: Listing; similar: Listing[] }>(`/listings/${code}`);
      setListing(res.data.listing);
      setSimilar(res.data.similar);
      setFavorited(!!res.data.listing.isFavorited);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [code]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const requireSignIn = () => {
    if (isAuthenticated) return true;
    toast.error('Sign in to trade', { description: 'You need an account to order or make offers.' });
    router.push(`/login?next=/marketplace/${code}`);
    return false;
  };

  const isOwner = !!user && !!listing && user.id === listing.farmerId;

  const toggleFavorite = async () => {
    if (!requireSignIn() || !listing) return;
    const next = !favorited;
    setFavorited(next);
    try {
      await api.post(`/listings/${listing.id}/favorite`);
    } catch (err) {
      setFavorited(!next);
      toast.error(errorMessage(err));
    }
  };

  const placeOrder = async () => {
    if (!listing) return;
    const qty = Number(order.quantity);
    if (!qty || qty <= 0) return toast.error('Enter how much you want to buy');
    if (qty > Number(listing.quantityRemaining)) return toast.error(`Only ${listing.quantityRemaining} ${listing.unit} available`);

    setSubmitting(true);
    try {
      const res = await api.post<{ code: string }>('/orders', {
        listingId: listing.id,
        quantity: qty,
        paymentMethod: order.paymentMethod,
        deliveryMethod: order.deliveryMethod,
        deliveryAddress: order.deliveryAddress || undefined,
        notes: order.notes || undefined,
      });
      toast.success(`Order ${res.data.code} placed`, { description: 'The farmer has been alerted by SMS.' });
      setOrderOpen(false);
      router.push(`/dashboard/orders/${res.data.code}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const sendOffer = async () => {
    if (!listing) return;
    if (!Number(offer.offerPrice)) return toast.error('Enter your offer price');
    if (!Number(offer.quantity)) return toast.error('Enter the quantity you want');

    setSubmitting(true);
    try {
      await api.post('/offers', {
        listingId: listing.id,
        offerPrice: Number(offer.offerPrice),
        quantity: Number(offer.quantity),
        message: offer.message || undefined,
      });
      toast.success('Offer sent', { description: 'You will be notified by SMS when the farmer responds.' });
      setOfferOpen(false);
      setOffer({ offerPrice: '', quantity: '', message: '' });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const messageFarmer = async () => {
    if (!requireSignIn() || !listing) return;
    try {
      const res = await api.post<{ id: number }>('/messages/conversations', {
        listingId: listing.id,
        message: `Hello, I am interested in your ${listing.produce?.name} (${listing.code}). Is it still available?`,
      });
      router.push(`/dashboard/messages/${res.data.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: listing?.title ?? 'AgriMart listing', url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      }
    } catch {
      /* dismissed */
    }
  };

  if (loading) {
    return (
      <div className="container-wide grid gap-10 py-10 lg:grid-cols-[1.2fr_1fr]">
        <Skeleton className="aspect-[4/3] w-full rounded-3xl" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="container-wide py-20">
        <ErrorState message={error ?? 'Listing not found'} onRetry={load} />
      </div>
    );
  }

  const { photos: images, isCatalogue } = listingPhotos(listing);
  const available = listing.status === 'active' && Number(listing.quantityRemaining) > 0;
  const soldPercent = Math.round(((Number(listing.quantity) - Number(listing.quantityRemaining)) / Number(listing.quantity)) * 100);
  const grade = QUALITY_GRADES[listing.qualityGrade];
  const orderTotal = Number(order.quantity || 0) * Number(listing.pricePerUnit);

  return (
    <div className="container-wide py-8 lg:py-10">
      <Link href="/marketplace" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to marketplace
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        {/* Gallery */}
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border bg-muted shadow-soft">
            <SmartImage
              src={images[activeImage] ?? images[0]}
              alt={listing.produce?.name ?? 'Produce'}
              rounded="rounded-none"
              priority
              sizes="(max-width: 1024px) 100vw, 55vw"
            />
            <div className="absolute left-4 top-4 flex flex-wrap gap-2">
              {listing.isFeatured && <Badge variant="gold"><Star className="fill-current" /> Featured</Badge>}
              {listing.isOrganic && <Badge variant="success"><Leaf /> Organic</Badge>}
              {!available && <Badge variant="destructive">{listing.status === 'sold' ? 'Sold out' : listing.status}</Badge>}
            </div>
            <div className="absolute right-4 top-4 flex gap-2">
              <Button size="icon-sm" variant="secondary" className="bg-white/90 backdrop-blur hover:bg-white dark:bg-slate-900/80" onClick={share} aria-label="Share">
                <Share2 />
              </Button>
              <Button
                size="icon-sm"
                variant="secondary"
                className={cn('backdrop-blur', favorited ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-white/90 hover:bg-white dark:bg-slate-900/80')}
                onClick={toggleFavorite}
                aria-label="Save"
              >
                <Heart className={cn(favorited && 'fill-current')} />
              </Button>
            </div>
          </div>

          {images.length > 1 && (
            <div className="mt-3 flex gap-3">
              {images.map((img, i) => (
                <button
                  key={img}
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    'relative h-20 w-20 overflow-hidden rounded-xl border-2 transition-all',
                    i === activeImage ? 'border-primary shadow-glow' : 'border-transparent opacity-70 hover:opacity-100'
                  )}
                >
                  <SmartImage src={img} alt={`Photo ${i + 1}`} rounded="rounded-none" sizes="80px" />
                </button>
              ))}
            </div>
          )}

          {isCatalogue && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-muted/40 px-4 py-3 text-sm">
              <p className="flex items-start gap-2 text-muted-foreground">
                <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {isOwner
                  ? 'Buyers see a catalogue photo. Add photos of your actual harvest to stand out.'
                  : `Representative photo of ${listing.produce?.name?.toLowerCase() ?? 'this produce'}.${
                      listing.source === 'ussd' || listing.source === 'sms'
                        ? ` This farmer listed by ${listing.source.toUpperCase()}, which cannot send pictures.`
                        : ''
                    } Ask the farmer for photos before you buy.`}
              </p>
              {isOwner && (
                <Button size="sm" variant="outline" onClick={() => setManagingPhotos(true)}>
                  <Camera /> Add photos
                </Button>
              )}
            </div>
          )}
          {isOwner && !isCatalogue && (
            <div className="mt-3 flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setManagingPhotos(true)}>
                <Camera /> Manage photos
              </Button>
            </div>
          )}

          {/* Details */}
          <Card className="mt-6 p-6">
            <h2 className="font-semibold">About this produce</h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {listing.description ||
                `${formatNumber(listing.quantity)} ${listing.unit} of ${grade?.label ?? 'graded'} ${listing.produce?.name?.toLowerCase() ?? 'produce'} from ${listing.location || listing.region?.name || 'Ghana'}.`}
            </p>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                { icon: ShieldCheck, label: 'Quality', value: `${grade?.label} — ${grade?.description}` },
                { icon: Calendar, label: 'Harvested', value: listing.harvestDate ? formatDate(listing.harvestDate) : 'Not specified' },
                { icon: Package, label: 'Minimum order', value: `${formatNumber(listing.minOrderQuantity)} ${listing.unit}` },
                { icon: Clock, label: 'Listing expires', value: listing.expiresAt ? formatDate(listing.expiresAt) : '—' },
                { icon: MapPin, label: 'Location', value: [listing.location, listing.district?.name, listing.region?.name].filter(Boolean).join(', ') },
                {
                  icon: Smartphone,
                  label: 'Listed via',
                  value: CHANNEL_META[listing.source]?.label ?? listing.source,
                },
              ].map((item) => (
                <div key={item.label} className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <item.icon className="h-4 w-4 text-primary" />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</dt>
                    <dd className="mt-0.5 text-sm">{item.value}</dd>
                  </div>
                </div>
              ))}
            </dl>

            {listing.produce?.localNames && (
              <p className="mt-6 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Local names:</span> {listing.produce.localNames}
              </p>
            )}
          </Card>
        </div>

        {/* Purchase panel */}
        <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <code className="rounded-md bg-muted px-2 py-0.5 font-mono font-semibold">{listing.code}</code>
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {formatNumber(listing.views)} views</span>
              <span>· Listed {timeAgo(listing.createdAt)}</span>
            </div>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{listing.produce?.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-4 w-4" /> {listing.location || listing.region?.name}, {listing.region?.name}
            </p>
          </div>

          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-primary-50 to-transparent p-6 dark:from-primary-950/40">
              <p className="text-sm text-muted-foreground">Price per {listing.unit}</p>
              <p className="mt-1 font-display text-4xl font-extrabold tracking-tight text-primary-700 dark:text-primary-400">
                {formatCurrency(listing.pricePerUnit)}
              </p>
              {listing.negotiable && <Badge variant="info" className="mt-2"><HandCoins /> Price negotiable</Badge>}
            </div>

            <div className="space-y-4 p-6">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{formatNumber(listing.quantityRemaining)} {listing.unit} available</span>
                  <span className="text-muted-foreground">of {formatNumber(listing.quantity)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-gold-500 transition-all" style={{ width: `${soldPercent}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{soldPercent}% already sold</p>
              </div>

              {isOwner ? (
                <Button className="w-full" size="lg" variant="outline" asChild>
                  <Link href="/dashboard/listings">Manage this listing</Link>
                </Button>
              ) : (
                <div className="grid gap-2.5">
                  <Button
                    size="lg"
                    variant="gradient"
                    disabled={!available}
                    onClick={() => requireSignIn() && setOrderOpen(true)}
                  >
                    <ShoppingCart /> Place order
                  </Button>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Button
                      variant="outline"
                      disabled={!available || !listing.negotiable}
                      onClick={() => requireSignIn() && setOfferOpen(true)}
                    >
                      <HandCoins /> Make offer
                    </Button>
                    <Button variant="outline" onClick={messageFarmer}>
                      <MessageSquare /> Message
                    </Button>
                  </div>
                </div>
              )}

              <ul className="space-y-2 border-t pt-4 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Farmer is alerted by SMS instantly</li>
                <li className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Pickup or delivery by arrangement</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Every order is recorded and disputable</li>
              </ul>
            </div>
          </Card>

          {/* Farmer */}
          {listing.farmer && (
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  {listing.farmer.avatarUrl && <AvatarImage src={listing.farmer.avatarUrl} />}
                  <AvatarFallback className="text-base">{initials(listing.farmer.fullName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <span className="truncate">{listing.farmer.fullName}</span>
                    {listing.farmer.isVerifiedSeller && <BadgeCheck className="h-4 w-4 shrink-0 fill-primary text-white" />}
                  </p>
                  <p className="text-sm text-muted-foreground">{listing.farmer.community || listing.region?.name}</p>
                  <p className="mt-1 flex items-center gap-1 text-sm">
                    <Star className="h-4 w-4 fill-gold-400 text-gold-400" />
                    <span className="font-semibold">{Number(listing.farmer.ratingAvg || 0).toFixed(1)}</span>
                    <span className="text-muted-foreground">({listing.farmer.ratingCount} reviews)</span>
                  </p>
                </div>
              </div>
              {isAuthenticated && !isOwner && (
                <Button variant="subtle" className="mt-4 w-full" asChild>
                  <a href={`tel:${listing.farmer.phone}`}>
                    <Phone /> Call {listing.farmer.phone}
                  </a>
                </Button>
              )}
              {!isAuthenticated && (
                <p className="mt-4 rounded-xl bg-muted/60 p-3 text-center text-xs text-muted-foreground">
                  <Link href={`/login?next=/marketplace/${listing.code}`} className="font-semibold text-primary hover:underline">Sign in</Link> to see the farmer&apos;s phone number
                </p>
              )}
            </Card>
          )}
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl font-bold">More {listing.produce?.name} from other farms</h2>
          <p className="mt-1 text-muted-foreground">Compare prices before you buy — sorted cheapest first.</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {similar.slice(0, 4).map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>
        </section>
      )}

      {/* Order dialog */}
      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order {listing.produce?.name}</DialogTitle>
            <DialogDescription>
              {formatCurrency(listing.pricePerUnit)} per {listing.unit} · {formatNumber(listing.quantityRemaining)} available
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label required>Quantity</Label>
              <Input
                type="number"
                min={listing.minOrderQuantity}
                max={listing.quantityRemaining}
                value={order.quantity}
                onChange={(e) => setOrder((o) => ({ ...o, quantity: e.target.value }))}
                suffix={listing.unit}
                placeholder={`Minimum ${listing.minOrderQuantity}`}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Payment</Label>
                <Select value={order.paymentMethod} onValueChange={(v) => setOrder((o) => ({ ...o, paymentMethod: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="momo">Mobile money</SelectItem>
                    <SelectItem value="cash">Cash on pickup</SelectItem>
                    <SelectItem value="bank">Bank transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Delivery</Label>
                <Select value={order.deliveryMethod} onValueChange={(v) => setOrder((o) => ({ ...o, deliveryMethod: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pickup">I will collect</SelectItem>
                    <SelectItem value="delivery">Farmer delivers</SelectItem>
                    <SelectItem value="transporter">I will send a transporter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {order.deliveryMethod !== 'pickup' && (
              <div className="space-y-2">
                <Label>Delivery address</Label>
                <Input value={order.deliveryAddress} onChange={(e) => setOrder((o) => ({ ...o, deliveryAddress: e.target.value }))} placeholder="Warehouse, town, landmark" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Note to farmer</Label>
              <Textarea rows={3} value={order.notes} onChange={(e) => setOrder((o) => ({ ...o, notes: e.target.value }))} placeholder="Collection day, packaging, anything else" />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-primary-50 p-4 dark:bg-primary-950/40">
              <span className="text-sm font-medium">Order total</span>
              <span className="font-display text-2xl font-extrabold text-primary-700 dark:text-primary-400">{formatCurrency(orderTotal)}</span>
            </div>

            {/* Nobody should send money thinking the platform is holding it */}
            <p className="flex gap-2 rounded-xl border border-dashed bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Ordering does not pay anyone. {site.shortName} never holds your money: once the farmer accepts, you get
                their phone number, agree how to pay and collect, and pay them directly. Keep your mobile-money
                confirmation — you can attach it to the order, and it is the evidence we review if anything goes wrong.
              </span>
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderOpen(false)}>Cancel</Button>
            <Button variant="gradient" loading={submitting} onClick={placeOrder}>Confirm order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offer dialog */}
      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make an offer</DialogTitle>
            <DialogDescription>
              Asking price is {formatCurrency(listing.pricePerUnit)} per {listing.unit}. The farmer can accept, decline or counter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label required>Your price</Label>
                <Input type="number" value={offer.offerPrice} onChange={(e) => setOffer((o) => ({ ...o, offerPrice: e.target.value }))} suffix={`/${listing.unit.split(' ')[0]}`} />
              </div>
              <div className="space-y-2">
                <Label required>Quantity</Label>
                <Input type="number" value={offer.quantity} onChange={(e) => setOffer((o) => ({ ...o, quantity: e.target.value }))} suffix={listing.unit.split(' ')[0]} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea rows={3} value={offer.message} onChange={(e) => setOffer((o) => ({ ...o, message: e.target.value }))} placeholder="e.g. I can collect this week and pay by MoMo" />
            </div>
            {Number(offer.offerPrice) > 0 && (
              <p className="text-sm text-muted-foreground">
                That is{' '}
                <span className="font-semibold text-foreground">
                  {Math.abs(Math.round((1 - Number(offer.offerPrice) / Number(listing.pricePerUnit)) * 100))}%{' '}
                  {Number(offer.offerPrice) < Number(listing.pricePerUnit) ? 'below' : 'above'}
                </span>{' '}
                the asking price.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferOpen(false)}>Cancel</Button>
            <Button variant="gradient" loading={submitting} onClick={sendOffer}>Send offer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ListingPhotosDialog
        listing={managingPhotos ? listing : null}
        onClose={() => setManagingPhotos(false)}
        onSaved={(updated) => {
          setListing((prev) => (prev ? { ...prev, ...updated } : updated));
          setActiveImage(0);
        }}
      />
    </div>
  );
}
