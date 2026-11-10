# 道具屋UI用の店員

組み込みのimagegenで作成した4表情です。1024×1536px、透過RGBA、WebP品質92。通常画像を基準に、同じ人物・衣装・頭の位置を保つ編集で各表情を作りました。ゲーム本体はこの4ファイルを参照し、旧PNGは上書きしていません。

| ファイル | 使用箇所 |
| --- | --- |
| `shopkeeper-normal.webp` | 朝の報告、章移動の案内 |
| `shopkeeper-talking.webp` | 朝の報告の口元アニメーション |
| `shopkeeper-oh.webp` | 朝の報告4ページ目、出発時の挨拶 |
| `shopkeeper-surprised.webp` | 仕入れ演出 |

通常・会話画像は完全なピクセル差分ではないため、会話画像全体を明滅させず、口元の楕円領域だけを重ねています。座標は `css/game.css` の `.report-clerk-talking` にあります。報告の人物枠は縦横比2:3を固定し、下部をカウンターで隠して上半身を大きく見せます。

## 生成指示

### 基準画像

Use case: illustration-story. Production transparent-background character sprite for a cozy Japanese fantasy shop management mobile game. Redesign the shopkeeper to suit warm ivory parchment panels, forest green buttons, honey brown wooden shop backgrounds and softly painted storybook fantasy artwork. A cheerful adult young woman shopkeeper, warm brown eyes, chestnut brown medium length hair with soft bangs and a loose side braid tied with a small deep forest green ribbon. Cream linen blouse with modest high collar, puffed sleeves rolled to forearms, deep forest green apron with simple brown waist belt and a small brass buckle, subtle stitched apron pocket. Front facing slight three quarter angle, looking warmly toward viewer, gentle closed-mouth smile, both hands relaxed together at waist, welcoming natural pose. Frame from head to upper thighs, both arms and hands completely visible, entire head and hair visible, centrally aligned standing pose, level camera, no foreshortening. Mature tasteful hand painted anime RPG illustration with delicate brown contour lines and soft painterly shading, nuanced fabric and hair, natural proportions roughly 6.5 heads tall, NOT chibi or pixel art. Warm gentle morning lighting. True transparent background, no environment, no counter, no shadow ground, no text, no watermark, no border. Leave approximately 5% transparent padding around full character silhouette. This will be the master design for multiple precisely aligned facial expression variants.

基準画像への仕上げ指示：

Edit target: the most recent green-apron shopkeeper character. Produce the finalized clean transparent cutout. Preserve her face, body, hair, closed-mouth smile, costume, colors, painterly style and exact pose. Remove ALL brown or beige halo, vignette, ambient glow and background pixels around her silhouette. Background must be completely transparent immediately outside her hair and clothes, with only normal antialiased edge pixels. Solid parts of the character should be fully opaque. Do not add a drop shadow or ground. Ensure the entire top of her hair is visible, with 4 percent transparent canvas margin at top and sides, retaining the same portrait 2:3 canvas and central framing. No other changes, no text.

### 会話

Edit target: the supplied transparent green-apron shopkeeper. Make a mouth-only talking expression variant for animation overlay. Change ONLY her lips and the small interior of her mouth: a modest friendly open-mouth smile as if calmly speaking. Keep absolutely everything else identical: exact face shape, eye position, brows, hair, costume, hands, pose, silhouette, light, scale, pixel framing and canvas dimensions. Do not repaint other areas. Same 1024x1536 portrait with character in same coordinates. Preserve the transparent alpha background, no halo or ground. No text, no extra objects.

### 出発時

Edit target: the supplied transparent green-apron shopkeeper. Create her cheerful farewell expression for saying 'Let's do our best today, I'm off to buy supplies!' Same exact adult woman, face, chestnut side braid with green ribbon, cream blouse and green apron, brown belt, same painterly style. Warm joyful open-mouth smile, bright eyes, raise her right hand (viewer left) beside her shoulder in a gentle friendly wave, fingers naturally spread. Other hand resting near waist. Maintain exact head position, overall scale, canvas dimensions and framing of the reference, fully contained arms and hand with clear transparent margins. Upper thigh length, no head cropping. Preserve true transparent background, no halo, no environment or props, no text. This must feel like an expression/gesture variation of the same character, not a redesign.

### 驚き

Edit target: supplied green-apron fantasy shopkeeper. Create her pleasantly surprised expression for receiving newly purchased merchandise: eyebrows gently raised, eyes slightly widened, small open 'oh!' mouth, one hand resting lightly at her upper chest, other hand near her waist. Welcoming happy surprise, not fearful. Preserve the exact adult woman's identity, head position, chestnut side braid with green ribbon, cream blouse, deep forest green apron, brown belt, warm hand painted anime style, same scale and portrait canvas dimensions and upper thigh framing. Keep arms and hands fully inside the canvas. True transparent background with clean silhouette, no background, no text, no ground, no props. An expression/gesture variation of the same character.

## 確認結果

朝の報告4ページを360×640・1280×800で検証し、画像読み込み・表情切替・固定位置・画面内への収まりを確認しました。390×844の実画面を目視確認し、店内背景へ自然に重なることを確認しています。仕入れ演出は360×640、章移動は360×640の35項目が通過しました。実機タッチは未確認です。
