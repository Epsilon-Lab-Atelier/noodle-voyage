# 料理を追加する手順

新しい料理は `dishes.csv` と `taste-scores.csv` の2ファイルへ1行ずつ追加します。両方に同じ `id` の行が必要です。

## 守るべき規則

1. **IDは公開後に変更しない。** 利用者の「食べたい」「ごちそうさま」の記録がIDを参照しています。
2. **味覚値を料理名から推測して公開しない。** 資料で確認できた特徴に基づいて記入してください。
3. **公開資料を確認できない料理は公開しない。** `publication_status` を `internal_pending` にすると、アプリのデータには含まれません。

新規に公開する料理は、原則2件以上の情報源を持ち、そのうち1件以上を公的機関、自治体、観光協会、文化団体、博物館、学術資料のいずれかとします。

## IDの付け方

| カテゴリ | 接頭辞 | 例 |
|---|---|---|
| 定番ラーメン | `jp-style-ramen-` | `jp-style-ramen-shoyu` |
| ご当地うどん | `jp-udon-` | `jp-udon-sanuki` |
| 定番うどん | `jp-style-udon-` | `jp-style-udon-kake` |
| ご当地そば | `jp-soba-` | `jp-soba-izumo` |
| 定番そば | `jp-style-soba-` | `jp-style-soba-mori` |
| ご当地焼きそば | `jp-yakisoba-` | `jp-yakisoba-fujinomiya` |
| 定番焼きそば | `jp-style-yakisoba-` | `jp-style-yakisoba-sauce` |

## dishes.csv の列

複数の値を持つ列は `|` で区切ります。

| 列 | 必須 | 内容 |
|---|---|---|
| `id` | ● | 上記の接頭辞に従った一意のID |
| `name` | ● | 料理名 |
| `local_name` | | 現地表記 |
| `aliases` | | 別名。`|`区切り |
| `country_code` | ● | 日本は `JP` |
| `prefecture_codes` | ご当地のみ | 都道府県コード。`01`〜`47`。複数は `|` 区切り |
| `region_codes` | | 空欄可。`prefecture_codes` から自動で導出されます |
| `city` | | 市区町村名 |
| `lat` / `lon` | ご当地のみ | 地図表示に使う代表座標 |
| `domain` | ● | `japan` または `world` |
| `noodle_category` | ● | `ramen` / `udon` / `soba` / `yakisoba` / `world_noodle` / `other` |
| `cultural_scope` | ● | `regional` / `standard` / `contemporary` / `international` |
| `publication_status` | ● | `published` / `internal_pending` / `archived` |
| `form` | ● | `soup` / `dry` / `dipping` / `cold` / `fried` / `instant` / `hybrid` / `stew` / `hot_pot` / `sauce` |
| `noodle_materials` | ● | `wheat` / `buckwheat` / `rice` / `starch` など。`|`区切り |
| `noodle_shape` | | 麺の形状の説明 |
| `broth_bases` | | だし・スープのベース。`|`区切り |
| `seasonings` | | 味付け。`|`区切り |
| `keywords` | | 検索と関連付けに使う語。`|`区切り |
| `summary` | ● | 1〜2文の紹介文 |
| `background` | | 地域や文化の背景 |
| `variation` | | 店舗や地域による違いの説明 |
| `parent_style_ids` | | 対応する定番スタイルのID。`|`区切り |
| `public_source_ids` | ● | `sources.csv` のID。`|`区切り |
| `verification_level` | ● | `basic` または `reviewed` |
| `reviewed_at` | ● | 確認日。`YYYY-MM-DD` |

### 定番スタイル・現代スタイルの注意

`cultural_scope=standard` と `cultural_scope=contemporary` の料理は、`prefecture_codes`、`lat`、`lon` を**必ず空欄**にしてください。定番スタイルは地図と都道府県の集計に含めません。値が入っていると `npm run check:data` が失敗します。

収録済みの定番スタイル20件のIDは `taxonomy.json` の `standardStyleDisplayOrder`、現代スタイル2件は `contemporaryStyleDisplayOrder` が正本です。この一覧と `dishes.csv` の内容がずれると `npm run check:data` が失敗します。定番スタイルを増減するときは、両方を同時に更新してください。

調査元のデータ、調査ノート、検証結果は `data/standard-styles/` に残しています。内容を変えるときは、まずそちらを更新してからマスターへ反映してください。

## 特徴タグ

`dishes.csv` の `tags` 列には、`rich` や `firm_noodle` のような英語IDを `|` 区切りで書きます。英語IDは内部の識別子で、画面には出しません。

日本語の表示名は `feature-tag-taxonomy.ja.json` から引きます。新しいタグを使うときは、先にこのファイルへ登録してください。

```json
{ "id": "quail_egg", "labelJa": "うずら卵を使う", "groupId": "ingredient", "visibility": "filter", "filterIds": ["egg"] }
```

| 項目 | 内容 |
|---|---|
| `labelJa` | 画面に出す日本語 |
| `groupId` | `taste_aroma` / `broth_seasoning` / `noodle` / `serving` / `ingredient` / `culture` / `internal` |
| `visibility` | `filter`は絞り込みに出る。`detail`は詳細画面のみ。`internal`は表示しない |
| `filterIds` | 対応する絞り込みのID。`visibility=filter` では1件以上必須 |

v2.1.2から続く日本語の自由記述タグ（「煮干し」「あっさり」など）はそのまま使えます。`legacyJapaneseTags` に登録されていれば、絞り込みにも一致します。

辞書にない英語タグが公開中の料理にあると、`npm run check:data` が失敗します。

## relations.csv

定番スタイルと料理の関係は `relations.csv` に1行1関係で記述します。同じ関係を `dishes.csv` と両方に書かないでください。

| 列 | 内容 |
|---|---|
| `source_id` | 関係のもとになる料理のID |
| `target_id` | 関係先の料理のID |
| `relation_type` | `regional_example` / `related_style` / `bridge` |
| `note` | 関係の説明 |

| relation_type | 意味 | 画面での見え方 |
|---|---|---|
| `regional_example` | 定番スタイル → 代表的なご当地料理 | 「代表例」 |
| `related_style` | 定番スタイル → 近い定番スタイル | 「近いスタイル」 |
| `bridge` | 麺の種類をまたぐ橋渡し | 「近いスタイル」 |

ご当地料理から定番スタイルへの関係は、`dishes.csv` の `parent_style_ids` 側に書きます。

`source_id` と `target_id` は、どちらも公開中の料理でなければなりません。1件でも解決できない関係が残ると `npm run check:data` が失敗し、公開できません。

## taste-scores.csv の列

`id` に続けて、17項目の味覚それぞれに `_typical`、`_min`、`_max` の3列、さらに麺の6指標が並びます。すべて0.0から5.0で、`min <= typical <= max` を満たす必要があります。

味覚17項目:

```text
richness          濃厚さ
oiliness          油分
saltiness         塩味
sweetness         甘味
sourness          酸味
heat              辛味
umami             うま味
animalIntensity   動物系の強さ
seafoodIntensity  魚介感
spiceIntensity    香辛料
herbalIntensity   香草
fermentation      発酵感
roastedAroma      香ばしさ
garlicIntensity   にんにく
dashiIntensity    だしの強さ
sauceIntensity    ソース・たれの強さ
noodleAroma       麺そのものの香り
```

麺6指標（`noodle_` を頭に付けます）:

```text
noodle_thickness   太さ
noodle_width       平打ち度
noodle_firmness    硬さ
noodle_elasticity  弾力
noodle_chewiness   もちもち感・噛みごたえ
noodle_smoothness  なめらかさ
```

`noodle_notes` 列には、麺の特徴を文章で書けます。`|` 区切りで複数書けます。空欄でもかまいません。

`noodle_provenance` 列は、麺の数値がどこから来たかを表します。

| 値 | 意味 | 麺のfacetを作るか |
|---|---|---|
| `reviewed` | 資料をもとに確認した | 作る |
| `rule_inferred` | 名称などからの規則で得た | 作る |
| `default_placeholder` | v2.1.2の生成器が一律に与えた既定値 | **作らない** |
| `unknown` | 情報がない | **作らない** |

太麺・細麺・コシなどの絞り込みは、この列が `reviewed` または `rule_inferred` の料理にだけ付きます。件数を増やす目的で `reviewed` へ書き換えないでください。

`min` と `max` は、店舗や地域による一般的な幅を表します。測定誤差ではありません。目安として、地域差の大きい料理は `typical ± 0.85`、比較的均質な料理は `typical ± 0.65` 程度から調整してください。

## sources.csv へ情報源を追加する

| 列 | 内容 |
|---|---|
| `id` | 一意のID |
| `title` | 資料名 |
| `publisher` | 発行元 |
| `url` | URL |
| `kind` | `official_catalog` / `official_tourism` / `museum` / `editorial` |
| `note` | 何の確認に使ったか |
| `visibility` | `public` または `internal` |
| `checked_at` | 資料を確認した日。`YYYY-MM-DD`。空欄可 |

`visibility=internal` の情報源は公開JSONにも画面にも出ません。料理側で参照していても、公開データからは自動で除外されます。

## 見出し行のひな形

`data/templates/` に、各CSVの見出しだけのファイルを置いています。新しい行を用意するときの写し元に使ってください。

## facet索引

絞り込みは `public/data/facet-index.json` を使います。v2.1.2から続く215件は `data/facets/facet-index.seed.json` が正本で、コード側で作り直しません。それ以外の料理は `data/facets/facet-derivation-rules.v2.3.0.json` の規則から生成します。

新しい料理を足したときは、その料理の `tags`、`form`、料理名、味覚値からfacetが自動で作られます。1件もfacetが付かないと `npm run check:data` が失敗します。

麺・スープ・具材が未確認の料理は `data/facets/review-queue.csv` で優先順位を管理しています。調査せずに埋めないでください。

## 追加したあとの確認

```bash
npm run check:data
npm test
```

`check:data` は、ID重複、slug重複、都道府県コードの妥当性、地方との整合、味覚値の範囲、`min <= typical <= max`、定番スタイルへの座標付与、ご当地料理の地域情報欠損、存在しない情報源ID、内部情報源の公開出力への混入、定番スタイル20件の一致、公開中の料理と`relations.json`の未解決IDが0件であることなどを検査します。

公開情報源を持たない料理は警告として一覧に出ます。エラーにはなりませんが、公開前に解消することを推奨します。
