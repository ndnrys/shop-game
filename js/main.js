
const $=s=>document.querySelector(s);const phases=['報告','仕入れ','倉庫整理','陳列','支援','営業'];const navs=[['home','⌂','経営'],['warehouse','▦','倉庫'],['residents','♧','住人'],['adventurers','♙','冒険者'],['records','≡','記録'],['settings','⚙','設定']];
let day=2,phase=0,screen='home',gold=0,counts=[0,0,0],pending=[],stock=[],shelf=[],selected=0,page=0,sub=0,party=0,funds=[0,0,0],away=false;const prices=[];let characters=[];const villageCharacters=()=>characters.filter(c=>c.joinChapter===0);
let chapter=0,availableCharacterIds=[],parties=[[],[],[]],partySlot=0,rosterPage=0;
const availableCharacters=()=>characters.filter(c=>availableCharacterIds.includes(c.id));
const partyNumber=id=>parties.findIndex(members=>members.includes(id))+1;
function switchParty(index){party=index;partySlot=0;render()}
const canAssignCharacter=id=>!isAway(id)&&!partyAway(party)&&availableCharacterIds.includes(id)&&(!partyNumber(id)||partyNumber(id)===party+1);
function assignCharacter(id,slot=partySlot){if(isAway(id)||partyAway(party)||!canAssignCharacter(id)||!Number.isInteger(slot)||slot<0||slot>2)return;partySlot=slot;for(const members of parties)for(let i=0;i<3;i++)if(members[i]===id)members[i]=null;parties[party][partySlot]=id;render()}
function removeCharacterFromParty(id){if(!canAssignCharacter(id)||partyNumber(id)!==party+1)return;parties[party]=parties[party].map(member=>member===id?null:member);render()}
let partySuppressClick=0;
function startPartyDrag(event,id){
 if(!canAssignCharacter(id)||event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0))return;
 const pointerId=event.pointerId,originParty=party,originScreen=screen,startX=event.clientX,startY=event.clientY;
 let active=false,ghost=null,target=null;
 function clearTarget(){target?.classList.remove('party-drop-target');target=null}
 function move(e){
  if(e.pointerId!==pointerId)return;
  if(party!==originParty||screen!==originScreen){cancel();return}
  if(!active&&Math.hypot(e.clientX-startX,e.clientY-startY)<6)return;
  if(!active){active=true;ghost=document.createElement('div');ghost.className='drag-ghost';ghost.textContent=characters.find(c=>c.id===id).name;document.body.append(ghost)}
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
function partyFormation(){
 const members=parties[party],all=availableCharacters(),size=3,total=Math.max(1,Math.ceil(all.length/size));rosterPage=Math.min(rosterPage,total-1);
 const characterButton=(c,slot=null)=>btn(`${slot===null?`<span class="party-badge">${partyNumber(c.id)||'−'}</span>`:''}${esc(c.name)}${{recovering:' · 療養',dead:' · 死亡',away:' · 遠征'}[companionStatus(c.id)]||''}`,`openCharacterEquipment('${c.id}')`,'party-character').replace('<button ',`<button ${slot!==null?`data-party-slot="${slot}" `:''}${canAssignCharacter(c.id)?`onpointerdown="startPartyDrag(event,'${c.id}')" `:''}`);
 return card(`<div class="row"><h2>第${party+1}パーティ · 3人枠</h2><div class="actions">${[0,1,2].map(i=>btn(String(i+1),`switchParty(${i})`,party===i?'mini active':'mini')).join('')}</div></div><div class="actions party-slots">${Array.from({length:3},(_,i)=>{const c=characters.find(c=>c.id===members[i]);return c?characterButton(c,i):`<button data-party-slot="${i}" aria-label="パーティ枠${i+1} · 空き">空き枠</button>`}).join('')}</div>${note(partyAway(party)?'遠征中は編成できません。キャラをタップで装備を確認。':'ドラッグで編成 ／ キャラをタップで装備。')}`)+card(`<h2>この章で使える仲間 · ${all.length}人</h2><div class="actions chapter-roster">${all.slice(rosterPage*size,(rosterPage+1)*size).map(c=>characterButton(c)).join('')}</div>${note('数字は所属パーティ。枠からこの一覧へドラッグで外す。')}${total>1?`<div class="page">${btn('‹','rosterPage=Math.max(0,rosterPage-1);render()')}<small>${rosterPage+1} / ${total}</small>${btn('›',`rosterPage=Math.min(${total-1},rosterPage+1);render()`)}</div>`:''}`).replace('<section ', '<section data-party-roster="true" ')
}
function characterInfo(id){const c=characters.find(c=>c.id===id),s=companionStats(id);const attrs=Object.entries(s.attributes).map(([id,n])=>({fire:'炎',water:'水',wind:'風',earth:'土'}[id]||id)+n).join('・')||'なし';info(c.name,`${c.jobName} / Lv.${companionLevel(id)} / HP ${s.hp} / 攻撃 ${s.attack} / 防御 ${s.defense} / 固有属性 ${attrs}`)}
const title=(a,b='')=>`<div class="heading"><h1>${a}</h1>${b?`<span class="tag">${b}</span>`:''}</div>`;const btn=(s,fn,cl='',label='')=>`<button ${label?`aria-label="${esc(label)}" `:''}class="${cl}" onclick="${fn.replaceAll('"','&quot;')}">${s}</button>`;const card=s=>`<section class="card">${s}</section>`;const steps=()=>`<div class="steps">${phases.map((p,i)=>`<span class="${phase===i?'current':''}">${p}</span>`).join('')}</div>`;const next=(label='次へ')=>`<div class="bottom"><div class="actions">${phase>0&&phase<5?btn('前の工程',`phase--;go('home')`):''}${btn(label,'advance()','primary')}</div>${steps()}</div>`;const row=(a,b)=>`<div class="row"><span>${a}</span><b>${b}</b></div>`;const note=s=>`<p class="muted">${s}</p>`;const money=n=>n.toLocaleString()+' G';
function go(id){cancelEquipmentDrag();equipmentSelectedUid=null;if(screen==='equipment'&&id!=='equipment')equipmentOrigin=null;screen=id;page=0;sub=0;render()}function advance(){if(pending.length){go('trade');return}if(economyState.bill?.status==='unpaid')return;if(phase===5){resolveTradingDay();closeEconomyDay();day++;phase=0;recoverCompanions();resolveExpeditions()}else phase++;go('home')}
function info(a,b){$('#modalTitle').textContent=a;$('#modalBody').textContent=b;$('#modal').showModal()}
function home(){if(economyState.bill?.status==='unpaid')return report();if(phase===0)return report();if(phase===1)return purchase();if(phase===2)return warehouse(true);if(phase===3)return stocking();if(phase===4)return support(true);return sales()}
function report(){const size=3;page=Math.min(page,Math.max(0,Math.ceil(returnReport.length/size)-1));return title(sub?'仲間の帰還報告':'朝の営業報告',`春 ${day}日`)+(sub?card(`<h2>遠征の結果</h2>${returnReport.length?returnReport.slice(page*size,(page+1)*size).map(line=>`<p>${esc(line)}</p>`).join(''):note('帰還したパーティはありません。')}`)+(returnReport.length>size?pager(returnReport.length,size):''):card(row('前日の売上',money(lastSales))+tradingReportSummary()+economyReport())+note(`遠征は翌朝に帰還し、参加者の各装備を${balanceRuntime.expeditionWear}消耗します。`))+`<div class="bottom">${btn(sub?'確認して仕入れへ':'次へ · 帰還報告',sub?'advance()':'sub=1;page=0;render()','primary')}${steps()}</div>`}
function purchase(){let total=counts.reduce((a,n,i)=>a+n*prices[i],0);return title('今日の仕入れ','02 / 06')+note(`商人ごとに回数を選択。1回につき${balanceRuntime.itemsPerPurchase}品が入荷。`)+['武器商','防具商','道具商'].map((name,i)=>card(`<div class="merchant"><div><h2>${name}</h2><small>1回 ${prices[i]} G</small></div><div class="counter">${btn('−',`counts[${i}]=Math.max(0,counts[${i}]-1);render()`,'touch-target',name+'の仕入れを1回減らす')}<b>${counts[i]}</b>${btn('＋',`counts[${i}]++;render()`,'touch-target',name+'の仕入れを1回増やす')}</div></div>`)).join('')+card(row('合計 '+counts.reduce((a,n)=>a+n,0)*balanceRuntime.itemsPerPurchase+' 品',money(total)))+btn('村人からの寄付',"go('donation')",'mini touch-target')+`<div class="bottom">${btn('仕入れて入荷品を確認','buy()','primary touch-target')} ${btn('今日は仕入れない','phase=2;go("home")','mini touch-target')}${steps()}</div>`}
function stocking(){return title('店舗の陳列','04 / 06')+`<div class="tabs">${btn('商品の補充','sub=0;render()',!sub?'active':'')}${btn('棚・設備の配置','sub=1;render()',sub?'active':'')}</div>`+(!sub?shelfSelector()+card(row('補充済み',shelfItems().length+' 点 / '+config.development.shelfCapacity+' 点')+note(esc(shelfSummary())))+itemList(stock,'selected=INDEX;render()')+`<div class="actions">${btn('選んだ商品を補充','replenish()','primary')}${btn('1点を倉庫へ戻す','returnShelf()')}</div>`:card(`<h2>店舗の棚</h2>${row('設置済み',economyState.shelfCount+' 棚')}${row('陳列上限',shelfCapacity()+' 点')}${row('棚の日額管理費',money(economyState.shelfCount*economyConfig.chapters[economyChapterId(chapter)].shopMaintenancePerShelf))}${btn('大工へ棚増設を依頼',"go('residents')",'mini')}`))+note('商品と棚は翌日も維持。棚1つの容量は開発設定で管理。')+next('仲間の支援へ')}
function support(routine=false){return title(routine?'仲間への支援':'冒険者',away?'遠征中':'活動可能')+`<div class="tabs">${[['編成',0],...(routine?[['目的地',2]]:[])].map(([label,index])=>btn(label,`sub=${index};render()`,sub===index?'active':'')).join('')}</div>`+(sub!==2?(routine?card(`<div class="row"><h2>第${party+1}パーティの支度金</h2><b>${money(funds[party])}</b></div><div class="actions funding-controls">${[10,100,1000].map(n=>btn('＋'+n,`if(!partyAway(party)&&funds[party]+${n}<=gold)funds[party]+=${n};render()`,'mini touch-target',`支度金を${n}G加算`)).join('')}${btn('取消',`if(!partyAway(party))funds[party]=0;render()`,'mini touch-target','支度金の予定額を取り消す')}</div>${note('派遣時に消費。パーティごとに管理。')}`):'')+partyFormation():destinationView())+(routine?next('今日のお店を開ける'):`<div class="bottom">${note('目的地の選択・出発は経営の支援工程で行います。')}${btn('経営に戻る',`go('home')`,'primary')}</div>`)}
function records(){return title('記録')+card(`<h2>日誌</h2><p>日々の商売や冒険の出来事を振り返ります。</p><br>${btn('日誌を開く',"go('journal')",'primary')}`)+card(`<h2>図鑑</h2><p>発見した商品・セット装備・人物を確認します。</p><br>${btn('図鑑を開く','openEncyclopedia()','primary')}`)}
function journal(){let days=['春 2日','春 1日'];return title('店主の日誌')+`<div class="page">${btn('‹','page=0;render()')}<b>${days[page]}</b>${btn('›','page=1;render()')}</div>`+card(`<div class="ledger">${row('商売','売上 480 G')}${row('仕入れ','300 G')}${row('仲間への支援','支度金 100 G')}${row('遠征','周辺の森へ出発')}${row('現金収支','＋80 G')}</div>`)+note('日付ごとに短い記録を表示。会話全文は重ねない。')+`<div class="bottom">${btn('記録に戻る',`go('records')`)}</div>`}
function renderBase(){ $('#date').textContent=`1年 春${day}日 · ${phases[phase]}`;$('#gold').textContent=money(gold);$('#nav').innerHTML=navs.map(([id,icon,s])=>`<button class="${screen===id||screen==='equipment'&&equipmentOrigin?.screen===id||id==='home'&&screen==='trade'||id==='records'&&['journal','encyclopedia'].includes(screen)?'active':''}" onclick="go('${id}')"><span>${icon}</span>${s}</button>`).join('');$('#view').innerHTML=({home,trade,tradingReport:tradingReportView,equipment:equipmentView,catalog:catalogView,encyclopedia:encyclopediaView,donation:donationView,warehouse:()=>warehouse(false),adventurers:()=>support(false),residents,records,journal,settings}[screen]||home)();$('#flow').innerHTML=phases.map((x,i)=>btn(String(i+1).padStart(2,'0')+'　'+x,`if(pending.length){go('trade')}else if(!economyState.bill||economyState.bill.status!=='unpaid'){phase=${i};go('home')}`,phase===i?'active':'')).join('');}

// JSON-driven item definitions and current game screens.
let balanceRuntime={...Balance.runtimeDefaults};
let catalog,config,definitions={},types={},uid=0,catalogFilter='',catalogQuery='',catalogSlot='',catalogItemId=null,catalogDetail=false,catalogOrigin='warehouse';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function def(instance){return definitions[instance.itemId]}
function type(instance){return types[def(instance).typeId]}
function newItem(id){EncyclopediaCore.acquire(encyclopedia,id);const maxDurability=EquipmentCore.roll();return{uid:++uid,itemId:id,typeId:definitions[id].typeId,x:null,y:null,rotation:0,...(types[definitions[id].typeId].slot?{durability:maxDurability,maxDurability,forged:false,forgeType:null}:{})}}
function itemName(instance){return def(instance).name}
function itemMeta(instance){const d=def(instance),t=type(instance);return `${t.label} · ${t.width?`${t.width}×${t.height}`:'寸法未設定'} · ${catalog.elements[d.element]} · 販売 ${saleValue(instance)} G${t.slot?` · 耐久 ${instance.durability}/${instance.maxDurability}${instance.forged?' · 鍛冶済み':''}`:''}` }
function shape(d){return `<span class="item-art"><img src="${esc(d.image)}" alt="" loading="lazy" decoding="async" draggable="false"></span>`}
function warehouseArtwork(item){const d=ItemCore.dimensions(item,types),board=config.warehouse,rotated=item.rotation%2;return `<span class="warehouse-art" style="left:calc(${item.x/board.width*100}% + ${item.x/board.width*3}px);top:calc(${item.y/board.height*100}% + ${item.y/board.height*3}px);width:calc(${d.width/board.width*100}% - ${3-d.width/board.width*3}px);height:calc(${d.height/board.height*100}% - ${3-d.height/board.height*3}px)"><img src="${esc(def(item).image)}" alt="" draggable="false" style="width:${rotated?d.height/d.width*100:100}%;height:${rotated?d.width/d.height*100:100}%;transform:translate(-50%,-50%) rotate(${rotated?90:0}deg)"></span>`}


function storeItem(instance){const position=ItemCore.findSpace(instance,stock,types,config.warehouse);if(!position)return false;Object.assign(instance,position);stock.push(instance);return true}
function reset(persistReset=true){cancelEquipmentDrag();equipmentSelectedUid=null;selectedShelf=0;tradingState={rumors:[],report:null};resetRescue();resetEconomy();if(persistReset)saveReady=true;dungeonProgress={};selectedDungeon=config.dungeons[0].id;equipment={};autoEquip={};brokenTargets={};expeditions=[];returnReport=[];lastSales=0;equipCharacter=null;equipmentOrigin=null;characterPanel="equipment";equipmentSlot="weapon";equipPage=0;day=2;phase=0;gold=config.development.initialGold;counts=[0,0,0];pending=[];stock=[];shelf=[];funds=[0,0,0];party=0;partySlot=0;rosterPage=0;chapter=0;availableCharacterIds=characters.filter(c=>c.joinChapter===chapter).map(c=>c.id);parties=[availableCharacterIds.slice(0,3),[],[]];away=false;selected=0;page=0;uid=0;encyclopedia=EncyclopediaCore.create();encyclopediaSelection=null;for(const id of config.development.initialItemIds){if(!storeItem({...newItem(id),durability:10,maxDurability:10}))throw Error('初期在庫が倉庫に入りません')}go('home')};
function itemList(items,fn){const size=pending.length?Math.min(2,config.ui.pageSize):config.ui.pageSize;page=Math.min(page,Math.max(0,Math.ceil(items.length/size)-1));return `<div class="list">${items.slice(page*size,page*size+size).map((item,i)=>`<button class="item ${selected===page*size+i?'active':''}" onclick="${fn.replaceAll('INDEX',page*size+i)}"><span><b>${esc(itemName(item))}</b><small class="block">${esc(itemMeta(item))}</small></span><span class="item-mini">${shape(def(item))}</span></button>`).join('')||note('商品はありません')}</div>`+pager(items.length,size)};
function pager(length,size){const pages=Math.max(1,Math.ceil(length/size));return `<div class="page"><button class="mini" ${page===0?'disabled':''} onclick="page--;render()">‹</button><small>${page+1} / ${pages} ページ · ${length}件</small><button class="mini" ${page===pages-1?'disabled':''} onclick="page++;render()">›</button></div>`}
function openCatalog(origin){catalogOrigin=origin;catalogDetail=false;page=0;screen='catalog';render()}
function filteredItems(){return catalog.items.filter(d=>(!catalogSlot||types[d.typeId].slot===catalogSlot)&&(!catalogFilter||d.typeId===catalogFilter)&&(!catalogQuery||d.name.includes(catalogQuery)))}
function catalogView(){if(catalogDetail)return catalogItemView();const items=filteredItems();return title('アイテム設定一覧',`${catalog.items.length}種類`)+`<div class="catalog-filters"><select aria-label="装備枠" onchange="catalogSlot=this.value;catalogFilter='';page=0;render()"><option value="">すべての枠</option>${Object.entries(catalog.slots).map(([id,name])=>`<option value="${id}" ${catalogSlot===id?'selected':''}>${name}</option>`).join('')}</select><select aria-label="装備種類" onchange="catalogFilter=this.value;page=0;render()"><option value="">すべての種類</option>${catalog.types.filter(t=>!catalogSlot||t.slot===catalogSlot).map(t=>`<option value="${t.id}" ${catalogFilter===t.id?'selected':''}>${esc(t.label)}</option>`).join('')}</select></div><form class="actions" onsubmit="event.preventDefault();catalogQuery=this.elements.query.value.trim();page=0;render()"><input name="query" aria-label="アイテム名検索" placeholder="アイテム名を検索" value="${esc(catalogQuery)}"><button class="mini">検索</button></form><div class="catalog-list">${items.slice(page*config.ui.pageSize,(page+1)*config.ui.pageSize).map(d=>`<button class="item" onclick="catalogItemId='${d.id}';catalogDetail=true;render()"><span><b>${esc(d.name)}</b><small class="block">${esc(types[d.typeId].label)} · ${catalog.elements[d.element]}</small></span>${shape(d)}</button>`).join('')||note('一致するアイテムはありません')}</div>${pager(items.length,config.ui.pageSize)}<div class="bottom">${note('正式価格・能力は未設定。装備の耐久度は個体ごとに管理。')}${btn('戻る',`go('${catalogOrigin}')`)}</div>`}
function catalogItemView(){const d=definitions[catalogItemId],t=types[d.typeId];return title('アイテム詳細','登録済み')+card(`<div class="row"><div><h2>${esc(d.name)}</h2><small>${esc(t.label)}</small></div>${shape(d)}</div><div class="ledger">${row('装備枠',t.slot?catalog.slots[t.slot]:'装備不可')}${row('寸法（横×縦）',t.width?`${t.width} × ${t.height}`:'未設定')}${row('形状の指定',esc(t.shapeLabel||'未設定'))}${row('属性',catalog.elements[d.element])}${row('価格',d.price===null?'未設定':esc(d.price)+' G')}${row('能力',d.stats===null?'未設定':esc(JSON.stringify(d.stats)))}${row('耐久',t.slot?'基準10（仕入れ時8〜12）':'装備対象外')}</div>`)+(d.effect?card(`<h2>素材の用途</h2><p>${catalog.elements[d.effect.element]}属性付与</p>${note('付与量・費用・対象・消費ルールは未設定。')}`):'')+note('ID: '+d.id)+`<div class="bottom">${btn('一覧へ戻る','catalogDetail=false;render()','primary')}</div>`}
function warehouseCell(x,y){const hit=stock.find(item=>{const d=ItemCore.dimensions(item,types);return d&&x>=item.x&&x<item.x+d.width&&y>=item.y&&y<item.y+d.height});if(hit){const index=stock.indexOf(hit);if(selected===index){rotateSelected();return}selected=index;render();return}const item=stock[selected];if(!item)return;const position=ItemCore.findNearby(item,x,y,item.rotation,stock,types,config.warehouse);if(!position)return;Object.assign(item,position);render()}
function rotateSelected(){const item=stock[selected];if(!item)return;const rotation=(item.rotation+1)%2;const position=ItemCore.findNearby(item,item.x,item.y,rotation,stock,types,config.warehouse,true);if(!position)return;Object.assign(item,position);render()}
function warehouseWorkspace(routine=false){selected=Math.min(selected,Math.max(0,stock.length-1));const item=stock[selected],board=config.warehouse,used=stock.reduce((a,i)=>{const d=ItemCore.dimensions(i,types);return a+d.width*d.height},0);let grid=`<div class="grid real-board" style="grid-template-columns:repeat(${board.width},1fr);--board-rows:${board.height}">`;for(let y=0;y<board.height;y++)for(let x=0;x<board.width;x++){const index=stock.findIndex(i=>{const d=ItemCore.dimensions(i,types);return x>=i.x&&x<i.x+d.width&&y>=i.y&&y<i.y+d.height});grid+=`<button class="${index>=0?'filled':''} ${index===selected?'selected':''}" data-x="${x}" data-y="${y}" onclick="warehouseCell(${x},${y})" aria-label="${x+1}列${y+1}行 ${index>=0?esc(itemName(stock[index])):'空き'}">${index>=0?index+1:''}</button>`}grid+=stock.map(warehouseArtwork).join('')+'</div>';return title('倉庫',`${used}/${board.width*board.height}マス`)+`<div class="tabs">${btn('配置','sub=0;render()',sub===0?'active':'')}${btn('商品一覧','sub=1;render()',sub===1?'active':'')}${btn('種類一覧',`openCatalog('warehouse')`)}</div>`+(sub?itemList(stock,'selected=INDEX;render()'):grid)+card(`<div class="row"><div><h2>${item?esc(itemName(item)):'商品なし'}</h2><small>${item?esc(itemMeta(item)):'入荷した商品を収納してください。'}</small></div>${btn('↻ 回転','rotateSelected()','mini')}</div><div class="actions">${btn(item?'商人へ引取 '+money(buybackValue(item)):'商人へ引取','buybackStock()','mini')}${btn('破棄','discardStock()','mini')}</div>`)+note('クリックで選択／選択中は回転／長押しでドラッグ。')+(routine?next('陳列へ'):`<div class="bottom">${btn(pending.length?'取引へ戻る':'経営に戻る',`go('${pending.length?'trade':'home'}')`,'primary')}</div>`)};
function buy(){if(pending.length){phase=2;go('trade');return}const total=counts.reduce((a,n,i)=>a+n*prices[i],0);if(!counts.some(n=>n>0))return info('回数を選択','商人の＋で回数を選んでください。');if(total>gold)return info('所持金不足','仕入れ回数を減らしてください。');const pools=[['weapon'],['offhand','head','body'],['accessory']].map(slots=>catalog.items.filter(d=>d.status==='active'&&slots.includes(types[d.typeId].slot)));pending=counts.flatMap((n,i)=>Array.from({length:n*balanceRuntime.itemsPerPurchase},()=>newItem(pools[i][Math.floor(Math.random()*pools[i].length)].id)));gold-=total;counts=[0,0,0];phase=2;go('trade')};
function receive(){if(!pending.length)return;if(!storeItem(pending[0]))return info('倉庫に入りません','倉庫を整理するか、商人へ引き取ってもらってください。');selected=stock.length-1;pending.shift();render()}
function replenish(){if(!stock.length||shelfItems().length>=config.development.shelfCapacity)return info('補充できません','在庫と棚の空きを確認してください。');if(stock[selected]?.forged)return info('陳列できません','鍛冶済み装備は手動装備または破棄してください。');if(!stock[selected])return;const item=stock.splice(selected,1)[0];item.shelfId=selectedShelf;shelf.push(item);selected=0;page=0;discoverShelfSets();render()};
function returnShelf(){const item=shelfItems().at(-1);if(!item)return;if(!storeItem(item))return info('倉庫に入りません','倉庫を整理してください。');shelf.splice(shelf.indexOf(item),1);delete item.shelfId;render()}
function sales(){const ch=tradingChapter(),rumors=tradingState.rumors.filter(r=>r.startDay<=day&&day<r.endDay);return title('本日の営業','06 / 06')+card(row('本日の来店予定',`${ch.visitors.min}〜${ch.visitors.max}人`)+row('陳列中',shelf.length+'品')+note('翌日へ進むと購入を判定します。売れ残りは持ち越します。'))+card(`<h2>お店の噂</h2>${note(rumors.map(r=>esc(tradingConfig.rumors.find(d=>d.id===r.id).name)+' · あと'+(r.endDay-day)+'日').join(' ／ ')||'現在の噂はありません。')}`)+note('固定価格で販売。客層・所持金・購入率は開発用の仮設定。')+`<div class="bottom">${btn('翌日へ · 朝の報告','finishDay()','primary')}${steps()}</div>`};

function downloadConfig(kind){const data=kind==='items'?catalog:config;const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=kind==='items'?'item-catalog.json':'game-settings.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function settings(){return title('設定')+card(`<h2>進行データ</h2><div class="actions">${btn('JSON書き出し','exportGame()')}${btn('JSON読み込み',"document.querySelector('#saveInput').click()")}</div><input id="saveInput" type="file" accept="application/json,.json" hidden onchange="importGame(this.files[0])">${note(catalogMigrationNotice||saveError||'操作ごとにこのブラウザへ自動保存します。')}`)+card(`<h2>表示スキン</h2><div class="actions">${[['','標準'],['paper','紙'],['night','夜']].map(([id,s])=>btn(s,`document.documentElement.dataset.skin='${id}';render()`)).join('')}</div>`)+card(`<h2>アイテム設定 · ${catalog.items.length}種類</h2>${btn('設定されたアイテムを確認',`openCatalog('settings')`)}<br>${note('JSONを編集して再読み込みすると反映されます。')}`)+card(`<h2>設定JSONの書き出し</h2><div class="actions">${btn('アイテム定義',`downloadConfig('items')`)}${btn('確認用設定',`downloadConfig('settings')`)}</div>`)+note('正式価格・能力は未設定。耐久度は個体ごとに管理。')+`<div class="bottom">${btn('経営に戻る',`go('home')`,'primary')}</div>`};
function render(){rescueUnpaidBill();renderBase();persist()}
async function loadItemSettings(){try{const responses=await Promise.all(['data/item-catalog.json','data/game-settings.json','data/encyclopedia.json','data/characters.json','data/economy.json','data/trading.json'].map(path=>fetch(path,{cache:'no-store'})));if(responses.some(r=>!r.ok))throw Error('設定ファイルが読み込めません');[catalog,config,encyclopediaDefinitions,characters,economyConfig,tradingConfig]=await Promise.all(responses.map(r=>r.json()));initializeBalance();ItemCore.validate(catalog,config);validateEconomyConfig(economyConfig);validateRescueConfig();validateDungeonConfig();validateAdventurerConfig();types=Object.fromEntries(catalog.types.map(t=>[t.id,t]));definitions=Object.fromEntries(catalog.items.map(d=>[d.id,d]));validateTradingConfig();prices.splice(0,prices.length,...config.development.merchantCosts);const saved=readStoredGame();saveReady=false;reset(false);if(saved){try{applySave(saved);saveReady=true;go('home')}catch(error){info('保存データを読み込めません',error.message)}}else{saveReady=!saveError;persist()}}catch(error){$('#view').innerHTML=title('設定の読み込みエラー')+note(esc(error.message))+note('HTTPプレビューから開いてください。JSONを修正した場合は構文とIDを確認してください。')+btn('再読み込み','location.reload()')}}

// Procurement results and warehouse organisation share one workspace.
function intakePanel(){const item=pending[0];return `<section class="card intake"><div class="row"><h2>仕入れ結果 · 残り${pending.length}品</h2>${item?`<small>${type(item).slot?`耐久 ${item.durability}/${item.maxDurability}`:esc(itemMeta(item))}</small>`:''}</div>${item?`<div class="row"><b class="incoming-draggable" data-drag-incoming="true" title="倉庫へドラッグ">↕ ${esc(itemName(item))}</b><div class="actions">${btn('収納','receive()','primary mini')}${btn('引取 '+money(buybackValue(item)),'buybackIncoming()','mini')}</div></div>`:note('入荷品の振り分け完了。倉庫の配置を調整できます。')}</section>`}
function combinedWarehouse(routine=true){let content=warehouseWorkspace(routine);content=content.replace(title('倉庫',`${stock.reduce((a,i)=>{const d=ItemCore.dimensions(i,types);return a+d.width*d.height},0)}/${config.warehouse.width*config.warehouse.height}マス`),title('仕入れ結果・倉庫整理',`${stock.length}点を保管`));content=content.replace('<div class="tabs">',intakePanel()+'<div class="tabs">');if(pending.length)content=content.replace('onclick="advance()"','disabled onclick="advance()"');return content}
function trade(){return combinedWarehouse(true)};
function warehouse(routine=false){return (pending.length||routine&&phase===2)?combinedWarehouse(true):warehouseWorkspace(routine)};

// Pointer-based drag and drop supports touch and mouse with the same rules.
(function installWarehouseDrag(){
 const root=document.querySelector('#view');
 let drag=null,suppressClickUntil=0;
 function clearPreview(){root.querySelectorAll('.drop-preview').forEach(cell=>cell.classList.remove('drop-preview'));}
 function cleanup(){if(!drag)return;const pointer=drag.pointerId;clearTimeout(drag.holdTimer);drag.ghost?.remove();clearPreview();drag=null;root.classList.remove('dragging');if(root.hasPointerCapture?.(pointer))root.releasePointerCapture(pointer);}
 function targetAt(event){
  const board=root.querySelector('.real-board');if(!board)return null;
  const bounds=board.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>=bounds.right||event.clientY<bounds.top||event.clientY>=bounds.bottom)return null;
  const cells=board.querySelectorAll('button'),first=cells[0].getBoundingClientRect();
  const stepX=config.warehouse.width>1?cells[1].getBoundingClientRect().left-first.left:first.width;
  const stepY=config.warehouse.height>1?cells[config.warehouse.width].getBoundingClientRect().top-first.top:first.height;
  const x=Math.floor((event.clientX-first.left)/stepX)-drag.offsetX;
  const y=Math.floor((event.clientY-first.top)/stepY)-drag.offsetY;
  return ItemCore.findNearby(drag.item,x,y,drag.item.rotation,stock,types,config.warehouse);
 }
 function update(event){
  clearPreview();drag.position=targetAt(event);
  drag.ghost.style.left=event.clientX+12+'px';drag.ghost.style.top=event.clientY+12+'px';
  drag.ghost.classList.toggle('invalid',!drag.position);
  if(!drag.position)return;
  const d=ItemCore.dimensions(drag.item,types),p=drag.position;
  root.querySelectorAll('.real-board button').forEach(cell=>{const x=Number(cell.dataset.x),y=Number(cell.dataset.y);if(x>=p.x&&x<p.x+d.width&&y>=p.y&&y<p.y+d.height)cell.classList.add('drop-preview');});
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
  drag={item,incoming:Boolean(incoming),pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,offsetX,offsetY,active:false,position:null,ghost:null,holdTimer:null,lastPoint:{clientX:event.clientX,clientY:event.clientY}};
  drag.holdTimer=setTimeout(()=>{if(!drag)return;drag.active=true;root.setPointerCapture?.(drag.pointerId);root.classList.add('dragging');drag.ghost=document.createElement('div');drag.ghost.className='drag-ghost';drag.ghost.textContent=itemName(drag.item);document.body.append(drag.ghost);update(drag.lastPoint);},100);
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
