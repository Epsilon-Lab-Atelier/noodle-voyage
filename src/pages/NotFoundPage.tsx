import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return <div className="page-container section-pad"><section className="empty-state"><p className="eyebrow">404</p><h1>ページが見つかりません</h1><p>URLが変わったか、料理データが更新された可能性があります。</p><Link className="button button-primary" to="/">ホームへ戻る</Link></section></div>;
}
