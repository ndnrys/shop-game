# お客様の手描き画像

組み込み image_gen ツールで生成。1024×1536、透過WebP、品質92。旧 assets/villagers は保持し、data/trading.json の画像参照のみ差し替え。確率・料金・IDは変更しない。

## 共通生成指示

Create one standalone transparent portrait sprite for a cozy Japanese fantasy shop game. Style reference is the attached shopkeeper image ONLY for visual style: same refined hand-painted anime illustration, natural adult proportions, delicate warm brown linework, softly blended watercolor/gouache shading, detailed cloth and hair, warm sunlight, muted earthy palette. NOT chibi, NOT 3D. One adult character, front three-quarter view looking toward viewer, friendly natural neutral expression. Portrait 1024x1536, head to upper thighs, entire head and hands visible, generous 6% empty space above head, centered subject, consistent framing. True transparent background, no scenery, no frame, no text, no letters, no watermark. Subject: 

## 人物ごとの生成指示

### villager

Adult village woman around 35, dark brown hair gathered under a cream linen headscarf, warm brown eyes, dusty rose dress and cream work apron, modest practical clothing, hands gently clasped, kind smile. Distinct older face from the shopkeeper.

### warrior

Adult male town guard around 35, sturdy build, short dark hair under simple steel helmet, worn steel breastplate and pauldrons over brown leather tunic, brown gloves, holds a simple spear upright beside his shoulder, dependable calm expression. Keep spear inside frame.

### archer

Adult male archer in his late twenties, tousled brown hair, round small spectacles, tan shirt and moss green leather vest, carries a wooden longbow in one hand and a quiver of arrows on his back, thoughtful gentle face. No book.

### mage

Adult female mage in her late twenties, chestnut shoulder-length hair, large floppy muted purple pointed hat with ochre ribbon, plum cape and purple robe, small brass clasp, holds a closed leather spellbook at waist, warm thoughtful expression. Entire hat visible.

### priest

Adult female priest in her early thirties, dark brown hair partly covered by a cream veil edged with muted blue, cream and blue modest robes, hands gently clasped at waist, serene kind expression, simple brass pendant without symbols or letters. Entire veil visible.

### rogue

Adult female rogue in her late twenties, forest green hair in a short ponytail with small burgundy tie, dark olive hooded short cape with hood down, charcoal fitted practical leather tunic, leather belts and small pouches, relaxed hands at waist, alert knowing subtle smile.

### traveler

Adult male traveler in his late twenties, short tousled auburn hair, cream linen shirt with rolled sleeves, worn dark brown leather vest, belt and travel satchel strap across chest, cheerful confident smile, one hand lightly holding shoulder strap.

## 顔の描き分け

村人：丸い頬・目尻の皺・中年の温かな笑顔。戦士：頑丈な顔・無精髭・頬の傷。弓使い：細い面長・丸眼鏡。魔法使い：銀髪・細い青い目・長い鼻。僧侶：角のある柔らかな輪郭・太い眉・垂れ目・目元のほくろ。盗賊：尖った顎・切れ長の琥珀色の目・そばかす・片側の笑み。旅人：広い顎・太い眉・緑の目・歯を見せる笑顔。

## 顔の修正指示

Edit ONLY the face and visible hair of this adult village woman. Preserve clothing, headscarf, hands, pose, framing, warm painterly anime technique and transparent background exactly. Make a DISTINCT middle-aged woman about 48: broad round face with full cheeks, short rounded chin, smaller gently hooded brown eyes with subtle crow's feet, softly arched thin eyebrows, wider small rounded nose, clear warm laugh lines, welcoming closed-mouth smile. Slight gray streaks in dark hair near temples. Not the youthful oval face of the shopkeeper. Natural appealing kind motherly woman. No text.

Edit ONLY this mage's facial identity and hair color, keeping exact purple hat and costume, hands, book, pose, transparent background, rendering style and framing. Create a distinctly different adult woman aged 38: elongated narrow oval face, sharper slender chin, elegant long straight nose, thin high-arched eyebrows, narrow half-lidded icy blue eyes with upper lids, small composed unsmiling lips, cool intellectual reserved expression. Ash silver shoulder-length hair. NOT the round-eyed brown-haired shopkeeper face. Keep warm detailed painterly fantasy anime style, no text.

Change ONLY facial identity and visible hair of this priest woman; keep blue and cream veil, robes, pose, hands, pendant, framing, transparent background and warm painterly anime style. Distinct woman age 32, softly square face and broad rounded jaw, short dark black hair neatly tucked under veil, straight thick dark eyebrows, gently downturned small dark gray eyes with heavy soft eyelids, wider straight nose, full lips in a serene subtle smile, a tiny mole below her left eye. Calm grounded adult appearance, do NOT use the reference's large round brown eyes and pointy oval chin. No text.

盗賊の追加指示：Distinctly angular long narrow face, high cheekbones, pointed chin, small narrow upturned amber eyes, straight bold low eyebrows, long straight nose, asymmetric sideways smirk, light freckles across nose. Do not copy reference facial identity.

旅人の追加指示：Broad square jaw, broad short nose, thick strongly arched auburn eyebrows, slightly small round green eyes, sun-tanned skin, light freckles, broad toothy grin with dimples, clean shaven.


## 確認

7画像とも1024×1536、RGBAの透過を維持してWebPに変換。`tests/customers-ui.html` で360×640・390×844の各幅について、7人それぞれの販売中の人物、販売履歴、翌朝のお客様の声に新画像が読み込まれ、画面内に収まることを確認しました。PC幅の確認はユーザーの指示で省略。実機タッチは未確認です。ゲームの数値ロジックは変更していません。
