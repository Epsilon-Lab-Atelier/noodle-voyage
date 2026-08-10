import { useState, type ChangeEvent } from 'react';
import { areaSearchLink, nearbySearchLink, requestCoordinates, type Coordinates } from '../features/places/nearby';

interface StyleShopSearchProps {
  /** The style or dish name to search for, e.g. 「濃厚魚介豚骨つけ麺」. */
  term: string;
  /** Prefilled area, empty for styles that belong to no region. */
  defaultArea?: string;
}

/**
 * Opens a Google Maps search for shops serving this style. No API key and no
 * request from this app: the reader follows a link they can read first.
 */
export function StyleShopSearch({ term, defaultArea = '' }: StyleShopSearchProps) {
  const [area, setArea] = useState(defaultArea);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [message, setMessage] = useState('');
  const [asking, setAsking] = useState(false);

  const useCurrentPosition = async () => {
    setAsking(true);
    setMessage('');
    const result = await requestCoordinates();
    setAsking(false);
    if (!result.ok) {
      setCoordinates(null);
      setMessage(result.message);
      return;
    }
    setCoordinates(result.coordinates);
  };

  return (
    <div className="style-shop-search">
      <a className="button button-secondary" href={areaSearchLink(term, area)} target="_blank" rel="noopener noreferrer">
        このスタイルのお店を地図で探す
      </a>
      <label>
        地域を指定する
        <input
          type="text"
          value={area}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setArea(event.target.value)}
          placeholder="例: 新宿、札幌駅"
        />
      </label>
      <button type="button" className="button button-secondary" onClick={() => void useCurrentPosition()} disabled={asking}>
        {asking ? '現在地を確認しています…' : '現在地の周辺で探す'}
      </button>
      {coordinates ? (
        <a className="button button-primary" href={nearbySearchLink(term, coordinates)} target="_blank" rel="noopener noreferrer">
          現在地の周辺の地図を開く
        </a>
      ) : null}
      {message ? <p className="field-error" role="status">{message}</p> : null}
      <p className="method-note">
        外部サイトを新しいタブで開きます。現在地は保存せず、地図を開くときだけ、おおよその位置として使います。
      </p>
    </div>
  );
}
