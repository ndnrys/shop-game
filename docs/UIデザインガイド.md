# 道具屋UIの試作

ブランチは `codex/warm-shop-ui`。入口は既存の `index.html` です。別ゲームやworktreeは作成していません。

## 見た目の調整

`css/game.css` 冒頭の変数が色の正本です。標準は生成り・焦げ茶・深緑、紙・夜の既存スキンも同じレイアウトを使います。

| 変数 | 用途 |
| --- | --- |
| `--paper` / `--bg` | 画面・外側の背景 |
| `--ink` / `--muted` | 本文・補助文 |
| `--line` / `--soft` | 枠・淡い面 |
| `--accent` | 確定ボタン・選択枠 |
| `--wood` / `--header-ink` | ヘッダーの木色・文字 |
| `--gold` / `--nav` | 所持金・下部メニュー |
| `--chrome-veil` | ヘッダー・フッターの画像へ重ねる夜スキンの暗色 |
| `--surface-opacity` | 吹き出し・カードの紙画像の濃さ |
| `--paper-wash` / `--bubble-tip` | 画面背景の紙の濃さ・吹き出し先端の色 |

共通見出しは `title()`、ナビゲーションは `renderNavigation()`。画面の状態は `#view` の `data-screen`・`data-phase`・`data-formation` に出力します。スキンの変更で商品寸法や価格を変更しません。

設定画面の表示ページから日本語・英語、標準・紙・夜を切り替えます。英訳が未対応の文言は引き続き日本語です。

## 画像素材

仲間・商品は既存PNGを使っています。商人は `assets/merchants/warm/` の3人×3表情の手描き調WebPへ統一しました。店員は `assets/shopkeeper/warm/` の新しい4表情に統一しています。店員の仕様・生成指示は同ディレクトリの `README.md` を参照してください。追加した背景は組み込みのimagegenで生成し、WebP品質88で書き出しています。約900KBの2画像を使用し、実行時依存は追加していません。

- `assets/backgrounds/shop-interior-open.webp`：手前のカウンターを含まない店内。朝の報告と営業に使用します。人物・UI文字は含めません。
- `assets/backgrounds/shop-counter.webp`：透過の前景カウンター。朝の報告で背景→店員→カウンター→吹き出しの順に重ねます。横幅に追従する3:1の表示枠で、人物の腰を手前から隠します。元の `shop-interior.webp` は生成時の参照元として保持しています。
- `assets/backgrounds/expedition-map.webp`：探索の雰囲気用地図。章ごとの地形・正式な位置関係は表しません。目的地名・攻略進度はJSONと保存状態から描画します。

生成プロンプト（店内）：

> Create a background illustration asset for a warm Japanese fantasy shop management mobile game. Portrait 2:3 composition, exquisite cozy hand painted 2D anime environment matching a cream parchment and forest green UI. Interior of a small medieval equipment and potion shop in soft warm morning sunlight. Wooden shelves to left and right with glass potion bottles, small shields, books, hanging dried herbs, gentle leafy plants; bright mullioned window rear right, warm timber walls. Frontal eye level composition, central area uncluttered to composite an existing shopkeeper character. A broad wooden counter runs across the entire bottom 18 percent of image, simple polished honey brown wood. No people, no characters, no text, no signs, no letters, no UI, no watermark. This is usable production background artwork, not a screenshot. Light airy pastoral mood, painterly detailed but subdued, no heavy black outlines.

生成プロンプト（地図）：

> Production 2D hand painted fantasy map background illustration for a cozy Japanese shop game, landscape 3:2. Warm ivory parchment color scheme, subdued forest green foliage, honey brown trails. A tiny pastoral village at left, lush woodland in middle, small wilderness tent encampment at right, soft mountains behind and small stream in foreground. Delicate painterly anime storybook aesthetic, sunny gentle morning, top-down oblique illustrated map view. No people, no monsters, no text, no labels, no UI, no markers, no border, no watermark. Environment illustration only; usable as background for selectable route markers composited in HTML.

## 検証

- `tests/warm-ui.html?width=360&height=640`：主要・周辺画面、空の在庫と検証用在庫、見出し・常設メニュー・画面内への収まり。
- 同じページの390×844・1280×800も確認対象です。
- `tests/warm-operations.html`：マウス／タッチ相当の回転、端への補正、プレビュー中の状態維持、枠外・キャンセル、重なり防止、装備へのドラッグ、帰還報告のページ切替。
- `tests/report-clerk-ui.html`：報告4ページで店員の位置・画像・表情を確認。
- `tests/trading-ui.html`・`tests/effects-ui.html`：売買・仕入れ演出の既存確認。

上記の画面検証は360×640・390×844・1280×800、操作検証34項目は360×640・1280×800で通過しました。朝の報告・売買・仕入れ演出の既存確認も通過しています。

実機タッチは未検証です。Node.jsが環境にないため `node --test tests/game.test.mjs` は実行できません。

既存の `tests/warehouse-ui.html` と `tests/equipment-ui.html` は初期在庫が5品ある前提ですが、現在の設定は初期在庫0品です。倉庫テストには現行の固定8×8表示とも異なる期待値があります。これらは変更せず、実データから検証用在庫を明示的に作る上記の操作検証を追加しました。

## ヘッダー・フッター

現在のヘッダーは `assets/ui/header-rustic.webp` を9スライス表示し、フッターは `footer-parchment.webp` を上下の余白が見えないよう拡大して配置します。翻訳文やアイコンを含めない装飾画像です。店名は `ui.shopTitle`、ナビゲーションは `ui.nav.*` で明示的に翻訳し、HTMLで描き直します。画像レイヤーはクリック・タップを遮りません。`tests/frame-ui.html` が言語・スキンごとの収まりを検証します。素材の詳細と生成指示は `assets/ui/README.md` を参照してください。

吹き出し・カードの装飾は `assets/ui/paper-panel.webp` を9スライス表示します。共通の疑似要素を使い、表示内容と入力処理から分離しています。装飾の濃さはスキン変数で調整し、夜スキンでも文字のコントラストを保ちます。

ヘッダーの店名・日付・所持金は横一列です。季節名は `ui.season.*`、長い店名は省略表示して全文をツールチップへ保持します。フッターは塗りのSVGアイコンと細い区切り線を使います。吹き出しの付け根の線は `.speech-tail-join` の小さな紙色の面で隠し、しっぽへつなげます。

仕入れの表情は人物カードの大きな画像自体を切り替えます。小さな旧アイコンは重複表示しません。道具商は赤髪・プラム色、武器商は茶色、防具商は青色で識別します。

仕入れ演出も店内背景・独立したカウンター・新商人と店員の組み合わせに統一しました。旧宝箱GIFをやめ、実際の入荷商品の画像を温かなカウンター上に表示し、羊皮紙の4枚ページ一覧へ移ります。演出の文言はHTMLで日本語・英語に対応します。

仕入れ変更の確認：演出・重複購入防止・4枚ページ切替・倉庫復帰は360×640、1280×800、568×320で通過。商人の表情と3人連続演出は360×640・1280×800で通過。実機タッチは未確認です。Node.js未導入のためNodeテストは未実行です。

朝の営業報告は、売上の金色の帯・仕入れと維持費の点線行・淡い緑の収支行で帳簿風に統一。文字はHTMLで翻訳し、SVG装飾に文字は含めません。360×640・1280×800で報告4ページと主要画面の収まり、仕入れと維持費を差し引く収支を確認済みです。実機タッチは未確認、Node.js未導入のためNodeテストは未実行です。

営業の来店間隔は最初0.6秒、その後は1人1.6秒。人物の登場を0.8秒のフェード＋12pxの移動、吹き出しを0.65秒に変更しました。動きを減らす設定では停止。`tests/sales-pacing-ui.html` で表示時間・切替・履歴・収益不変・スマホ幅の収まり、`tests/trading-ui.html` で360×640の8画面を確認済み。実機タッチは未確認です。

営業中は下部の接客履歴・履歴のページ切替を撤去し、その領域を人物と入口背景へ割り当てました。会話・来店数・当日の売上・営業終了ボタンは維持し、購入結果の記録は翌朝のお客様の声から確認します。

## 羊皮紙と4画面の統一

共通背景は薄い羊皮紙を敷き、左右のみ淡い茶色の陰影を重ねます。倉庫・陳列・編成・装備のタブと見出し帯を緑で統一。倉庫は入荷品の帯→番号付き盤面→選択商品の順に配置し、陳列は2列の商品カード、編成は3人の人物カード、装備は人物と能力値の2列にしています。人物カードは既存立ち絵の上半身を切り抜いて使い、画像に文言は含めません。表示用に価格や能力値を作りません。画面の操作部分は既存のロジックとPointer Eventsを利用します。

左右の陰影は不透明度約7%・幅8%に抑え、中央の薄い羊皮紙が主役になるように調整しています。

確認：360×640・390×844で主要画面の表示と4画面の新構成を検証。入荷品による進行制限、棚の一括補充／返却、マウス・タッチ相当の編成ドラッグ、装備候補の収まりを通過。倉庫・装備の34項目の操作検証と、スマホでの9種類の言語／スキン組み合わせを通過しました。実機タッチは未確認。Node.jsがないためNodeテストは起動できませんでした。PC幅の確認はユーザーの指示で省略しています。
