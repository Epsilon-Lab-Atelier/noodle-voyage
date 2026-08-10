import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isIosDevice,
  isIosSafari,
  isStandalone,
  resolveInstallState,
  type InstallPromptEvent,
  type InstallState
} from './installState';

export interface InstallPromptApi {
  state: InstallState;
  /** True only on iOS outside Safari, where adding is not possible yet. */
  needsSafari: boolean;
  /** Opens the browser's own install confirmation. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export function useInstallPrompt(): InstallPromptApi {
  const deferred = useRef<InstallPromptEvent | null>(null);
  const [promptAvailable, setPromptAvailable] = useState(false);
  const [standalone, setStandalone] = useState(() => isStandalone());
  const [iosDevice] = useState(() => isIosDevice());
  const [needsSafari] = useState(() => isIosDevice() && !isIosSafari());

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      // Held so the reader can start the install from our own button instead of
      // whatever bar the browser would have shown.
      event.preventDefault();
      deferred.current = event as InstallPromptEvent;
      setPromptAvailable(true);
    };
    const onInstalled = () => {
      deferred.current = null;
      setPromptAvailable(false);
      setStandalone(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    const media = window.matchMedia?.('(display-mode: standalone)');
    const onDisplayModeChange = (event: MediaQueryListEvent) => setStandalone(event.matches || isStandalone());
    media?.addEventListener?.('change', onDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      media?.removeEventListener?.('change', onDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const event = deferred.current;
    if (!event) return 'unavailable' as const;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // A saved prompt can only be used once, so it is dropped either way.
    deferred.current = null;
    setPromptAvailable(false);
    return outcome;
  }, []);

  return {
    state: resolveInstallState({ standalone, iosDevice, promptAvailable }),
    needsSafari,
    promptInstall
  };
}
