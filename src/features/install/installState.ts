/**
 * What the app can honestly say about being added to the home screen.
 *
 * `installed`         already running from the home screen
 * `install_available` the browser has offered an install prompt we can open
 * `ios_manual`        iPhone or iPad, where the reader adds it from Safari
 * `unsupported`       everything else: we describe, we do not promise
 */
export type InstallState = 'installed' | 'install_available' | 'ios_manual' | 'unsupported';

/** The event Chromium fires before offering its own install UI. */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface NavigatorWithStandalone extends Navigator {
  /** Safari's own flag; present only on iOS. */
  standalone?: boolean;
}

export function isStandalone(view: Window = window): boolean {
  if (view.matchMedia?.('(display-mode: standalone)').matches) return true;
  if (view.matchMedia?.('(display-mode: fullscreen)').matches) return true;
  return (view.navigator as NavigatorWithStandalone).standalone === true;
}

export function isIosDevice(view: Window = window): boolean {
  const agent = view.navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(agent)) return true;
  // iPadOS reports itself as a Mac; a touch screen is what separates the two.
  return /Macintosh/.test(agent) && view.navigator.maxTouchPoints > 1;
}

/**
 * Safari is the only iOS browser that can add to the home screen. Chrome, Edge
 * and Firefox on iOS all run WebKit but say so in the user agent.
 */
export function isIosSafari(view: Window = window): boolean {
  if (!isIosDevice(view)) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|Line|FBAN|FBAV/.test(view.navigator.userAgent);
}

export function resolveInstallState(
  { standalone, iosDevice, promptAvailable }: { standalone: boolean; iosDevice: boolean; promptAvailable: boolean }
): InstallState {
  if (standalone) return 'installed';
  if (promptAvailable) return 'install_available';
  if (iosDevice) return 'ios_manual';
  return 'unsupported';
}

export const installStateLabels: Record<InstallState, string> = {
  installed: 'アプリとして利用中',
  install_available: 'ホーム画面に追加できます',
  ios_manual: 'Safariの共有メニューから追加できます',
  unsupported: 'このブラウザーでは、ホーム画面への追加に対応していない場合があります'
};

/** Where the reminder's "今はしない" is remembered. Device only, never sent. */
export const installHintKey = 'noodle-voyage-install-hint';

export interface InstallHintRecord {
  dismissedAt: string | null;
  shownAt: string | null;
}

const hintWindowMs = 1000 * 60 * 60 * 24 * 30;

export function readInstallHint(storage: Storage | undefined = globalThis.localStorage): InstallHintRecord {
  try {
    const raw = storage?.getItem(installHintKey);
    if (!raw) return { dismissedAt: null, shownAt: null };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { dismissedAt: null, shownAt: null };
    const record = parsed as Partial<InstallHintRecord>;
    return {
      dismissedAt: typeof record.dismissedAt === 'string' ? record.dismissedAt : null,
      shownAt: typeof record.shownAt === 'string' ? record.shownAt : null
    };
  } catch {
    return { dismissedAt: null, shownAt: null };
  }
}

export function writeInstallHint(record: InstallHintRecord, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(installHintKey, JSON.stringify(record));
  } catch { /* A device that refuses storage simply sees the hint again later. */ }
}

/**
 * The quiet reminder appears after the reader has done something worth keeping,
 * never on the first screen of a first visit, and not again for a month after
 * they have said no.
 */
export function shouldShowInstallHint(
  { state, hasEarnedIt, hint, now = new Date() }:
  { state: InstallState; hasEarnedIt: boolean; hint: InstallHintRecord; now?: Date }
): boolean {
  if (state === 'installed' || state === 'unsupported') return false;
  if (!hasEarnedIt) return false;
  if (!hint.dismissedAt) return true;
  return now.getTime() - new Date(hint.dismissedAt).getTime() > hintWindowMs;
}
