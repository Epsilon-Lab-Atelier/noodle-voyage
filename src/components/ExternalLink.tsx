import { useState, type MouseEvent, type ReactNode } from 'react';
import { offlineExternalMessage, useOnlineStatus } from '../features/install/useOnlineStatus';

interface ExternalLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

/**
 * Every link that leaves Noodle Voyage goes through here: it names itself as
 * external, opens in a new tab without handing over the opener, and says why
 * nothing happened when the device is offline.
 */
export function ExternalLink({ href, children, className = 'button button-secondary' }: ExternalLinkProps) {
  const online = useOnlineStatus();
  const [blocked, setBlocked] = useState(false);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (online) return;
    event.preventDefault();
    setBlocked(true);
  };

  return (
    <span className="external-link-wrap">
      <a
        className={`${className} external-link`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-describedby="external-link-note"
        onClick={onClick}
      >
        {children}
        <span className="external-mark" aria-hidden="true">↗</span>
        <span className="visually-hidden">（外部サイト、新しいタブで開きます）</span>
      </a>
      {blocked ? <span className="field-error" role="status">{offlineExternalMessage}</span> : null}
    </span>
  );
}

/** One shared note, referenced by every external link on the page. */
export function ExternalLinkNote() {
  return <p className="method-note" id="external-link-note">外部サイトを新しいタブで開きます。Noodle Voyageの画面ではありません。</p>;
}
