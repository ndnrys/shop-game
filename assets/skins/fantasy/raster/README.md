# 採用画像のPNGアトラス

この会話でユーザーが採用した「キャラクター案・アイテム案」を基準に、内蔵画像生成ツールで作成した透過PNG。CLI/API経由の生成は使用していない。

- `characters.png`: 1536 × 1024、剣士・騎士・魔法使いの3人。約2.1 MiB。
- `items.png`: 1254 × 1254、商品13種類。約1.5 MiB。
- 表示範囲は `js/data/skins/fantasy/artwork.js` に記録。客・商人の役には3人の絵を共有している。役ごとの独自キャラクター画像は未作成。
- 各PNGは1回読み込んで共有する。SVGはPNGの一部分を表示する窓としてのみ使い、絵そのものはラスタ画像。拡大縮小は縦横比を保ち、倉庫・棚では周囲10〜12%の余白を取る。
- 商品の回転は表示窓にも反映。L字形状の当たり判定は占有マスに限定し、画像部分はPointer Eventsを受け取らない。

## 最終生成プロンプト

### Characters（レイアウト調整の最終指示）

Edit this approved character sheet ONLY for clean game-atlas layout. Preserve these exact three character identities, poses, equipment, colors and pixel detail. Keep full body with weapons. SHRINK ALL THREE figures to approximately 65% of canvas height and arrange into THREE EQUAL-WIDTH VERTICAL COLUMNS. The left figure including sword and cloak must be FULLY contained within left one-third; the center knight including shield fully inside middle one-third; the mage including staff fully inside right one-third. Make generous empty transparent vertical gutters of at least 10% of each column width on BOTH sides of EACH figure, so no figure's bounding box overlaps any other figure's bounding box. Align boots at 85% canvas height. Characters may be smaller; the blank spacing is essential. This is a functional transparent PNG texture atlas for programmatic extraction, not an illustration. Remove ALL background glows, colored haze and ground shadows. True transparent background. No words, labels, lines, frame, duplicates. Three isolated figures, with at least 100 pixels of fully transparent gap between each complete silhouette in a 1536px-wide canvas.

### Items

Use case: production game item ATLAS, a single shared PNG texture. Recreate the SIX approved large inventory items from attached reference with the SAME refined fantasy pixel-art material quality (metal glints, leather stitching, wood grain, translucent potion), and extend that coherent style to other shop goods. Output a single SQUARE transparent image containing a perfectly aligned FOUR BY FOUR equally sized grid with NO visible gridlines. Exactly ONE isolated complete object centered inside each tile, max 75% of tile width and height, at least 12% transparent margin. Strict row-major tile contents: row1: straight vertical iron sword tip upward, iron axe with blade at TOP RIGHT and straight vertical wooden handle at LEFT extending downward, round wood shield with brass boss, brown leather cuirass. Row2: red glass healing potion, silver ring with green stone, blue-green faceted magical crystal, tied green herb bundle. Row3: rustic bread loaf, ornate brighter steel sword vertical tip upward, reinforced round shield with steel rim, gray chainmail shirt. Row4: small golden protective amulet on loop, EMPTY, EMPTY, EMPTY. Axes and swords must be completely visible with full tips and pommels. Each tile is independent, no objects cross tile edges. Crisp dense hand-pixeled detail matching attached reference. No characters. No captions, names, numbers, miniatures or frame. No shadows outside objects, no glows, NO background at all. REAL alpha transparent around every object, not black, not parchment, not checkerboard. The last 3 tiles are completely transparent. All 13 objects fit within their own 4x4 equally sized tile.

生成結果は均等グリッドと完全には一致しなかったため、透明部分の範囲を確認し、各画像の個別の矩形を設定している。生成後の切り貼り・背景消去・画素編集は行っていない。
