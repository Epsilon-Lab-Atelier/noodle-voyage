import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface RowAction {
  key: string;
  label: string;
  onSelect?: () => void;
  /** Set for an action that leaves the app; rendered as a link. */
  href?: string;
  /** A destructive action is separated and coloured in the menu. */
  danger?: boolean;
  pressed?: boolean;
}

interface ActionRowProps {
  /** Shown on its own, at full size, at every width. */
  primary: RowAction;
  /** Folded behind「その他」on narrow screens. */
  secondary: RowAction[];
  label: string;
  children?: ReactNode;
}

const renderAction = (action: RowAction, className: string) => (action.href
  ? (
    <a key={action.key} className={`${className} external-link`} href={action.href} target="_blank" rel="noopener noreferrer">
      {action.label}<span className="external-mark" aria-hidden="true">↗</span>
      <span className="visually-hidden">（外部サイト、新しいタブで開きます）</span>
    </a>
  )
  : (
    <button key={action.key} type="button" className={className} aria-pressed={action.pressed} onClick={action.onSelect}>
      {action.label}
    </button>
  ));

/**
 * A row of controls that stays readable on a phone: one real button, and
 * everything else behind a menu, rather than four half-width buttons wrapping
 * over three lines and squeezing the shop's name.
 */
export function ActionRow({ primary, secondary, label, children }: ActionRowProps) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="action-row" aria-label={label} ref={wrap}>
      {children}
      {renderAction(primary, 'card-action is-primary')}
      {secondary.length > 0 ? (
        <div className="action-more">
          <button
            type="button"
            ref={trigger}
            className="card-action action-more-trigger"
            aria-expanded={open}
            aria-controls={menuId}
            aria-haspopup="menu"
            onClick={() => setOpen((value) => !value)}
          >
            その他
          </button>
          {open ? (
            <ul id={menuId} className="action-more-list" role="menu" aria-label={`${label}のその他の操作`}>
              {secondary.map((action) => (
                <li key={action.key} role="none">
                  {action.href
                    ? (
                      <a role="menuitem" className={action.danger ? 'is-danger' : ''} href={action.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                        {action.label}<span className="external-mark" aria-hidden="true">↗</span>
                        <span className="visually-hidden">（外部サイト、新しいタブで開きます）</span>
                      </a>
                    )
                    : (
                      <button
                        type="button"
                        role="menuitem"
                        className={action.danger ? 'is-danger' : ''}
                        aria-pressed={action.pressed}
                        onClick={() => { setOpen(false); action.onSelect?.(); trigger.current?.focus(); }}
                      >
                        {action.label}
                      </button>
                    )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
