import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { readInstallHint, shouldShowInstallHint, writeInstallHint } from '../features/install/installState';
import { useInstallPrompt } from '../features/install/useInstallPrompt';
import { useAppStore } from '../state/store';

/**
 * The quiet reminder. It waits until the reader has kept something — a wish, a
 * meal, a shop, a finished questionnaire — so it never lands on a first screen,
 * and "今はしない" keeps it away for a month. The answer stays on the device.
 */
export function InstallHint() {
  const { state } = useInstallPrompt();
  const hydrated = useAppStore((store) => store.hydrated);
  const wishes = useAppStore((store) => store.wishes.length);
  const meals = useAppStore((store) => store.meals.length);
  const places = useAppStore((store) => store.places.length);
  const preferenceMode = useAppStore((store) => store.preferenceMeta.mode);
  const [visible, setVisible] = useState(false);
  const panel = useRef<HTMLDivElement | null>(null);

  const hasEarnedIt = wishes > 0 || meals > 0 || places > 0 || preferenceMode !== 'unset';

  useEffect(() => {
    if (!hydrated) return;
    const hint = readInstallHint();
    if (!shouldShowInstallHint({ state, hasEarnedIt, hint })) {
      setVisible(false);
      return;
    }
    writeInstallHint({ ...hint, shownAt: new Date().toISOString() });
    setVisible(true);
  }, [hydrated, state, hasEarnedIt]);

  if (!visible) return null;

  const dismiss = () => {
    writeInstallHint({ ...readInstallHint(), dismissedAt: new Date().toISOString() });
    setVisible(false);
  };

  return (
    <div
      className="install-hint"
      role="region"
      aria-labelledby="install-hint-title"
      ref={panel}
      onKeyDown={(event) => { if (event.key === 'Escape') dismiss(); }}
    >
      <p id="install-hint-title">また使うなら、アプリとして追加できます</p>
      <div className="install-hint-actions">
        <Link className="button button-secondary" to="/about#app" onClick={() => setVisible(false)}>追加方法を見る</Link>
        <button type="button" className="button button-ghost" onClick={dismiss}>今はしない</button>
      </div>
    </div>
  );
}
