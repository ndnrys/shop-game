from pathlib import Path
import json
from PIL import Image

def check(path):
    with Image.open(path) as im:
        assert im.format == 'PNG' and im.mode == 'RGBA', path
        histogram = im.getchannel('A').histogram()
        pixels = im.width * im.height
        assert histogram[0] / pixels >= .1, (path, 'insufficient clear background')
        # Soft outlines and translucent gems can exceed this review threshold.
        # Inspect flagged assets over a contrasting background before importing.
        if sum(histogram[1:240]) / pixels >= .1:
            print('Transparency review:', path)
        return im.size

root = Path('assets/characters/warm')
chars = Path('data/characters.json')
data = json.loads(chars.read_text())
integrated = []
for c in data:
    name = Path(c['images']['normal']).name
    normal, battle, resting = root/name, root/'battle'/name, root/'resting'/name
    if all(p.exists() for p in (normal, battle, resting)):
        for p in (normal, battle, resting): check(p)
        c['images'].update(normal=str(normal), icon=str(normal), battle=str(battle), resting=str(resting))
        full = root/'full'/name
        if full.exists():
            check(full)
            c['images']['full'] = str(full)
        c['images'].pop('dead', None)
        integrated.append(c['id'])
chars.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
items = Path('data/item-catalog.json')
catalog = json.loads(items.read_text())
src = items.read_text()
for item in catalog['items']:
    new = Path('assets/equipment/warm')/(item['id']+'.png')
    if not new.exists() or str(new) == item['image']: continue
    x,y = check(new); w,h = Image.open(item['image']).size
    assert x*h == y*w, (item['id'],(x,y),(w,h))
    src=src.replace(json.dumps(item['image'],ensure_ascii=False),json.dumps(str(new),ensure_ascii=False))
items.write_text(src)
print('Integrated complete companion sets:', ', '.join(integrated))
