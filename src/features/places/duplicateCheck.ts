import type { PlaceRecord } from '../../types/records';
import { normalizeMapsUrl } from './urlSafety';

/** Folds width, case and spacing so that "Ｒａｍｅｎ 　太郎" matches "ramen 太郎". */
export function normalizeName(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('ja');
}

export type DuplicateStrength = 'strong' | 'soft';

export interface DuplicateMatch {
  place: PlaceRecord;
  strength: DuplicateStrength;
  /** Why the two look like the same shop, in the reader's words. */
  reason: string;
}

export interface PlaceCandidate {
  id?: string;
  name: string;
  addressText?: string | null;
  googlePlaceId?: string | null;
  googleMapsUrl?: string | null;
}

/**
 * Finds places that look like the one being added. Nothing is merged or removed
 * automatically: the reader decides whether it is the same shop (spec 10.3).
 */
export function findDuplicatePlaces(candidate: PlaceCandidate, places: PlaceRecord[]): DuplicateMatch[] {
  const name = normalizeName(candidate.name);
  const address = normalizeName(candidate.addressText ?? '');
  const mapsUrl = normalizeMapsUrl(candidate.googleMapsUrl ?? null);
  const matches: DuplicateMatch[] = [];

  for (const place of places) {
    if (candidate.id && place.id === candidate.id) continue;

    if (candidate.googlePlaceId && place.googlePlaceId && candidate.googlePlaceId === place.googlePlaceId) {
      matches.push({ place, strength: 'strong', reason: 'Google の場所IDが同じです' });
      continue;
    }
    if (mapsUrl && normalizeMapsUrl(place.googleMapsUrl) === mapsUrl) {
      matches.push({ place, strength: 'strong', reason: 'Google マップのリンクが同じです' });
      continue;
    }
    if (name && place.nameNormalized === name) {
      const placeAddress = normalizeName(place.addressText ?? '');
      if (address && placeAddress && address === placeAddress) {
        matches.push({ place, strength: 'soft', reason: '店名と住所が同じです' });
      } else {
        matches.push({ place, strength: 'soft', reason: '店名が同じです' });
      }
    }
  }

  // A strong match is the one worth acting on, so it is offered first.
  return matches.sort((a, b) => (a.strength === b.strength ? 0 : a.strength === 'strong' ? -1 : 1));
}
