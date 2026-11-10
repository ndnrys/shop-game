# ヘッダー・フッターの装飾画像

`header-panel.webp` と `footer-panel.webp` は、組み込みのimagegenで生成した文字なしの装飾素材です。各2172×724px、WebP品質90。文字・数字・アイコンを焼き込まず、店名・日付・所持金・ナビゲーション名はHTML、アイコンはSVGで重ねます。

`css/game.css` の `header::before` と `#nav::before` に9スライスの `border-image` として指定しています。外枠を潰さず中央だけを引き伸ばし、画面幅に追従させます。夜スキンでは `--chrome-veil` を重ねて明度を下げます。画像レイヤーは `pointer-events:none` です。

多言語の店名・ナビゲーション名は `data/locales/ja.json` と `en.json` の `ui.shopTitle`・`ui.nav.*` を参照します。英語から日本語への切替でも店名を描画し直します。画像に文言は含まれません。既存の本文や日付などには未翻訳箇所が残っています。

`tests/frame-ui.html` で、日本語→英語→日本語と標準・紙・夜の9通りを、スマホ・PC幅で確認します。画像の参照、文字の切替、ボタンの収まり、メニューの操作も確認します。実機タッチは未確認です。

## ヘッダーの生成指示

Use case: ui-mockup asset. Create ONLY a decorative blank horizontal header panel texture for a warm hand-painted fantasy shop game UI. Wide landscape 3:1 composition, orthographic perfectly straight frontal view, no perspective, full bleed edges. Elegant dark walnut wooden signboard with subtle horizontal wood grain, very thin honey-gold beveled trim along all four edges, tiny restrained brass corner accents. Broad uninterrupted dark central field covering at least 85 percent of panel, deliberately flat low-contrast grain so white HTML text can be overlaid. Soft warm highlights along upper bevel, delicate hand-painted anime storybook material matching cozy wooden shop counter, refined not rough or grungy. Shallow border with minimal ornament, no extruding objects, no mounting wall, no scene, no shadows outside panel. ABSOLUTELY NO text, no letters, no numerals, no inscriptions, no symbols, no logos, no icons, no pictograms, no decorative fake writing. One blank UI panel asset only, no mockup screens, no examples of usage.

## フッターの生成指示

Use case: ui-mockup asset. ONLY a decorative blank horizontal footer navigation backing panel for a cozy hand-painted fantasy shop game. Wide landscape 3:1 composition, perfectly straight frontal orthographic view, no perspective, full bleed edges. Warm pale ivory parchment inset in a slim honey-brown oak frame, restrained brass corner details matching a walnut signboard header. Very light creamy central surface, extremely subtle paper fibers and faint warm shading near edges, broad flat clean uninterrupted central field covering at least 85 percent. Thin beveled wooden top and bottom rails, slender sides. Gentle hand-painted anime storybook material, refined and warm, simple natural grain. This is a background texture only; HTML icons and translated labels will be drawn separately. ABSOLUTELY NO text, no letters, no numbers, no inscriptions, no symbols, no logos, no icons, no pictograms, no fake writing. NO slots, no dividers, no buttons, no compartments, no objects, no scene, no surrounding wall or floor, no external shadows. One continuous blank ivory panel in a modest wooden frame, no mockup screenshots.

確認結果：360×640・1280×800で日英切替と3スキンの9通りが通過しました。390×844の日英スクリーンショットも目視確認しています。
