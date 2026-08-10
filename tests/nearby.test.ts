import { describe, expect, it } from 'vitest';
import { areaSearchLink, coarsen, nearbySearchLink, requestCoordinates } from '../src/features/places/nearby';

const geolocationThat = (behaviour: (success: PositionCallback, failure: PositionErrorCallback) => void) =>
  ({ getCurrentPosition: behaviour } as unknown as Geolocation);

const position = (latitude: number, longitude: number) =>
  ({ coords: { latitude, longitude } } as GeolocationPosition);

describe('building a map search', () => {
  it('joins the style and the area into one encoded query', () => {
    const url = new URL(areaSearchLink('濃厚魚介豚骨つけ麺', '新宿'));
    expect(url.hostname).toBe('www.google.com');
    expect(url.pathname).toBe('/maps/search/');
    expect(url.searchParams.get('query')).toBe('濃厚魚介豚骨つけ麺 新宿');
  });

  it('searches on the name alone when a style belongs to no region', () => {
    expect(new URL(areaSearchLink('かけうどん', '')).searchParams.get('query')).toBe('かけうどん');
    expect(new URL(areaSearchLink('かけうどん', '   ')).searchParams.get('query')).toBe('かけうどん');
  });

  it('centres a nearby search on the given position', () => {
    const link = nearbySearchLink('家系ラーメン', { latitude: 35.689, longitude: 139.692 });
    expect(link).toBe(`https://www.google.com/maps/search/${encodeURIComponent('家系ラーメン')}/@35.689,139.692,14z`);
    expect(link).not.toContain('家系');
  });
});

describe('asking for the current position', () => {
  it('rounds the position to about 100m before it can reach a link', () => {
    expect(coarsen(35.6895014)).toBe(35.69);
    expect(coarsen(139.6917064)).toBe(139.692);
  });

  it('returns the coarsened position when the reader allows it', async () => {
    const result = await requestCoordinates(geolocationThat((success) => success(position(35.6895014, 139.6917064))));
    expect(result).toEqual({ ok: true, coordinates: { latitude: 35.69, longitude: 139.692 } });
  });

  it('explains that an area can be typed instead when permission is refused', async () => {
    const result = await requestCoordinates(geolocationThat((_success, failure) =>
      failure({ code: 1 } as GeolocationPositionError)));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('地名を入力');
  });

  it('says the same thing when the device cannot locate itself at all', async () => {
    const unavailable = await requestCoordinates(geolocationThat((_success, failure) =>
      failure({ code: 2 } as GeolocationPositionError)));
    const timedOut = await requestCoordinates(geolocationThat((_success, failure) =>
      failure({ code: 3 } as GeolocationPositionError)));
    const missing = await requestCoordinates(undefined);
    for (const result of [unavailable, timedOut, missing]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain('地名を入力');
    }
  });
});
