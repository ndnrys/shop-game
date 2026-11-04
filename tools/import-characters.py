"""提供ZIPの横4コマを通常・戦闘態勢・療養・死亡へ等分して取り込む。"""
import io
import json
import sys
import zipfile
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
path = root / 'data/characters.json'
characters = json.loads(path.read_text())
states = ('normal', 'battle', 'resting', 'dead')
with zipfile.ZipFile(sys.argv[1]) as archive:
    for character in characters:
        filename = Path(character['images']['normal']).name
        with Image.open(io.BytesIO(archive.read('キャラクター/' + filename))) as sheet:
            if sheet.width % 4:
                raise ValueError(f'{filename}: 横幅を4等分できません')
            width = sheet.width // 4
            for index, state in enumerate(states):
                relative = Path('assets/characters') / ('' if state == 'normal' else state) / filename
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                sheet.crop((index * width, 0, (index + 1) * width, sheet.height)).save(target)
                character['images'][state] = relative.as_posix()
            character['images']['icon'] = character['images']['normal']
path.write_text(json.dumps(characters, ensure_ascii=False, indent=2) + '\n')
