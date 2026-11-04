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

async function game(){
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
 const context=vm.createContext({
  document:{querySelector:key=>key==='#view'?view:elements[key]??(elements[key]={innerHTML:'',textContent:'',showModal(){throw Error('Unexpected alert');}}),documentElement:{dataset:{}},body:{append(){}},createElement:()=>({style:{},classList:{toggle(){}},remove(){}}),addEventListener(){}},
  window:{addEventListener(){}},
  fetch:async path=>({ok:true,json:async()=>JSON.parse(read(path))}),
  setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;},clearTimeout:id=>timers.delete(id)
 });
 vm.runInContext(read('js/item-core.js'),context);
 vm.runInContext(read('js/encyclopedia-core.js'),context);
 vm.runInContext(read('js/encyclopedia-ui.js'),context);
 vm.runInContext(read('js/main.js'),context);
 await vm.runInContext('loadItemSettings()',context);
 const run=code=>vm.runInContext(code,context);
 const event=(x,y,pointerType='mouse',incoming=false)=>({
  target:{closest:selector=>selector==='[data-drag-incoming]'?(incoming?{}:null):(incoming?null:cells[Math.floor(y/10)*8+Math.floor(x/10)])},
  pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y,pointerType,preventDefault(){}
 });
 return{run,view,elements,handlers,timers,event};
}

test('main entry references only existing scripts and CSS',()=>{
 const html=read('index.html');
 for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g))assert(existsSync(resolve(root,match[1])),match[1]);
 assert(!html.includes('design-previews'));
});

test('235 unique items, fixed elements and two planned accessories',()=>{
 assert(rules.validate(catalog,settings));
 assert.equal(catalog.items.length,235);
 assert.equal(new Set(catalog.items.map(i=>i.id)).size,235);
 assert.equal(catalog.items.filter(i=>i.status==='planned').length,2);
 const counts={weapon:94,offhand:32,head:30,body:30,accessory:45};
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
 for(const screen of ['home','trade','warehouse','adventurers','residents','records','journal','settings','catalog','encyclopedia','departure'])for(let phase=0;phase<6;phase++)for(let sub=0;sub<4;sub++){
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
 const action=[...g.view.innerHTML.matchAll(/onclick="([^"]*)"/g)].find(m=>m[1].includes('EncyclopediaCore.sold'))[1];
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
 g.run('sub=1;render()');assert(g.view.innerHTML.includes('カイル · 装備'));
 g.run("screen='home';phase=0;sub=1;render()");
 assert(g.view.innerHTML.includes('カイル・ガレス・ミラが帰還しました。'));
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
 assert(g.view.innerHTML.includes('disabled'));
 g.run("switchParty(0);partySlot=0;removePartyMember();switchParty(1);assignCharacter('kyle')");
 assert.equal(g.run('parties[0][0]'),null);
 assert.equal(g.run('parties[1][0]'),'kyle');
 assert.equal(g.run("partyNumber('kyle')"),2);
 assert.equal(g.run("parties.flat().filter(id=>id==='kyle').length"),1);
 assert(g.view.innerHTML.includes('party-badge">2</span>カイル'));
 g.run("assignCharacter('leon')");assert.equal(g.run('parties[1][0]'),'kyle');
 g.run('removePartyMember()');assert.equal(g.run("partyNumber('kyle')"),0);
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
 g.run(`switchParty(0);removePartyMember();switchParty(1);startPartyDrag(dragEvent,'kyle');dragTarget={closest:()=>dropSlot};dragHandlers.pointermove({...dragEvent,clientX:30});dragHandlers.pointerup({...dragEvent,clientX:30})`);
 assert.equal(g.run('parties[1][2]'),'kyle');
 assert.equal(g.run('Object.keys(dragHandlers).length'),0);
 const before=g.run('JSON.stringify(parties)');
 g.run(`startPartyDrag(dragEvent,'kyle');dragTarget=null;dragHandlers.pointermove({...dragEvent,clientX:30});dragHandlers.pointerup({...dragEvent,clientX:30})`);
 assert.equal(g.run('JSON.stringify(parties)'),before);
 g.run(`startPartyDrag(dragEvent,'kyle');dragTarget={closest:()=>dropSlot};dragHandlers.pointermove({...dragEvent,clientX:30});dragHandlers.pointercancel()`);
 assert.equal(g.run('JSON.stringify(parties)'),before);
 assert.equal(g.run('Object.keys(dragHandlers).length'),0);
});

test('clear releases only the selected party and preserves other parties and funds',async()=>{
 const g=await game();
 g.run("screen='adventurers';parties=[['kyle'],['gares','mira'],[]];funds=[10,100,1000];switchParty(1);partySlot=2;clearParty()");
 assert.equal(g.run('JSON.stringify(parties)'),JSON.stringify([['kyle'],[],[]]));
 assert.equal(g.run("partyNumber('gares')"),0);
 assert.equal(g.run("partyNumber('mira')"),0);
 assert.equal(g.run('JSON.stringify(funds)'),JSON.stringify([10,100,1000]));
 assert.equal(g.run('party'),1);assert.equal(g.run('partySlot'),0);
 assert(g.view.innerHTML.includes('クリア'));
 g.run('clearParty()');assert.equal(g.run('parties[0][0]'),'kyle');
});
