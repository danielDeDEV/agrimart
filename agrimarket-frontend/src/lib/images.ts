import type { Listing } from './types';

/** Most photos a farmer can attach to one listing (matches the API). */
export const MAX_LISTING_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * A stock picture from the built-in library (or a Wikimedia link from before
 * the library existed), as opposed to a photo a farmer uploaded.
 */
export const isCataloguePhoto = (url?: string | null) =>
  !!url && (/^\/images\/(produce|categories)\//.test(url) || /wikimedia\.org\//i.test(url));

/**
 * The photos to show for a listing. Farmers who sell over USSD or SMS cannot
 * attach pictures, so a listing without its own photos shows the catalogue
 * photo of its produce — flagged so the page can say it is representative.
 */
export function listingPhotos(listing: Pick<Listing, 'images' | 'produce'>) {
  const own = (listing.images ?? []).filter((url) => url && !isCataloguePhoto(url));
  if (own.length) return { photos: own, cover: own[0], isCatalogue: false } as const;
  const stock = listing.produce?.imageUrl || null;
  return { photos: stock ? [stock] : [], cover: stock, isCatalogue: !!stock } as const;
}

/** Keeps only images within the upload limits; returns what was rejected too. */
export function acceptPhotos(list: FileList | File[] | null) {
  const files = Array.from(list ?? []);
  const accepted = files.filter((f) => f.type.startsWith('image/') && f.size <= MAX_PHOTO_BYTES);
  return { accepted, rejected: files.length - accepted.length };
}
