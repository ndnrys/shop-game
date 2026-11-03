import skin from '../js/data/skins/fantasy/index.js';
import { createSession } from '../js/application/createSession.js';
import { makeSave, validateSave } from '../js/systems/save.js';
const assert = (value, message) => { if (!value) throw new Error(message); };
let passed = 0;
function pass(message) { passed++; const li = document.createElement('li'); li.textContent = 'PASS ' + message; document.querySelector('#checks').append(li); }
try {
 const game = createSession(skin), actions = game.campaign;
 actions.advancePhase();
 const before = JSON.stringify(game.state);
 for (const plan of [[], [{merchantId:'weapons',lots:0}], [{merchantId:'tools',lots:-1}], [{merchantId:'tools',lots:1.5}], [{merchantId:'missing',lots:1}], [{merchantId:'tools',lots:4}], [{merchantId:'tools',lots:1},{merchantId:'tools',lots:1}]]) {
   assert(!actions.startProcurement(plan).ok, 'reject invalid plan');
   assert(JSON.stringify(game.state) === before, 'invalid plan is atomic');
 }
 assert(actions.startProcurement([{merchantId:'weapons',lots:1},{merchantId:'tools',lots:1}]).ok, 'batch accepted');
 assert(game.state.campaign.gold === 130 && game.state.campaign.today.purchasing === 270, 'exact aggregate charge');
 let resumed = createSession(skin, validateSave(makeSave(game.state), skin));
 assert(resumed.state.campaign.trade.pending[0].merchantId === 'tools', 'pending merchant saved');
 const corrupt = makeSave(game.state); corrupt.state.campaign.trade.pending[0].merchantId = 'missing';
 let rejected = false; try { validateSave(corrupt,skin); } catch { rejected = true; } assert(rejected,'invalid pending merchant rejected');
 for (const id of ['weapons','tools']) {
   assert(resumed.state.campaign.trade.merchantId === id, 'merchant order');
   assert(resumed.state.campaign.trade.incoming.length === 1, 'delivery count per merchant');
   assert(resumed.state.campaign.trade.incoming.reduce((n,item)=>n+item.purchaseCost,0) === (id === 'weapons' ? 150 : 120), 'allocated cost');
   for (const item of [...resumed.state.campaign.trade.incoming]) assert(resumed.campaign.sellBack(item.instanceId,'incoming').ok,'sell to current merchant');
   assert(resumed.campaign.finishTrade().ok, 'next paid merchant');
   resumed = createSession(skin,validateSave(makeSave(resumed.state),skin));
 }
 assert(resumed.state.campaign.trade === null, 'batch finished');
 const legacy = makeSave(createSession(skin).state); legacy.version = 5; assert(validateSave(legacy,skin), 'version 5 loads');
 pass('atomic batch charge, per-merchant stock, save/resume, invalid saves and legacy version');
 for (const [width,height] of [[320,568],[390,844],[430,932],[1280,900]]) {
   const frame=document.createElement('iframe');frame.style.cssText=`width:${width}px;height:${height}px;border:0;display:block`;
   const loaded=new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));frame.src='routine-preview.html?procurement=1#home';document.querySelector('#frames').append(frame);await loaded;
   const doc=frame.contentDocument,win=frame.contentWindow;
   for(let i=0;!doc.querySelector('.procurement-selection')&&i<100;i++) await new Promise(resolve=>setTimeout(resolve,20));
   assert(doc.documentElement.scrollHeight<=height,'procurement fits viewport');
   assert(doc.querySelector('.topbar .day-label > span:first-child').textContent==='村のよろず屋','store title retained');
   assert(!doc.querySelector('.procurement-row small').textContent.includes('品'),'price only in terms');
   assert(doc.querySelectorAll('.procurement-row').length===4, 'three merchants and villager');
   assert([...doc.querySelectorAll('.procurement-villager button')].every(button=>button.disabled),'video reward disabled');
   assert(doc.querySelector('.procurement-villager .procurement-video')?.disabled,'villager uses disabled video button');
   assert(!doc.querySelector('.procurement-villager .procurement-counter'),'villager has no quantity control');
   doc.querySelector('[data-procurement-change="1"][data-id="weapons"]').click();
   doc.querySelector('[data-action="procurementSkip"]').click();
   assert(doc.querySelector('#game-gold').textContent==='400 G','skipping does not spend gold');
   assert(doc.querySelector('.home-phase-card h3').textContent==='倉庫整理','skip advances stage');
   doc.querySelector('[data-routine="back"]').click();
   doc.querySelector('.home-primary').click();
   assert([...doc.querySelectorAll('.procurement-counter output')].every(output=>output.textContent==='0'),'skip clears selections');
   const plus=id=>doc.querySelector(`[data-procurement-change="1"][data-id="${id}"]`);
   assert(doc.querySelector('[data-action="procurementConfirm"]').disabled,'empty selection disabled');
   plus('weapons').dispatchEvent(new win.PointerEvent('pointerdown',{bubbles:true,pointerType:'touch'}));plus('weapons').click();plus('tools').click();
   assert(doc.querySelector('.procurement-summary').textContent.includes('270 G'),'combined price');
   assert(plus('weapons').disabled,'unaffordable increment disabled');
   assert(doc.documentElement.scrollWidth<=width,'Japanese no overflow');
   const select=doc.querySelector('#locale-select');select.value='en';select.dispatchEvent(new win.Event('change',{bubbles:true}));
   assert(doc.querySelector('[data-action="procurementConfirm"]').textContent==='Buy stock','English labels');
   assert(doc.documentElement.scrollWidth<=width,'English no overflow');
   assert(doc.documentElement.scrollHeight<=height,'English procurement fits viewport');
   doc.querySelector('[data-action="procurementConfirm"]').click();
   assert(doc.querySelector('[data-action="keep"]'),'delivery screen opens');
   assert(!doc.querySelector('.mvp-status').textContent,'no routine success announcement');
   assert(doc.querySelector('#game-gold').textContent==='130 G','combined payment once');
   pass(`${width}×${height}: four rows, counters, budget, languages and purchase`);
 }
 document.querySelector('#result').textContent=`PASS ${passed}/${passed}`;
} catch(error) {document.querySelector('#result').textContent=`FAIL after ${passed}: ${error.message}`;console.error(error);}
