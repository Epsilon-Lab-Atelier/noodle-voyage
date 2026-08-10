/**
 * The reader types these URLs by hand, so every one is checked before it is
 * stored and again before it is rendered as a link. `javascript:` and `data:`
 * are refused outright; everything else must be https.
 *
 * Host lists come from data/additions/v2.3.0/private-place-menu-schema.json.
 */
export const googleMapsHosts = ['google.com', 'www.google.com', 'maps.google.com', 'goo.gl', 'maps.app.goo.gl'];
export const tabelogHosts = ['tabelog.com', 'www.tabelog.com'];

export type UrlKind = 'googleMaps' | 'tabelog' | 'official' | 'any';

export interface UrlCheck {
  ok: boolean;
  /** The normalised URL, or null when it was refused. */
  value: string | null;
  message: string;
}

const hostsFor = (kind: UrlKind): string[] | null =>
  (kind === 'googleMaps' ? googleMapsHosts : kind === 'tabelog' ? tabelogHosts : null);

export function checkUrl(input: string, kind: UrlKind = 'any'): UrlCheck {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, value: null, message: '' };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, value: null, message: 'URLの形式が正しくありません。' };
  }

  if (url.protocol !== 'https:') {
    return {
      ok: false,
      value: null,
      message: url.protocol === 'http:' ? 'https から始まるURLを入力してください。' : 'このURLは保存できません。'
    };
  }

  const allowed = hostsFor(kind);
  if (allowed && !allowed.includes(url.hostname)) {
    const expected = kind === 'googleMaps' ? 'Google マップ' : '食べログ';
    return { ok: false, value: null, message: `${expected}のURLを入力してください。` };
  }

  return { ok: true, value: url.toString(), message: '' };
}

/**
 * Two links to the same place rarely match character for character, so the
 * comparison drops the tracking query and the trailing slash.
 */
export function normalizeMapsUrl(input: string | null): string | null {
  if (!input) return null;
  const checked = checkUrl(input, 'googleMaps');
  if (!checked.ok || !checked.value) return null;
  const url = new URL(checked.value);
  const query = url.searchParams.get('query') ?? url.searchParams.get('q');
  const placeId = url.searchParams.get('query_place_id') ?? url.searchParams.get('place_id');
  const path = url.pathname.replace(/\/+$/, '');
  return [url.hostname, path, placeId ?? query ?? ''].filter(Boolean).join('|').toLocaleLowerCase('ja');
}

/** Builds a Google Maps search link. No API key, no request from this app. */
export function googleMapsSearchLink(query: string, placeId?: string | null): string {
  const params = new URLSearchParams({ api: '1', query });
  if (placeId) params.set('query_place_id', placeId);
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

/** Builds a Google Maps directions link to a saved place. */
export function googleMapsDirectionsLink(query: string, placeId?: string | null): string {
  const params = new URLSearchParams({ api: '1', destination: query });
  if (placeId) params.set('destination_place_id', placeId);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
