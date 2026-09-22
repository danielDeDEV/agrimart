'use client';

import * as React from 'react';
import { ImagePlus, Info, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { MAX_LISTING_PHOTOS, acceptPhotos, isCataloguePhoto } from '@/lib/images';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, SmartImage,
} from '@/components/ui';
import type { Listing } from '@/lib/types';

/**
 * Lets a farmer replace the catalogue picture with photos of their actual
 * harvest — useful for listings first created over USSD or SMS — or remove
 * photos they no longer want. With no photos left, buyers see the catalogue
 * photo again.
 */
export function ListingPhotosDialog({
  listing,
  onClose,
  onSaved,
}: {
  listing: Listing | null;
  onClose: () => void;
  onSaved?: (listing: Listing) => void;
}) {
  const [kept, setKept] = React.useState<string[]>([]);
  const [files, setFiles] = React.useState<File[]>([]);
  const [previews, setPreviews] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  const own = React.useMemo(
    () => (listing?.images ?? []).filter((url) => url && !isCataloguePhoto(url)),
    [listing]
  );

  React.useEffect(() => {
    setKept(own);
    setFiles([]);
  }, [own]);

  React.useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const total = kept.length + files.length;
  const changed = files.length > 0 || kept.length !== own.length;
  const produceName = listing?.produce?.name ?? 'your produce';

  const addFiles = (list: FileList | null) => {
    const { accepted, rejected } = acceptPhotos(list);
    if (rejected) toast.error('Photos must be JPG, PNG or WEBP images under 5MB');
    const room = MAX_LISTING_PHOTOS - kept.length;
    if (files.length + accepted.length > room) toast.error(`A listing can have up to ${MAX_LISTING_PHOTOS} photos`);
    setFiles((prev) => [...prev, ...accepted].slice(0, room));
  };

  const save = async () => {
    if (!listing) return;
    const body = new FormData();
    body.append('keepImages', JSON.stringify(kept));
    files.forEach((file) => body.append('images', file));
    setSaving(true);
    try {
      const res = await api.upload<Listing>(`/listings/${listing.id}`, body, 'PATCH');
      toast.success(res.message || 'Photos saved');
      onSaved?.(res.data);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!listing} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Photos of your {produceName}</DialogTitle>
          <DialogDescription>
            Real photos of your harvest help buyers decide. Add up to {MAX_LISTING_PHOTOS}; the first one is the cover.
          </DialogDescription>
        </DialogHeader>

        {total === 0 && listing?.produce?.imageUrl && (
          <div className="flex items-center gap-3 rounded-xl border bg-muted/50 p-3">
            <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg">
              <SmartImage src={listing.produce.imageUrl} alt={produceName} sizes="80px" />
            </div>
            <p className="flex gap-1.5 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Buyers now see this catalogue photo of {produceName.toLowerCase()}. Add your own to replace it.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {kept.map((url, i) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border">
              <SmartImage src={url} alt={`Photo ${i + 1}`} rounded="rounded-none" sizes="100px" />
              {i === 0 && (
                <span className="absolute bottom-1 left-1 rounded bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">Cover</span>
              )}
              <button
                type="button"
                onClick={() => setKept((prev) => prev.filter((u) => u !== url))}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/75 text-white transition-colors hover:bg-red-600"
                aria-label={`Remove photo ${i + 1}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {previews.map((src, i) => (
            <div key={src} className="group relative aspect-square overflow-hidden rounded-xl border-2 border-primary/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`New photo ${i + 1}`} className="h-full w-full object-cover" />
              <span className="absolute bottom-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">New</span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/75 text-white transition-colors hover:bg-red-600"
                aria-label={`Remove new photo ${i + 1}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {total < MAX_LISTING_PHOTOS && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary">
              <ImagePlus className="h-6 w-6" />
              <span className="text-xs font-medium">Add photo</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" loading={saving} disabled={!changed} onClick={save}>Save photos</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
