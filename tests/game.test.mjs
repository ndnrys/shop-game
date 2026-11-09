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

async function game(saved=null,boardSize=8){
 const handlers={},timers=new Map();let timerId=0;
 const cells=Array.from({length:boardSize*boardSize},(_,index)=>({
  dataset:{x:String(index%boardSize),y:String(Math.floor(index/boardSize))},
  classList:{add(){},remove(){}},
  getBoundingClientRect(){return{left:index%boardSize*10,top:Math.floor(index/boardSize)*10,width:10,height:10};}
 }));
 const board={getBoundingClientRect:()=>({left:0,top:0,right:boardSize*10,bottom:boardSize*10}),querySelectorAll:()=>cells};
 const view={innerHTML:'',classList:{add(){},remove(){}},
  addEventListener:(name,fn)=>handlers[name]=fn,querySelector:()=>board,querySelectorAll:()=>cells,
  setPointerCapture(){},hasPointerCapture:()=>false};
 const elements={};
 const storage=new Map(saved?[["shop-game-save",JSON.stringify(saved)]]:[]);
 const context=vm.createContext({localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
  document:{querySelector:key=>key==='#view'?view:elements[key]??(elements[key]={innerHTML:'',textContent:'',classList:{toggle(){},remove(){}},setAttribute(){},showModal(){throw Error('Unexpected alert');}}),documentElement:{dataset:{}},body:{append(){}},createElement:()=>({style:{},classList:{toggle(){}},remove(){}}),addEventListener(){}},
  window:{addEventListener(){}},
  fetch:async path=>({ok:true,json:async()=>{const data=JSON.parse(read(path));if(path==='data/game-settings.json')data.warehouse={width:boardSize,height:boardSize};return data}}),
  setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;},clearTimeout:id=>timers.delete(id)
 });
 vm.runInContext('Math.random=()=>0.99',context);
 vm.runInContext(read('js/item-core.js'),context);
 vm.runInContext(read('js/encyclopedia-core.js'),context);
 vm.runInContext(read('js/encyclopedia-ui.js'),context);
 for(const path of ['js/balance.js','js/adventurer-core.js','js/equipment-core.js','js/equipment-ui.js','js/equipment-input.js','js/economy.js','js/rescue.js','js/trading-core.js','js/trading.js','js/save-game.js','js/main.js'])vm.runInContext(read(path),context);
 await vm.runInContext('loadItemSettings()',context);
 const run=code=>vm.runInContext(code,context);
 const event=(x,y,pointerType='mouse',incoming=false)=>({
  target:{closest:selector=>selector==='[data-drag-incoming]'?(incoming?{}:null):(incoming?null:cells[Math.floor(y/10)*boardSize+Math.floor(x/10)])},
  pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y,pointerType,preventDefault(){}
 });
 return{run,view,elements,handlers,timers,event,storage};
}

test('main entry references only existing scripts and CSS',()=>{
 const html=read('index.html');
 for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g))assert(existsSync(resolve(root,match[1].split('?')[0])),match[1]);
 assert(!html.includes('design-previews'));
});

test('210 unique pictured items in 19 categories with fixed magic elements',()=>{
 assert(rules.validate(catalog,settings));
 assert.equal(catalog.items.length,210);
 assert.equal(new Set(catalog.items.map(i=>i.id)).size,210);
 assert.equal(catalog.items.filter(i=>i.status==='planned').length,0);
 const counts={weapon:94,offhand:36,head:30,body:30,accessory:20};
 for(const [slot,count] of Object.entries(counts))assert.equal(catalog.items.filter(i=>types[i.typeId].slot===slot).length,count);
 for(const id of ['staff','rod','spellbook'])for(const element of ['fire','water','wind','earth'])assert.equal(catalog.items.filter(i=>i.typeId===id&&i.element===element).length,3);
});

test('rotation finds a free fourth row in the reported layout',()=>{
 const inventory=[['one_hand_sword',0,0],['shield',1,0],['body_heavy',3,0],['spear',6,0],['staff',5,4],['head_light',1,2]].map(([typeId,x,y],i)=>({uid:i+1,typeId,x,y,rotation:0}));
 const result=rules.findNearby(inventory[3],6,0,1,inventory,types,{width:8,height:8},true);
 assert.equal(result.x,1);assert.equal(result.y,3);assert.equal(result.rotation,1);
 assert(rules.canPlace(inventory[3],result.x,result.y,result.rotation,inventory,types,{width:8,height:8}));
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
 g.run('tradingConfig.customers.forEach(c=>{c.probability=1;c.categories={}});tradingChapter().visitors={min:1,max:1};tradingChapter().customers.villager.money={min:1000,max:1000};tradingChapter().customers.warrior.money={min:1000,max:1000}');
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
 g.run('changeEquipment(1);warehouseSize={width:1,height:1}');
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


test('equipment close restores the exact origin and inventory supports selecting items across all slots',async()=>{
 const g=await game();g.run("screen='home';phase=4;party=1;partySlot=2;rosterPage=1;page=2;sub=0;render();globalThis.before=JSON.stringify({screen,sub,page,party,partySlot,rosterPage});openCharacterEquipment('gares')");
 assert.equal(g.run('screen'),'equipment');assert(g.view.innerHTML.includes('ガレス · 装備'));
 assert(g.view.innerHTML.includes('HP <b>4</b>'));assert(g.view.innerHTML.includes('攻撃 <b>2</b>'));assert(g.view.innerHTML.includes('防御 <b>3</b>'));
 assert.equal((g.view.innerHTML.match(/class="equipment-slot /g)||[]).length,5);
 assert(g.view.innerHTML.includes('鉄の剣'));assert(g.view.innerHTML.includes('onclick="selectEquipmentItem(2)"'));assert(!g.view.innerHTML.includes('onclick="changeEquipment(1)"'));
 g.run('selectEquipmentItem(2)');assert.equal(g.run('gear("gares").offhand??null'),null);g.run("selectEquipmentSlot('offhand')");assert.equal(g.run('gear("gares").offhand.uid'),2);
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

test('all 210 images are unique transparent PNGs and category dimensions match the specification',()=>{
 assert.equal(catalog.types.length,19);
 assert.equal(new Set(catalog.items.map(i=>i.image)).size,210);
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

test('daily costs use evening chapter, shelves and status, charge tax on day five once',async()=>{
 const g=await game();assert.equal(g.run('economyState.bill'),null);
 g.run("day=5;phase=5;economyState.shelfCount=2;economyState.companions[availableCharacterIds[1]]={recoveryDay:8};economyState.companions[availableCharacterIds[2]]={dead:true};finishDay()");
 assert.equal(g.run('day'),6);assert.equal(g.run('economyState.bill.total'),120);
 assert.equal(g.run('gold'),1130);g.run("go('home');settleEconomyBill()");assert.equal(g.run('gold'),1130);
 const saved=JSON.parse(g.run('JSON.stringify(snapshot())')),loaded=await game(saved);assert.equal(loaded.run('gold'),1130);assert.equal(loaded.run('economyState.bill.status'),'paid');
});
test('departed companions incur no maintenance even when they return that morning',async()=>{
 const g=await game();g.run("phase=4;screen='home';depart();phase=5;finishDay()");
 assert.equal(g.run('economyState.bill.companions'),0);assert.equal(g.run('gold'),1245);assert.equal(g.run('expeditions.length'),0);
});
test('healing costs level times 200, excludes dead, and natural recovery is free',async()=>{
 const g=await game();g.run("economyState.companions[availableCharacterIds[0]]={level:3,recoveryDay:5};healCompanion(availableCharacterIds[0])");
 assert.equal(g.run('gold'),650);assert.equal(g.run('companionStatus(availableCharacterIds[0])'),'waiting');
 g.run("healCompanion(availableCharacterIds[0]);economyState.companions[availableCharacterIds[0]]={level:3,recoveryDay:5,dead:true};healCompanion(availableCharacterIds[0])");assert.equal(g.run('gold'),650);
 g.run("economyState.companions[availableCharacterIds[1]]={recoveryDay:3};phase=5;finishDay()");assert.equal(g.run('gold'),635);assert.equal(g.run('companionStatus(availableCharacterIds[1])'),'waiting');
});
test('carpenter expands real capacity, persists shelves, migrates old saves without backcharging',async()=>{
 const g=await game();g.run('expandShelf()');assert.equal(g.run('gold'),950);assert.equal(g.run('shelfCapacity()'),16);
 const s=JSON.parse(g.run('JSON.stringify(snapshot())'));const loaded=await game(s);assert.equal(loaded.run('economyState.shelfCount'),2);
 delete s.economyState;const old=await game(s);assert.equal(old.run('gold'),950);assert.equal(old.run('economyState.shelfCount'),1);assert.equal(old.run('economyState.bill'),null);
});
test('unaffordable bill triggers rescue once and persists paid costs',async()=>{
 const g=await game();g.run('gold=1;phase=5;finishDay()');assert.equal(g.run('gold'),981);assert.equal(g.run('rescueState.count'),1);assert.equal(g.run('clearFunds()'),4700);
 const loaded=await game(JSON.parse(g.run('JSON.stringify(snapshot())')));loaded.run('render();retryEconomyBill()');assert.equal(loaded.run('gold'),981);assert.equal(loaded.run('rescueState.totalLoans'),1000);
 g.run('gold=0;phase=5;finishDay();gold=0;phase=5;finishDay();gold=0;phase=5;finishDay()');assert.equal(g.run('clearFunds()'),7000);assert.equal(g.run('rescueState.count'),4);
});
test('donation requires completion, prevents concurrent claims and persists UTC quota',async()=>{
 const g=await game();await g.run('watchDonation()');assert.equal(g.run('pending.length'),0);
 g.run('registerDonationAdapter({showRewardedAd:async()=>({completed:false})})');await g.run('watchDonation()');assert.equal(g.run('donationState.used'),0);
 g.run('registerDonationAdapter({showRewardedAd:async()=>({completed:true})})');await g.run('Promise.all([watchDonation(),watchDonation()])');assert.equal(g.run('pending.length'),3);assert.equal(g.run('donationState.used'),1);
 const loaded=await game(JSON.parse(g.run('JSON.stringify(snapshot())')));assert.equal(loaded.run('donationRemaining()'),2);assert.equal(loaded.run('pending.length'),3);
 g.run('pending=[]');await g.run('watchDonation()');g.run('pending=[]');await g.run('watchDonation()');g.run('pending=[]');await g.run('watchDonation()');assert.equal(g.run('donationState.used'),3);assert.equal(g.run('pending.length'),0);
 assert.equal(g.run("donationDate(Date.parse('2026-11-04T23:59:59Z'))"),'2026-11-04');assert.equal(g.run("donationDate(Date.parse('2026-11-05T00:00:00Z'))"),'2026-11-05');assert.equal(g.run("donationRemaining(Date.parse(donationState.date+'T00:00:00Z')+86400000)"),3);
});
test('unset prices and malformed economy saves are rejected without corrupting current progress',async()=>{
 const g=await game();assert.throws(()=>g.run('validateEconomyConfig({chapters:{},healing:{costPerLevel:null}})'));
 for(const change of ["bad.economyState.shelfCount=0","bad.economyState.companions.unknown={level:1}","bad.economyState.companions[availableCharacterIds[0]]={level:0}"]){g.run('globalThis.bad=JSON.parse(JSON.stringify(snapshot()))');g.run(change);assert.throws(()=>g.run('applySave(bad)'))}
 assert.equal(g.run('gold'),1250);
});

test('30-day cashflow simulation covers trading, no sales and expansion without income',async()=>{
 for(const [policy,expectedDays,expectedGold,unpaid] of [['trade',30,2450,false],['idle',30,50,false],['expand-idle',30,600,false]]){
  const g=await game();g.run('tradingConfig.customers.forEach(c=>{c.probability=1;c.categories={}});tradingChapter().visitors={min:1,max:1};Object.values(tradingChapter().customers).forEach(c=>c.money={min:1000,max:1000})');if(policy==='expand-idle')g.run('expandShelf()');let days=0;
  for(;days<30;){g.run(`phase=1;if(${policy==='trade'}&&stock.length===0&&gold>=prices[0]){counts=[1,0,0];buy();while(pending.length)receive()}if(${policy==='trade'}&&stock.length){selected=0;replenish()}phase=5;finishDay()`);days++;if(g.run('!!bankruptcyExpense()'))break}
  assert.equal(days,expectedDays,policy);assert.equal(g.run('gold'),expectedGold,policy);assert.equal(g.run('!!bankruptcyExpense()'),unpaid,policy);
 }
});

test('healing and expansion reject insufficient funds without changing state',async()=>{
 const g=await game();g.run("document.querySelector('#modal').showModal=()=>{};gold=199;economyState.companions[availableCharacterIds[0]]={level:1,recoveryDay:5};healCompanion(availableCharacterIds[0]);expandShelf()");
 assert.equal(g.run('gold'),199);assert.equal(g.run('economyState.shelfCount'),1);assert.equal(g.run('companionStatus(availableCharacterIds[0])'),'recovering');
});
test('chapter transition and next-morning edits do not recalculate the previous bill',async()=>{
 const g=await game();g.run('day=5;chapter=1;phase=5;finishDay();chapter=2;expandShelf();render()');
 assert.equal(g.run('economyState.bill.chapterId'),'chapter_1');assert.equal(g.run('economyState.bill.total'),240);assert.equal(g.run('gold'),110);
});

test('sets reserve exact units per shelf and surplus gets only identical bonus',async()=>{
 const g=await game();g.run(`shelf=[];for(let n=0;n<4;n++)shelf.push({...newItem('one_hand_sword_01'),shelfId:0});for(let n=0;n<3;n++)shelf.push({...newItem('shield_01'),shelfId:0})`);
 assert.equal(g.run("shelfCandidates().filter(c=>c.effect==='set').length"),3);
 assert.equal(g.run("shelfCandidates().filter(c=>c.effect==='identical').length"),1);
 assert.equal(g.run('new Set(shelfCandidates().flatMap(c=>c.items.map(i=>i.uid))).size'),7);
 g.run("shelf[6].shelfId=1");assert.equal(g.run("shelfCandidates().filter(c=>c.effect==='set').length"),2);
 g.run("shelf=[{...newItem('one_hand_sword_01'),shelfId:0},{...newItem('shield_01'),shelfId:1}];encyclopedia.sets={};discoverShelfSets()");
 assert.equal(g.run('Object.keys(encyclopedia.sets).length'),0);
});
test('purchase is atomic, affordable, and each visitor buys at most one candidate',async()=>{
 const g=await game();g.run("shelf=[newItem('one_hand_sword_01'),newItem('shield_01')];tradingChapter().visitors={min:1,max:1};tradingChapter().customers.villager.money={min:399,max:399};resolveTradingDay(()=>0)");
 assert.equal(g.run('shelf.length'),2);assert.equal(g.run('lastSales'),0);
 g.run('tradingChapter().customers.villager.money={min:400,max:400};resolveTradingDay(()=>0)');
 assert.equal(g.run('shelf.length'),0);assert.equal(g.run('lastSales'),400);assert.equal(g.run('tradingState.report.visits[0].uids.length'),2);
 assert.equal(g.run('encyclopedia.items.shield_01.sold'),1);
});
test('failed purchases preserve inventory, rumor duration and save are stable',async()=>{
 const g=await game();g.run("replenish();tradingConfig.customers.forEach(c=>{c.probability=0;c.categories={}});tradingChapter().visitors={min:1,max:1};activateRumor('forest_monsters');phase=5;finishDay()");
 assert.equal(g.run('shelf.length'),1);assert.equal(g.run('lastSales'),0);
 assert.equal(g.run('tradingState.rumors[0].endDay'),5);
 assert.equal(g.run("TradingCore.weights(tradingConfig,tradingChapter(),tradingState.rumors,day)[1].weight"),2);
 const save=g.run('JSON.stringify(snapshot())');g.run(`applySave(${save})`);assert.equal(g.run('JSON.stringify(snapshot())'),save);
 g.run('phase=5;finishDay();phase=5;finishDay()');assert.equal(g.run('tradingState.rumors.length'),0);
});
test('legacy shelves migrate without combining shelves and invalid trading saves reject atomically',async()=>{
 const g=await game();g.run("replenish();globalThis.legacy=JSON.parse(JSON.stringify(snapshot()));delete legacy.tradingState;delete legacy.shelf[0].shelfId;applySave(legacy)");
 assert.equal(g.run('shelf[0].shelfId'),0);
 for(const mutation of ['bad.shelf[0].shelfId=10','bad.tradingState.rumors=[{id:"unknown",startDay:2,endDay:5}]','bad.tradingState.report={day:2,revenue:0,visits:[]}']){
  g.run('globalThis.bad=JSON.parse(JSON.stringify(snapshot()))');g.run(mutation);assert.throws(()=>g.run('applySave(bad)'));assert.equal(g.run('shelf[0].shelfId'),0);
 }
});
test('same slot bonus, probability clamps and set competition follow data',async()=>{
 const g=await game();g.run("shelf=[newItem('one_hand_sword_01'),newItem('one_hand_sword_03')]");assert.equal(g.run('shelfCandidates()[0].bonus'),.1);
 g.run("tradingConfig.customers[0].probability=1;tradingConfig.customers[0].categories={}");assert.equal(g.run('TradingCore.probability(shelfCandidates()[0],tradingConfig.customers[0],definitions,tradingConfig)'),1);
 g.run("shelf.push(newItem('shield_01'));encyclopediaDefinitions.sets.push({id:'competing',itemIds:['shield_01','one_hand_sword_03']})");assert.equal(g.run("shelfCandidates().find(c=>c.effect==='set').setId"),'wood_sword_shield');
});

test('balance registry rejects invalid overrides and preserves defaults',()=>{
 const context=vm.createContext({URLSearchParams});vm.runInContext(read('js/balance.js'),context);
 const registry=vm.runInContext('Balance',context).create({game:settings,economy:JSON.parse(read('data/economy.json')),trading:JSON.parse(read('data/trading.json'))});
 assert.equal(registry.validate({version:1,overrides:{}}).game.development.initialGold,1250);
 for(const overrides of [{'unknown':1},{'game.development.initialGold':-1},{'runtime.itemsPerPurchase':1.5},{'trading.chapters.prologue.visitors.min':10},{'game.development.salePrice':0},{'runtime.minimumPriceRatio':2}])assert.throws(()=>registry.validate({version:1,overrides}));
 assert.equal(registry.validate({version:1,overrides:{'runtime.expeditionWear':3}}).runtime.expeditionWear,3);
 const balance=vm.runInContext('Balance',context);assert.equal(balance.enabled({hostname:'example.com',search:'?dev=balance'}),false);assert.equal(balance.enabled({hostname:'localhost',search:''}),false);assert.equal(balance.enabled({hostname:'localhost',search:'?dev=balance'}),true);
});

test('dungeon progress uses all members, equipment attributes and persists once on return',async()=>{
 const g=await game();
 g.run("phase=4;screen='home';depart()");
 assert.equal(g.run('expeditions[0].power.attack'),7);
 assert.equal(g.run('expeditions[0].power.bonus'),0);
 const restored=await game(JSON.parse(g.run('JSON.stringify(snapshot())')));
 restored.run('phase=5;finishDay()');
 assert.equal(restored.run('dungeonProgress.forest'),7);
 restored.run('resolveExpeditions()');
 assert.equal(restored.run('dungeonProgress.forest'),7);
 restored.run("dungeonProgress.forest=59;phase=4;screen='home';depart();phase=5;finishDay()");
 assert.equal(restored.run('dungeonProgress.forest'),60);
 assert.equal(restored.run("dungeonAvailable(config.dungeons[1])"),true);
 assert.match(restored.run("returnReport.join(' ')"),/クリア/);
 restored.run("definitions.one_hand_sword_03.attributes={fire:3};gear('kyle').weapon=newItem('one_hand_sword_03')");
 assert.equal(restored.run("expeditionPower(['kyle','gares','mira'],config.dungeons[0]).bonus"),3);
 assert.equal(restored.run("expeditionPower(['kyle','gares','mira'],config.dungeons[1]).bonus"),0);
});

test('locked destination cannot consume funding; legacy trips remain durability-only',async()=>{
 const g=await game();
 g.run("phase=4;screen='home';selectedDungeon='camp';funds[0]=100;depart()");
 assert.equal(g.run('expeditions.length'),0);assert.equal(g.run('funds[0]'),100);
 const old=JSON.parse(g.run('JSON.stringify(snapshot())'));delete old.dungeonProgress;
 old.expeditions=[{party:0,members:['kyle'],returnDay:old.day+1}];
 const restored=await game(old);restored.run('phase=5;finishDay()');
 assert.equal(restored.run('Object.keys(dungeonProgress).length'),0);
 assert.throws(()=>g.run("validateSave({...snapshot(),dungeonProgress:{forest:-1}})"));
 assert.throws(()=>g.run("validateSave({...snapshot(),expeditions:[{party:0,members:['kyle'],returnDay:day+1,dungeonId:'forest',power:{attack:-1,bonus:0}}]})"));
});

test('village dungeon thresholds take 29 expeditions without level-ups or equipment bonuses',async()=>{
 const g=await game();let trips=0;
 g.run('Math.random=()=>0.99;config.adventurers.growth.experience.baseRequired=100000');
 for(const d of settings.dungeons){
  while(!g.run(`dungeonCleared('${d.id}')`)){
   g.run(`phase=4;screen='home';selectedDungeon='${d.id}';depart();day++;resolveExpeditions()`);
   if(++trips>40)throw Error('Village progress stalled');
  }
 }
 assert.equal(trips,29);
});

test('expedition risks improve with defense and HP; tutorial limits death; outcome boundaries are exact',async()=>{
 const g=await game(),risk=stats=>JSON.parse(g.run(`JSON.stringify(AdventurerCore.risks(${JSON.stringify(stats)},5,config.adventurers.risk,false))`));
 const base=risk({hp:3,defense:2}),defended=risk({hp:3,defense:10}),healthy=risk({hp:20,defense:2});
 assert(defended.injury<base.injury);assert(defended.death<base.death);
 assert(healthy.severe<base.severe);assert(healthy.death<base.death);assert(healthy.severeDays<base.severeDays);
 assert(g.run('AdventurerCore.risks({hp:3,defense:2},5,config.adventurers.risk,true).death')<=settings.adventurers.risk.tutorialDeathCap);
 const status=n=>g.run(`AdventurerCore.outcome(${JSON.stringify(base)},()=>${n}).status`);
 assert.equal(status(0),'dead');assert.equal(status(base.death),'severe');assert.equal(status(base.death+base.severe),'injured');assert.equal(status(base.death+base.injury),'healthy');
 assert.equal(g.run('AdventurerCore.risks({hp:3,defense:2},0,config.adventurers.risk,true).injury'),0);
});

test('individual injury and death persist from departure, return once and connect to treatment',async()=>{
 const g=await game();
 g.run(`phase=4;screen='home';let rolls=[0,0.001,0.01];Math.random=()=>rolls.shift()??0.99;depart()`);
 assert.equal(g.run('expeditions[0].health.kyle.status'),'dead');
 assert.equal(g.run('expeditions[0].health.gares.status'),'severe');
 assert.equal(g.run('expeditions[0].health.mira.status'),'injured');
 const saved=JSON.parse(g.run('JSON.stringify(snapshot())')),restored=await game(saved);
 assert.equal(restored.run('JSON.stringify(expeditions[0].health)'),JSON.stringify(saved.expeditions[0].health));
 restored.run('phase=5;finishDay()');
 assert.equal(restored.run("companionStatus('kyle')"),'dead');assert.equal(restored.run("companionStatus('gares')"),'recovering');
 const recovery=restored.run('economyState.companions.gares.recoveryDay');
 assert.match(restored.run("returnReport.join(' ')"),/死亡.*重傷.*負傷/);
 restored.run('resolveExpeditions()');assert.equal(restored.run('economyState.companions.gares.recoveryDay'),recovery);
 const before=restored.run('gold');restored.run("healCompanion('gares')");assert.equal(restored.run('gold'),before-200);assert.equal(restored.run("companionStatus('gares')"),'waiting');
 restored.run('day=10;recoverCompanions()');assert.equal(restored.run("companionStatus('mira')"),'waiting');assert.equal(restored.run("companionStatus('kyle')"),'dead');
 restored.run("parties[0]=['kyle','gares','mira'];phase=4;depart()");assert.equal(restored.run("expeditions[0].members.includes('kyle')"),false);
});

test('job restrictions apply to manual and automatic equipment; legacy equipment remains removable',async()=>{
 const g=await game();g.run("equipCharacter='kyle';equipmentSlot='weapon';changeEquipment(5)");
 assert.equal(g.run("gear('kyle').weapon??null"),null);assert(g.run('stock.some(i=>i.uid===5)'));
 g.run("equipCharacter='mira';changeEquipment(5)");assert.equal(g.run("gear('mira').weapon.uid"),5);
 g.run("equipCharacter='kyle';autoEquip={kyle:{body:true}};brokenTargets={kyle:{body:'body_heavy_02'}};prepareEquipment(['kyle'])");
 assert.equal(g.run("gear('kyle').body??null"),null);
 // Preserve existing unsupported equipment through save migration; allow its return to inventory.
 g.run("stock=stock.filter(i=>i.uid!==3);gear('kyle').body={...newItem('body_heavy_02'),x:null,y:null};equipmentSlot='body'");
 const old=JSON.parse(g.run('JSON.stringify(snapshot())')),restored=await game(old);
 assert(restored.run("gear('kyle').body"));restored.run("equipCharacter='kyle';equipmentSlot='body';changeEquipment()");assert.equal(restored.run("gear('kyle').body"),null);
});

test('invalid health saves and risk settings are rejected atomically',async()=>{
 const g=await game();g.run("phase=4;screen='home';depart();globalThis.valid=JSON.stringify(snapshot())");
 for(const mutation of ["s.expeditions[0].health.kyle.status='unknown'","s.expeditions[0].health.kyle.recoveryDays=1","delete s.expeditions[0].health.mira","s.expeditions[0].health=[]"]){
  g.run('globalThis.s=JSON.parse(valid)');g.run(mutation);assert.throws(()=>g.run('applySave(s)'));assert.equal(g.run('JSON.stringify(snapshot())'),g.run('valid'));
 }
 g.run('config.adventurers.risk.injuryRate=2');assert.throws(()=>g.run('validateAdventurerConfig()'));
});

test('each growth policy distributes exactly three points and policy changes preserve previous gains',async()=>{
 for(const [policy,expected] of Object.entries(settings.adventurers.growth.policies)){
  const g=await game();g.run(`equipCharacter='kyle';setGrowthPolicy('${policy}');grantExpeditionExperience(['kyle'],45)`);
  assert.equal(g.run("companionLevel('kyle')"),2);
  for(const stat of ['attack','defense','hp'])assert.equal(g.run(`economyState.companions.kyle.growth.${stat}`),expected[stat]);
 }
 const g=await game();g.run("equipCharacter='kyle';grantExpeditionExperience(['kyle'],45);globalThis.before=JSON.stringify(companionStats('kyle'));setGrowthPolicy('attack')");
 assert.equal(g.run("JSON.stringify(companionStats('kyle'))"),g.run('before'));
 g.run("grantExpeditionExperience(['kyle'],90)");
 assert.equal(g.run("companionLevel('kyle')"),3);
 assert.equal(g.run('JSON.stringify(economyState.companions.kyle.growth)'),JSON.stringify({attack:3,defense:1,hp:2}));
 assert.equal(g.run('growthPolicy("gares")'),'balanced');
});

test('expedition XP divides actual progress among participants and floors the share',async()=>{
 for(const [members,power,expected] of [[['kyle','gares','mira'],120,40],[['kyle','gares','mira'],7,2],[['kyle','gares'],7,3],[['kyle'],7,7]]){
  const g=await game();g.run(`config.dungeons[0].requiredProgress=1000;parties[0]=${JSON.stringify(members)};phase=4;screen='home';depart();expeditions[0].power.attack=${power};day++;resolveExpeditions()`);
  for(const id of members)assert.equal(g.run(`economyState.companions.${id}.experience`),expected);
  if(!members.includes('mira'))assert.equal(g.run('economyState.companions.mira?.experience??0'),0);
  const saved=g.run('JSON.stringify(economyState.companions)');g.run('resolveExpeditions()');assert.equal(g.run('JSON.stringify(economyState.companions)'),saved);
 }
 const g=await game();g.run("dungeonProgress.forest=59;phase=4;screen='home';depart();day++;resolveExpeditions()");
 assert.equal(g.run('dungeonProgress.forest'),60);
 for(const id of ['kyle','gares','mira'])assert.equal(g.run(`economyState.companions.${id}.experience`),0);
 g.run("phase=4;depart();day++;resolveExpeditions()");
 assert.equal(g.run('economyState.companions.kyle.experience'),0);
});

test('level-ups carry leftover XP, handle multiple levels, update combat stats and current-level treatment',async()=>{
 const g=await game();g.run("equipCharacter='kyle';setGrowthPolicy('attack');grantExpeditionExperience(['kyle'],280)");
 assert.equal(g.run("companionLevel('kyle')"),4);assert.equal(g.run('economyState.companions.kyle.experience'),10);
 assert.equal(g.run('JSON.stringify(economyState.companions.kyle.growth)'),JSON.stringify({attack:6,defense:0,hp:3}));
 assert.equal(g.run("expeditionPower(['kyle','gares','mira'],config.dungeons[0]).attack"),13);
 assert.equal(g.run("companionStats('kyle').hp"),6);assert.equal(g.run("characters.find(c=>c.id==='kyle').initialStats.hp"),3);
 g.run("openCharacterEquipment('kyle');selectCharacterPanel('growth')");assert(g.view.innerHTML.includes('Lv.4'));assert(g.view.innerHTML.includes('10 / 180'));
 g.run("gold=2000;economyState.companions.kyle.recoveryDay=day+2;healCompanion('kyle')");assert.equal(g.run('gold'),1200);
 g.run("document.querySelector('#modal').showModal=()=>{};characterInfo('kyle')");assert.match(g.elements['#modalBody'].textContent,/Lv.4 \/ HP 6 \/ 攻撃 10 \/ 防御 2/);
});

test('growth policies, XP and gains round-trip; legacy levels do not retroactively add growth',async()=>{
 const g=await game();g.run("equipCharacter='mira';setGrowthPolicy('defense');grantExpeditionExperience(['mira'],50);render()");
 const saved=JSON.parse(g.storage.get('shop-game-save')),restored=await game(saved);
 assert.equal(restored.run("growthPolicy('mira')"),'defense');assert.equal(restored.run('economyState.companions.mira.experience'),5);
 assert.equal(restored.run("companionStats('mira').defense"),5);
 restored.run('globalThis.s=JSON.parse(JSON.stringify(snapshot()));s.economyState.companions.kyle={level:3};applySave(s)');
 assert.equal(restored.run("companionStats('kyle').attack"),4);assert.equal(restored.run("growthPolicy('kyle')"),'balanced');
 restored.run("grantExpeditionExperience(['kyle'],135)");assert.equal(restored.run("companionLevel('kyle')"),4);assert.equal(restored.run("companionStats('kyle').attack"),5);
 const legacy=await game();legacy.run("phase=4;screen='home';depart();delete expeditions[0].dungeonId;delete expeditions[0].power;delete expeditions[0].health;day++;resolveExpeditions()");
 assert.equal(legacy.run('Object.keys(economyState.companions).length'),0);
});

test('policy at level-up applies during an expedition, while departure power and risk stay fixed',async()=>{
 const g=await game();g.run("economyState.companions.kyle={experience:44};phase=4;screen='home';depart();globalThis.trip=JSON.stringify(expeditions[0]);openCharacterEquipment('kyle');selectCharacterPanel('growth');setGrowthPolicy('hp')");
 assert.equal(g.run('JSON.stringify(expeditions[0])'),g.run('trip'));
 g.run('day++;resolveExpeditions()');assert.equal(g.run('JSON.stringify(economyState.companions.kyle.growth)'),JSON.stringify({attack:0,defense:1,hp:2}));
 assert.equal(g.run('economyState.companions.kyle.experience'),1);
});

test('invalid growth imports and allocations reject atomically',async()=>{
 const g=await game();g.run("globalThis.original=JSON.stringify(snapshot())");
 for(const value of [{growthPolicy:'bad'},{experience:-1},{experience:1.5},{growth:{attack:0,defense:0,hp:1}},{growth:{attack:1,defense:1,hp:1}},{growth:[]}]){
  g.run(`globalThis.bad=JSON.parse(original);bad.economyState.companions.kyle=${JSON.stringify(value)}`);assert.throws(()=>g.run('applySave(bad)'));assert.equal(g.run('JSON.stringify(snapshot())'),g.run('original'));
 }
 g.run("equipCharacter='kyle';setGrowthPolicy('invalid')");assert.equal(g.run('growthPolicy("kyle")'),'balanced');
 g.run('config.adventurers.growth.policies.balanced.attack=2');assert.throws(()=>g.run('validateAdventurerConfig()'));
});

test('tap selection commits only on matching slot, preserves identity and durability and clears on character changes',async()=>{
 const g=await game();g.run("openCharacterEquipment('kyle');stock[0].durability=3;globalThis.before=JSON.stringify(snapshot());selectEquipmentItem(1)");
 assert.equal(g.run('JSON.stringify(snapshot())'),g.run('before'));assert.equal(g.run('equipmentSelectedUid'),1);
 g.run("selectEquipmentSlot('offhand')");assert.equal(g.run('JSON.stringify(snapshot())'),g.run('before'));
 g.run("selectEquipmentSlot('weapon')");assert.equal(g.run("gear('kyle').weapon.uid"),1);assert.equal(g.run("gear('kyle').weapon.durability"),3);assert.equal(g.run('equipmentSelectedUid'),null);
 g.run('selectEquipmentItem(2);selectEquipmentItem(2)');assert.equal(g.run('equipmentSelectedUid'),null);
 g.run('selectEquipmentItem(2);moveEquipmentCharacter(1)');assert.equal(g.run('equipmentSelectedUid'),null);
 g.run('selectEquipmentItem(2);selectCharacterPanel("growth")');assert.equal(g.run('equipmentSelectedUid'),null);
 g.run('go("warehouse")');assert.equal(g.run('equipmentSelectedUid'),null);
});

async function gearInputGame(){
 const g=await game();g.run(`openCharacterEquipment('kyle');availableCharacterIds.forEach(gear);globalThis.gearHandlers={};globalThis.dropKind='slot';globalThis.dropSlot='weapon';window.addEventListener=(name,fn)=>gearHandlers[name]=fn;window.removeEventListener=(name,fn)=>{if(gearHandlers[name]===fn)delete gearHandlers[name]};document.elementFromPoint=()=>({closest:selector=>selector===(dropKind==='slot'?'[data-equipment-slot]':'[data-equipment-warehouse]')?{dataset:{equipmentSlot:dropSlot},classList:{add(){},remove(){}}}:null});globalThis.gearPointer={pointerId:11,pointerType:'touch',button:0,isPrimary:true,clientX:20,clientY:20,preventDefault(){}}`);
 const hold=()=>{const timer=[...g.timers.values()].find(t=>t.delay===100);assert(timer);timer.fn()};
 return {...g,hold};
}
for(const pointerType of ['touch','mouse'])test(`${pointerType}: equipment hold drag commits only on valid release and supports warehouse return`,async()=>{
 const g=await gearInputGame();g.run(`gearPointer.pointerType='${pointerType}';globalThis.before=JSON.stringify(snapshot());startEquipmentDrag(gearPointer,1)`);g.hold();
 assert.equal(g.run('JSON.stringify(snapshot())'),g.run('before'));
 g.run('gearHandlers.pointermove(gearPointer)');assert.equal(g.run('JSON.stringify(snapshot())'),g.run('before'));
 g.run('gearHandlers.pointerup(gearPointer)');assert.equal(g.run("gear('kyle').weapon.uid"),1);assert.equal(g.run('equipmentDrag'),null);
 g.run("dropKind='warehouse';startEquipmentDrag(gearPointer,null,'weapon')");g.hold();g.run('gearHandlers.pointerup(gearPointer)');
 assert.equal(g.run("gear('kyle').weapon"),null);assert(g.run('stock.some(i=>i.uid===1&&i.durability===10)'));
});

test('equipment drag cancellation, wrong targets and stale screens preserve saved state and clean listeners',async()=>{
 for(const cancel of ["gearHandlers.pointercancel(gearPointer)","gearHandlers.blur()","gearHandlers.keydown({key:'Escape'})","dropSlot='body';gearHandlers.pointerup(gearPointer)","dropKind='outside';gearHandlers.pointerup(gearPointer)","moveEquipmentCharacter(1)","selectCharacterPanel('growth')"]){
  const g=await gearInputGame();g.run('globalThis.before=JSON.stringify(snapshot());startEquipmentDrag(gearPointer,1)');g.hold();g.run(cancel);
  assert.equal(g.run('JSON.stringify(snapshot())'),g.run('before'));assert.equal(g.run('equipmentDrag'),null);assert.equal(g.run('Object.keys(gearHandlers).length'),0);
 }
 const g=await gearInputGame();g.run('startEquipmentDrag(gearPointer,1);gearHandlers.pointerup(gearPointer)');assert.equal(g.run('equipmentDrag'),null);assert.equal(g.timers.size,0);
});

test('equipment input respects job and expedition locks, and full-warehouse exchanges remain atomic without alerts',async()=>{
 const g=await gearInputGame();g.run("selectEquipmentItem(5)");assert.equal(g.run('equipmentSelectedUid'),null);
 g.run("changeEquipment(1);globalThis.spare=newItem('one_hand_sword_03');stock.push(spare);warehouseSize={width:1,height:1};globalThis.before=JSON.stringify(snapshot());selectEquipmentItem(spare.uid);selectEquipmentSlot('weapon')");assert.equal(g.run('JSON.stringify(snapshot())'),g.run('before'));
 g.run('startEquipmentDrag(gearPointer,spare.uid)');g.hold();g.run('gearHandlers.pointerup(gearPointer)');assert.equal(g.run('JSON.stringify(snapshot())'),g.run('before'));
 g.run("warehouseSize={width:8,height:8};phase=4;screen='home';depart();openCharacterEquipment('kyle');equipmentSelectedUid=null;selectEquipmentItem(2);startEquipmentDrag(gearPointer,2)");assert.equal(g.run('equipmentSelectedUid'),null);assert.equal(g.run('equipmentDrag'),null);
});

test('new 5x5 game excludes oversized initial items without creating incoming stock or discoveries',async()=>{
 const g=await game(null,5);
 assert.equal(settings.warehouse.width,5);assert.equal(g.run('warehouseSize.width'),5);
 assert.equal(g.run('stock.length'),5);assert.equal(g.run('pending.length'),0);
 assert.equal(g.run("encyclopedia.items.spear_01"),undefined);
 assert(g.run('stock.every(i=>ItemCore.canPlace(i,i.x,i.y,i.rotation,stock,types,warehouseSize))'));
 const restored=await game(JSON.parse(g.run('JSON.stringify(snapshot())')),5);
 assert.equal(restored.run('warehouseSize.width'),5);assert.equal(restored.run('pending.length'),0);
});

test('carpenter expands in order, charges once, preserves positions, and stops at 8x8',async()=>{
 const g=await game(null,5);g.run('gold=2000;globalThis.before=JSON.stringify(stock)');
 for(const size of [6,7,8]){g.run('expandWarehouse()');assert.equal(g.run('warehouseSize.width'),size);assert.equal(g.run('JSON.stringify(stock)'),g.run('before'));const restored=await game(JSON.parse(g.run('JSON.stringify(snapshot())')),5);assert.equal(restored.run('warehouseSize.width'),size)}
 assert.equal(g.run('gold'),200);g.run('expandWarehouse()');assert.equal(g.run('gold'),200);assert.equal(g.run('warehouseSize.width'),8);
 g.run('reset();gold=299;globalThis.before=JSON.stringify(snapshot());expandWarehouse()');assert.equal(g.run('JSON.stringify(snapshot())'),g.run('before'));
});

test('legacy warehouses stay 8x8 without moving or losing stock and invalid sizes reject atomically',async()=>{
 const old=await game();const saved=JSON.parse(old.run('JSON.stringify(snapshot())'));delete saved.warehouseSize;
 const g=await game(saved,5);assert.equal(g.run('warehouseSize.width'),8);assert.equal(g.run('gold'),saved.gold);assert.equal(g.run('JSON.stringify(stock)'),JSON.stringify(saved.stock));
 g.run('globalThis.before=JSON.stringify(snapshot())');
 for(const size of [{width:4,height:4},{width:6,height:5},{width:9,height:9},null]){
  g.run(`globalThis.bad=JSON.parse(before);bad.warehouseSize=${JSON.stringify(size)}`);
  assert.throws(()=>g.run('applySave(bad)'));assert.equal(g.run('JSON.stringify(snapshot())'),g.run('before'));
 }
 g.run('bad=JSON.parse(before);bad.warehouseSize={width:5,height:5};bad.stock[0].x=5');assert.throws(()=>g.run('applySave(bad)'));
});

test('warehouse capacity and dimensions constrain incoming goods until expansion; pending blocks progression',async()=>{
 const g=await game(null,5);g.run("gold=2000;pending=[newItem('spear_01')];globalThis.spear=pending[0];receive()");assert.equal(g.run('pending[0].uid'),g.run('spear.uid'));
 g.run('expandWarehouse();receive()');assert.equal(g.run('pending[0].uid'),g.run('spear.uid'));
 g.run('expandWarehouse();receive()');assert.equal(g.run('pending.length'),0);assert(g.run('stock.some(i=>i.uid===4)'));
 g.run("reset();stock=[];pending=[];for(let n=0;n<25;n++)storeItem(newItem('accessory_01'));pending=[newItem('accessory_01')];globalThis.before=JSON.stringify(stock);receive()");
 assert.equal(g.run('stock.length'),25);assert.equal(g.run('pending.length'),1);assert.equal(g.run('JSON.stringify(stock)'),g.run('before'));
 g.run('phase=2;advance()');assert.equal(g.run('phase'),2);
 g.run('gold=300;expandWarehouse();receive()');assert.equal(g.run('pending.length'),0);assert.equal(g.run('stock.length'),26);
});

for(const pointerType of ['mouse','touch'])test(`${pointerType}: 5x5 drag stays in bounds and cancellation preserves the original placement`,async()=>{
 const g=await game(null,5);g.run('stock=[stock[0]];pending=[];stock[0].x=0;stock[0].y=0;stock[0].rotation=0;selected=0');
 g.handlers.pointerdown(g.event(5,5,pointerType));for(const t of [...g.timers.values()])t.fn();g.handlers.pointermove(g.event(45,45,pointerType));g.handlers.pointerup(g.event(45,45,pointerType));
 assert.equal(g.run('stock[0].x'),4);assert.equal(g.run('stock[0].y'),2);assert(g.run('ItemCore.canPlace(stock[0],4,2,0,stock,types,warehouseSize)'));
 const before=g.run('JSON.stringify(stock)');g.handlers.pointerdown(g.event(45,25,pointerType));for(const t of [...g.timers.values()])t.fn();g.handlers.pointermove(g.event(150,150,pointerType));g.handlers.pointercancel();assert.equal(g.run('JSON.stringify(stock)'),before);
 g.run('rotateSelected()');assert.equal(g.run('stock[0].rotation'),1);assert(g.run('ItemCore.canPlace(stock[0],stock[0].x,stock[0].y,1,stock,types,warehouseSize)'));
});

test('warehouse draw filter checks both rotations independently of occupied cells and unlocks large items after expansion',async()=>{
 assert(rules.fitsBoard({typeId:'spear'},types,{width:7,height:5}));
 assert(!rules.fitsBoard({typeId:'spear'},types,{width:6,height:6}));
 const g=await game(null,5);
 assert.equal(g.run("fitsWarehouse(definitions.spear_01)"),false);
 g.run('gold=2000;expandWarehouse()');assert.equal(g.run('fitsWarehouse(definitions.spear_01)'),false);
 g.run('expandWarehouse()');assert.equal(g.run('fitsWarehouse(definitions.spear_01)'),true);
 g.run("warehouseSize={width:5,height:5};stock=[];pending=[];for(let i=0;i<25;i++)storeItem(newItem('accessory_01'));counts=[100,100,100];gold=100000;buy()");
 assert.equal(g.run('pending.length'),300);assert(g.run('pending.every(i=>fitsWarehouse(definitions[i.itemId]))'));
 assert.equal(g.run('stock.length'),25);
});

test('donation draw excludes items too large for the warehouse and empty pools consume neither money nor ad quota',async()=>{
 const g=await game(null,5);g.run("registerDonationAdapter({showRewardedAd:async()=>({completed:true})});Math.random=()=>0.56");
 await g.run('watchDonation()');assert(g.run('pending.every(i=>fitsWarehouse(definitions[i.itemId]))'));assert.equal(g.run('pending.length'),3);
 g.run("pending=[];catalog.items.forEach(d=>d.status='planned');counts=[1,0,0];document.querySelector('#modal').showModal=()=>{};globalThis.beforeGold=gold;buy()");assert.equal(g.run('gold'),g.run('beforeGold'));assert.equal(g.run('pending.length'),0);
 const used=g.run('donationState.used');await g.run('watchDonation()');assert.equal(g.run('donationState.used'),used);assert.equal(g.run('pending.length'),0);
});
