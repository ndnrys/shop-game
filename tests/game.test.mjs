import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const catalog=JSON.parse(read('data/item-catalog.json'));
const settings=JSON.parse(read('data/game-settings.json'));
const types=Object.fromEntries(catalog.types.map(t=>[t.id,t]));
const rulesContext=vm.createContext({});
vm.runInContext(read('js/item-core.js'),rulesContext);
const rules=rulesContext.ItemCore;

async function game(saved=null){
 const handlers={},timers=new Map();let timerId=0;
 const cells=Array.from({length:64},(_,index)=>({
  dataset:{x:String(index%8),y:String(Math.floor(index/8))},
  classList:{add(){},remove(){}},
  getBoundingClientRect(){return{left:index%8*10,top:Math.floor(index/8)*10,width:10,height:10};}
 }));
 const board={getBoundingClientRect:()=>({left:0,top:0,right:80,bottom:80}),querySelectorAll:()=>cells};
 const view={innerHTML:'',classList:{add(){},remove(){}},
  addEventListener:(name,fn)=>handlers[name]=fn,querySelector:()=>board,querySelectorAll:()=>cells,
  setPointerCapture(){},hasPointerCapture:()=>false};
 const elements={};
 const storage=new Map(saved?[["shop-game-save",JSON.stringify(saved)]]:[]);
 const context=vm.createContext({localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
  document:{querySelector:key=>key==='#view'?view:elements[key]??(elements[key]={innerHTML:'',textContent:'',showModal(){throw Error('Unexpected alert');}}),documentElement:{dataset:{}},body:{append(){}},createElement:()=>({style:{},classList:{toggle(){}},remove(){}}),addEventListener(){}},
  window:{addEventListener(){}},
  fetch:async path=>({ok:true,json:async()=>JSON.parse(read(path))}),
  setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;},clearTimeout:id=>timers.delete(id)
 });
 vm.runInContext(read('js/item-core.js'),context);
 vm.runInContext(read('js/encyclopedia-core.js'),context);
 vm.runInContext(read('js/encyclopedia-ui.js'),context);
 for(const path of ['js/equipment-core.js','js/equipment-ui.js','js/save-game.js','js/main.js'])vm.runInContext(read(path),context);
 await vm.runInContext('loadItemSettings()',context);
 const run=code=>vm.runInContext(code,context);
 const event=(x,y,pointerType='mouse',incoming=false)=>({
  target:{closest:selector=>selector==='[data-drag-incoming]'?(incoming?{}:null):(incoming?null:cells[Math.floor(y/10)*8+Math.floor(x/10)])},
  pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y,pointerType,preventDefault(){}
 });
 return{run,view,elements,handlers,timers,event,storage};
}

test('main entry references only existing scripts and CSS',()=>{
 const html=read('index.html');
 for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g))assert(existsSync(resolve(root,match[1])),match[1]);
 assert(!html.includes('design-previews'));
});

test('206 unique pictured items in 19 categories with fixed magic elements',()=>{
 assert(rules.validate(catalog,settings));
 assert.equal(catalog.items.length,206);
 assert.equal(new Set(catalog.items.map(i=>i.id)).size,206);
 assert.equal(catalog.items.filter(i=>i.status==='planned').length,0);
 const counts={weapon:94,offhand:32,head:30,body:30,accessory:20};
 for(const [slot,count] of Object.entries(counts))assert.equal(catalog.items.filter(i=>types[i.typeId].slot===slot).length,count);
 for(const id of ['staff','rod','spellbook'])for(const element of ['fire','water','wind','earth'])assert.equal(catalog.items.filter(i=>i.typeId===id&&i.element===element).length,3);
});

test('rotation finds a free fourth row in the reported layout',()=>{
 const inventory=[['one_hand_sword',0,0],['shield',1,0],['body_heavy',3,0],['spear',6,0],['staff',5,4],['head_light',1,2]].map(([typeId,x,y],i)=>({uid:i+1,typeId,x,y,rotation:0}));
 const result=rules.findNearby(inventory[3],6,0,1,inventory,types,settings.warehouse,true);
 assert.equal(result.x,1);assert.equal(result.y,3);assert.equal(result.rotation,1);
 assert(rules.canPlace(inventory[3],result.x,result.y,result.rotation,inventory,types,settings.warehouse));
 assert.equal(rules.findNearby(inventory[3],0,0,1,inventory,types,{width:1,height:1}),null);
});

test('all current screens render and generated actions are valid JavaScript',async()=>{
 const g=await game();
 for(const screen of ['home','trade','warehouse','adventurers','equipment','residents','records','journal','settings','catalog','encyclopedia','departure'])for(let phase=0;phase<6;phase++)for(let sub=0;sub<4;sub++){
  g.run(`screen='${screen}';phase=${phase};sub=${sub};render()`);
  assert(g.view.innerHTML.length>0);
  for(const match of g.view.innerHTML.matchAll(/onclick="([^"]*)"/g))new vm.Script(match[1].replaceAll('&quot;','"'));
 }
});

test('purchase, receiving, stocking, return and next day remain connected',async()=>{
 const g=await game();
 g.run('counts=[1,1,1];buy()');
 assert.equal(g.run('phase'),2);assert.equal(g.run('pending.length'),3);
 assert(g.view.innerHTML.includes('仕入れ結果・倉庫整理'));
 assert(g.view.innerHTML.includes('real-board'));
 g.run('advance()');assert.equal(g.run('phase'),2);
 g.run('while(pending.length)receive();advance()');assert.equal(g.run('phase'),3);
 g.run('replenish();returnShelf()');assert.equal(g.run('shelf.length'),0);
 g.run('phase=5;advance()');assert.equal(g.run('day'),3);assert.equal(g.run('phase'),0);
});

for(const pointerType of ['mouse','touch'])test(`${pointerType}: click selection, repeated click rotation, 100ms hold and drag cancellation`,async()=>{
 const g=await game();
 g.run('selected=1;warehouseCell(0,0)');assert.equal(g.run('selected'),0);
 g.run('warehouseCell(0,0)');assert.equal(g.run('stock[0].rotation'),1);
 g.run('reset()');
 const original=g.run('JSON.stringify(stock[0])');
 g.handlers.pointerdown(g.event(5,5,pointerType));g.handlers.pointerup(g.event(5,5,pointerType));
 assert.equal(g.run('JSON.stringify(stock[0])'),original);assert.equal(g.timers.size,0);
 g.handlers.pointerdown(g.event(5,5,pointerType));
 assert.equal([...g.timers.values()][0].delay,100);
 for(const timer of [...g.timers.values()])timer.fn();
 g.handlers.pointermove(g.event(5,45,pointerType));g.handlers.pointerup(g.event(5,45,pointerType));
 assert.equal(g.run('stock[0].y'),4);assert.equal(g.run('stock[0].rotation'),0);
 const moved=g.run('JSON.stringify(stock[0])');
 g.handlers.pointerdown(g.event(5,45,pointerType));for(const timer of [...g.timers.values()])timer.fn();
 g.handlers.pointermove(g.event(150,150,pointerType));g.handlers.pointerup(g.event(150,150,pointerType));
 assert.equal(g.run('JSON.stringify(stock[0])'),moved);
 g.handlers.pointerdown(g.event(5,45,pointerType));for(const timer of [...g.timers.values()])timer.fn();g.handlers.pointercancel();
 assert.equal(g.run('JSON.stringify(stock[0])'),moved);
});

test('incoming drag consumes exactly one item and preserves unique instance IDs',async()=>{
 const g=await game();g.run('counts=[1,0,0];buy()');
 g.handlers.pointerdown(g.event(5,5,'touch',true));for(const timer of [...g.timers.values()])timer.fn();
 g.handlers.pointermove(g.event(5,45,'touch',true));g.handlers.pointerup(g.event(5,45,'touch',true));
 assert.equal(g.run('pending.length'),0);assert.equal(g.run('stock.length'),7);
 assert.equal(g.run('new Set(stock.map(i=>i.uid)).size'),7);
});

test('encyclopedia acquisition survives buyback and does not infer sales',async()=>{
 const g=await game();
 assert.equal(g.run('Object.keys(encyclopedia.items).length'),settings.development.initialItemIds.length);
 g.run('counts=[1,0,0];buy();globalThis.acquired=pending[0].itemId;pending.shift()');
 assert(g.run('encyclopedia.items[acquired].discovered'));
 assert.equal(g.run('encyclopedia.items[acquired].sold'),0);
 g.run('replenish();globalThis.soldId=shelf[0].itemId;phase=5;screen="home";render()');
 assert.equal(g.run('encyclopedia.items[soldId].sold'),0);
 const action=[...g.view.innerHTML.matchAll(/onclick="([^"]*)"/g)].find(m=>m[1].includes('finishDay()'))[1];
 g.run(action.replaceAll('&quot;','"'));
 assert.equal(g.run('encyclopedia.items[soldId].sold'),1);
});
test('set discovery requires simultaneous placement and survives return',async()=>{
 const g=await game();
 g.run("stock=[newItem('one_hand_sword_01'),newItem('shield_01')];selected=0;replenish()");
 assert.equal(g.run('Object.keys(encyclopedia.sets).length'),0);
 g.run('replenish()');
 assert(g.run('encyclopedia.sets.wood_sword_shield.discovered'));
 g.run('returnShelf()');
 assert(g.run('encyclopedia.sets.wood_sword_shield.discovered'));
 assert.equal(g.run('encyclopedia.sets.wood_sword_shield.expeditions'),0);
 g.run("screen='encyclopedia';encyclopediaTab='sets';encyclopediaSelection='wood_sword_shield';render()");
 assert(g.view.innerHTML.includes('木剣＋木の盾'));
});
test('undiscovered detail hides definition and reset clears records',async()=>{
 const g=await game();
 g.run("screen='encyclopedia';encyclopediaTab='sets';encyclopediaSelection='wood_sword_shield';render()");
 assert(!g.view.innerHTML.includes('木剣'));
 g.run("EncyclopediaCore.acquire(encyclopedia,'shield_01');reset()");
 assert.equal(g.run('Object.keys(encyclopedia.sets).length'),0);
});

test('failed purchase does not discover any new products',async()=>{
 const g=await game();
 const before=g.run('JSON.stringify(encyclopedia)');
 g.run('gold=0;counts=[1,0,0]');
 assert.throws(()=>g.run('buy()'),/Unexpected alert/);
 assert.equal(g.run('JSON.stringify(encyclopedia)'),before);
 assert.equal(g.run('pending.length'),0);
});

test('touch movement before hold and capture transfer from the touched cell do not cancel dragging',async()=>{
 const g=await game();
 g.handlers.pointerdown(g.event(5,5,'touch'));
 // A real finger starts moving while the long-press timer is still pending.
 g.handlers.pointermove(g.event(5,25,'touch'));
 assert.equal(g.timers.size,1);
 for(const timer of [...g.timers.values()])timer.fn();
 // Implicit capture on the cell is lost when capture moves to the workspace.
 g.handlers.lostpointercapture({target:{nodeName:'BUTTON'},pointerId:1});
 g.handlers.pointermove(g.event(5,45,'touch'));
 g.handlers.pointerup(g.event(5,45,'touch'));
 assert.equal(g.run('stock[0].y'),4);
 assert.equal(g.run('stock[0].rotation'),0);
});

test('agreed village characters and individual initial stats replace placeholder names',async()=>{
 const g=await game();
 assert.equal(g.run('characters.length'),27);
 g.run("screen='adventurers';sub=0;render()");
 for(const name of ['カイル','ガレス','ミラ'])assert(g.view.innerHTML.includes(name));
 assert(!/リナ|ブラン|ノア/.test(g.view.innerHTML));
 for(const [id,expected] of [['kyle','冒険者 / Lv.1 / HP 3 / 攻撃 4 / 防御 2 / 固有属性 なし'],['gares','戦士 / Lv.1 / HP 4 / 攻撃 2 / 防御 3 / 固有属性 なし'],['mira','魔法使い / Lv.1 / HP 4 / 攻撃 1 / 防御 3 / 固有属性 炎1']]){
  assert.throws(()=>g.run(`characterInfo('${id}')`),/Unexpected alert/);
  assert.equal(g.elements['#modalBody'].textContent,expected);
 }
 g.run("openCharacterEquipment('kyle')");assert(g.view.innerHTML.includes('カイル · 装備'));g.run('closeCharacterEquipment()');
 g.run("screen='home';phase=0;sub=1;render()");
 assert(g.view.innerHTML.includes('帰還したパーティはありません。'));
});

test('party rosters are independent and moving a member updates chapter membership badges',async()=>{
 const g=await game();
 assert.equal(g.run('JSON.stringify(parties)'),JSON.stringify([['kyle','gares','mira'],[],[]]));
 g.run("screen='adventurers';switchParty(1)");
 assert.equal(g.run('parties[1].filter(Boolean).length'),0);
 assert(g.view.innerHTML.includes('この章で使える仲間 · 3人'));
 assert(!g.view.innerHTML.includes('待機中の冒険者'));
 assert(!g.view.innerHTML.includes('パーティの支度金'));
 g.run("assignCharacter('kyle')");
 assert.equal(g.run('parties[0][0]'),'kyle');
 assert.equal(g.run('parties[1].filter(Boolean).length'),0);
 assert(g.view.innerHTML.includes("openCharacterEquipment('kyle')"));
 g.run("switchParty(0);partySlot=0;removeCharacterFromParty(parties[party][partySlot]);switchParty(1);assignCharacter('kyle')");
 assert.equal(g.run('parties[0][0]'),null);
 assert.equal(g.run('parties[1][0]'),'kyle');
 assert.equal(g.run("partyNumber('kyle')"),2);
 assert.equal(g.run("parties.flat().filter(id=>id==='kyle').length"),1);
 assert(g.view.innerHTML.includes('party-badge">2</span>カイル'));
 g.run("assignCharacter('leon')");assert.equal(g.run('parties[1][0]'),'kyle');
 g.run('removeCharacterFromParty(parties[party][partySlot])');assert.equal(g.run("partyNumber('kyle')"),0);
 g.run("screen='home';phase=4;sub=0;render()");
 assert(g.view.innerHTML.indexOf('パーティの支度金')<g.view.innerHTML.indexOf('パーティ · 3人枠'));
 g.run('funds[1]=100;switchParty(0)');assert.equal(g.run('funds[0]'),0);
 g.run('reset()');assert.equal(g.run('party'),0);assert.equal(g.run("partyNumber('kyle')"),1);
});

for(const pointerType of ['mouse','touch'])test(`${pointerType}: party drop targets a slot and cancellation preserves membership`,async()=>{
 const g=await game();
 g.run(`globalThis.dragHandlers={};globalThis.dragTarget=null;
 window.addEventListener=(name,fn)=>dragHandlers[name]=fn;
 window.removeEventListener=(name,fn)=>{if(dragHandlers[name]===fn)delete dragHandlers[name]};
 document.elementFromPoint=()=>dragTarget;
 globalThis.dropSlot={dataset:{partySlot:'2'},classList:{add(){},remove(){}}};
 globalThis.dragEvent={pointerId:9,isPrimary:true,button:0,pointerType:'${pointerType}',clientX:0,clientY:0,preventDefault(){}};
 screen='adventurers';switchParty(1);startPartyDrag(dragEvent,'kyle');`);
 assert.equal(g.run('Object.keys(dragHandlers).length'),0);
 g.run(`switchParty(0);removeCharacterFromParty(parties[party][partySlot]);switchParty(1);startPartyDrag(dragEvent,'kyle');dragTarget={closest:()=>dropSlot};dragHandlers.pointermove({...dragEvent,clientX:30});dragHandlers.pointerup({...dragEvent,clientX:30})`);
 assert.equal(g.run('parties[1][2]'),'kyle');
 assert.equal(g.run('Object.keys(dragHandlers).length'),0);
 const before=g.run('JSON.stringify(parties)');
 g.run(`startPartyDrag(dragEvent,'kyle');dragTarget=null;dragHandlers.pointermove({...dragEvent,clientX:30});dragHandlers.pointerup({...dragEvent,clientX:30})`);
 assert.equal(g.run('JSON.stringify(parties)'),before);
 g.run(`startPartyDrag(dragEvent,'kyle');dragTarget={closest:()=>dropSlot};dragHandlers.pointermove({...dragEvent,clientX:30});dragHandlers.pointercancel()`);
 assert.equal(g.run('JSON.stringify(parties)'),before);
 assert.equal(g.run('Object.keys(dragHandlers).length'),0);
});

test('formation offers only drag assignment and character equipment actions, without click assignment or clear controls',async()=>{
 const g=await game();g.run("screen='adventurers';render()");
 assert(!g.view.innerHTML.includes('onclick="assignCharacter'));
 assert(!g.view.innerHTML.includes('枠から外す'));
 assert(!g.view.innerHTML.includes('クリア'));
 assert.equal((g.view.innerHTML.match(/onclick="openCharacterEquipment/g)||[]).length,6);
 assert(g.view.innerHTML.includes('data-party-roster="true"'));
 const before=g.run('JSON.stringify(parties)');
 g.run("openCharacterEquipment('kyle')");assert.equal(g.run('JSON.stringify(parties)'),before);assert.equal(g.run('screen'),'equipment');
});

test('durability roll follows all weighted boundaries and price uses current ratio',async()=>{
 const g=await game();
 for(const [n,expected] of [[0,8],[.09999,8],[.1,9],[.29999,9],[.3,10],[.69999,10],[.7,11],[.89999,11],[.9,12],[.99999,12]])assert.equal(g.run(`EquipmentCore.roll(()=>${n})`),expected);
 g.run("stock[0].durability=5;stock[0].maxDurability=10");assert.equal(g.run('saleValue(stock[0])'),100);assert.equal(g.run('buybackValue(stock[0])'),10);
 g.run('stock[0].durability=1;stock[0].maxDurability=12');assert.equal(g.run('saleValue(stock[0])'),20);
 g.run('reset()');assert(g.run('stock.every(i=>i.durability===10&&i.maxDurability===10)'));
 g.run("pending=[newItem('one_hand_sword_03')]");assert(g.run('pending[0].durability===pending[0].maxDurability&&pending[0].durability>=8&&pending[0].durability<=12'));
});

test('equipping and removing preserves durability; full warehouse returns are atomic',async()=>{
 const g=await game();g.run("equipCharacter='kyle';equipmentSlot='weapon';stock[0].durability=3;changeEquipment(stock[0].uid)");
 assert.equal(g.run('gear("kyle").weapon.durability'),3);assert.equal(g.run('stock.length'),5);
 g.run('changeEquipment()');assert.equal(g.run('stock.find(i=>i.uid===1).durability'),3);
 g.run('changeEquipment(1);config.warehouse={width:1,height:1}');
 assert.throws(()=>g.run('changeEquipment()'),/Unexpected alert/);assert.equal(g.run('gear("kyle").weapon.uid'),1);assert.equal(g.run('stock.length'),5);
});

test('departure snapshots members, locks equipment and party, wears once on return, persists broken target',async()=>{
 const g=await game();g.run("equipCharacter='kyle';equipmentSlot='weapon';stock[0].durability=1;changeEquipment(1);phase=4;screen='home';funds[0]=10;depart();depart()");
 assert.equal(g.run('expeditions.length'),1);assert.equal(g.run('gear("kyle").weapon.durability'),1);assert.equal(g.run('gold'),1240);
 g.run("changeEquipment();removeCharacterFromParty('kyle')");assert.equal(g.run('gear("kyle").weapon.uid'),1);assert.equal(g.run('parties[0][0]'),'kyle');
 const saved=JSON.parse(g.run('JSON.stringify(snapshot())'));const restored=await game(saved);
 assert.equal(restored.run('expeditions.length'),1);
 restored.run('phase=5;finishDay()');assert.equal(restored.run('gear("kyle").weapon'),null);assert.equal(restored.run('brokenTargets.kyle.weapon'),'one_hand_sword_03');assert.equal(restored.run('expeditions.length'),0);
 restored.run('resolveExpeditions()');assert.equal(restored.run('encyclopedia.items.one_hand_sword_03.expeditions'),1);
});

test('auto equip is opt-in, same ID only, skips forged, lowest maximum then current; retries missing stock',async()=>{
 const g=await game();g.run("stock=[];brokenTargets={kyle:{weapon:'one_hand_sword_03'}};prepareEquipment(['kyle'])");assert.equal(g.run('gear("kyle").weapon??null'),null);
 g.run("autoEquip={kyle:{weapon:true}};prepareEquipment(['kyle']);stock=[{...newItem('one_hand_sword_03'),maxDurability:8,durability:1,forged:true},{...newItem('one_hand_sword_03'),maxDurability:9,durability:1},{...newItem('one_hand_sword_03'),maxDurability:8,durability:4},{...newItem('one_hand_sword_03'),maxDurability:8,durability:2},newItem('spear_01')];prepareEquipment(['kyle'])");
 assert.equal(g.run('gear("kyle").weapon.maxDurability'),8);assert.equal(g.run('gear("kyle").weapon.durability'),2);assert.equal(g.run('stock.length'),4);assert.equal(g.run('brokenTargets.kyle.weapon??null'),null);
 g.run('prepareEquipment(["kyle"])');assert.equal(g.run('stock.length'),4);
});

test('forged equipment cannot be stocked or bought back, can be manually equipped, discarded and broken',async()=>{
 const g=await game();g.run('stock[0].forged=true');assert.throws(()=>g.run('replenish()'),/Unexpected alert/);assert.throws(()=>g.run('buybackStock()'),/Unexpected alert/);assert.equal(g.run('stock.length'),6);
 g.run("equipCharacter='kyle';equipmentSlot='weapon';changeEquipment(1);gear('kyle').weapon.durability=1;EquipmentCore.wear(gear('kyle'))");assert.equal(g.run('gear("kyle").weapon'),null);
 g.run('stock[0].forged=true;discardStock()');assert.equal(g.run('stock.length'),4);
});

test('v1 migration uses used flag, v2 round-trip preserves instance and invalid import is atomic',async()=>{
 const g=await game();g.run("globalThis.legacy=snapshot();legacy=JSON.parse(JSON.stringify(legacy));legacy.version=1;for(const i of legacy.stock){delete i.durability;delete i.maxDurability;delete i.forged;delete i.forgeType}legacy.stock[0].used=true;applySave(legacy)");
 assert.equal(g.run('stock[0].durability'),5);assert.equal(g.run('stock[1].durability'),10);assert.equal(g.run('stock[0].forged'),false);assert.equal(g.run('snapshot().version'),2);
 const saved=JSON.parse(g.run('JSON.stringify(snapshot())'));const loaded=await game(saved);assert.equal(loaded.run('stock[0].durability'),5);assert.equal(loaded.run('stock[0].uid'),1);
 for(const change of ['bad.stock[0].durability=0','bad.stock[0].itemId="unknown"','bad.stock[1].uid=bad.stock[0].uid','bad.stock[0].x=99','bad.version=99']){
  loaded.run('globalThis.bad=JSON.parse(JSON.stringify(snapshot()))');loaded.run(change);assert.throws(()=>loaded.run('applySave(bad)'));assert.equal(loaded.run('stock[0].durability'),5);
 }
 loaded.run('render()');assert.equal(JSON.parse(loaded.storage.get('shop-game-save')).version,2);
});

test('departure consumes every slot once for participants only and replacement happens on next departure',async()=>{
 const g=await game();g.run(`equipCharacter='kyle';equipmentSlot='weapon';changeEquipment(1);equipmentSlot='offhand';changeEquipment(2);equipCharacter='gares';equipmentSlot='body';changeEquipment(3);equipCharacter='mira';equipmentSlot='head';changeEquipment(6);
 gear('kyle').weapon.durability=1;autoEquip={kyle:{weapon:true}};
 globalThis.spare={...newItem('one_hand_sword_03'),maxDurability:8,durability:8};storeItem(spare);
 parties[0]=['kyle','gares'];phase=4;screen='home';depart();phase=5;finishDay()`);
 assert.equal(g.run('gear("kyle").weapon'),null);assert.equal(g.run('gear("kyle").offhand.durability'),9);assert.equal(g.run('gear("gares").body.durability'),9);assert.equal(g.run('gear("mira").head.durability'),10);
 assert(g.run('stock.some(i=>i.uid===spare.uid)'));
 g.run('phase=4;depart()');assert.equal(g.run('gear("kyle").weapon.uid'),g.run('spare.uid'));assert.equal(g.run('gear("kyle").weapon.durability'),8);
});

test('browser save reload and JSON import/export data preserve pending, shelves, parties and per-slot settings',async()=>{
 const g=await game();g.run(`replenish();pending=[newItem('shield_01')];autoEquip={mira:{head:true,weapon:false}};render()`);
 const saved=JSON.parse(g.storage.get('shop-game-save'));const loaded=await game(saved);
 assert.equal(loaded.run('pending[0].uid'),saved.pending[0].uid);assert.equal(loaded.run('shelf[0].uid'),saved.shelf[0].uid);assert.equal(loaded.run('autoEquip.mira.head'),true);assert.equal(loaded.run('autoEquip.mira.weapon'),false);
 loaded.run(`globalThis.copy=JSON.stringify(snapshot());gold=0`);loaded.run("document.querySelector('#modal').showModal=()=>{}");await loaded.run(`importGame({size:copy.length,text:async()=>copy})`);
 assert.equal(loaded.run('gold'),saved.gold);assert.equal(loaded.run('snapshot().version'),2);
});


test('equipment close restores the exact origin, navigation stays within available characters and slots filter inventory',async()=>{
 const g=await game();g.run("screen='home';phase=4;party=1;partySlot=2;rosterPage=1;page=2;sub=0;render();globalThis.before=JSON.stringify({screen,sub,page,party,partySlot,rosterPage});openCharacterEquipment('gares')");
 assert.equal(g.run('screen'),'equipment');assert(g.view.innerHTML.includes('ガレス · 装備'));
 assert(g.view.innerHTML.includes('HP <b>4</b>'));assert(g.view.innerHTML.includes('攻撃 <b>2</b>'));assert(g.view.innerHTML.includes('防御 <b>3</b>'));
 assert.equal((g.view.innerHTML.match(/class="equipment-slot /g)||[]).length,5);
 assert(g.view.innerHTML.includes('鉄の剣'));assert(!g.view.innerHTML.includes('onclick="changeEquipment(2)"'));
 g.run("selectEquipmentSlot('offhand')");assert(g.view.innerHTML.includes('onclick="changeEquipment(2)"'));assert(!g.view.innerHTML.includes('onclick="changeEquipment(1)"'));
 g.run('changeEquipment(2)');assert.equal(g.run('gear("gares").offhand.uid'),2);
 g.run('moveEquipmentCharacter(1)');assert.equal(g.run('equipCharacter'),'mira');assert(g.view.innerHTML.includes('固有属性 '+catalog.elements.fire+'1'));assert.equal(g.run('equipmentSlot'),'offhand');
 g.run('moveEquipmentCharacter(1)');assert.equal(g.run('equipCharacter'),'mira');
 g.run('moveEquipmentCharacter(-1);moveEquipmentCharacter(-1);moveEquipmentCharacter(-1)');assert.equal(g.run('equipCharacter'),'kyle');
 g.run('closeCharacterEquipment()');assert.equal(g.run('JSON.stringify({screen,sub,page,party,partySlot,rosterPage})'),g.run('before'));
});

for(const pointerType of ['mouse','touch'])test(`${pointerType}: dragging a party character back to the roster removes only that member and suppresses equipment click`,async()=>{
 const g=await game();g.run(`globalThis.dragHandlers={};window.addEventListener=(name,fn)=>dragHandlers[name]=fn;window.removeEventListener=(name,fn)=>{if(dragHandlers[name]===fn)delete dragHandlers[name]};
 globalThis.rosterTarget={dataset:{partyRoster:'true'},classList:{add(){},remove(){}}};document.elementFromPoint=()=>({closest:()=>rosterTarget});
 globalThis.dragEvent={pointerId:3,isPrimary:true,button:0,pointerType:'${pointerType}',clientX:0,clientY:0,preventDefault(){}};
 screen='adventurers';startPartyDrag(dragEvent,'kyle');dragHandlers.pointermove({...dragEvent,clientX:30});dragHandlers.pointerup({...dragEvent,clientX:30});openCharacterEquipment('kyle')`);
 assert.equal(g.run('partyNumber("kyle")'),0);assert.equal(g.run('partyNumber("gares")'),1);assert.equal(g.run('screen'),'adventurers');
 g.run("partySuppressClick=0;openCharacterEquipment('kyle')");assert.equal(g.run('screen'),'equipment');
});

test('clicking a roster character in another party or on an expedition opens read-only equipment',async()=>{
 const g=await game();g.run("parties=[['kyle'],['gares','mira'],[]];screen='adventurers';party=1;render();openCharacterEquipment('kyle')");
 assert.equal(g.run('equipCharacter'),'kyle');assert.equal(g.run('partyNumber("kyle")'),1);
 g.run("closeCharacterEquipment();party=0;screen='home';phase=4;depart();openCharacterEquipment('kyle')");assert(g.view.innerHTML.includes('遠征中は装備変更できません。'));
 g.run('changeEquipment(1)');assert.equal(g.run('gear("kyle").weapon??null'),null);
});

test('all 206 images are unique transparent PNGs and category dimensions match the specification',()=>{
 assert.equal(catalog.types.length,19);
 assert.equal(new Set(catalog.items.map(i=>i.image)).size,206);
 for(const item of catalog.items){
  const image=readFileSync(resolve(root,item.image));
  assert.equal(image.subarray(1,4).toString(),'PNG');
  assert.equal(image[25],6,'RGBA image required: '+item.name);
  const type=types[item.typeId];
  assert.equal(image.readUInt32BE(16)*type.height,image.readUInt32BE(20)*type.width,item.name);
 }
 assert.equal(catalog.items.filter(i=>i.typeId==='accessory').length,20);
 assert(!catalog.types.some(t=>t.id==='forge_material'));
 assert(!catalog.items.some(i=>i.element==='composite'));
});

test('old saves retain common items and gold while removing retired stock, equipment and records',async()=>{
 const g=await game();
 const previous=JSON.parse(g.run('JSON.stringify(snapshot())'));
 const retired=catalog.migration.removedItemIds[0],hero=previous.availableCharacterIds[0];
 delete previous.catalogVersion;
 previous.gold=4321;
 previous.stock.push({uid:901,itemId:retired,typeId:'arrow',x:7,y:7,rotation:0,durability:10,maxDurability:10});
 previous.equipment[hero]={offhand:{uid:902,itemId:retired,typeId:'arrow',durability:10,maxDurability:10}};
 previous.brokenTargets[hero]={offhand:retired};
 previous.encyclopedia.items[retired]={discovered:true,sold:2,expeditions:0,usedInstances:[]};
 const restored=await game(previous);
 assert.equal(restored.run('gold'),4321);
 assert.equal(restored.run('stock.length'),previous.stock.length-1);
 assert.equal(restored.run(`equipment['${hero}'].offhand`),null);
 assert.equal(restored.run(`encyclopedia.items['${retired}']`),undefined);
 assert.equal(restored.run('snapshot().catalogVersion'),2);
 assert.equal(restored.run(`validateSave(${JSON.stringify(previous)}).catalogMigrationRemoved`),2);
});

test('new catalog saves reject unknown IDs and future versions instead of silently discarding them',async()=>{
 const g=await game();const raw=JSON.parse(g.run('JSON.stringify(snapshot())'));
 raw.stock[0].itemId='not_an_item';
 assert.throws(()=>g.run(`validateSave(${JSON.stringify(raw)})`));
 raw.stock[0].itemId=catalog.items[0].id;raw.catalogVersion=999;
 assert.throws(()=>g.run(`validateSave(${JSON.stringify(raw)})`));
});
