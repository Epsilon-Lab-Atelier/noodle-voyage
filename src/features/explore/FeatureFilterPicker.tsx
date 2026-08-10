import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { FeatureFilter, FeatureTagTaxonomy } from '../tags/featureTagTypes';
import { searchFeatureFilters, type FeatureSelection } from './featureFilters';

interface FeatureFilterPickerProps {
  taxonomy: FeatureTagTaxonomy | null;
  selection: FeatureSelection;
  onToggle: (filterId: string, mode: 'include' | 'exclude') => void;
  /** Number of dishes each filter would leave, so empty options can be marked. */
  availability: Map<string, number>;
}

export function FeatureFilterPicker({ taxonomy, selection, onToggle, availability }: FeatureFilterPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  const quickFilters = useMemo(() => {
    const byId = new Map((taxonomy?.filters ?? []).map((filter) => [filter.id, filter]));
    return (taxonomy?.quickFilterIds ?? [])
      .map((filterId) => byId.get(filterId))
      .filter((filter): filter is FeatureFilter => filter !== undefined);
  }, [taxonomy]);

  const groups = useMemo(() => {
    const matches = query.trim() ? new Set(searchFeatureFilters(query, taxonomy).map((filter) => filter.id)) : null;
    return (taxonomy?.groups ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((group) => ({
        ...group,
        filters: (taxonomy?.filters ?? [])
          .filter((filter) => filter.groupId === group.id && (!matches || matches.has(filter.id)))
          .sort((a, b) => a.sortOrder - b.sortOrder)
      }))
      .filter((group) => group.filters.length > 0);
  }, [taxonomy, query]);

  const state = (filterId: string) =>
    selection.selected.includes(filterId) ? 'include' : selection.excluded.includes(filterId) ? 'exclude' : 'none';

  const renderFilterButton = (filter: FeatureFilter) => {
    const current = state(filter.id);
    const count = availability.get(filter.id) ?? 0;
    return (
      <li key={filter.id}>
        <button
          type="button"
          className={`feature-option is-${current}`}
          aria-pressed={current === 'include'}
          disabled={current === 'none' && count === 0}
          onClick={() => onToggle(filter.id, 'include')}
        >
          <span className="feature-option-label">{filter.labelJa}</span>
          <small>{filter.descriptionJa}</small>
          <span className="feature-option-count">{count}</span>
        </button>
        <button
          type="button"
          className={current === 'exclude' ? 'feature-exclude is-active' : 'feature-exclude'}
          aria-pressed={current === 'exclude'}
          aria-label={`${filter.labelJa} を除外する`}
          title={`${filter.labelJa} を除外する`}
          onClick={() => onToggle(filter.id, 'exclude')}
        >
          除外
        </button>
      </li>
    );
  };

  return (
    <div className="feature-picker" ref={containerRef}>
      <div className="feature-quick-row" role="group" aria-label="よく使う特徴">
        {quickFilters.map((filter) => {
          const current = state(filter.id);
          const count = availability.get(filter.id) ?? 0;
          return (
            <button
              type="button"
              key={filter.id}
              className={`feature-quick is-${current}`}
              aria-pressed={current === 'include'}
              disabled={current === 'none' && count === 0}
              onClick={() => onToggle(filter.id, 'include')}
            >
              {filter.labelJa}<small>{count}</small>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="button button-secondary feature-picker-toggle"
        aria-expanded={open}
        aria-controls="feature-picker-panel"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'すべての特徴を閉じる' : 'すべての特徴を開く'}
      </button>

      {open && (
        <div className="feature-picker-panel" id="feature-picker-panel">
          <label className="feature-search">特徴を検索
            <input
              type="search"
              value={query}
              placeholder="例: こってり、硬め、冷やし"
              onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            />
          </label>
          {groups.length === 0 && <p className="empty-state">一致する特徴がありません。別の言い方をお試しください。</p>}
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`feature-group-${group.id}`}>
              <h4 id={`feature-group-${group.id}`}>{group.labelJa}</h4>
              <p>{group.descriptionJa}</p>
              <ul className="feature-option-list">{group.filters.map(renderFilterButton)}</ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
