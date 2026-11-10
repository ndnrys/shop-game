# 道具屋UI用の商人

店員と同じ、細い茶色の輪郭線と柔らかい陰影を使う手描き調に統一しています。組み込みのimagegenで作成しました。各画像は1024×1536pxの透過RGBAから、WebP品質92で保存しています。

| 商人 | 通常 | ＋を押した時 | −を押した時 |
| --- | --- | --- | --- |
| 武器商 | `weapon-normal.webp` | `weapon-happy.webp` | `weapon-troubled.webp` |
| 防具商 | `armor-normal.webp` | `armor-happy.webp` | `armor-troubled.webp` |
| 道具商 | `tool-normal.webp` | `tool-happy.webp` | `tool-troubled.webp` |

武器商はひげと茶色の革エプロン、防具商は青いベストと兜を維持しています。道具商は成人女性で、赤髪・プラム色の服・胸元の開いたブラウス・気だるげな目元を使い、店員の茶髪と深緑のエプロンから区別しました。

仕入れカードでは小さな旧アイコンを重複表示せず、大きな人物画像自体を切り替えます。最後の操作から0.5秒で通常へ戻る挙動を維持しています。仕入れ演出にも同じ通常画像を使います。旧PNGは上書きしていません。表示だけの変更で、料金・入荷数・抽選は従来どおりです。

## 生成指示（最終仕様）

共通タッチ：

Use the shopkeeper as the required illustration style reference. Soft hand-painted storybook anime style, fine warm brown contour lines, nuanced textured fabric and hair, gentle warm morning light, natural adult anatomy, no chibi, no thick black cartoon outlines, no glossy cel shading. Standing relaxed front three-quarter view, head to upper thighs, entire head and arms in frame, centered 2:3 portrait, true transparent background immediately outside silhouette. No room, no counter, no table, no text, no ground shadow, no halo.

武器商：

Friendly sturdy middle-aged male weapon merchant with chestnut swept-back spiky hair and a full brown beard. Cream rolled sleeve linen shirt, brown leather apron with brass fasteners and brown wrist bracers, one sheathed sword at his side, hands naturally near waist, mature gentle brown eyes and a modest closed-mouth welcoming smile.

防具商：

Friendly young adult male armor merchant with short swept-back brown hair, warm brown eyes and a modest closed-mouth smile. Blue wool waistcoat over cream rolled sleeve linen shirt, brown leather apron with brass buckles. Hold a simple steel helmet naturally at waist with both hands.

道具商：

Adult female potion merchant in her late twenties with a subtly languid, world-weary, quietly confident demeanor, relaxed half-lidded brown eyes and a small restrained asymmetric smile. Long wavy rich copper-red hair, cream headscarf with muted deep plum-purple ribbon, plum-purple fitted bodice and cream blouse with low open scoop neckline and visible tasteful cleavage, moderately fuller bust and natural adult proportions, brown belt and brass details. Hold a red corked potion bottle and a cloth herb pouch. Keep her calm mature charm rather than an exuberant or childish expression.

表情差分：

Change facial expression only. Preserve exact identity, head position, hairstyle, outfit, arms, hands, held objects, pose, silhouette, scale and canvas dimensions. Happy: warm open-mouth smile, gently lifted cheeks and bright friendly eyes; the tool merchant keeps a restrained knowing smile and relaxed half-lidded eyes. Troubled: gently raised inner eyebrows and a small downturned closed mouth; the tool merchant keeps a cool languid, slightly wry demeanor, without tears or a childish pout.

## 確認

`tests/merchants-ui.html` を360×640・1280×800で実行し、9表情・500msの復帰・0回での−操作・3商人の順次登場・画面内への収まり・スキップ・画像失敗時の継続を確認しました。`tests/effects-ui.html` と `tests/frame-ui.html` も360×640で通過しました。実機タッチは未確認です。
