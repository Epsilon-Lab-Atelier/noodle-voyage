import { describe, expect, it } from 'vitest';
import type { Dish } from '../src/types/catalog';
import { googleImageSearchUrl } from '../src/utils/externalSearch';

const dish = {
  name: '札幌ラーメン',
  localName: null,
  domain: 'japan',
  noodleCategory: 'ramen',
  prefectureLabel: '北海道',
  country: '日本'
} as unknown as Dish;

describe('external search links', () => {
  it('creates a Google image-search URL with the dish name and region', () => {
    const url = new URL(googleImageSearchUrl(dish));
    expect(url.hostname).toBe('www.google.com');
    expect(url.searchParams.get('tbm')).toBe('isch');
    expect(url.searchParams.get('q')).toContain('札幌ラーメン');
    expect(url.searchParams.get('q')).toContain('北海道');
  });
});
