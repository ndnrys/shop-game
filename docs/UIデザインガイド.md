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

仲間・商人・商品は既存PNGを使っています。店員は `assets/shopkeeper/warm/` の新しい4表情に統一しています。店員の仕様・生成指示は同ディレクトリの `README.md` を参照してください。追加した背景は組み込みのimagegenで生成し、WebP品質88で書き出しています。約900KBの2画像を使用し、実行時依存は追加していません。

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

`assets/ui/header-panel.webp`・`footer-panel.webp` を9スライス表示します。翻訳文やアイコンを含めない装飾画像です。店名は `ui.shopTitle`、ナビゲーションは `ui.nav.*` で明示的に翻訳し、HTMLで描き直します。画像レイヤーはクリック・タップを遮りません。`tests/frame-ui.html` が言語・スキンごとの収まりを検証します。素材の詳細と生成指示は `assets/ui/README.md` を参照してください。

吹き出し・カードの装飾は `assets/ui/paper-panel.webp` を9スライス表示します。共通の疑似要素を使い、表示内容と入力処理から分離しています。装飾の濃さはスキン変数で調整し、夜スキンでも文字のコントラストを保ちます。
