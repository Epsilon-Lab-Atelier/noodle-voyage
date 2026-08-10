import { describe, expect, it } from 'vitest';
import { findDuplicatePlaces, normalizeName } from '../src/features/places/duplicateCheck';
import type { PlaceRecord } from '../src/types/records';

const place = (overrides: Partial<PlaceRecord> & Pick<PlaceRecord, 'id' | 'name'>): PlaceRecord => ({
  visibility: 'private',
  nameNormalized: normalizeName(overrides.name),
  addressText: null,
  latitude: null,
  longitude: null,
  googleMapsUrl: null,
  googlePlaceId: null,
  tabelogUrl: null,
  officialUrl: null,
  status: 'unknown',
  sourceType: 'user_manual',
  note: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  ...overrides
});

describe('normalising a shop name', () => {
  it('folds width, case and repeated spaces', () => {
    expect(normalizeName('Ｒａｍｅｎ　　太郎 ')).toBe(normalizeName('ramen 太郎'));
  });

  it('leaves two genuinely different names different', () => {
    expect(normalizeName('らーめん たろう')).not.toBe(normalizeName('らーめん じろう'));
  });
});

describe('finding a shop that may already be saved', () => {
  const saved: PlaceRecord[] = [
    place({
      id: 'place-1',
      name: 'らーめん たろう',
      addressText: '東京都新宿区1-2-3',
      googlePlaceId: 'ChIJtaro',
      googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=taro&query_place_id=ChIJtaro'
    }),
    place({ id: 'place-2', name: 'らーめん たろう', addressText: '大阪府大阪市4-5-6' }),
    place({ id: 'place-3', name: '中華そば じろう', addressText: '東京都新宿区9-9-9' })
  ];

  it('finds nothing when the shop is new', () => {
    expect(findDuplicatePlaces({ name: '麺屋 はなこ' }, saved)).toEqual([]);
  });

  it('calls a matching Google place ID a strong match', () => {
    const matches = findDuplicatePlaces({ name: 'まったく別の名前', googlePlaceId: 'ChIJtaro' }, saved);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.strength).toBe('strong');
    expect(matches[0]?.place.id).toBe('place-1');
  });

  it('calls the same Maps link a strong match even when written differently', () => {
    const matches = findDuplicatePlaces(
      { name: '別名', googleMapsUrl: 'https://www.google.com/maps/search?api=1&query=taro&query_place_id=ChIJtaro&utm_source=share' },
      saved
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.strength).toBe('strong');
    expect(matches[0]?.reason).toBe('Google マップのリンクが同じです');
  });

  it('calls the same name a soft match, and says so more precisely when the address matches too', () => {
    const matches = findDuplicatePlaces({ name: 'ＲＡＭＥＮ たろう' }, [place({ id: 'place-9', name: 'ramen たろう' })]);
    expect(matches[0]?.strength).toBe('soft');
    expect(matches[0]?.reason).toBe('店名が同じです');

    const withAddress = findDuplicatePlaces({ name: 'らーめん たろう', addressText: '東京都新宿区1-2-3' }, saved);
    expect(withAddress.map((match) => match.place.id)).toContain('place-1');
    expect(withAddress.find((match) => match.place.id === 'place-1')?.reason).toBe('店名と住所が同じです');
  });

  it('reports both shops that share a name and lets the reader choose', () => {
    const matches = findDuplicatePlaces({ name: 'らーめん たろう' }, saved);
    expect(matches.map((match) => match.place.id).sort()).toEqual(['place-1', 'place-2']);
  });

  it('puts the strong match first', () => {
    const matches = findDuplicatePlaces({ name: 'らーめん たろう', googlePlaceId: 'ChIJtaro' }, saved);
    expect(matches[0]?.strength).toBe('strong');
    expect(matches[0]?.place.id).toBe('place-1');
    expect(matches.some((match) => match.place.id === 'place-2' && match.strength === 'soft')).toBe(true);
  });

  it('does not report a shop against itself while it is being edited', () => {
    expect(findDuplicatePlaces({ id: 'place-1', name: 'らーめん たろう', googlePlaceId: 'ChIJtaro' }, saved)
      .map((match) => match.place.id)).toEqual(['place-2']);
  });

  it('does not treat two empty place IDs or two empty links as a match', () => {
    const matches = findDuplicatePlaces({ name: '麺屋 はなこ', googlePlaceId: null, googleMapsUrl: null }, [
      place({ id: 'place-4', name: '別の店' })
    ]);
    expect(matches).toEqual([]);
  });

  it('ignores an unsafe Maps link instead of matching on it', () => {
    const matches = findDuplicatePlaces({ name: '別名', googleMapsUrl: 'javascript:alert(1)' }, saved);
    expect(matches).toEqual([]);
  });
});
