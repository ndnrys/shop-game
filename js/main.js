
const $=s=>document.querySelector(s);
let language=localStorage.getItem('shop-game-language')==='en'?'en':'ja',translations={ja:{},en:{}};
const t=(key,fallback='')=>translations[language]?.[key]??translations.ja?.[key]??fallback;
function changeLanguage(next){if(next!=='ja'&&next!=='en')return;language=next;localStorage.setItem('shop-game-language',next);render()}
const characterName=c=>t(c.nameKey,c.name||c.id);
const characterJob=c=>t('jobs.'+c.initialJobId+'.name',c.jobName||c.initialJobId);
const customerName=c=>t('customers.'+c.id+'.name',c.name||c.id);
function translateVisibleText(){
  if(language!=='en')return;
  const root=document.body;if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node;while((node=walker.nextNode())){
    if(!node.parentElement||node.parentElement.closest('script,style,textarea,input'))continue;
    const original=node.nodeValue,trimmed=original.trim();if(!trimmed)continue;
    const translated=t('text.'+trimmed,null);
    if(translated!==null)node.nodeValue=original.replace(trimmed,translated);
  }
  for(const el of root.querySelectorAll('[title],[aria-label],[placeholder]')){
    for(const attr of ['title','aria-label','placeholder']){
      const value=el.getAttribute(attr);if(!value)continue;
      const translated=t('text.'+value,null);if(translated!==null)el.setAttribute(attr,translated);
    }
  }
}

const phases=['報告','仕入れ','倉庫整理','陳列','探索','営業'];const navs=[['home','shop','お店'],['warehouse','box','倉庫'],['adventurers','party','仲間'],['records','book','記録']];
function uiIcon(name){
 const art={
 shop:'<path d="M4 12h4v7h8v-7h4v10H4z M5 3h3l-2 7H2z M9 3h3v7H7z M13 3h3l1 7h-4z M17 3h2l3 7h-4z"/>',
 box:'<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7l10-4 10 4v13l-10 3-10-3z M2 7l10 4 10-4 M12 11v12 M7 5l10 4 M3 12l8 3 M13 15l8-3 M3 16l8 3 M13 19l8-3"/></g>',
 party:'<circle cx="12" cy="6" r="3.3"/><circle cx="4.5" cy="8" r="2.7"/><circle cx="19.5" cy="8" r="2.7"/><path d="M7 22v-7a5 5 0 0 1 10 0v7z M0 21v-7a4.5 4.5 0 0 1 6-4c-1 2-1 5-1 7v4z M19 21v-4c0-2 0-5-1-7a4.5 4.5 0 0 1 6 4v7z"/>',
 book:'<path d="M1 4c4-1.5 7-1.2 10 1v17c-3-2.1-6-2.5-10-1z M13 5c3-2.2 6-2.5 10-1v17c-4-1.5-7-1.1-10 1z"/>',
 menu:'<path d="M3 5h18 M3 12h18 M3 19h18" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>'};
 return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${art[name]||art.menu}</svg>`;
}
function renderHeader(){
 const season=Math.floor(((day-1)%20)/5),date=(day-1)%5+1,seasonKeys=['spring','summer','autumn','winter'],seasonNames=['春','夏','秋','冬'];
 $('header strong').textContent=t('ui.shopTitle','村のよろず屋');$('header strong').title=t('ui.shopTitle','村のよろず屋');
 $('.header-shop-icon').innerHTML=uiIcon('shop');$('#seasonIcon').textContent=['🌸','☀️','🍂','❄️'][season];
 $('#date').textContent=t('ui.season.'+seasonKeys[season],seasonNames[season])+(language==='en'?' ':'')+date+(language==='ja'?'日':'');
 $('.header-date').title=gameDate()+' · '+phases[phase];$('#gold').textContent=money(gold);
}

function renderNavigation(){const current=screen==='equipment'?equipmentOrigin?.screen:screen;return navs.map(([id,icon,label])=>{const active=id===current||id==='records'&&['encyclopedia','journal'].includes(current)||id==='home'&&['trade','dailyReport','shelfOverview'].includes(current);return `<button class="${active?'active':''}" ${active?'aria-current="page"':''} onclick="go('${id}')">${uiIcon(icon)}<span class="nav-label" title="${esc(t('ui.nav.'+id,label))}">${esc(t('ui.nav.'+id,label))}</span></button>`}).join('')+`<button onclick="toggleMenu()" aria-label="メニューを開閉" aria-expanded="${$('#nav').classList.contains('is-open')}">${uiIcon('menu')}<span class="nav-label">${esc(t('ui.nav.menu','メニュー'))}</span></button><div class="nav-more">${btn('設定',"go('settings')")}${btn('住人・施設',"go('residents')")}${btn('情報屋',"go('broker')")}${developmentMenu()}</div>`}

let day=1,phase=0,screen='home',gold=0,counts=[0,0,0],pending=[],stock=[],shelf=[],selected=0,page=0,sub=0,party=0,funds=[0,0,0],away=false;const prices=[];
const merchantPrice=index=>chapter===0?config.development.prologueMerchantCosts[index]:prices[index];let characters=[];const villageCharacters=()=>characters.filter(c=>c.joinChapter===0);
let chapter=0,availableCharacterIds=[],parties=[[],[],[]],partySlot=0,rosterPage=0;
const availableCharacters=()=>characters.filter(c=>availableCharacterIds.includes(c.id));
const partyNumber=id=>parties.findIndex(members=>members.includes(id))+1;
function switchParty(index){party=index;partySlot=0;render()}
const canAssignCharacter=id=>!isAway(id)&&!partyAway(party)&&availableCharacterIds.includes(id)&&(!partyNumber(id)||partyNumber(id)===party+1);
function assignCharacter(id,slot=partySlot){if(isAway(id)||partyAway(party)||!canAssignCharacter(id)||!Number.isInteger(slot)||slot<0||slot>2)return;partySlot=slot;for(const members of parties)for(let i=0;i<3;i++)if(members[i]===id)members[i]=null;parties[party][partySlot]=id;render()}
function removeCharacterFromParty(id){if(!canAssignCharacter(id)||partyNumber(id)!==party+1)return;parties[party]=parties[party].map(member=>member===id?null:member);render()}
let partySuppressClick=0;
let selectedCompanion=null;
function startPartyDrag(event,id){
 if(!canAssignCharacter(id)||event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0))return;
 const pointerId=event.pointerId,originParty=party,originScreen=screen,startX=event.clientX,startY=event.clientY;
 let active=false,ghost=null,target=null;
 function clearTarget(){target?.classList.remove('party-drop-target');target=null}
 function move(e){
  if(e.pointerId!==pointerId)return;
  if(party!==originParty||screen!==originScreen){cancel();return}
  if(!active&&Math.hypot(e.clientX-startX,e.clientY-startY)<6)return;
  if(!active){active=true;ghost=document.createElement('div');ghost.className='drag-ghost';const c=characters.find(c=>c.id===id);ghost.innerHTML=characterArt(c)+`<span>${esc(characterName(c))}</span>`;document.body.append(ghost)}
  e.preventDefault();clearTarget();ghost.style.left=e.clientX+12+'px';ghost.style.top=e.clientY+12+'px';
  target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-party-slot],[data-party-roster]')||null;
  target?.classList.add('party-drop-target');ghost.classList.toggle('invalid',!target);
 }
 function cleanup(){clearTarget();ghost?.remove();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key)}
 function up(e){if(e.pointerId!==pointerId)return;if(active){move(e);const slot=target?.dataset.partySlot===undefined?null:Number(target.dataset.partySlot),remove=target?.dataset.partyRoster!==undefined;partySuppressClick=Date.now()+400;cleanup();if(party===originParty&&screen===originScreen){if(remove)removeCharacterFromParty(id);else if(slot!==null)assignCharacter(id,slot)}}else cleanup()}
 function cancel(){if(active)partySuppressClick=Date.now()+400;cleanup()}
 function key(e){if(e.key==='Escape')cancel()}
 window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',key);
}
function characterArt(c,kind='icon'){
 const status=companionStatus(c.id),state=status==='recovering'?'resting':status==='away'?'battle':status==='dead'?'dead':kind;
 return `<img class="character-art" src="${esc(c.images[state]||c.images.normal)}" alt="" draggable="false">`;
}
let partyRosterOpen=false;
function partyFormation(){
 const members=parties[party],all=availableCharacters(),size=3,total=Math.max(1,Math.ceil(all.length/size));rosterPage=Math.min(rosterPage,total-1);
 const characterButton=(c,slot=null)=>btn(`${slot===null?`<span class="party-badge">${partyNumber(c.id)||'−'}</span>`:''}${characterArt(c)}<span class="character-name">${esc(characterName(c))}</span>${companionStatus(c.id)==='waiting'?'':`<small class="character-status">${{recovering:'療養中',dead:'死亡',away:'遠征中'}[companionStatus(c.id)]||''}</small>`}${slot!==null&&config.dungeons.find(d=>d.id===selectedDungeon&&d.chapter===chapter)?`<small class="party-safety">${expeditionSafetyLabel(c.id,config.dungeons.find(d=>d.id===selectedDungeon))}</small>`:''}`,`openCharacterEquipment('${c.id}')`,'party-character',`${characterName(c)}の装備を開く`).replace('<button ',`<button ${slot!==null?`data-party-slot="${slot}" `:''}${canAssignCharacter(c.id)?`onpointerdown="startPartyDrag(event,'${c.id}')" `:''}`);
 return card(`<div class="row"><h2>第${party+1}パーティ · 3人枠</h2><div class="actions">${[0,1,2].map(i=>btn(String(i+1),`switchParty(${i})`,party===i?'mini active':'mini')).join('')}</div></div><div class="actions party-slots">${Array.from({length:3},(_,i)=>{const c=characters.find(c=>c.id===members[i]);return c?characterButton(c,i):`<button data-party-slot="${i}" aria-label="パーティ枠${i+1} · 空き">空き枠</button>`}).join('')}</div>${note(partyAway(party)?'遠征中です。':'キャラをタップで装備を確認。')}<div class="actions">${(partyRosterOpen?'':btn('編成','partyRosterOpen=true;render()','mini'))}${!partyRosterOpen&&phase===4&&(screen==='home'||screen==='adventurers')?(parties[party].some(id=>id&&companionStatus(id)==='waiting')&&!partyAway(party)?btn('このパーティを派遣','depart()','primary'):'<button class="primary" disabled>このパーティを派遣</button>'):''}</div>`)+(partyRosterOpen?card(`<h2>この章で使える仲間 · ${all.length}人</h2><div class="actions chapter-roster">${all.slice(rosterPage*size,(rosterPage+1)*size).map(c=>characterButton(c)).join('')}</div>${note('数字は所属パーティ。枠からこの一覧へドラッグで外す。')}${total>1?`<div class="page">${btn('‹','rosterPage=Math.max(0,rosterPage-1);render()')}<small>${rosterPage+1} / ${total}</small>${btn('›',`rosterPage=Math.min(${total-1},rosterPage+1);render()`)}</div>`:''}`).replace('<section ', '<section data-party-roster="true" '):'')
}
function characterInfo(id){const c=characters.find(c=>c.id===id),s=companionStats(id);const attrs=Object.entries(s.attributes).map(([id,n])=>({fire:'炎',water:'水',wind:'風',earth:'土'}[id]||id)+n).join('・')||'なし';info(characterName(c),`${characterJob(c)} / Lv.${companionLevel(id)} / 生存力 ${s.hp} / 攻撃 ${s.attack} / 防御 ${s.defense} / 固有属性 ${attrs}`)}
const title=(label,detail='')=>`<div class="heading"><h1>${esc(label)}</h1>${detail?`<span class="tag">${esc(detail)}</span>`:''}</div>`;const btn=(s,fn,cl='',label='')=>`<button ${label?`aria-label="${esc(label)}" `:''}class="${cl}" onclick="${fn.replaceAll('"','&quot;')}">${s}</button>`;const card=s=>`<section class="card">${s}</section>`;const steps=()=>'';const next=()=>`<div class="bottom">${dayActions()}${steps()}</div>`;const dayActions=()=>`<div class="actions">${btn('報告を確認','reviewDailyReport()')}${btn('今日のお店を開ける','openShop()','primary')}</div>`;const row=(a,b)=>`<div class="row"><span>${a}</span><b>${b}</b></div>`;const note=s=>`<p class="muted">${s}</p>`;const money=n=>n.toLocaleString()+' G';
function gameDate(n=day){const seasons=['春','夏','秋','冬'],year=Math.floor((n-1)/20)+1,season=seasons[Math.floor(((n-1)%20)/5)],date=(n-1)%5+1;return `${year}年 ${season}${date}日`}

function toggleMenu(){const opening=$('#nav').classList.toggle('is-open');$('#menuToggle').setAttribute('aria-expanded',String(opening));$('#nav>button:last-of-type')?.setAttribute('aria-expanded',String(opening))}
function go(id){$('#nav').classList.remove('is-open');$('#menuToggle').setAttribute('aria-expanded','false');partyRosterOpen=false;shopPanelOpen=false;shopSelectedShelf.clear();shopSelectedStock.clear();cancelEquipmentDrag();equipmentSelectedUid=null;if(screen==='equipment'&&id!=='equipment')equipmentOrigin=null;screen=id;page=0;sub=0;render()}function advance(){if(phase===4){if(pending.length)return confirmUnsortedItems();phase=5;go('home');return}if(pending.length&&phase!==2){go('trade');return}if(economyState.bill?.status==='unpaid')return;if(phase===5){if(tradingState.report?.day!==day||salesShown<tradingState.report.visits.length)return;ledgerDay();closeEconomyDay();day++;phase=0;recoverCompanions();resolveExpeditions()}else phase++;go('home')}
function reviewDailyReport(){screen='dailyReport';sub=0;page=0;render()}
function openShop(){if(pending.length)return confirmUnsortedItems();phase=5;go('home')}
function goStage(target){if(phase<1||phase>5||target<1||target>5)return;if(target===5&&pending.length)return confirmUnsortedItems();phase=target;go('home')}
function openResidentService(tab){go('residents');sub=tab;render()}
function stageNavigation(){return '<div class="actions">'+[1,2,3,4].map(n=>btn(['','仕入れ','倉庫','陳列','探索'][n],'goStage('+n+')',phase===n?'mini active':'mini')).join('')+'</div>'}
function confirmUnsortedItems(){document.querySelector('#confirmUnsortedDialog').showModal()}
function acceptUnsortedItems(){document.querySelector('#confirmUnsortedDialog').close();const amount=pending.reduce((sum,item)=>sum+buybackValue(item),0);gold+=amount;ledgerMoney('otherIncome',amount);pending=[];warehouseShowStock=false;phase=5;go('home')}
function info(a,b){$('#modalTitle').textContent=a;$('#modalBody').textContent=b;$('#modal').showModal()}
let pendingStockAction=null;
function confirmStockAction(action){
 const item=stock[selected];if(!item)return;
 if(action==='buyback'&&item.forged)return info('引取できません','鍛冶済み装備は手動装備または破棄してください。');
 pendingStockAction={action,uid:item.uid};
 $('#confirmStockTitle').textContent=action==='buyback'?'商人へ引き取ってもらいますか？':'商品を破棄しますか？';
 $('#confirmStockBody').textContent=action==='buyback'?itemName(item)+'を '+money(buybackValue(item))+' で引き取ってもらいます。':itemName(item)+'を破棄します。この操作は取り消せません。';
 $('#confirmStockDialog').showModal();
}
function executeStockAction(){
 const pendingAction=pendingStockAction;pendingStockAction=null;
 $('#confirmStockDialog').close();
 if(!pendingAction)return;
 const index=stock.findIndex(item=>item.uid===pendingAction.uid);if(index<0)return;
 selected=index;
 if(pendingAction.action==='buyback')buybackStock();else if(pendingAction.action==='discard')discardStock();
}

function villageCompletion(){
 const rules=config.chapterProgression.prologue;
 const conquered=dungeonCleared(rules.clearDungeonId),funded=gold>=clearFunds();
 const settled=economyState.bill?.status!=='unpaid',ready=chapter===0&&phase===0&&conquered&&funded&&settled&&!pending.length&&!expeditions.length;
 return {rules,conquered,funded,ready};
}
function villageClearView(){
 const {rules}=villageCompletion();
 const candidates=availableCharacters().filter(c=>companionStatus(c.id)!=='dead');
 if(!candidates.some(c=>c.id===selectedCompanion))selectedCompanion=null;
 if(!sub)return '<h1>プロローグクリア！</h1>'+clerkDialogue(`店長！ ${rules.enemyName}を倒して、村に平和が戻りました！ 旅の資金も集まりましたね。次はエルディアへ向かいましょう！`)+card(row('攻略',esc(rules.enemyName)+' 討伐完了')+row('必要資金',money(clearFunds())+' 達成'))+`<div class="bottom">${btn('同行する仲間を選ぶ','sub=1;render()','primary')}</div>`;
 return title('次の旅へ')+clerkDialogue(`一緒に旅をする仲間を${rules.memberLimit}人選んでください。残る仲間には、村をお願いしますね。`)+card(`<h2>同行する仲間を${rules.memberLimit}人選ぶ</h2><div class="actions departure-roster">${candidates.map(c=>btn(characterArt(c)+`<span>${esc(characterName(c))}</span>`,`selectedCompanion='${c.id}';render()`,selectedCompanion===c.id?'active':'')).join('')}</div>`)+note('所持金・商品・倉庫・棚を引き継ぎます。必要資金は消費しません。残る仲間の装備と育成状態も保持します。')+`<div class="bottom"><button class="primary" onclick="travelToNextChapter()" ${!selectedCompanion?'disabled':''}>${esc(rules.nextName)}へ出発</button></div>`;
}
function shopkeeperImage(expression='normal'){return `assets/shopkeeper/warm/shopkeeper-${expression}.webp`}
function clerkDialogue(message){
 return `<section class="clerk-dialogue" aria-label="店員からの案内"><img src="${shopkeeperImage()}" alt="案内役の店員"><div class="card"><h2>店員</h2><p>${esc(message)}</p></div></section>`;
}
function travelToNextChapter(){
 const {rules,ready}=villageCompletion();
 if(!ready||!availableCharacterIds.includes(selectedCompanion)||companionStatus(selectedCompanion)==='dead')return;
 const recruits=characters.filter(c=>c.joinChapter===rules.nextChapter).map(c=>c.id);
 if(!recruits.length)return;
 cancelEquipmentDrag();equipmentSelectedUid=null;
 chapter=rules.nextChapter;availableCharacterIds=[selectedCompanion,...recruits];
 parties=[recruits.slice(0,3),[selectedCompanion],[]];funds=[0,0,0];counts=[0,0,0];supplies=Array.from({length:3},()=>[0,0,0]);
 party=0;partySlot=0;rosterPage=0;selectedDungeon=config.dungeons.find(d=>d.chapter===chapter)?.id;
 equipCharacter=null;equipmentOrigin=null;selectedCompanion=null;go('chapterArrival');
}
function chapterArrival(){
 const rules=config.chapterProgression.prologue;
 const recruits=characters.filter(c=>c.joinChapter===chapter);
 return `<h1>${esc(rules.nextName)}</h1>`+clerkDialogue('店長、到着しました！ 新しい仲間と、この土地でお店を始めましょう！')+card(`<h2>新たな仲間との出会い</h2><div class="actions departure-roster">${recruits.map(c=>`<div>${characterArt(c)}<b>${esc(characterName(c))}</b><small>${esc(characterJob(c))}</small></div>`).join('')}</div>`)+note('編成を整えて、探索工程から仲間を派遣しましょう。')+`<div class="bottom">${btn('この土地で経営を始める',"go('home')",'primary')}</div>`;
}

function developmentMenu(){
 return `<details class="development-menu"><summary><span>⚒</span>開発用</summary><div class="development-options"><b>確認するタイミング</b>${btn('プロローグの最初から',"loadDevelopmentStage('prologue')")}${btn('プロローグ終了間際',"loadDevelopmentStage('prologueEnd')")}${btn('プロローグクリア直後',"loadDevelopmentStage('prologueClear')")}${btn('1章はじめから',"loadDevelopmentStage('chapter1')")}${note('現在の進行を置き換えて自動保存します。残す場合は設定からJSONを書き出してください。')}</div></details>`;
}
function loadDevelopmentStage(stage){
 if(!['prologue','prologueEnd','prologueClear','chapter1'].includes(stage))return;
 $('#nav').classList.remove('is-open');$('#menuToggle').setAttribute('aria-expanded','false');
 // Build the complete checkpoint before allowing any automatic save.
 saveReady=false;reset(false);
 if(stage!=='prologue'){
  const target=config.dungeons.find(d=>d.id===config.chapterProgression.prologue.clearDungeonId);
  for(const d of config.dungeons.filter(d=>d.chapter===0))dungeonProgress[d.id]=d.requiredProgress;
  gold=clearFunds()+config.development.initialGold;
  if(stage==='prologueEnd'){
   dungeonProgress[target.id]=target.requiredProgress-1;phase=4;selectedDungeon=target.id;
  }
 }
 saveReady=true;
 if(stage==='chapter1'){selectedCompanion=villageCharacters()[0].id;travelToNextChapter()}
 else {go('home');if(stage==='prologueEnd'){sub=2;render()}}
}

function dailyReport(){return report(true)}
function home(){if(economyState.bill?.status==='unpaid')return report();if(phase===0)return report();return stageNavigation()+(phase===1?purchase():phase===2?warehouse(true):phase===3?stocking():phase===4?support(true):sales())}
function report(review=false){
 const groups=typeof groupedReturnReport!=='undefined'?groupedReturnReport:[];
 const bill=economyState.bill,visits=tradingState.report?.visits;
 const buyers=visits?.filter(v=>v.uids.length).length||0;
 const costDetails=bill?[['店舗管理費',bill.shop],['仲間維持費',bill.companions],['季節税',bill.tax]].filter(([,amount])=>amount>0).map(([label,amount])=>esc(label)+'：'+money(amount)).join('<br>'):'';
 const salesSpeech=(visits&&!buyers?'<p>購入された方はいらっしゃいませんでした。</p>':'')+
 (!bill?'<p>初回の朝なので、固定費のお支払いはありません。</p>':bill.status==='paid'?'':'<p>所持金が足りず、まだお支払いができていません。</p>'+btn('支払いを再確認','retryEconomyBill()','mini'))+
 (rescueState.last?.day===day?`<p>国から${money(rescueState.last.amount)}の資金提供を受けました。</p>`:'');
 const voiceSize=2,voicePages=Math.max(1,Math.ceil((visits?.length||0)/voiceSize));
 if(sub===1)page=Math.max(0,Math.min(page,voicePages-1));
 const voicesSpeech='<p>お客様からこんな声が届いています。</p>'+
 (visits?.length?visits.slice(page*voiceSize,(page+1)*voiceSize).map(visit=>{
  const customer=tradingConfig.customers.find(c=>c.id===visit.customerId),purchased=visit.uids.length>0;
  const products=purchased?visit.itemIds.map(id=>esc(definitions[id]?.name||id)).join(' ＋ '):'購入なし';
  return `<div class="report-customer"><div class="report-customer-art">${customer?.image?`<img src="${esc(customer.image)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${customerIcons[visit.customerId]||'🧑'}</span>`:customerIcons[visit.customerId]||'🧑'}</div><div><b>${esc(customer?.name||visit.customerId)}</b><p>「${purchased?'いい買い物ができた！':'今日は見送ろうかな'}」</p><small>${products}${purchased?' · '+money(visit.price):''}</small></div></div>`;
 }).join('')+(voicePages>1?`<div class="report-voice-pages">${btn('前のお客様','page=Math.max(0,page-1);render()','mini')}<span>${page+1} / ${voicePages}</span>${btn('次のお客様',`page=Math.min(${voicePages-1},page+1);render()`,'mini')}</div>`:''):'<p>今回はお客様の声は届いていません。</p>');
 const returnEntries=groups.flatMap(g=>g.members.map(member=>({...g,members:[member]})));
 const returnPages=Math.max(1,returnEntries.length);if(sub===2)page=Math.max(0,Math.min(page,returnPages-1));
 const returnEntry=returnEntries[page];
 const returnSpeech=returnEntry?`<h2>${esc(returnEntry.destination)} · 攻略 ${returnEntry.totalProgress}%</h2><p>第${returnEntry.party+1}パーティ · ${esc(returnEntry.progress)}</p>${returnEntry.members.map(m=>`<div class="return-member"><img class="return-member-art" src="${esc(m.image)}" alt=""><div><b>${esc(m.name)}</b><p>${m.events.length?m.events.map(esc).join(' ／ '):'無事に帰還しました。'}</p></div></div>`).join('')}${returnPages>1?`<div class="page">${btn('‹','page=Math.max(0,page-1);render()','mini')}<small>${page+1} / ${returnPages}</small>${btn('›',`page=Math.min(${returnPages-1},page+1);render()`,'mini')}</div>`:''}`:'<p>今回は帰還したパーティはありません。仕入れの準備を進めましょう。</p>';
 const reportPage=Math.min(3,Math.max(0,sub));
 const reportDay=tradingState.report?.day??bill?.day??day-1;
 const purchaseCost=ledgerHistory.find(entry=>entry.day===reportDay)?.purchases||0;
 const maintenance=bill?.total||0,net=lastSales-purchaseCost-maintenance;
 const ledgerIcon=kind=>{const paths={receipt:'<path d="M5 5h22v26H5z" fill="#a77b50"/><path d="M8 3h21v25H8z" fill="#f4e3bf"/><path d="M12 3v25M16 9h9M16 14h9M16 19h9M21 7v15M6 8h4M6 14h4M6 20h4"/><path d="M16 24h9"/>',crate:'<path d="m3 9 13-6 13 6v15l-13 6-13-6zM3 9l13 6 13-6M16 15v15M9 6l13 6v9"/>',wrench:'<path d="M21 3a8 8 0 0 0-9 10L3 23a4 4 0 0 0 6 6l10-10A8 8 0 0 0 29 9l-6 5-5-5z" fill="#d5b58b"/>',balance:'<path d="M16 3v25M7 29h18M3 8h26M7 8 2 22h10L7 8m18 0-5 14h10L25 8"/><path d="M2 22q5 7 10 0m8 0q5 7 10 0" fill="currentColor"/>'};return `<svg viewBox="0 0 32 34" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]}</svg>`};
 const ledgerMoneyText=amount=>`${amount.toLocaleString()} <small class="ledger-unit">G</small>`;
 const reportLedger=`<div class="morning-ledger"><div class="morning-sales">${ledgerIcon('receipt')}<div><span>${esc(t('ui.report.sales','昨日の売上'))}</span><strong>${ledgerMoneyText(lastSales)}</strong></div></div><div class="morning-entry">${ledgerIcon('crate')}<span>${esc(t('ui.report.purchase','仕入れ'))}</span><b>−${ledgerMoneyText(purchaseCost)}</b></div><div class="morning-entry" title="${esc(costDetails.replaceAll('<br>',' / '))}">${ledgerIcon('wrench')}<span>${esc(t('ui.report.maintenance','維持費'))}${bill?.status==='unpaid'?`<small>（${esc(t('ui.report.unpaid','未払い'))}）</small>`:''}</span><b>−${ledgerMoneyText(maintenance)}</b></div><div class="morning-entry morning-net${net<0?' is-negative':''}">${ledgerIcon('balance')}<span>${esc(t('ui.report.net','収支'))}</span><b>${net>=0?'+':'−'}${ledgerMoneyText(Math.abs(net))}</b></div></div>`;

 const clerk=`<section class="report-clerk" aria-label="店員からの報告"><div class="report-clerk-speech">${[reportLedger+`<div class="morning-greeting">${salesSpeech}</div>`,voicesSpeech,returnSpeech,'<p>今日も一日がんばりましょう！</p><p>仕入れにいってきまーす！</p>'][reportPage]}<span class="speech-tail-join" aria-hidden="true"><svg viewBox="0 0 70 34"><path d="M25 1C28 13 19 25 0 33C31 27 49 13 70 1"/></svg></span></div><div class="report-clerk-art${reportPage===3?' report-clerk-farewell':''}"><div class="report-clerk-portrait"><img src="${shopkeeperImage(reportPage===3?'oh':'normal')}" alt="${reportPage===3?'仕入れに向かう店員':'報告する店員'}" onerror="this.hidden=true"><img class="report-clerk-talking" ${reportPage===3?'hidden':''} src="${shopkeeperImage('talking')}" alt="" onerror="this.hidden=true"></div></div></section>`;
 return title(['朝の営業報告','お客様の声','パーティ報告','今日も一日'][reportPage],`${reportPage+1} / 4`)+clerk+
 `<div class="bottom"><div class="actions">${reportPage?btn('前へ','sub--;page=0;render()','mini'):''}${btn(reportPage<3?'次のページ':review?'準備に戻る':'仕入れへ',reportPage<3?'sub++;page=0;render()':review?"go('home')":'advance()','primary')}</div>${steps()}</div>`;
}
function shelfOverview(){const capacity=config.development.shelfCapacity;return title('棚の中身')+card(row('棚の空き',`${Math.max(0,shelfCapacity()-shelf.length)} / ${shelfCapacity()} 点`))+Array.from({length:economyState.shelfCount},(_,index)=>{const items=shelf.filter(item=>item.shelfId===index);return card('<h2>棚 '+(index+1)+' · '+items.length+' / '+capacity+' 点</h2>'+(items.length?items.map(item=>row(esc(itemName(item)),money(saleValue(item)))).join(''):note('商品なし')))}).join('')+`<div class="bottom">${btn('仕入れへ戻る',"go('home')",'primary')}</div>`}
// Transient presentation state; never included in game saves.
const merchantExpressions=['normal','normal','normal'],merchantExpressionTimers=[null,null,null];
function merchantIconPath(index){return 'assets/merchants/warm/'+['weapon','armor','tool'][index]+'-'+merchantExpressions[index]+'.webp'}
function changePurchaseCount(index,delta){
 counts[index]=Math.max(0,counts[index]+delta);
 clearTimeout(merchantExpressionTimers[index]);
 merchantExpressions[index]=delta>0?'happy':'troubled';
 render();
 merchantExpressionTimers[index]=setTimeout(()=>{
  merchantExpressions[index]='normal';merchantExpressionTimers[index]=null;
  const img=document.querySelector('[data-merchant-icon="'+index+'"]');
  if(img){img.hidden=false;img.src=merchantIconPath(index)}
 },500);
}
function purchase(){
 const total=counts.reduce((sum,n,i)=>sum+n*merchantPrice(i),0);
 return title('今日の仕入れ')+`<div class="purchase-note">商人を選んで仕入れよう <small>1回 ${balanceRuntime.itemsPerPurchase}品</small></div><div class="merchant-cards">`+['武器商','防具商','道具商'].map((name,i)=>`<section class="card merchant-card"><img class="merchant-watermark" src="${esc(definitions[['one_hand_sword_01','shield_01','accessory_01'][i]].image)}" alt="" aria-hidden="true" draggable="false"><img class="merchant-portrait" data-merchant-icon="${i}" src="${merchantIconPath(i)}" alt="${name}" draggable="false"><div class="merchant"><div class="merchant-label"><div><h2>${name}</h2><small>1回 ${money(merchantPrice(i))}</small></div></div><div class="counter">${btn('−',`changePurchaseCount(${i},-1)`,'touch-target',name+'の仕入れを1回減らす')}<b>${counts[i]}</b>${btn('＋',`changePurchaseCount(${i},1)`,'touch-target',name+'の仕入れを1回増やす')}</div></div></section>`).join('')+`</div><div class="purchase-total">${row('合計 '+counts.reduce((a,n)=>a+n,0)*balanceRuntime.itemsPerPurchase+'品',money(total))}</div><div class="actions purchase-links">${btn('棚の空き '+Math.max(0,shelfCapacity()-shelf.length)+'点',"go('shelfOverview')",'mini')}${btn('村人からの寄付',"go('donation')",'mini')}</div><div class="bottom">${btn('仕入れる','finishPurchase()','primary touch-target')}${dayActions()}</div>`;
}
// 店舗の棚は8×8マスに2×2で配置する。
const SHOP_WIDTH=8,SHOP_HEIGHT=8,SHELF_SIDE=2;
let shopMoveShelf=false,shopDragSuppressClick=0,shopPanelOpen=false,shopInventoryTab=0,shopSelectedShelf=new Set(),shopSelectedStock=new Set();
function shopLayout(){return economyState.shelfLayout}
function shopShelfAt(x,y){return shopLayout().findIndex(p=>p&&x>=p.x&&x<p.x+SHELF_SIDE&&y>=p.y&&y<p.y+SHELF_SIDE)}
function shopCanPlace(index,x,y){
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x+SHELF_SIDE>SHOP_WIDTH||y+SHELF_SIDE>SHOP_HEIGHT)return false;
 return shopLayout().every((p,i)=>i===index||!p||x+SHELF_SIDE<=p.x||p.x+SHELF_SIDE<=x||y+SHELF_SIDE<=p.y||p.y+SHELF_SIDE<=y);
}
function shopPlaceAt(x,y){
 const hit=shopShelfAt(x,y);
 if(hit>=0&&!shopMoveShelf){selectedShelf=hit;shopPanelOpen=true;shopInventoryTab=0;shopSelectedShelf.clear();shopSelectedStock.clear();page=0;render();return}
 const index=shopMoveShelf?selectedShelf:shopLayout().findIndex(p=>p===null);
 if(index<0||index>=economyState.shelfCount)return;
 if(!shopCanPlace(index,x,y))return;
 shopLayout()[index]={x,y};selectedShelf=index;shopMoveShelf=false;render();
}

function startShopDrag(event,x,y){
 if(event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0))return;
 const index=shopShelfAt(x,y);if(index<0)return;
 const origin=shopLayout()[index],pointerId=event.pointerId;
 const offsetX=x-origin.x,offsetY=y-origin.y;
 const sx=event.clientX,sy=event.clientY;
 let active=false,done=false;
 const timer=setTimeout(()=>{if(!done)active=true},100);
 function cleanup(){done=true;clearTimeout(timer);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel)}
 function move(e){if(e.pointerId!==pointerId)return;if(!active&&Math.hypot(e.clientX-sx,e.clientY-sy)>8)cleanup();if(active)e.preventDefault()}
 function up(e){
  if(e.pointerId!==pointerId)return;
  const dragging=active;cleanup();if(!dragging)return;
  shopDragSuppressClick=Date.now()+500;
  const cell=document.elementFromPoint(e.clientX,e.clientY)?.closest('.shop-layout-grid .shop-cell');
  if(cell){
   const nx=Number(cell.dataset.shopX)-offsetX,ny=Number(cell.dataset.shopY)-offsetY;
   if(shopCanPlace(index,nx,ny))shopLayout()[index]={x:nx,y:ny};
  }
  selectedShelf=index;render();
 }
 function cancel(){if(active)shopDragSuppressClick=Date.now()+500;cleanup()}
 window.addEventListener('pointermove',move,{passive:false});
 window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);
}
function shopLayoutView(){
 const layout=shopLayout(),unplaced=layout.filter(p=>!p).length;
 const cells=Array.from({length:SHOP_WIDTH*SHOP_HEIGHT},(_,i)=>{
  const x=i%SHOP_WIDTH,y=Math.floor(i/SHOP_WIDTH),hit=shopShelfAt(x,y),position=layout[hit];
  const label=hit<0?'空きマス':`棚${hit+1}`;
  const origin=hit>=0&&position.x===x&&position.y===y;
  return `<button type="button" data-shop-x="${x}" data-shop-y="${y}" class="shop-cell ${hit>=0?'occupied':''} ${hit===selectedShelf?'chosen':''}" aria-label="${label} ${x+1}列${y+1}行" onpointerdown="startShopDrag(event,${x},${y})" onclick="if(Date.now()>shopDragSuppressClick)shopPlaceAt(${x},${y})">${origin?'棚'+(hit+1):''}</button>`;
 }).join('');
 return card(`<div class="row"><h2>店舗レイアウト</h2><small>8×8マス · 棚${layout.length-unplaced}/${economyState.shelfCount}</small></div><div class="shop-layout-grid">${cells}</div>`
 +note(unplaced?'空きマスをタップして棚を設置。長押しドラッグで移動できます。':'棚をタップして商品管理。長押しドラッグで移動できます。')
 +note('位置は自動保存されます。'));
}
function shopToggleSelection(source,id){
 const set=source==='shelf'?shopSelectedShelf:shopSelectedStock;
 if(set.has(id))set.delete(id);else set.add(id);
 render();
}
function shopBulkStock(){
 if(selectedShelf<0||selectedShelf>=economyState.shelfCount)return;
 const available=stock.filter(i=>shopSelectedStock.has(i.uid)&&!i.forged);
 const free=config.development.shelfCapacity-shelfItems().length;
 if(available.length>free)return info('補充できません','棚の空き容量が不足しています。');
 if(!available.length)return;
 const ids=new Set(available.map(i=>i.uid));
 stock=stock.filter(i=>!ids.has(i.uid));
 for(const item of available){item.shelfId=selectedShelf;shelf.push(item)}
 shopSelectedStock.clear();discoverShelfSets();render();
}
function shopBulkReturn(){
 const chosen=shelfItems().filter(i=>shopSelectedShelf.has(i.uid));
 if(!chosen.length)return;
 const positions=[],temporary=stock.slice();
 for(const item of chosen){
  const position=ItemCore.findSpace(item,temporary,types,warehouseSize);
  if(!position)return info('倉庫に入りません','選択した商品すべてを収納できる空きがありません。');
  positions.push({item,position});temporary.push({...item,...position});
 }
 const ids=new Set(chosen.map(i=>i.uid));
 shelf=shelf.filter(i=>!ids.has(i.uid));
 for(const {item,position} of positions){Object.assign(item,position);delete item.shelfId;stock.push(item)}
 shopSelectedShelf.clear();discoverShelfSets();render();
}
function shopProductInfo(uid,source){
 const item=(source==='shelf'?shelf:stock).find(i=>i.uid===uid);
 if(!item)return;
 const d=def(item),t=type(item);
 info(d.name,[d.description||'説明未設定','種類：'+t.label,'属性：'+catalog.elements[d.element],
 '販売価格：'+saleValue(item)+' G','基礎価格：'+(d.price==null?'未設定':d.price+' G'),
 '能力：'+(d.stats==null?'未設定':JSON.stringify(d.stats))].join('\n'));
}
function shopTransferItem(uid,source){
 if(source==='shelf'){
  const item=shelfItems().find(i=>i.uid===uid);if(!item)return;
  const position=ItemCore.findSpace(item,stock,types,warehouseSize);
  if(!position)return info('倉庫に入りません','倉庫に空きがありません。');
  shelf=shelf.filter(i=>i.uid!==uid);Object.assign(item,position);delete item.shelfId;stock.push(item);
 }else{
  if(selectedShelf<0||selectedShelf>=economyState.shelfCount)return;
  const item=stock.find(i=>i.uid===uid&&!i.forged);if(!item)return;
  if(shelfItems().length>=config.development.shelfCapacity)return info('補充できません','棚に空きがありません。');
  stock=stock.filter(i=>i.uid!==uid);item.shelfId=selectedShelf;shelf.push(item);
 }
 shopSelectedShelf.clear();shopSelectedStock.clear();discoverShelfSets();render();
}
function shopItemCard(item,source){
 const isShelf=source==='shelf',label=isShelf?'倉庫へ戻す':'棚に補充';
 return '<div class="shop-product-tile"><div class="shop-product-card">'+
 '<img class="shop-product-image" src="'+esc(def(item).image)+'" alt="" loading="lazy" draggable="false">'+
 '<span class="shop-product-name">'+esc(itemName(item))+'</span></div>'+
 '<button type="button" class="shop-product-detail" aria-label="'+esc(itemName(item))+'の情報" onclick="shopProductInfo('+item.uid+',&quot;'+source+'&quot;)">i</button>'+
 '<button type="button" class="shop-product-transfer" aria-label="'+esc(itemName(item))+'を'+label+'" onclick="shopTransferItem('+item.uid+',&quot;'+source+'&quot;)">'+(isShelf?'×':'＋')+'</button></div>';
}
function switchShopShelf(direction){const count=economyState.shelfCount;if(!count)return;selectedShelf=(selectedShelf+direction+count)%count;shopInventoryTab=0;shopSelectedShelf.clear();shopSelectedStock.clear();page=0;render()}
function stocking(){
 // 旧セーブの未配置棚も、レイアウト画面を経由せず補充可能にする。
 shopPanelOpen=true;
 selectedShelf=Math.max(0,Math.min(selectedShelf,economyState.shelfCount-1));
 const items=shelfItems(),capacity=config.development.shelfCapacity;
 const totalValue=items.reduce((sum,item)=>sum+saleValue(item),0);
 const stockItems=stock.filter(i=>!i.forged);
 const perPage=4,pages=Math.max(1,Math.ceil(stockItems.length/perPage));page=Math.max(0,Math.min(page,pages-1));
 const visibleStock=stockItems.slice(page*perPage,(page+1)*perPage);
 const pager=pages>1?'<div class="page">'+btn('‹','page=Math.max(0,page-1);render()','mini')+'<small>'+(page+1)+' / '+pages+'</small>'+btn('›','page=Math.min('+(pages-1)+',page+1);render()','mini')+'</div>':'';
 const details='<div class="shelf-toolbar">'+btn('‹','switchShopShelf(-1)','mini touch-target','前の棚へ')+'<div><b>棚 '+(selectedShelf+1)+' <small>'+items.length+' / '+capacity+'点</small></b><small>合計 '+money(totalValue)+'</small></div>'+btn('›','switchShopShelf(1)','mini touch-target','次の棚へ')+'</div>';
 const shelfSection='<div class="card shop-folder-content shop-shelf-section"><div class="row"><h2>棚の商品</h2><small>×で倉庫へ戻す</small></div>'+
 '<div class="shop-product-list">'+items.map(i=>shopItemCard(i,'shelf')).join('')+
 Array.from({length:Math.max(0,capacity-items.length)},()=>'<div class="shop-empty-slot" aria-label="空き枠">＋</div>').join('')+'</div>'+
 '</div>';
 const stockSection='<div class="card shop-folder-content shop-stock-section"><div class="row"><h2>倉庫から補充 ('+stockItems.length+')</h2><small>＋で棚に補充</small></div>'+
 (visibleStock.length?'<div class="shop-product-list">'+visibleStock.map(i=>shopItemCard(i,'stock')).join('')+'</div>':note('商品がありません。'))+
 pager+'</div>';
 return title('棚補充','04 / 06')+details+shelfSection+stockSection+next('探索へ');
}

const supplyTypes=[{name:'支給食料',price:100,effect:'生存力＋1'},{name:'防具整備具',price:150,effect:'防御力＋1'},{name:'冒険者の薬草',price:200,effect:'回復日数−1日'}];
let supplies=Array.from({length:3},()=>[0,0,0]);
const supplyCost=items=>items.reduce((sum,n,i)=>sum+n*supplyTypes[i].price,0);
function changeSupply(index,delta){
 if(partyAway(party))return;
 const next=[...supplies[party]];next[index]=Math.max(0,Math.min(3,next[index]+delta));
 if(supplyCost(next)>gold)return;
 supplies[party]=next;render();
}
let assistanceOpen=false;
function support(routine=false){
 const items=supplies[party],cost=supplyCost(items);
 const supplyPanel=card('<h2>第'+(party+1)+'パーティの遠征物資</h2>'+supplyTypes.map((item,i)=>
  '<div class="row"><span>'+item.name+' <small>'+item.price+'G · '+item.effect+' / 個</small></span><span class="actions">'+btn('−',`changeSupply(${i},-1)`,'mini touch-target')+' <b>'+items[i]+'</b> '+btn('＋',`changeSupply(${i},1)`,'mini touch-target')+'</span></div>'
 ).join('')+row('出発時の消費',money(cost))+note('各種最大3個。パーティ全員に遠征1回限りの効果。'));
 if(partyRosterOpen)return title('パーティ編成')+btn('‹ 探索画面へ戻る','partyRosterOpen=false;render()','mini')+partyFormation();
 if(assistanceOpen)return title('遠征の支援')+btn('‹ 目的地へ戻る','assistanceOpen=false;render()','mini')+btn('教会 · 治療','openResidentService(0)','mini touch-target')+supplyPanel;
 const partyMembers=parties[party].map(id=>characters.find(c=>c.id===id));
 const partyStrip=`<section class="expedition-party"><div><b>パーティ${party+1}</b><small>${partyAway(party)?'遠征中':'活動可能'}</small></div><div class="expedition-portraits">${partyMembers.map(c=>c?btn(characterArt(c)+`<small>${esc(characterName(c))}</small>`,`openCharacterEquipment('${c.id}')`):'<span>空き</span>').join('')}</div></section>`;
 const canDepart=parties[party].some(id=>id&&companionStatus(id)==='waiting')&&!partyAway(party)&&dungeonAvailable(config.dungeons.find(d=>d.id===selectedDungeon)||{chapter:-1,requires:[]});
 return title('遠征の目的地')+`<div class="actions">${btn('編成','partyRosterOpen=true;render()','mini')}${btn('支援・物資','assistanceOpen=true;render()','mini')}</div>`+partyStrip+destinationView()+`<div class="bottom">${routine?`<button class="primary" onclick="depart()" ${canDepart?'':'disabled'}>${partyAway(party)?'遠征中':'この目的地へ派遣'}</button>`:note('出発は経営の探索工程で行います。')}${routine?dayActions():''}</div>`;

}
function broker(){const rumors=tradingState.rumors.filter(r=>r.startDay<=day&&day<r.endDay);return title('情報屋')+card('<h2>お店の噂</h2>'+note(rumors.map(r=>esc(tradingConfig.rumors.find(d=>d.id===r.id)?.name||r.id)+' · あと'+(r.endDay-day)+'日').join(' ／ ')||'現在の噂はありません。'))}
function records(){return title('記録')+card(`<h2>経営帳簿</h2><p>日別の収支とダンジョン攻略履歴を確認します。</p><br>${btn('帳簿を開く',"go('journal')",'primary')}`)+card(`<h2>図鑑</h2><p>発見した商品・セット装備・人物を確認します。</p><br>${btn('図鑑を開く','openEncyclopedia()','primary')}`)}
let ledgerHistory=[];
function ledgerDay(n=day){let entry=ledgerHistory.find(e=>e.day===n);if(!entry){entry={day:n,sales:0,purchases:0,funding:0,expenses:0,otherIncome:0,expeditions:[]};ledgerHistory.push(entry);ledgerHistory.sort((a,b)=>a.day-b.day)}return entry}
function ledgerMoney(kind,amount,n=day){if(amount>0)ledgerDay(n)[kind]+=amount}
function ledgerExpedition(dungeonId,partyId,gain,total,members=[]){ledgerDay().expeditions.push({dungeonId,party:partyId,gain,total,members:[...members]})}
function journal(){const entries=ledgerHistory.slice().sort((a,b)=>b.day-a.day),size=1,total=Math.max(1,entries.length);page=Math.min(page,total-1);const e=entries[page];if(!e)return title('経営帳簿')+card(note('まだ経営・攻略の記録はありません。'))+`<div class="bottom">${btn('記録に戻る',`go('records')`)}</div>`;const income=e.sales+e.otherIncome,out=e.purchases+e.funding+e.expenses,balance=income-out;const format=n=>(n>=0?'＋':'−')+money(Math.abs(n));const expeditionHtml=e.expeditions.length?e.expeditions.map(x=>{const d=config.dungeons.find(d=>d.id===x.dungeonId);return row(esc(d?.name||x.dungeonId)+' · '+esc(x.members?.length?x.members.map(id=>characters.find(c=>c.id===id)?.name||id).join('・'):'第'+(x.party+1)+'パーティ'),`＋${x.gain}%（累計 ${x.total}%）`)}).join(''):note('この日の攻略記録はありません。');const recent=entries.slice(0,7).reverse(),maxSales=Math.max(1,...recent.map(x=>x.sales)),trend=card('<h2>直近7日間の売上</h2><div style="display:flex;align-items:end;gap:6px;height:74px">'+recent.map(x=>'<div title="春'+x.day+'日 '+x.sales+'G" style="flex:1;min-width:0;text-align:center;font-size:10px"><div style="height:'+Math.max(2,Math.round(x.sales/maxSales*45))+'px;background:var(--accent);border-radius:3px 3px 0 0"></div>'+x.day+'日</div>').join('')+'</div>');return title('経営帳簿')+`<div class="page">${btn('‹','page=Math.min(page+1,ledgerHistory.length-1);render()','mini')}<b>${gameDate(e.day)}</b>${btn('›','page=Math.max(0,page-1);render()','mini')}</div>`+card('<h2>収支</h2>'+row('売上',money(e.sales))+row('その他収入',money(e.otherIncome))+row('仕入れ', '−'+money(e.purchases))+row('支度金','−'+money(e.funding))+row('その他支出','−'+money(e.expenses))+row('収支合計',format(balance)))+card('<h2>ダンジョン攻略</h2>'+expeditionHtml)+`<div class="bottom">${btn('記録に戻る',`go('records')`)}</div>`}

function renderBase(){ renderHeader();$('#nav').innerHTML=renderNavigation();$('#view').dataset.screen=screen;$('#view').dataset.phase=phase;$('#view').dataset.formation=String(partyRosterOpen);$('#view').innerHTML=({home,villageClear:villageClearView,chapterArrival,dailyReport,broker,shelfOverview,trade,tradingReport:tradingReportView,equipment:equipmentView,catalog:catalogView,encyclopedia:encyclopediaView,donation:donationView,warehouse:()=>warehouse(false),adventurers:()=>support(false),residents,records,journal,settings}[screen]||home)();translateVisibleText();}

// JSON-driven item definitions and current game screens.
let balanceRuntime={...Balance.runtimeDefaults};
let warehouseSize;
let catalog,config,definitions={},types={},uid=0,catalogFilter='',catalogQuery='',catalogSlot='',catalogItemId=null,catalogDetail=false,catalogOrigin='warehouse';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function def(instance){return definitions[instance.itemId]}
function type(instance){return types[def(instance).typeId]}
function fitsWarehouse(definition){return ItemCore.fitsBoard({typeId:definition.typeId},types,warehouseSize)}
function newItem(id){EncyclopediaCore.acquire(encyclopedia,id);const maxDurability=EquipmentCore.roll();return{uid:++uid,itemId:id,typeId:definitions[id].typeId,x:null,y:null,rotation:0,...(types[definitions[id].typeId].slot?{durability:maxDurability,maxDurability,forged:false,forgeType:null}:{})}}
function itemName(instance){return def(instance).name}
function itemMeta(instance){const d=def(instance),t=type(instance);return `${t.label} · ${t.width?`${t.width}×${t.height}`:'寸法未設定'} · ${catalog.elements[d.element]} · 販売 ${saleValue(instance)} G${t.slot?` · 耐久 ${instance.durability}/${instance.maxDurability}${instance.forged?' · 鍛冶済み':''}`:''}` }
function shape(d){return `<span class="item-art"><img src="${esc(d.image)}" alt="" draggable="false"></span>`}
function warehouseArtwork(item){const d=ItemCore.dimensions(item,types),board={width:8,height:8},rotated=item.rotation%2;return `<span class="warehouse-art ${stock[selected]===item?'is-selected':''}" style="left:${item.x/board.width*100}%;top:${item.y/board.height*100}%;width:${d.width/board.width*100}%;height:${d.height/board.height*100}%"><img src="${esc(def(item).image)}" alt="" draggable="false" style="width:${rotated?d.height/d.width*100:100}%;height:${rotated?d.width/d.height*100:100}%;transform:translate(-50%,-50%) rotate(${rotated?90:0}deg)"></span>`}


function storeItem(instance){const position=ItemCore.findSpace(instance,stock,types,warehouseSize);if(!position)return false;Object.assign(instance,position);stock.push(instance);return true}
function reset(persistReset=true){selectedCompanion=null;groupedReturnReport=[];salesShown=0;salesDay=0;if(salesTimer){clearTimeout(salesTimer);salesTimer=null}ledgerHistory=[];shopPanelOpen=false;warehouseSize={...config.warehouse};cancelEquipmentDrag();equipmentSelectedUid=null;selectedShelf=0;tradingState={rumors:[],report:null};resetRescue();resetEconomy();if(persistReset)saveReady=true;dungeonProgress={};selectedDungeon=config.dungeons[0].id;equipment={};autoEquip={};brokenTargets={};expeditions=[];returnReport=[];lastSales=0;equipCharacter=null;equipmentOrigin=null;characterPanel="equipment";equipmentSlot="weapon";equipPage=0;day=1;phase=0;gold=config.development.initialGold;counts=[0,0,0];pending=[];stock=[];shelf=[];funds=[0,0,0];supplies=Array.from({length:3},()=>[0,0,0]);party=0;partySlot=0;rosterPage=0;chapter=0;availableCharacterIds=characters.filter(c=>c.joinChapter===chapter).map(c=>c.id);parties=[availableCharacterIds.slice(0,3),[],[]];away=false;selected=0;page=0;uid=0;encyclopedia=EncyclopediaCore.create();encyclopediaSelection=null;for(const id of config.development.initialItemIds){if(!fitsWarehouse(definitions[id]))continue;const item={...newItem(id),durability:5,maxDurability:5};if(!storeItem(item))pending.push(item)}go('home')};
function itemList(items,fn){const size=pending.length?Math.min(2,config.ui.pageSize):config.ui.pageSize;page=Math.min(page,Math.max(0,Math.ceil(items.length/size)-1));return `<div class="list">${items.slice(page*size,page*size+size).map((item,i)=>`<button class="item ${selected===page*size+i?'active':''}" onclick="${fn.replaceAll('INDEX',page*size+i)}"><span><b>${esc(itemName(item))}</b><small class="block">${esc(itemMeta(item))}</small></span><span class="item-mini">${shape(def(item))}</span></button>`).join('')||note('商品はありません')}</div>`+pager(items.length,size)};
function pager(length,size){const pages=Math.max(1,Math.ceil(length/size));return `<div class="page"><button class="mini" ${page===0?'disabled':''} onclick="page--;render()">‹</button><small>${page+1} / ${pages} ページ · ${length}件</small><button class="mini" ${page===pages-1?'disabled':''} onclick="page++;render()">›</button></div>`}
function openCatalog(origin){catalogOrigin=origin;catalogDetail=false;page=0;screen='catalog';render()}
function filteredItems(){return catalog.items.filter(d=>(!catalogSlot||types[d.typeId].slot===catalogSlot)&&(!catalogFilter||d.typeId===catalogFilter)&&(!catalogQuery||d.name.includes(catalogQuery)))}
function catalogView(){if(catalogDetail)return catalogItemView();const items=filteredItems();return title('アイテム設定一覧',`${catalog.items.length}種類`)+`<div class="catalog-filters"><select aria-label="装備枠" onchange="catalogSlot=this.value;catalogFilter='';page=0;render()"><option value="">すべての枠</option>${Object.entries(catalog.slots).map(([id,name])=>`<option value="${id}" ${catalogSlot===id?'selected':''}>${name}</option>`).join('')}</select><select aria-label="装備種類" onchange="catalogFilter=this.value;page=0;render()"><option value="">すべての種類</option>${catalog.types.filter(t=>!catalogSlot||t.slot===catalogSlot).map(t=>`<option value="${t.id}" ${catalogFilter===t.id?'selected':''}>${esc(t.label)}</option>`).join('')}</select></div><form class="actions" onsubmit="event.preventDefault();catalogQuery=this.elements.query.value.trim();page=0;render()"><input name="query" aria-label="アイテム名検索" placeholder="アイテム名を検索" value="${esc(catalogQuery)}"><button class="mini">検索</button></form><div class="catalog-list">${items.slice(page*config.ui.pageSize,(page+1)*config.ui.pageSize).map(d=>`<button class="item" onclick="catalogItemId='${d.id}';catalogDetail=true;render()"><span><b>${esc(d.name)}</b><small class="block">${esc(types[d.typeId].label)} · ${catalog.elements[d.element]} · ${d.price==null?'価格未設定':d.price+' G'}</small><small class="block">${esc(d.description||'説明未設定')}</small></span>${shape(d)}</button>`).join('')||note('一致するアイテムはありません')}</div>${pager(items.length,config.ui.pageSize)}<div class="bottom">${note('正式価格・能力は未設定。装備の耐久度は個体ごとに管理。')}${btn('戻る',`go('${catalogOrigin}')`)}</div>`}
function catalogItemView(){const d=definitions[catalogItemId],t=types[d.typeId];return title('アイテム詳細','登録済み')+card(`<div class="row"><div><h2>${esc(d.name)}</h2><small>${esc(t.label)}</small></div>${shape(d)}</div><div class="ledger">${row('装備枠',t.slot?catalog.slots[t.slot]:'装備不可')}${row('寸法（横×縦）',t.width?`${t.width} × ${t.height}`:'未設定')}${row('形状の指定',esc(t.shapeLabel||'未設定'))}${row('属性',catalog.elements[d.element])}${row('価格',d.price===null?'未設定':esc(d.price)+' G')+row('商品説明',esc(d.description||'未設定'))}${row('能力',d.stats===null?'未設定':esc(JSON.stringify(d.stats)))}${row('耐久',t.slot?'基準5（仕入れ時3〜7）':'装備対象外')}</div>`)+(d.effect?card(`<h2>素材の用途</h2><p>${catalog.elements[d.effect.element]}属性付与</p>${note('付与量・費用・対象・消費ルールは未設定。')}`):'')+note('ID: '+d.id)+`<div class="bottom">${btn('一覧へ戻る','catalogDetail=false;render()','primary')}</div>`}
let warehouseShowStock=false;
function showIncomingWarehouseItem(){warehouseShowStock=false;render()}
function warehouseCell(x,y){const hit=stock.find(item=>{const d=ItemCore.dimensions(item,types);return d&&x>=item.x&&x<item.x+d.width&&y>=item.y&&y<item.y+d.height});if(hit){const index=stock.indexOf(hit);if(selected===index){warehouseShowStock=true;rotateSelected();render();return}selected=index;warehouseShowStock=true;render();return}const item=stock[selected];if(!item)return;const position=ItemCore.findNearby(item,x,y,item.rotation,stock,types,warehouseSize);if(!position)return;Object.assign(item,position);render()}
function rotateSelected(){const item=stock[selected];if(!item)return;const rotation=(item.rotation+1)%2;const position=ItemCore.findNearby(item,item.x,item.y,rotation,stock,types,warehouseSize,true);if(!position)return;Object.assign(item,position);render()}
function warehouseUsed(){return stock.reduce((sum,item)=>{const d=ItemCore.dimensions(item,types);return sum+d.width*d.height},0)}
function warehouseSummary(){return `${warehouseSize.width}×${warehouseSize.height} · ${warehouseUsed()}/${warehouseSize.width*warehouseSize.height}マス`}
function warehouseItemStats(item){const stats=def(item).stats;if(!stats||typeof stats!=='object')return '能力値：未設定';const labels={attack:'攻撃',defense:'防御',hp:'生存力'};const values=Object.entries(stats).filter(([key,value])=>Object.hasOwn(labels,key)&&typeof value==='number').map(([key,value])=>`${labels[key]}${value>=0?'＋':''}${value}`);return values.length?values.join(' ／ '):'能力値：未設定'}
function warehouseWorkspace(routine=false){selected=Math.min(selected,Math.max(0,stock.length-1));const item=stock[selected],board={width:8,height:8};let grid=`<div class="grid real-board" style="grid-template-columns:repeat(${board.width},1fr);--board-rows:${board.height}">`;for(let y=0;y<board.height;y++)for(let x=0;x<board.width;x++){const locked=x>=warehouseSize.width||y>=warehouseSize.height;const index=locked?-1:stock.findIndex(i=>{const d=ItemCore.dimensions(i,types);return x>=i.x&&x<i.x+d.width&&y>=i.y&&y<i.y+d.height});grid+=`<button class="${locked?'warehouse-locked ':''}${index>=0?'filled':''} ${index===selected?'selected':''}" data-x="${x}" data-y="${y}" ${locked?'disabled':`onclick="warehouseCell(${x},${y})"`} aria-label="${locked?'未開放':`${x+1}列${y+1}行 ${index>=0?esc(itemName(stock[index])):'空き'}`}"></button>`}grid+=stock.map(warehouseArtwork).join('')+'</div>';return title('倉庫整理',pending.length?'入荷 '+pending.length+'品':'在庫 '+stock.length+'点')+warehouseItemPanel()+`<div class="warehouse-board-area"><div class="warehouse-pagination" aria-label="倉庫ページ"><button type="button" disabled aria-label="前の倉庫ページ">‹</button><span>1 / 1</span><button type="button" disabled aria-label="次の倉庫ページ">›</button></div>`+grid+`</div><div class="warehouse-footer">${btn('大工 · 倉庫拡張','openResidentService(1)','mini touch-target')}`+(routine?next(phase===2?'陳列へ':'経営の次の工程へ'):(pending.length?`<div class="bottom">${btn('取引へ戻る',`go('trade')`,'primary')}</div>`:''))+`</div>`};
function finishPurchase(){if(GameEffects.active)return;if(counts.some(n=>n>0))buy();else goStage(2)}
function buy(){if(pending.length){phase=2;go('trade');return}const total=counts.reduce((a,n,i)=>a+n*merchantPrice(i),0);if(!counts.some(n=>n>0))return info('回数を選択','商人の＋で回数を選んでください。');if(total>gold)return info('所持金不足','仕入れ回数を減らしてください。');const pools=[['weapon'],['offhand','head','body'],['accessory']].map(slots=>catalog.items.filter(d=>d.status==='active'&&Number.isInteger(d.unlockChapter)&&d.unlockChapter<=chapter&&slots.includes(types[d.typeId].slot)&&fitsWarehouse(d)));if(counts.some((n,i)=>n>0&&!pools[i].length))return info('仕入れできません','現在の倉庫サイズに合う商品がありません。');pending=counts.flatMap((n,i)=>Array.from({length:n*balanceRuntime.itemsPerPurchase},()=>newItem(pools[i][Math.floor(Math.random()*pools[i].length)].id)));warehouseShowStock=false;gold-=total;ledgerMoney('purchases',total);const merchants=counts.flatMap((n,i)=>n>0?[i]:[]);counts=[0,0,0];phase=2;go('trade');GameEffects.play('purchase',{merchants,items:pending.map(item=>({name:itemName(item),image:def(item).image}))})};
function receive(){if(!pending.length)return;if(!storeItem(pending[0]))return;selected=stock.length-1;pending.shift();warehouseShowStock=false;render()}
function replenish(){if(selectedShelf<0||selectedShelf>=economyState.shelfCount)return;if(!stock.length||shelfItems().length>=config.development.shelfCapacity)return info('補充できません','在庫と棚の空きを確認してください。');if(stock[selected]?.forged)return info('陳列できません','鍛冶済み装備は手動装備または破棄してください。');if(!stock[selected])return;const item=stock.splice(selected,1)[0];item.shelfId=selectedShelf;shelf.push(item);selected=0;page=0;discoverShelfSets();render()};
function returnShelf(){const item=shelfItems().at(-1);if(!item)return;if(!storeItem(item))return info('倉庫に入りません','倉庫を整理してください。');shelf.splice(shelf.indexOf(item),1);delete item.shelfId;render()}
let salesShown=0,salesTimer=null,salesDay=0;
const customerIcons={villager:'🧑',warrior:'⚔️',archer:'🏹',mage:'🧙',priest:'⛪',rogue:'🥷',traveler:'🎒'};
function sales(){
 if(tradingState.report?.day!==day)resolveTradingDay();
 const visits=tradingState.report.visits;
 if(salesDay!==day){salesDay=day;salesShown=0}
 if(salesShown<visits.length&&!salesTimer){
  salesTimer=setTimeout(()=>{salesTimer=null;if(phase!==5||screen!=='home')return;salesShown++;page=Math.floor(Math.max(0,salesShown-1)/2);render()},850);
 }
 const shown=visits.slice(0,salesShown);
 const latest=shown.at(-1),guest=latest&&tradingConfig.customers.find(c=>c.id===latest.customerId);
 const historySize=2,historyPages=Math.max(1,Math.ceil(shown.length/historySize));page=Math.min(page,historyPages-1);
 const lines=shown.slice(page*historySize,(page+1)*historySize).map((visit,index)=>{
  const customer=tradingConfig.customers.find(c=>c.id===visit.customerId);
  const purchased=visit.itemIds.length>0;
  const speech=purchased?'いい買い物ができた！':'今日は見送ろうかな';
  const products=purchased?visit.itemIds.map(id=>esc(definitions[id].name)).join(' ＋ '):'購入なし';
  return '<div class="sales-visit'+(index===shown.length-1?' sales-visit-enter':'')+'"><span class="sales-character" aria-hidden="true">'+(customer?.image?'<img src="'+esc(customer.image)+'" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>'+(customerIcons[visit.customerId]||'🧑')+'</span>':(customerIcons[visit.customerId]||'🧑'))+'</span><div class="sales-visit-text"><b>'+esc(customer?.name||visit.customerId)+'</b><small>「'+speech+'」</small><span>'+products+'</span></div><b class="sales-price">'+money(visit.price)+'</b></div>';
 }).join('');
 const finished=salesShown>=visits.length;
 return title('本日の営業','06 / 06')+
 `<div class="sales-scene"><div class="sales-bubble">${latest?(latest.itemIds.length?'いい買い物ができた！':'今日は見送ろうかな'):'いらっしゃいませ！'}</div>${guest?.image?`<img src="${esc(guest.image)}" alt="${esc(guest.name)}">`:''}</div>`+card(row('来店',salesShown+' / '+visits.length+' 人')+row('本日の売上',money(shown.reduce((sum,v)=>sum+v.price,0))))+
 '<div class="sales-visits" aria-live="polite">'+(lines||note('お客さんを待っています…'))+'</div>'+ (historyPages>1?pager(shown.length,historySize):'')+
 (finished?`<div class="bottom">${btn('営業終了 · 翌日へ','finishDay()','primary')}</div>`:note('接客中…'));
}

function downloadConfig(kind){const data=kind==='items'?catalog:config;const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=kind==='items'?'item-catalog.json':'game-settings.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
let settingsTab=0;
function settings(){
 const tabs=`<div class="tabs">${['表示','セーブ','設定データ'].map((label,i)=>btn(label,`settingsTab=${i};render()`,settingsTab===i?'active':'')).join('')}</div>`;
 const panels=[
 card(`<h2>${t('ui.language','言語')}</h2><div class="actions">${btn('日本語',"changeLanguage('ja')",language==='ja'?'active':'')}${btn('English',"changeLanguage('en')",language==='en'?'active':'')}</div>`)+card(`<h2>表示スキン</h2><div class="actions">${[['','標準'],['paper','紙'],['night','夜']].map(([id,label])=>btn(label,`document.documentElement.dataset.skin='${id}';render()`)).join('')}</div>`),
 card(`<h2>進行データ</h2><p>今の進行をファイルに保存・復元します。</p><div class="actions">${btn('JSON書き出し','exportGame()')}${btn('JSON読み込み',"document.querySelector('#saveInput').click()")}</div><input id="saveInput" type="file" accept="application/json,.json" hidden onchange="importGame(this.files[0])">${note(catalogMigrationNotice||saveError||'操作ごとにこのブラウザへ自動保存します。')}`),
 card(`<h2>アイテム設定 · ${catalog.items.length}種類</h2>${btn('設定されたアイテムを確認',"openCatalog('settings')")}${note('JSONを編集して再読み込みすると反映されます。')}`)+card(`<h2>設定JSONの書き出し</h2><div class="actions">${btn('アイテム定義',"downloadConfig('items')")}${btn('確認用設定',"downloadConfig('settings')")}</div>`)+note('正式価格・能力は未設定。耐久度は個体ごとに管理。')
 ];
 return title(t('nav.settings','設定'))+tabs+panels[settingsTab]+`<div class="bottom">${btn('経営に戻る',"go('home')",'primary')}</div>`;
}

function render(){
 rescueUnpaidBill();
 const clearReady=villageCompletion().ready;
 if(clearReady&&screen!=='villageClear'){screen='villageClear';sub=0;page=0;selectedCompanion=null}
 else if(!clearReady&&screen==='villageClear'){screen='home';sub=0}
 const transitioning=screen==='villageClear'||screen==='chapterArrival';
 $('.shell').classList.toggle('chapter-transition',transitioning);
 if(transitioning){$('#nav').classList.remove('is-open');$('#menuToggle').setAttribute('aria-expanded','false')}
 renderBase();if(phase===5&&screen==='home'){const list=$('.sales-visits');if(list)list.scrollTop=list.scrollHeight}persist()
}
async function loadItemSettings(){try{const responses=await Promise.all(['data/item-catalog.json','data/game-settings.json','data/encyclopedia.json','data/characters.json','data/economy.json','data/trading.json','data/locales/ja.json','data/locales/en.json'].map(path=>fetch(path,{cache:'no-store'})));if(responses.some(r=>!r.ok))throw Error('設定ファイルが読み込めません');[catalog,config,encyclopediaDefinitions,characters,economyConfig,tradingConfig,translations.ja,translations.en]=await Promise.all(responses.map(r=>r.json()));initializeBalance();ItemCore.validate(catalog,config);validateEconomyConfig(economyConfig);validateRescueConfig();validateDungeonConfig();validateAdventurerConfig();validateWarehouseConfig();types=Object.fromEntries(catalog.types.map(t=>[t.id,t]));definitions=Object.fromEntries(catalog.items.map(d=>[d.id,d]));validateTradingConfig();prices.splice(0,prices.length,...config.development.merchantCosts);const saved=readStoredGame();saveReady=false;reset(false);if(saved){try{applySave(saved);saveReady=true;go('home')}catch(error){info('保存データを読み込めません',error.message)}}else{saveReady=!saveError;persist()}}catch(error){$('#view').innerHTML=title('設定の読み込みエラー')+note(esc(error.message))+note('HTTPプレビューから開いてください。JSONを修正した場合は構文とIDを確認してください。')+btn('再読み込み','location.reload()')}}

// Procurement results and warehouse organisation share one workspace.
function warehouseItemPanel(){
 const incoming=pending.length&&!warehouseShowStock,item=incoming?pending[0]:stock[selected];
 const header=pending.length?`<div class="row"><h2>商品情報</h2><small>仕入れ結果 · 残り${pending.length}品</small></div>`:'<h2>商品情報</h2>';
 const choose=pending.length&&warehouseShowStock?btn('未収納の商品を見る','showIncomingWarehouseItem()','mini'):'';
 const info=item?`<div class="row"><div><b ${incoming?'class="incoming-draggable" data-drag-incoming="true" title="倉庫へドラッグ"':''}>${incoming?'↕ ':''}${esc(itemName(item))}</b><small class="block">${incoming?esc(itemMeta(item))+' ／ ':''}${esc(warehouseItemStats(item))}</small></div>${incoming?'':btn('↻ 回転','rotateSelected()','mini')}</div>`:note('商品がありません');
 const actions=incoming?(()=>{const canStore=!!ItemCore.findSpace(item,stock,types,warehouseSize);return `<div class="actions">${btn(canStore?'収納':'収納不可','receive()','primary mini').replace('<button ',canStore?'<button ':'<button disabled ')}${btn('引取 '+money(buybackValue(item)),'buybackIncoming()','mini')}</div>`})():item?`<div class="actions">${btn('商人へ引取 '+money(buybackValue(item)),"confirmStockAction('buyback')",'mini')}${btn('破棄',"confirmStockAction('discard')",'mini')}</div>`:'';
 return `<section class="card warehouse-item-panel">${header}${choose}${info}${actions}</section>`;
}
function combinedWarehouse(routine=true){return warehouseWorkspace(routine)}
function trade(){return stageNavigation()+combinedWarehouse(true)};
function warehouse(routine=false){return (pending.length||routine&&phase===2)?combinedWarehouse(true):warehouseWorkspace(routine)};

// Pointer-based drag and drop supports touch and mouse with the same rules.
(function installWarehouseDrag(){
 const root=document.querySelector('#view');
 let drag=null,suppressClickUntil=0;
 function clearPreview(){root.querySelectorAll('.drop-preview').forEach(cell=>cell.classList.remove('drop-preview'));}
 function cleanup(){if(!drag)return;const pointer=drag.pointerId;clearTimeout(drag.holdTimer);drag.ghost?.remove();drag.preview?.remove();drag.sourceArt?.classList.remove('drag-source');clearPreview();drag=null;root.classList.remove('dragging');if(root.hasPointerCapture?.(pointer))root.releasePointerCapture(pointer);}
 function targetAt(event){
  const board=root.querySelector('.real-board');if(!board)return null;
  const bounds=board.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>=bounds.right||event.clientY<bounds.top||event.clientY>=bounds.bottom)return null;
  const cells=board.querySelectorAll('button'),first=cells[0].getBoundingClientRect();
  const stepX=cells[1].getBoundingClientRect().left-first.left;
  const stepY=cells[8].getBoundingClientRect().top-first.top;
  const x=Math.floor((event.clientX-first.left)/stepX)-drag.offsetX;
  const y=Math.floor((event.clientY-first.top)/stepY)-drag.offsetY;
  return ItemCore.findNearby(drag.item,x,y,drag.item.rotation,stock,types,warehouseSize);
 }
 function update(event){
  clearPreview();drag.position=targetAt(event);
  const board=root.querySelector('.real-board');
  if(!drag.preview||!board)return;
  drag.preview.hidden=!drag.position;
  if(!drag.position)return;
  const d=ItemCore.dimensions(drag.item,types),p=drag.position;
  Object.assign(drag.preview.style,{left:p.x/8*100+'%',top:p.y/8*100+'%',width:d.width/8*100+'%',height:d.height/8*100+'%'});
 }

 root.addEventListener('pointerdown',event=>{
  if(event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0)||drag)return;
  const incoming=event.target.closest('[data-drag-incoming]');
  const cell=event.target.closest('.real-board button');
  if(!incoming&&!cell)return;
  let item,offsetX=0,offsetY=0;
  if(incoming)item=pending[0];
  else{const x=Number(cell.dataset.x),y=Number(cell.dataset.y);item=stock.find(i=>{const d=ItemCore.dimensions(i,types);return x>=i.x&&x<i.x+d.width&&y>=i.y&&y<i.y+d.height});if(item){offsetX=x-item.x;offsetY=y-item.y;}}
  if(!item)return;
  drag={item,incoming:Boolean(incoming),pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,offsetX,offsetY,active:false,position:null,preview:null,holdTimer:null,lastPoint:{clientX:event.clientX,clientY:event.clientY}};
  drag.holdTimer=setTimeout(()=>{if(!drag)return;drag.active=true;root.setPointerCapture?.(drag.pointerId);root.classList.add('dragging');const board=root.querySelector('.real-board');if(!board){cleanup();return;}
  drag.preview=document.createElement('span');drag.preview.className='warehouse-drag-preview';
  const d=ItemCore.dimensions(drag.item,types),rotated=drag.item.rotation%2;
  const img=document.createElement('img');img.src=def(drag.item).image;img.alt='';img.draggable=false;
  Object.assign(img.style,{width:(rotated?d.height/d.width*100:100)+'%',height:(rotated?d.width/d.height*100:100)+'%',transform:'translate(-50%,-50%) rotate('+(rotated?90:0)+'deg)'});
  drag.preview.append(img);board.append(drag.preview);
  if(!drag.incoming){const art=[...board.querySelectorAll('.warehouse-art')].find(el=>el.style.left===drag.item.x/8*100+'%'&&el.style.top===drag.item.y/8*100+'%');if(art){drag.sourceArt=art;art.classList.add('drag-source');}}
  update(drag.lastPoint);},100);
 });
 root.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.pointerId)return;
  drag.lastPoint={clientX:event.clientX,clientY:event.clientY};
  // Small finger movement during the 100ms hold must not cancel the gesture.
  if(!drag.active)return;
  event.preventDefault();update(event);
 });
 root.addEventListener('pointerup',event=>{
  if(!drag||event.pointerId!==drag.pointerId)return;
  if(!drag.active){cleanup();return;}
  event.preventDefault();update(event);
  const {item,position,incoming}=drag;suppressClickUntil=Date.now()+400;
  cleanup();
  if(position){Object.assign(item,position);if(incoming){if(pending[0]!==item)return;pending.shift();stock.push(item);}selected=stock.indexOf(item);}
  if(!incoming){selected=stock.indexOf(item);warehouseShowStock=true;}
  render();
 });
 root.addEventListener('click',event=>{if(Date.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
 root.addEventListener('pointercancel',()=>{if(drag?.active)suppressClickUntil=Date.now()+400;cleanup();});
 // Touch browsers initially capture on the touched cell. Transferring capture
 // to the workspace emits a bubbling loss from that cell; it is not cancellation.
 root.addEventListener('lostpointercapture',event=>{if(event.target===root&&drag&&event.pointerId===drag.pointerId)cleanup();});
 root.addEventListener('contextmenu',event=>{if(event.target.closest('.real-board,[data-drag-incoming]'))event.preventDefault();});
 root.addEventListener('dragstart',event=>{if(event.target.closest('.real-board,[data-drag-incoming]'))event.preventDefault();});
 window.addEventListener('blur',cleanup);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&drag){suppressClickUntil=Date.now()+400;cleanup();}});
})();

loadItemSettings();

function initializeBalance(){
 if(typeof Balance==='undefined')return;
 const registry=Balance.create({game:config,economy:economyConfig,trading:tradingConfig});
 if(!Balance.enabled(window.location||{}))return;
 function apply(){
  let values;try{values=Balance.read(localStorage,registry)}catch(error){console.warn('開発用調整値を無視:',error.message);values=registry.defaults}
  config=values.game;economyConfig=values.economy;tradingConfig=values.trading;balanceRuntime=values.runtime;
  prices.splice(0,prices.length,...config.development.merchantCosts);
 }
 apply();window.addEventListener('storage',event=>{if(event.key===Balance.key||event.key===null){apply();document.title='Shop Game · 開発調整反映済み';}});
 document.title='Shop Game · 開発調整モード';
}
