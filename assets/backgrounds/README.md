# 店内のレイヤー素材

朝の報告は以下の順に描画します。

1. `shop-interior-open.webp`：カウンターを取り除いた店内背景。
2. `../shopkeeper/warm/`：人物。`.report-clerk-art` の `z-index:1`。
3. `shop-counter.webp`：独立した透過カウンター。`.report-clerk::after` の `z-index:2`。
4. 吹き出し：`z-index:3`。

カウンターは2172×724px（3:1）の透過画像。上側には透明な空間があり、下側に天板と前板があります。表示枠を横幅に追従させ、下端を基準に自身の高さの42%だけ下げています。前板の表示を抑え、店員のエプロン・腕・腰が見える位置にしています。`pointer-events:none` で操作を遮りません。背景にカウンターを描き込まず、人物と家具の前後関係をCSSで制御します。

画像は組み込みのimagegenで編集・生成し、WebP品質90で保存しました。元の `shop-interior.webp` は参照元として保持しています。

## 背景の編集指示

Edit target: this cozy fantasy shop interior background illustration. REMOVE THE ENTIRE FOREGROUND WOODEN COUNTER/TABLE across the bottom of the image, including its tabletop and decorative wooden front panel. Replace that area with a natural continuation of the empty wooden plank floor and perspective, leading from the existing central rug toward the bottom edge. There must be NO counter, NO table, NO desk, NO horizontal raised furniture spanning the central foreground. Keep the existing left/right wall shelves, potions, window, plants, warm sunlight, soft hand painted storybook style, color palette and camera perspective unchanged. The final image is a clean empty shop interior environment, for separately compositing a shopkeeper and separate foreground counter in HTML. No people, no text, no UI, no new objects. Same portrait composition and dimensions.

## 独立したカウンターの生成指示

Reference image is STYLE AND MATERIAL reference only. Generate a standalone foreground shop counter sprite on a truly transparent background, to be placed IN FRONT OF a shopkeeper in a 2D mobile game. Wide landscape approximately 3:1 composition. A straight warm honey-brown wooden shop counter spanning the full width of the canvas, viewed frontally at the same eye-level perspective as the reference, showing a modest visible tabletop upper surface and substantial carved timber front panel. Top edge horizontal, tabletop shallow in perspective; left and right ends extend to canvas edges so it can cover full screen width. Counter occupies bottom 75 percent of canvas; upper 25 percent is fully transparent air with no objects. Simple elegant wood grain, fine beveled edge, subtle recessed rectangular front panels, soft warm morning light, painterly anime storybook look matching reference shelves. No items on counter, no coins, no plants, no bell, no person, no room, no background, no floor, no cast shadow outside silhouette, no text. Only the wooden counter as a clean opaque cutout, transparent pixels above it. Designed as foreground overlay to hide a character below the waist. Do not render any of the reference room.

## 確認

360×640・1280×800の朝の報告4ページで、独立したカウンター画像・カウンターなしの背景・人物より前の重なり順・操作を遮らない指定を検証しました。390×844の実画面も目視確認しています。実機タッチは未確認です。
