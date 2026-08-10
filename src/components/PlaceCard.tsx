import { Link, useNavigate } from 'react-router-dom';
import { ActionRow } from './ActionRow';
import { placeLocationLabel, summarizePlace, type RecordCollections } from '../features/places/placeSummary';
import { googleMapsSearchLink } from '../features/places/urlSafety';
import { placeStatusLabels, type PlaceRecord } from '../types/records';

interface PlaceCardProps {
  place: PlaceRecord;
  records: RecordCollections;
}

export function PlaceCard({ place, records }: PlaceCardProps) {
  const navigate = useNavigate();
  const summary = summarizePlace(place.id, records);
  // A link the reader saved is preferred; otherwise the name and address are
  // enough for Google Maps to find the shop.
  const mapsUrl = place.googleMapsUrl
    ?? googleMapsSearchLink([place.name, place.addressText ?? ''].filter(Boolean).join(' '), place.googlePlaceId);

  return (
    <article className="place-card">
      <div className="place-card-topline">
        <p className="eyebrow">自分のお店{place.status !== 'unknown' ? ` / ${placeStatusLabels[place.status]}` : ''}</p>
        <span className="record-kind-badge">お店</span>
      </div>
      <h3><Link to={`/places/${place.id}`}>{place.name}</Link></h3>
      <p className="place-card-location">{placeLocationLabel(place)}</p>
      <dl className="place-card-stats">
        <div><dt>メニュー</dt><dd>{summary.menuCount}</dd></div>
        <div><dt>食べたい</dt><dd>{summary.wishCount}</dd></div>
        <div><dt>ごちそうさま</dt><dd>{summary.mealCount}</dd></div>
        <div><dt>最終記録</dt><dd>{summary.lastEatenAt ? summary.lastEatenAt.slice(0, 10) : 'なし'}</dd></div>
      </dl>
      <ActionRow
        label={place.name}
        primary={{ key: 'open', label: '詳しく見る', onSelect: () => navigate(`/places/${place.id}`) }}
        secondary={[
          { key: 'maps', label: 'Google マップで見る', href: mapsUrl },
          ...(place.tabelogUrl ? [{ key: 'tabelog', label: '食べログを開く', href: place.tabelogUrl }] : []),
          ...(place.officialUrl ? [{ key: 'official', label: '公式サイトを開く', href: place.officialUrl }] : [])
        ]}
      />
    </article>
  );
}
