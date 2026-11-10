# 追加のお客様14人

組み込み image_gen ツールを使用。各職種に2パターンを追加し、既存と合わせて7職種×3人＝21人です。1024×1536の透過WebP、品質92。画像内の文字なし。

## 共通指示

Create one standalone transparent portrait sprite for a cozy Japanese fantasy shop game. Style reference is the attached shopkeeper image ONLY for visual style: same refined hand-painted anime illustration, natural adult proportions, delicate warm brown linework, softly blended watercolor/gouache shading, detailed cloth and hair, warm sunlight, muted earthy palette. NOT chibi, NOT 3D. One adult character, front three-quarter view looking toward viewer, friendly natural neutral expression. Portrait 1024x1536, head to upper thighs, entire head and hands visible, generous 6% empty space above head, centered subject, consistent framing. True transparent background, no scenery, no frame, no text, no letters, no watermark. Subject:  CRITICAL: Copy only the reference rendering technique; never copy its facial identity, clothing or hairstyle. Make the distinctive facial anatomy and age below unmistakable. 

## 人物別指示

### villager-2

Male village farmer age 70, stout broad shoulders, weathered square face, deeply wrinkled sun-tanned cheeks, large bulbous nose, kindly tiny squinting eyes, bushy gray eyebrows, thick white mustache and beard stubble, balding gray hair under a worn straw hat. Ochre linen shirt, faded indigo work vest, brown belt, holds a small woven basket at hip. Closed warm smile.

### villager-3

Female village craft apprentice age 20, dark skin, round compact face, wide-set large dark eyes, flat broad nose, full lips, lively open smile, dense short curly black hair with mustard headband. Teal modest blouse, cream short work apron, rust red skirt, holding a small cloth shopping bag in both hands. No resemblance to brown-haired shopkeeper.

### warrior-2

Female veteran warrior age 45, powerful stocky build, stern broad square face, broken prominent nose, strong jaw, narrow gray eyes, one scar across right eyebrow, dark cropped hair with silver temples. Dented dark steel pauldrons and mail over burgundy padded gambeson, leather gloves, hand resting on sheathed sword at belt. No helmet, expression firm and dependable.

### warrior-3

Male young warrior age 22, lean adult build, long angular face, sharp small blue eyes, straight low brows, clean shaven, long blond hair tied low behind neck. Polished brass trimmed light steel breastplate over navy tunic, blue half cape, holds round steel shield at side. Serious reserved expression, no helmet.

### archer-2

Female adult huntress age 30, warm dark brown skin, oval broad-cheeked face, large deep brown almond eyes, wide nose, full lips, thick black eyebrows, long tightly braided black hair. Rust-red leather jerkin over cream linen, ochre hood down around shoulders, quiver on back, wooden shortbow in left hand. Confident gentle closed smile. No spectacles.

### archer-3

Male elderly forest ranger age 65, very thin long weathered face, hooked nose, deep set narrow green eyes, heavy gray brows, long gray mustache and pointed small beard, gray hair tied back. Muted gray-green hooded cloak hood down, patched brown leather vest over sage shirt, yew bow and quiver. Quiet knowing smile. No spectacles.

### mage-2

Male elderly wizard age 75, very long narrow face, prominent hooked nose, bushy white eyebrows, small round spectacles over tiny blue eyes, long flowing white beard and receding white hair. Large midnight blue pointed hat and deep blue robes with muted gold geometric embroidery, leather belt, holds gnarled wooden staff with amber crystal at side. Amused half-smile. Entire hat and crystal inside frame.

### mage-3

Female young adult mage age 21, short adult petite build, round face and broad cheeks, short button nose, round bright green eyes, thick eyebrows, abundant freckles, short curly copper bob. Small moss green pointed hat, warm ivory high-neck blouse, forest-green robe with ochre cuffs, closed red spellbook hugged at waist. Cheerful curious wide smile. Different face from shopkeeper.

### priest-2

Male temple priest age 55, broad oval face, bald head with short gray side hair, thick dark gray eyebrows, small soft brown eyes, wide nose and full cheeks, clean shaven. Ivory high collar ceremonial robe, deep burgundy stole with simple gold edge without lettering or symbols, simple wood bead necklace, hands gently clasped. Calm reassuring closed smile with age lines.

### priest-3

Female adult traveling priest age 24, dark brown skin, narrow heart-shaped face with high cheekbones and pointed chin, large dark downturned eyes, thin high arched brows, long narrow nose, full lips. Tightly curled dark hair mostly under pale ochre veil, cream and muted sage robe, simple bronze round pendant. Hands around plain small prayer book at waist, reserved tender expression.

### rogue-2

Male adult rogue age 32, lean wiry build, narrow triangular face with long pointed chin, prominent crooked nose, tiny slanted amber eyes, bold asymmetrical brows, black messy short hair, thin mustache and small chin goatee, sly toothy one-sided grin. Charcoal hood down, dusty burgundy leather jerkin, dark gloves, belt pouches and sheathed dagger. Relaxed hand on belt.

### rogue-3（初期案。最終修正は末尾）

Female seasoned rogue age 58, slender adult build, long weathered face, strong cheekbones, slightly hooked nose, small steel blue hooded eyes, fine wrinkles, thin straight eyebrows, silver white pixie hair. Deep navy short cape with hood down, slate blue leather vest, cream shirt, old brown belts with lockpick pouch. Wry closed-mouth smile, tiny scar on chin.

### traveler-2

Female mature traveler age 42, full sturdy build, broad rounded face, large broad nose, wide cheerful mouth, laugh lines, small amber eyes, high thick brows, dark brown curls in a loose bun. Wide-brim tan traveling hat, dusty terracotta cape over blue linen dress, leather satchel and rolled blanket, one hand holding walking stick. Lively broad toothy smile. Entire hat visible.

### traveler-3

Male adult scholarly traveler age 60, dark brown skin, slender long face, high cheekbones, straight long nose, large round thin brass glasses over gentle dark eyes, short tightly curled gray hair and neat salt-and-pepper beard. Muted sage jacket over cream shirt, mustard scarf, cross-body canvas travel satchel, holding a rolled map with no writing. Thoughtful soft closed smile.

## 表示の選び方

`data/trading.json` の `images` に3枚の配列を持ちます。販売対象日と来店の通し番号から見た目を選び、販売中・履歴・翌朝の報告で同じ来店の見た目を維持します。ゲームの乱数を消費せず、購買傾向・確率・価格・保存形式を変えません。旧設定の `image` だけでも表示できます。


## 盗賊3の最終修正

銀髪の年配女性案は採用せず、ユーザーの希望で25歳の女性に変更。銀髪・紺のマント・青い革装備を保ち、少し開いた襟元と細身の革ベストに調整。

Edit this silver-haired rogue into a clearly adult young woman aged 25. Keep silver short pixie hair, navy hood-down cloak, slate blue leather and cream palette, transparent background, pose, hand placement, framing, and warm hand-painted anime illustration technique. Make her clearly feminine with softly angular youthful face, smooth skin without age wrinkles, narrow playful blue eyes, fine arched brows, smaller straight nose, full softly smiling lips, subtle confident flirtatious expression. Slightly sexy but tasteful practical fantasy rogue clothes: fitted blue leather corset-style vest with a moderately low open neckline and cream blouse opened at top to show a little natural cleavage, leather waist belts and lockpick pouch. Normal adult proportions, no nudity, no exaggerated body, no text. Keep entire head and hands in frame.



## 検証

21画像のパスの一意性、1024×1536、RGBA透過を確認。`tests/customers-ui.html` は360×640・390×844で21人それぞれの販売中・履歴・翌朝の報告、3人連続来店時のページ切替、再描画時の安定性、翌日の人物一致、旧image設定へのフォールバックを確認しています。朝の報告4ページと主要画面の回帰確認は360×640で実行。PC幅はユーザーの希望で省略。実機タッチは未確認。Node.js未導入のため `node --test tests/game.test.mjs` は起動できず、ブラウザ検証で確認しています。
