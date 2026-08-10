import { useEffect, useState } from 'react';

/**
 * Whether the device believes it can reach the network. Used to explain why an
 * external link cannot open, never to block anything the app can do by itself.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => globalThis.navigator?.onLine ?? true);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

export const offlineExternalMessage = 'この機能にはインターネット接続が必要です';
