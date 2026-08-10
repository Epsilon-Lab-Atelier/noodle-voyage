import type { FeatureTagTaxonomy } from '../tags/featureTagTypes';
import { findFilter, type FeatureSelection } from './featureFilters';

interface SelectedFeatureChipsProps {
  selection: FeatureSelection;
  taxonomy: FeatureTagTaxonomy | null;
  onRemove: (filterId: string) => void;
  onClear: () => void;
}

export function SelectedFeatureChips({ selection, taxonomy, onRemove, onClear }: SelectedFeatureChipsProps) {
  const chips = [
    ...selection.selected.map((filterId) => ({ filterId, excluded: false })),
    ...selection.excluded.map((filterId) => ({ filterId, excluded: true }))
  ];
  if (!chips.length) return null;

  return (
    <div className="feature-chip-row">
      <ul aria-label="選択中の特徴">
        {chips.map(({ filterId, excluded }) => {
          const label = findFilter(filterId, taxonomy)?.labelJa ?? filterId;
          return (
            <li key={`${excluded ? 'x' : 'i'}-${filterId}`}>
              <button
                type="button"
                className={excluded ? 'feature-chip is-excluded' : 'feature-chip'}
                aria-label={excluded ? `除外条件「${label}」を外す` : `特徴「${label}」を外す`}
                onClick={() => onRemove(filterId)}
              >
                {excluded ? <span className="feature-chip-mark">除外</span> : null}
                {label}
                <span aria-hidden="true">×</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className="text-button" onClick={onClear}>特徴をすべて外す</button>
    </div>
  );
}
