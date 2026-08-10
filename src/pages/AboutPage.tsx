import { ErrorState, LoadingState } from '../components/LoadingState';
import { InstallGuide } from '../components/InstallGuide';
import { useCatalogData } from '../data/useCatalogData';
import { culturalScopeLabels, noodleCategoryLabels, type CulturalScope, type NoodleCategory } from '../types/catalog';

const sourceKindLabels: Record<string, string> = {
  official_catalog: '公式一覧',
  official_government: '公的機関資料',
  official_tourism: '公的観光資料',
  museum: '博物館資料',
  museum_or_library: '博物館・図書館資料',
  industry_association: '業界団体資料',
  professional_reference: '専門資料',
  producer_reference: '生産者資料',
  editorial: '独自編集'
};

export default function AboutPage() {
  const { manifest, sources, loading, error } = useCatalogData();
  if (loading) return <LoadingState />;
  if (error || !manifest) return <ErrorState message={error ?? 'データ情報を読み込めませんでした。'} />;

  const categoryCounts = Object.entries(manifest.counts.byCategory)
    .filter(([, count]) => count > 0) as [NoodleCategory, number][];
  const scopeCounts = Object.entries(manifest.counts.byCulturalScope)
    .filter(([, count]) => count > 0) as [CulturalScope, number][];

  return (
    <div className="page-container about-page section-pad">
      <header className="page-heading">
        <p className="eyebrow">Guide</p>
        <h1>ガイド</h1>
        <p>Noodle Voyageは、EpsilonLabが制作・運営する非公式の麺料理探索アプリです。料理を単純な順位へ並べるのではなく、味、麺、文化の違いを知りながら次の一杯を探せます。</p>
      </header>

      <section className="prose-section warning-section" aria-labelledby="allergy-title">
        <h2 id="allergy-title">原材料とアレルギー</h2>
        <p>本アプリは料理の一般的な特徴を示すもので、店舗ごとの原材料、調理環境、アレルギー対応、宗教上の食事対応を保証しません。健康や安全に関わる確認は、必ず利用する店舗へ直接お問い合わせください。</p>
      </section>

      <section className="prose-section">
        <h2>このアプリでできること</h2>
        <ul>
          <li><strong>好み診断</strong>: 8問の簡易診断か、17項目の詳細設定で好みを登録できます。</li>
          <li><strong>探す</strong>: 一覧、地図、味覚マップの3つの入口から料理を探せます。</li>
          <li><strong>比較</strong>: 日本と世界を横断して、最大3件を横並びで比べられます。</li>
          <li><strong>記録</strong>: 食べたい一杯、食べた記録、お気に入りを端末内に残せます。</li>
        </ul>
      </section>

      <section className="prose-section">
        <h2>好みとの一致度について</h2>
        <p>「一致度87点」のような数値は、好きになる確率や料理の品質評価ではありません。設定した好みと、登録された味・麺の特徴がどの程度近いかを0から100へ換算した指標です。</p>
        <ol>
          <li>好みが登録された「味の幅」の中にあれば、代表値が少し違っても大きく減点しません。</li>
          <li>重視すると指定した項目を強く反映します。</li>
          <li>冒険度を上げると、一致度を保ちながら未体験の特徴を少し優先します。</li>
          <li>似た料理だけで上位を埋めないよう、多様性も加味します。</li>
        </ol>
        <p>情報源の充実度によって一致度を減点することはありません。好み診断を行っていない場合、個人向けの一致度は表示しません。</p>
      </section>

      <section className="prose-section">
        <h2>味覚値、味の幅、味覚マップについて</h2>
        <p><strong>味覚値</strong>は17項目を0から5で表した独自の分類です。<strong>味の幅</strong>は、店舗、地域、作り手による一般的な違いを示すもので、統計的な測定誤差ではありません。</p>
        <p><strong>味覚マップ</strong>は、選んだ2つの特徴で料理を配置します。同じ味覚値を持つ料理は1つのバブルへ集約し、バブルの面積が件数に比例します。表示のために料理の座標を移動させることはありません。バブルを選ぶと、その座標の料理を一覧で確認できます。</p>
      </section>

      <section className="prose-section" id="data">
        <h2>料理の分類について</h2>
        <p>世界の料理を一律に「ラーメン」とは扱いません。次の3つの軸で分類しています。</p>
        <ul>
          <li><strong>地域</strong>: 日本 / 世界</li>
          <li><strong>麺の種類</strong>: ラーメン / うどん / そば / 焼きそば / 世界の麺料理 / その他</li>
          <li><strong>位置づけ</strong>: ご当地 / 定番スタイル / 世界の地域料理</li>
        </ul>
        <p>定番スタイルは特定の地域を持たない探索の入口として扱い、地図や都道府県の集計には含めません。醤油ラーメンやかけうどんのような基本の様式から、代表的なご当地料理をたどれます。</p>
        <p>定番スタイルの代表値は一つの決まったレシピではなく、たれ、だし、油、具材、麺、地域差、店舗差を含む中心像です。公式評価、人気順位、品質順位、官能試験の実測値のいずれでもありません。</p>
        <dl className="about-summary-inline">
          {categoryCounts.map(([category, count]) => (
            <div key={category}><dt>{noodleCategoryLabels[category]}</dt><dd>{count}件</dd></div>
          ))}
        </dl>
        <dl className="about-summary-inline">
          {scopeCounts.map(([scope, count]) => (
            <div key={scope}><dt>{culturalScopeLabels[scope]}</dt><dd>{count}件</dd></div>
          ))}
        </dl>
      </section>

      <section className="prose-section" id="app">
        <InstallGuide headingId="about-install-title" />
      </section>

      <section className="prose-section">
        <h2>記録とプライバシー</h2>
        <p>食べたい、ごちそうさま、お気に入り、自分のお店とメニュー、診断結果は、ブラウザーのIndexedDBへ保存します。アカウント登録やサーバー送信は行いません。写真は取得しません。現在地は、地図検索のボタンを押したときだけ取得し、保存はしません。</p>
        <p>ホーム画面に追加しても、記録はクラウドへ送信されません。記録はこの端末のブラウザー内に保存されます。ブラウザーのサイトデータを削除すると、ホーム画面へ追加した状態でも保存内容が失われる場合があります。定期的にマイ記録からJSONを書き出してください。</p>
        <p>外部地図、画像検索、参考資料を開いた場合は、移動先サービスの方針が適用されます。</p>
        <p>「ごちそうさま」は1回の食事ごとに保存するため、同じ料理を何度でも記録できます。「お気に入り」は、その記録の中から選んだものです。</p>
      </section>

      <section className="prose-section">
        <h2>主な情報源</h2>
        <div className="source-list">
          {sources.map((source) => (
            <article key={source.id}>
              <h3>{source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a> : source.title}</h3>
              <p>{source.publisher} / {sourceKindLabels[source.kind] ?? source.kind}</p>
              <small>{source.note}</small>
            </article>
          ))}
        </div>
        <p>第三者のポスター画像や説明文を転載せず、名称確認と背景調査の参考にした上で、アプリ用の説明と分類を独自に作成しています。公開資料の確認を継続している料理もあります。</p>
        <p>味覚値は、公的・専門資料と典型的な調理構成を照合したEpsilonLabの編集値です。公式評価や官能試験の測定値ではありません。</p>
      </section>

      <section className="prose-section">
        <h2>オフライン利用</h2>
        <p>一度読み込んだ後は、ホーム、料理一覧、条件検索、日本語の特徴検索、好み診断、おすすめ、料理詳細、比較、味覚マップ、食べたい、ごちそうさま、お気に入り、自分のお店とメニュー、設定をオフラインでも利用できます。</p>
        <p>地図検索、画像検索、食べログや公式サイトの閲覧、アプリの更新には通信が必要です。オフラインで外部リンクを押した場合は「この機能にはインターネット接続が必要です」と表示します。外部サイトの内容は保存しません。</p>
      </section>

      <section className="about-summary" aria-label="アプリとデータのバージョン">
        <dl>
          <div><dt>アプリ</dt><dd>v{manifest.appVersion}</dd></div>
          <div><dt>データ版</dt><dd>{manifest.dataVersion}</dd></div>
          <div><dt>データ構造</dt><dd>v{manifest.catalogSchemaVersion}</dd></div>
          <div><dt>最終確認</dt><dd>{manifest.lastReviewed}</dd></div>
          <div><dt>収録</dt><dd>{manifest.counts.total}件（日本 {manifest.counts.japan} / 世界 {manifest.counts.world}）</dd></div>
        </dl>
      </section>
    </div>
  );
}
