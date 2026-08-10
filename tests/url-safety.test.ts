import { describe, expect, it } from 'vitest';
import {
  checkUrl,
  googleMapsDirectionsLink,
  googleMapsSearchLink,
  normalizeMapsUrl
} from '../src/features/places/urlSafety';

describe('checking a URL the reader typed', () => {
  it('treats an empty field as "no link", not as an error', () => {
    expect(checkUrl('   ')).toEqual({ ok: true, value: null, message: '' });
  });

  it('refuses a script or data URL', () => {
    for (const input of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<script>x</script>']) {
      const result = checkUrl(input);
      expect(result.ok).toBe(false);
      expect(result.value).toBeNull();
    }
  });

  it('refuses plain http and says what to type instead', () => {
    const result = checkUrl('http://tabelog.com/tokyo/');
    expect(result.ok).toBe(false);
    expect(result.message).toBe('https から始まるURLを入力してください。');
  });

  it('refuses text that is not a URL at all', () => {
    expect(checkUrl('らーめん たろう 新宿').ok).toBe(false);
  });

  it('accepts an https link when no service is required', () => {
    const result = checkUrl('https://example.com/shop');
    expect(result.ok).toBe(true);
    expect(result.value).toBe('https://example.com/shop');
  });

  it('accepts the Google Maps hosts and rejects a look-alike', () => {
    for (const host of ['www.google.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl']) {
      expect(checkUrl(`https://${host}/maps/search/?api=1&query=x`, 'googleMaps').ok).toBe(true);
    }
    const spoofed = checkUrl('https://google.com.example.net/maps', 'googleMaps');
    expect(spoofed.ok).toBe(false);
    expect(spoofed.message).toBe('Google マップのURLを入力してください。');
  });

  it('accepts a tabelog link and rejects a Maps link in the tabelog field', () => {
    expect(checkUrl('https://tabelog.com/tokyo/A1304/A130401/13000000/', 'tabelog').ok).toBe(true);
    const wrongService = checkUrl('https://www.google.com/maps/search/?api=1&query=x', 'tabelog');
    expect(wrongService.ok).toBe(false);
    expect(wrongService.message).toBe('食べログのURLを入力してください。');
  });
});

describe('comparing two Maps links', () => {
  it('ignores tracking query and a trailing slash', () => {
    const a = normalizeMapsUrl('https://www.google.com/maps/search/?api=1&query=%E3%82%89%E3%83%BC%E3%82%81%E3%82%93&query_place_id=ChIJabc');
    const b = normalizeMapsUrl('https://www.google.com/maps/search?api=1&query=%E3%82%89%E3%83%BC%E3%82%81%E3%82%93&query_place_id=ChIJabc&utm_source=share');
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it('keeps two different places apart', () => {
    const a = normalizeMapsUrl('https://www.google.com/maps/search/?api=1&query=a&query_place_id=ChIJaaa');
    const b = normalizeMapsUrl('https://www.google.com/maps/search/?api=1&query=b&query_place_id=ChIJbbb');
    expect(a).not.toBe(b);
  });

  it('returns null for an empty or unsafe link instead of a comparable string', () => {
    expect(normalizeMapsUrl(null)).toBeNull();
    expect(normalizeMapsUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeMapsUrl('https://example.com/maps')).toBeNull();
  });
});

describe('building the links this app opens', () => {
  it('encodes a Japanese query rather than pasting it raw', () => {
    const link = googleMapsSearchLink('らーめん たろう 新宿');
    expect(link.startsWith('https://www.google.com/maps/search/?')).toBe(true);
    expect(link).not.toContain('らーめん');
    expect(new URL(link).searchParams.get('query')).toBe('らーめん たろう 新宿');
  });

  it('adds the place ID only when there is one', () => {
    expect(new URL(googleMapsSearchLink('店', 'ChIJabc')).searchParams.get('query_place_id')).toBe('ChIJabc');
    expect(new URL(googleMapsSearchLink('店', null)).searchParams.has('query_place_id')).toBe(false);
  });

  it('builds a directions link to the saved place', () => {
    const url = new URL(googleMapsDirectionsLink('店', 'ChIJabc'));
    expect(url.pathname).toBe('/maps/dir/');
    expect(url.searchParams.get('destination')).toBe('店');
    expect(url.searchParams.get('destination_place_id')).toBe('ChIJabc');
  });

  it('produces links that pass its own check', () => {
    expect(checkUrl(googleMapsSearchLink('店'), 'googleMaps').ok).toBe(true);
    expect(checkUrl(googleMapsDirectionsLink('店'), 'googleMaps').ok).toBe(true);
  });
});
