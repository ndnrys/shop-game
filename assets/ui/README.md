# ヘッダー・フッターの装飾画像

現在はヘッダー・フッター・操作ボタンに `header-rustic.webp`、通常背景に `pale-wood.png`、情報カードに `paper-panel.webp` を使います。`footer-parchment.webp` は旧案です。`header-panel.webp` と `footer-panel.webp` は旧案として保持しています。すべて組み込みのimagegenで生成した文字なしの装飾素材です。ヘッダー・旧フッターは2172×724pxのWebP、白木背景は1024×1536pxのPNGです。文字・数字・アイコンを焼き込まず、店名・日付・所持金・ナビゲーション名はHTML、アイコンはSVGで重ねます。

`css/game.css` の `header::before` は9スライスの `border-image`、`#nav::before` は濃い木目を中央基準・縦350%の背景画像として指定しています。外枠を潰さず中央だけを引き伸ばし、画面幅に追従させます。夜スキンでは `--chrome-veil` を重ねて明度を下げます。画像レイヤーは `pointer-events:none` です。

多言語の店名・ナビゲーション名は `data/locales/ja.json` と `en.json` の `ui.shopTitle`・`ui.nav.*` を参照します。英語から日本語への切替でも店名を描画し直します。画像に文言は含まれません。既存の本文や日付などには未翻訳箇所が残っています。

`tests/frame-ui.html` で、日本語→英語→日本語と標準・紙・夜の9通りを、スマホ・PC幅で確認します。画像の参照、文字の切替、ボタンの収まり、メニューの操作も確認します。実機タッチは未確認です。

## ヘッダーの生成指示

Use case: ui-mockup asset. Create ONLY a decorative blank horizontal header panel texture for a warm hand-painted fantasy shop game UI. Wide landscape 3:1 composition, orthographic perfectly straight frontal view, no perspective, full bleed edges. Elegant dark walnut wooden signboard with subtle horizontal wood grain, very thin honey-gold beveled trim along all four edges, tiny restrained brass corner accents. Broad uninterrupted dark central field covering at least 85 percent of panel, deliberately flat low-contrast grain so white HTML text can be overlaid. Soft warm highlights along upper bevel, delicate hand-painted anime storybook material matching cozy wooden shop counter, refined not rough or grungy. Shallow border with minimal ornament, no extruding objects, no mounting wall, no scene, no shadows outside panel. ABSOLUTELY NO text, no letters, no numerals, no inscriptions, no symbols, no logos, no icons, no pictograms, no decorative fake writing. One blank UI panel asset only, no mockup screens, no examples of usage.

## フッターの生成指示

Use case: ui-mockup asset. ONLY a decorative blank horizontal footer navigation backing panel for a cozy hand-painted fantasy shop game. Wide landscape 3:1 composition, perfectly straight frontal orthographic view, no perspective, full bleed edges. Warm pale ivory parchment inset in a slim honey-brown oak frame, restrained brass corner details matching a walnut signboard header. Very light creamy central surface, extremely subtle paper fibers and faint warm shading near edges, broad flat clean uninterrupted central field covering at least 85 percent. Thin beveled wooden top and bottom rails, slender sides. Gentle hand-painted anime storybook material, refined and warm, simple natural grain. This is a background texture only; HTML icons and translated labels will be drawn separately. ABSOLUTELY NO text, no letters, no numbers, no inscriptions, no symbols, no logos, no icons, no pictograms, no fake writing. NO slots, no dividers, no buttons, no compartments, no objects, no scene, no surrounding wall or floor, no external shadows. One continuous blank ivory panel in a modest wooden frame, no mockup screenshots.

確認結果：360×640・1280×800で日英切替と3スキンの9通りが通過しました。390×844の日英スクリーンショットも目視確認しています。

## メイン画面の紙パネル

`paper-panel.webp` は文字なしの生成りの紙と、細い二重線・隅の葉飾りを含む共通装飾です。組み込みimagegenで生成し、WebP品質90で保存しました。吹き出し・情報カード・営業の会話に9スライスで重ねます。飾りは縁に抑え、文字や数値はHTMLのままです。`--surface-opacity` で濃さ、`--paper-wash` で画面背景の紙の濃さ、`--bubble-tip` で吹き出し先端の色を調整します。夜スキンでは画像を薄くし、暗い背景と明るい文字を維持します。装飾レイヤーは `pointer-events:none` です。

生成指示：

Use case: ui-mockup asset. A blank subtle ivory parchment panel surface for the interior cards and speech bubbles of a cozy Japanese fantasy shop game. Landscape 3:2, perfectly flat orthographic 2D, full bleed. Warm light cream handmade paper, restrained fine paper fibers, extremely faint natural mottling, softly aged honey beige edges. A delicate thin brown-gold double hairline frame very near the outer edge with tiny tasteful engraved leaf curls confined to the four corners. Keep the central 90 percent almost plain pale ivory with very low contrast for readable dark HTML text and numbers. Soft hand-painted storybook fantasy material, elegant gentle warm atmosphere, no dark stains, no ripped edges, no heavy scroll rolls, no objects, no wood frame, no shadows outside the canvas. ABSOLUTELY NO text, letters, numbers, logos, symbols, icons, runes, fake handwriting or UI content. Just one reusable blank paper panel background asset.

## 見本に合わせた新しい素材の生成指示

### 木製ヘッダー

Create a production blank UI header background inspired by the supplied reference header. Preserve its restrained rustic shop sign look: deep brown horizontal wood grain in center, thin layered natural timber rails along top and bottom, gentle worn golden-beige highlights, simple straight edges. Wide landscape 3:1 panel, flat frontal orthographic view, full bleed with no surrounding margin. IMPORTANT: REMOVE AND DO NOT INCLUDE all writing, store icon, flower icon, coin icon, numerals, currency, vertical dividers and any other symbols from the reference. No screws, no rivets, no brass corner ornaments, no ornate gilded frame. This must be ONLY dark wood with slim timber edge trim and a plain uninterrupted dark central surface, suitable for placing live HTML text and SVG icons over it. Warm hand-painted fantasy game aesthetic matching reference. No text, no letters, no numbers, no logos, no icons, no objects, no scene.

### 生成りのフッター

Create ONLY a blank footer navigation background inspired by the supplied reference. Match its pale warm ivory paper surface, extremely soft parchment fibers, faint warm edge shading, slim natural brown timber line along TOP EDGE only, hairline brown bottom/side outlines and modest rounded corners. Wide horizontal 3:1 panel, perfectly straight orthographic front view, full bleed with no surrounding margin. Remove ALL reference text, icons, symbols, dividers, buttons and writing. The central area must be one continuous plain light ivory paper surface with no compartments. No metallic ornament, no gold frame, no studs, no screws, no thick wooden side or bottom rails. Hand-painted restrained fantasy shop game aesthetic. ABSOLUTELY NO letters, numerals, text, logo, icons, pictograms or objects. Reusable empty backing panel for live HTML labels and SVG icons.

ヘッダーの日付左右の縦線は表示しません。フッターは上端の木の線を画像の表示範囲から外し、上側の柔らかな影・細いハイライト・小さな角丸で段差を表現します。5項目が横幅を均等に使うよう、古い6列指定は除去しています。

現在のフッターは濃い木目へ変更済みです。背景に側枠を描かず、上側の柔らかな影とハイライトで段差を表現します。

## 白木背景（2026-11-11）

`pale-wood.png` は組み込みの image_gen で新規作成。濃い木目を白く覆う処理をやめ、背景専用の暖かい白木テクスチャを直接表示します。文字はHTMLで重ね、画像に文字を含めません。

生成指示：Use case: stylized-concept. Asset type: mobile fantasy shop game UI background texture. Flat evenly lit front-on pale warm ivory maple wood, subtle hand-painted watercolor/gouache matching a cozy Japanese fantasy game. Honey cream and warm off-white, not gray or parchment. Fine gently flowing vertical grain, a few very subtle elongated growth patterns, visible at mobile scale with low contrast for dark text. No dark knots, dramatic swirls, plank gaps, frames, borders, vignette, shadows, objects or text. Edge-to-edge continuous surface without focal point. Opaque vertical 1024x1536 texture.

## 棚切り替え画像

`shelf-four-cubbies.png` は組み込み image_gen で作成した透過PNGです。共通の空棚にHTMLで実際の商品画像を4区画に重ね、空・1/4・2/4・3/4・4/4の5状態を表示します。文字・番号・数量はHTMLで表示するため、多言語化に対応します。

生成指示：A single compact near-square wooden cabinet viewed straight on. Central vertical divider and one horizontal shelf form exactly four equal empty cubbies in a 2x2 grid. Warm honey oak frame, dark brown interior panels, soft hand-painted Japanese watercolor/gouache fantasy style. Clear silhouette and restrained grain. Simple outer frame, no legs, handles or decoration. No objects, labels, numbers, text, symbols, floor, halo or surrounding scene. Genuine transparent background, square 1024x1024 PNG, shelf fills about 94% of canvas.

## 漆喰背景

現在の通常背景は `lime-plaster.png`。組み込み image_gen で生成した1024×1536の不透明PNGです。生成指示：Warm ivory shikkui lime plaster, smooth matte mineral texture with extremely faint hand-troweled cloud-like tonal variations. Flat front-on, evenly lit, nearly plain, warm off-white suitable for brown text and parchment cards. Hand-painted watercolor/gouache fantasy material. No wood grain, paper fibers, cracks, stains, seams, vignette, objects or text. Full-bleed vertical 1024x1536.

- `parchment-fibers.webp`: built-in image_gen で生成した文字・枠なしの羊皮紙テクスチャ。装備・育成共通の内面へ360pxタイルで使用。プロンプト: light ivory warm parchment, watercolor subtle natural mottling and soft fibers, seamless full-bleed, low contrast, no borders, objects, text or symbols.
