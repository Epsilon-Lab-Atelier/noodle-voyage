import type { SearchScope } from '../types/catalog';

const tabs: Array<{ value: SearchScope; label: string }> = [
  { value: 'japan', label: '日本' },
  { value: 'world', label: '世界' },
  { value: 'all', label: 'すべて' }
];

export function ScopeTabs({ value, onChange, label = '検索対象' }: { value: SearchScope; onChange: (scope: SearchScope) => void; label?: string }) {
  return (
    <div className="segmented-control" role="group" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={value === tab.value ? 'is-active' : ''}
          aria-pressed={value === tab.value}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
