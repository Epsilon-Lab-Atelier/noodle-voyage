import { googleMapsSearchLink } from './urlSafety';

/**
 * Opening a map is the one place this app touches location, and only when the
 * reader presses the button. The position is never stored, never written to the
 * saved records, and rounded before it is placed in a link, so the link carries
 * a neighbourhood rather than a doorstep.
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type CoordinateResult =
  | { ok: true; coordinates: Coordinates }
  | { ok: false; message: string };

/** About 100m. Enough to centre a map, not enough to point at a home. */
export const coarsen = (value: number): number => Math.round(value * 1000) / 1000;

const messages: Record<number, string> = {
  1: '現在地の利用が許可されませんでした。地名を入力して探せます。',
  2: '現在地を取得できませんでした。地名を入力して探せます。',
  3: '現在地の取得に時間がかかっています。地名を入力して探せます。'
};

export function requestCoordinates(geolocation = globalThis.navigator?.geolocation): Promise<CoordinateResult> {
  if (!geolocation) {
    return Promise.resolve({ ok: false, message: 'この端末では現在地を取得できません。地名を入力して探せます。' });
  }
  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (position) => resolve({
        ok: true,
        coordinates: {
          latitude: coarsen(position.coords.latitude),
          longitude: coarsen(position.coords.longitude)
        }
      }),
      (error) => resolve({ ok: false, message: messages[error.code] ?? messages[2] as string }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  });
}

/** "家系ラーメン" plus whatever area the reader typed, if they typed one. */
export function areaSearchLink(term: string, area: string): string {
  return googleMapsSearchLink([term, area].map((part) => part.trim()).filter(Boolean).join(' '));
}

/**
 * Centres the search on the coarsened position. The `@lat,lng,zoom` form is the
 * only Google Maps URL that accepts a centre alongside a search term.
 */
export function nearbySearchLink(term: string, coordinates: Coordinates): string {
  const { latitude, longitude } = coordinates;
  return `https://www.google.com/maps/search/${encodeURIComponent(term.trim())}/@${latitude},${longitude},14z`;
}
