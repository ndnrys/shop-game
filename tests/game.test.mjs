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
 for(const screen of ['home','trade','warehouse','adventurers','residents','journal','settings','catalog','departure'])for(let phase=0;phase<6;phase++)for(let sub=0;sub<4;sub++){
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
