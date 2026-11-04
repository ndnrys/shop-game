"""Import the explicitly approved equipment archive without executing its contents."""
import argparse,collections,json,zipfile
from pathlib import Path,PurePosixPath

ROOT=Path(__file__).resolve().parents[1]
SPECS=[('one_hand_sword','片手剣','weapon',1,3,10),('one_hand_mace','片手メイス','weapon',1,2,10),('two_hand_sword','両手剣','weapon',2,4,10),('two_hand_axe','両手斧','weapon',2,3,10),('bow','弓','weapon',2,4,10),('staff','杖','weapon',1,4,12),('rod','ロッド','weapon',1,2,12),('spear','両手槍','weapon',1,7,10),('knife','ナイフ','weapon',1,2,10),('shield','盾','offhand',2,2,10),('arrow','矢','offhand',1,2,10),('spellbook','魔導書','offhand',2,2,12),('head_heavy','頭・重装備','head',2,2,10),('head_light','頭・軽装備','head',2,1,10),('head_cloth','頭・服','head',2,2,10),('body_heavy','体・重装備','body',2,3,10),('body_light','体・軽装備','body',2,3,10),('body_cloth','体・服','body',2,3,10),('accessory','装飾品','accessory',1,1,20)]
MAGIC=['火術師','炎帝','火竜','水術師','水精','水龍','風術師','風精','風王','土術師','地霊','大地王']

def main(archive):
 previous=json.loads((ROOT/'data/item-catalog.json').read_text())
 old_by_name={i['name']:i for i in previous['items']}
 reserved={i['id'] for i in previous['items']}|set(previous.get('migration',{}).get('removedItemIds',[]))
 items=[];types=[];new_ids=set()
 with zipfile.ZipFile(archive) as z:
  files=[i for i in z.infolist() if i.filename.endswith('.png')]
  assert len(files)==206,'206 PNGs required'
  groups=collections.defaultdict(list)
  for entry in files:
   path=PurePosixPath(entry.filename)
   assert len(path.parts)==3 and path.parts[0]=='equipment' and not path.is_absolute() and '..' not in path.parts
   groups[int(path.parts[1].split('_')[0])].append(entry)
  assert set(groups)==set(range(1,20))
  for category,(id,label,slot,w,h,count) in enumerate(SPECS,1):
   entries=groups[category]
   assert len(entries)==count
   if id in ['staff','rod','spellbook']:
    suffix={'staff':'の杖','rod':'のロッド','spellbook':'の魔導書'}[id]
    order={name+suffix:i for i,name in enumerate(MAGIC)}
    entries.sort(key=lambda e:order[PurePosixPath(e.filename).stem.split('_',1)[1]])
   else:entries.sort(key=lambda e:int(PurePosixPath(e.filename).name.split('_')[0]))
   types.append(dict(id=id,label=label,slot=slot,width=w,height=h,shapeLabel='正方形' if w==h else '横長' if w>h else '細長' if h>=4 and w==1 else '縦長',footprint='rectangle'))
   next_id=1
   for position,entry in enumerate(entries,1):
    name=PurePosixPath(entry.filename).stem.split('_',1)[1]
    old=old_by_name.get(name)
    if old: item_id=old['id']
    else:
     while f'{id}_{next_id:02}' in reserved:next_id+=1
     item_id=f'{id}_{next_id:02}';reserved.add(item_id)
    assert item_id not in new_ids;new_ids.add(item_id)
    element=['fire','water','wind','earth'][(position-1)//3] if id in ['staff','rod','spellbook'] else 'none'
    path=Path('assets')/entry.filename;target=ROOT/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(entry))
    items.append(dict(id=item_id,name=name,typeId=id,element=element,status='active',image=path.as_posix(),order=position,price=None,stats=None,durability=None,effect=None))
 removed=sorted(({i['id'] for i in previous['items']}|set(previous.get('migration',{}).get('removedItemIds',[])))-new_ids)
 catalog=dict(schemaVersion=1,contentVersion=2,slots=previous['slots'],elements={k:v for k,v in previous['elements'].items() if k!='composite'},types=types,items=items,migration=dict(fromContentVersion=1,removedItemIds=removed),notes=['指定一覧の206種・19カテゴリを正本とする。旧素材・旧装飾品・将来候補は廃止。','画像は提供ZIPの透過PNGをそのまま保存。番号は原ファイルに従う。','属性は杖・ロッド・魔導書のみ明示指定。装飾品を含むその他は属性未指定のため無属性。','価格・能力は未設定。個体耐久と経済設定は既存システムに従う。'])
 (ROOT/'data/item-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
 settings=json.loads((ROOT/'data/game-settings.json').read_text())
 for index,item_id in enumerate(settings['development']['initialItemIds']):
  if item_id in new_ids:continue
  former=next((i for i in previous['items'] if i['id']==item_id),None)
  replacement=next((i for i in items if former and i['typeId']==former['typeId']),items[0])
  settings['development']['initialItemIds'][index]=replacement['id']
 (ROOT/'data/game-settings.json').write_text(json.dumps(settings,ensure_ascii=False,indent=2)+'\n')
 print(f'{len(items)} items / {len(types)} categories / {len(removed)} retired IDs')

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('archive');main(parser.parse_args().archive)
