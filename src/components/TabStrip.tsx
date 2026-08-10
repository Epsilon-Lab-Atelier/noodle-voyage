import { useEffect, useRef, type KeyboardEvent } from 'react';

export interface TabDescriptor<Id extends string> {
  id: Id;
  label: string;
  count: number;
}

interface TabStripProps<Id extends string> {
  tabs: TabDescriptor<Id>[];
  current: Id;
  onSelect: (id: Id) => void;
  label: string;
}

/**
 * One row of tabs that never wraps. On a narrow phone the row scrolls sideways
 * instead of folding onto a second line, the selected tab is scrolled into
 * view, and the arrow keys move between tabs the way a tab list should.
 */
export function TabStrip<Id extends string>({ tabs, current, onSelect, label }: TabStripProps<Id>) {
  const list = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const selected = list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    // Guarded: not every environment implements it, and a tab that cannot
    // scroll into view is still perfectly usable.
    selected?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === current);
    const next = tabs[(index + step + tabs.length) % tabs.length];
    if (!next) return;
    onSelect(next.id);
    list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[tabs.indexOf(next)]?.focus();
  };

  return (
    <div className="tab-strip">
      <div className="tab-strip-scroller" role="tablist" aria-label={label} ref={list} onKeyDown={onKeyDown}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={current === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={current === tab.id ? 0 : -1}
            className={current === tab.id ? 'is-active' : ''}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}<span className="tab-count">{tab.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
