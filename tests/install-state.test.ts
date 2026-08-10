import { describe, expect, it } from 'vitest';
import {
  isIosDevice,
  isIosSafari,
  isStandalone,
  readInstallHint,
  resolveInstallState,
  shouldShowInstallHint,
  writeInstallHint,
  type InstallHintRecord
} from '../src/features/install/installState';

const fakeWindow = ({ displayMode = '', agent = '', touchPoints = 0, standalone }: {
  displayMode?: string;
  agent?: string;
  touchPoints?: number;
  standalone?: boolean;
}) => ({
  matchMedia: (query: string) => ({ matches: query.includes(displayMode) && displayMode !== '' }),
  navigator: { userAgent: agent, maxTouchPoints: touchPoints, standalone }
}) as unknown as Window;

const memoryStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => { map.delete(key); },
    setItem: (key: string, value: string) => { map.set(key, value); }
  };
};

describe('reading how the app was opened', () => {
  it('knows a home-screen launch from a browser tab', () => {
    expect(isStandalone(fakeWindow({ displayMode: 'standalone' }))).toBe(true);
    expect(isStandalone(fakeWindow({ displayMode: 'fullscreen' }))).toBe(true);
    expect(isStandalone(fakeWindow({}))).toBe(false);
  });

  it('accepts Safari\'s own standalone flag', () => {
    expect(isStandalone(fakeWindow({ standalone: true }))).toBe(true);
  });

  it('recognises an iPhone and an iPad that calls itself a Mac', () => {
    expect(isIosDevice(fakeWindow({ agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }))).toBe(true);
    expect(isIosDevice(fakeWindow({ agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', touchPoints: 5 }))).toBe(true);
    expect(isIosDevice(fakeWindow({ agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', touchPoints: 0 }))).toBe(false);
    expect(isIosDevice(fakeWindow({ agent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120' }))).toBe(false);
  });

  it('separates Safari on iOS from the other browsers that borrow WebKit', () => {
    expect(isIosSafari(fakeWindow({ agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Safari/605' }))).toBe(true);
    expect(isIosSafari(fakeWindow({ agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/120' }))).toBe(false);
    expect(isIosSafari(fakeWindow({ agent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120' }))).toBe(false);
  });
});

describe('deciding what the app may offer', () => {
  it('says nothing about installing once it is already installed', () => {
    expect(resolveInstallState({ standalone: true, iosDevice: false, promptAvailable: true })).toBe('installed');
    expect(resolveInstallState({ standalone: true, iosDevice: true, promptAvailable: false })).toBe('installed');
  });

  it('offers a real button only when a prompt is actually waiting', () => {
    expect(resolveInstallState({ standalone: false, iosDevice: false, promptAvailable: true })).toBe('install_available');
    expect(resolveInstallState({ standalone: false, iosDevice: false, promptAvailable: false })).toBe('unsupported');
  });

  it('falls back to the Safari steps on iOS', () => {
    expect(resolveInstallState({ standalone: false, iosDevice: true, promptAvailable: false })).toBe('ios_manual');
  });
});

describe('the quiet reminder', () => {
  const fresh: InstallHintRecord = { dismissedAt: null, shownAt: null };

  it('stays away until the reader has kept something', () => {
    expect(shouldShowInstallHint({ state: 'install_available', hasEarnedIt: false, hint: fresh })).toBe(false);
    expect(shouldShowInstallHint({ state: 'install_available', hasEarnedIt: true, hint: fresh })).toBe(true);
  });

  it('never appears once the app is installed, or where it cannot be', () => {
    expect(shouldShowInstallHint({ state: 'installed', hasEarnedIt: true, hint: fresh })).toBe(false);
    expect(shouldShowInstallHint({ state: 'unsupported', hasEarnedIt: true, hint: fresh })).toBe(false);
  });

  it('respects 今はしない for a month, then may ask once more', () => {
    const hint: InstallHintRecord = { dismissedAt: '2026-08-01T00:00:00.000Z', shownAt: null };
    expect(shouldShowInstallHint({ state: 'ios_manual', hasEarnedIt: true, hint, now: new Date('2026-08-20T00:00:00.000Z') })).toBe(false);
    expect(shouldShowInstallHint({ state: 'ios_manual', hasEarnedIt: true, hint, now: new Date('2026-09-15T00:00:00.000Z') })).toBe(true);
  });

  it('keeps the answer on the device and survives a broken value', () => {
    const storage = memoryStorage();
    writeInstallHint({ dismissedAt: '2026-08-10T00:00:00.000Z', shownAt: null }, storage);
    expect(readInstallHint(storage).dismissedAt).toBe('2026-08-10T00:00:00.000Z');
    storage.setItem('noodle-voyage-install-hint', 'not json');
    expect(readInstallHint(storage)).toEqual({ dismissedAt: null, shownAt: null });
    expect(readInstallHint(undefined)).toEqual({ dismissedAt: null, shownAt: null });
  });
});
