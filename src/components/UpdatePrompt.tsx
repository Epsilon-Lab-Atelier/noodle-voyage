import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * A new build never takes the page away mid-sentence. The reader is told a
 * version is waiting and reloads when it suits them; if a form on screen has
 * unsaved text, they are asked once more before the reload.
 */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisterError: () => undefined
  });
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDivElement | null>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!needRefresh) return;
    opener.current = document.activeElement;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [needRefresh]);

  if (!needRefresh) return null;

  const hasUnsavedText = (): boolean => Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('form input, form textarea')
  ).some((field) => field.type !== 'file' && field.value.trim() !== '');

  const close = () => {
    setNeedRefresh(false);
    (opener.current as HTMLElement | null)?.focus?.();
  };

  const update = () => {
    if (hasUnsavedText() && !window.confirm('入力中の内容があります。更新すると入力欄の内容は消えます。更新しますか？')) return;
    setBusy(true);
    // Saved records live in IndexedDB and are untouched by a reload.
    void updateServiceWorker(true);
  };

  return (
    <div
      className="update-prompt"
      role="dialog"
      aria-labelledby="update-prompt-title"
      aria-describedby="update-prompt-body"
      ref={dialog}
      onKeyDown={(event) => { if (event.key === 'Escape') close(); }}
    >
      <div>
        <strong id="update-prompt-title">新しいバージョンがあります</strong>
        <p id="update-prompt-body">保存した記録はそのまま引き継がれます。</p>
      </div>
      <div className="update-prompt-actions">
        <button type="button" className="button button-primary" onClick={update} disabled={busy}>
          {busy ? '更新しています…' : '更新する'}
        </button>
        <button type="button" className="button button-secondary" onClick={close}>あとで</button>
      </div>
    </div>
  );
}
