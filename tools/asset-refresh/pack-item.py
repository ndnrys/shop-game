"""Preserve original canvas ratio when packaging generated transparent item art."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageOps

item_id, generated_path = sys.argv[1:]
jobs = json.loads(Path('assets/equipment/warm/production.json').read_text())
job = next(job for job in jobs if job['id'] == item_id)
source = Image.open(generated_path).convert('RGBA')
alpha = source.getchannel('A')
bounds = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
if not bounds:
    raise ValueError('Generated art is empty')
width, height = job['size']
padding = max(2, round(min(width, height) * .04))
art = ImageOps.contain(source.crop(bounds), (width-padding*2, height-padding*2), Image.Resampling.LANCZOS)
canvas = Image.new('RGBA', (width, height))
canvas.paste(art, ((width-art.width)//2, (height-art.height)//2))
canvas.save(job['output'], optimize=True)
print(item_id, canvas.size)
