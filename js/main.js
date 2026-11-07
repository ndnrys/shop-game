
const $=s=>document.querySelector(s);const phases=['報告','仕入れ','倉庫整理','陳列','支援','営業'];const navs=[['home','⌂','経営'],['warehouse','▦','倉庫'],['residents','♧','住人'],['adventurers','♙','仲間'],['records','≡','記録'],['settings','⚙','設定']];
let day=2,phase=0,screen='home',gold=0,counts=[0,0,0],pending=[],stock=[],shelf=[],selected=0,page=0,sub=0,party=0,funds=[0,0,0],away=false;const prices=[];
const merchantPrice=index=>chapter===0?config.development.prologueMerchantCosts[index]:prices[index];let characters=[];const villageCharacters=()=>characters.filter(c=>c.joinChapter===0);
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
  if(!active){active=true;ghost=document.createElement('div');ghost.className='drag-ghost';const c=characters.find(c=>c.id===id);ghost.innerHTML=characterArt(c)+`<span>${esc(c.name)}</span>`;document.body.append(ghost)}
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
 const characterButton=(c,slot=null)=>btn(`${slot===null?`<span class="party-badge">${partyNumber(c.id)||'−'}</span>`:''}${characterArt(c)}<span class="character-name">${esc(c.name)}</span>${companionStatus(c.id)==='waiting'?'':`<small class="character-status">${{recovering:'療養中',dead:'死亡',away:'遠征中'}[companionStatus(c.id)]||''}</small>`}`,`openCharacterEquipment('${c.id}')`,'party-character',`${c.name}の装備を開く`).replace('<button ',`<button ${slot!==null?`data-party-slot="${slot}" `:''}${canAssignCharacter(c.id)?`onpointerdown="startPartyDrag(event,'${c.id}')" `:''}`);
 return card(`<div class="row"><h2>第${party+1}パーティ · 3人枠</h2><div class="actions">${[0,1,2].map(i=>btn(String(i+1),`switchParty(${i})`,party===i?'mini active':'mini')).join('')}</div></div><div class="actions party-slots">${Array.from({length:3},(_,i)=>{const c=characters.find(c=>c.id===members[i]);return c?characterButton(c,i):`<button data-party-slot="${i}" aria-label="パーティ枠${i+1} · 空き">空き枠</button>`}).join('')}</div>${note(partyAway(party)?'遠征中です。':'キャラをタップで装備を確認。')}<div class="actions">${(partyRosterOpen?'':btn('編成','partyRosterOpen=true;render()','mini'))}${!partyRosterOpen&&phase===4&&(screen==='home'||screen==='adventurers')?(parties[party].some(id=>id&&companionStatus(id)==='waiting')&&!partyAway(party)?btn('このパーティを派遣','depart()','primary'):'<button class="primary" disabled>このパーティを派遣</button>'):''}</div>`)+(partyRosterOpen?card(`<h2>この章で使える仲間 · ${all.length}人</h2><div class="actions chapter-roster">${all.slice(rosterPage*size,(rosterPage+1)*size).map(c=>characterButton(c)).join('')}</div>${note('数字は所属パーティ。枠からこの一覧へドラッグで外す。')}${total>1?`<div class="page">${btn('‹','rosterPage=Math.max(0,rosterPage-1);render()')}<small>${rosterPage+1} / ${total}</small>${btn('›',`rosterPage=Math.min(${total-1},rosterPage+1);render()`)}</div>`:''}`).replace('<section ', '<section data-party-roster="true" '):'')
}
function characterInfo(id){const c=characters.find(c=>c.id===id),s=companionStats(id);const attrs=Object.entries(s.attributes).map(([id,n])=>({fire:'炎',water:'水',wind:'風',earth:'土'}[id]||id)+n).join('・')||'なし';info(c.name,`${c.jobName} / Lv.${companionLevel(id)} / HP ${s.hp} / 攻撃 ${s.attack} / 防御 ${s.defense} / 固有属性 ${attrs}`)}
const title=(a,b='')=>`<div class="heading"><h1>${a}</h1>${b?`<span class="tag">${b}</span>`:''}</div>`;const btn=(s,fn,cl='',label='')=>`<button ${label?`aria-label="${esc(label)}" `:''}class="${cl}" onclick="${fn.replaceAll('"','&quot;')}">${s}</button>`;const card=s=>`<section class="card">${s}</section>`;const steps=()=>`<div class="steps">${phases.map((p,i)=>`<span class="${phase===i?'current':''}">${p}</span>`).join('')}</div>`;const next=(label='次へ')=>`<div class="bottom"><div class="actions">${phase>0&&phase<5?btn('前の工程',`phase--;go('home')`):''}${btn(label,'advance()','primary')}</div>${steps()}</div>`;const row=(a,b)=>`<div class="row"><span>${a}</span><b>${b}</b></div>`;const note=s=>`<p class="muted">${s}</p>`;const money=n=>n.toLocaleString()+' G';
function toggleMenu(){const nav=$('#nav'),toggle=$('#menuToggle');const opening=nav.classList.toggle('is-open');toggle.setAttribute('aria-expanded',String(opening))}
function go(id){partyRosterOpen=false;shopPanelOpen=false;shopSelectedShelf.clear();shopSelectedStock.clear();cancelEquipmentDrag();equipmentSelectedUid=null;if(screen==='equipment'&&id!=='equipment')equipmentOrigin=null;screen=id;page=0;sub=0;render()}function advance(){if(pending.length){go('trade');return}if(economyState.bill?.status==='unpaid')return;if(phase===5){resolveTradingDay();closeEconomyDay();day++;phase=0;recoverCompanions();resolveExpeditions()}else phase++;go('home')}
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

function home(){if(economyState.bill?.status==='unpaid')return report();if(phase===0)return report();if(phase===1)return purchase();if(phase===2)return warehouse(true);if(phase===3)return stocking();if(phase===4)return support(true);return sales()}
function report(){
 const groups=typeof groupedReturnReport!=='undefined'?groupedReturnReport:[];
 const destinations=[...new Set(groups.map(g=>g.destination))];
 const expeditionHtml=destinations.length?destinations.map(destination=>card(
  '<h2>派遣先：'+esc(destination)+'</h2>'+
  groups.filter(g=>g.destination===destination).map(g=>
   '<div class="return-party"><h3>第'+(g.party+1)+'パーティ</h3>'+
   (g.progress?'<p>'+esc(g.progress)+'</p>':'')+
   g.members.map(m=>'<div class="return-member"><b>'+esc(m.name)+'</b><p>'+m.events.map(esc).join(' ／ ')+'</p></div>').join('')+
   '</div>').join('')
 )).join(''):card(note('帰還したパーティはありません。'));
 return title(sub?'仲間の帰還報告':'朝の営業報告',`春 ${day}日`)+
 (sub?expeditionHtml:card(row('前日の売上',money(lastSales))+tradingReportSummary()+economyReport()))+
 `<div class="bottom">${btn(sub?'確認して仕入れへ':'次へ · 帰還報告',sub?'advance()':'sub=1;page=0;render()','primary')}${steps()}</div>`;
}
function purchase(){let total=counts.reduce((a,n,i)=>a+n*merchantPrice(i),0);return title('今日の仕入れ',`${warehouseSize.width}×${warehouseSize.height} · 空き${warehouseSize.width*warehouseSize.height-warehouseUsed()}マス`)+note(`商人ごとに回数を選択。1回につき${balanceRuntime.itemsPerPurchase}品が入荷。`)+['武器商','防具商','道具商'].map((name,i)=>card(`<div class="merchant"><div><h2>${name}</h2><small>1回 ${merchantPrice(i)} G</small></div><div class="counter">${btn('−',`counts[${i}]=Math.max(0,counts[${i}]-1);render()`,'touch-target',name+'の仕入れを1回減らす')}<b>${counts[i]}</b>${btn('＋',`counts[${i}]++;render()`,'touch-target',name+'の仕入れを1回増やす')}</div></div>`)).join('')+card(row('合計 '+counts.reduce((a,n)=>a+n,0)*balanceRuntime.itemsPerPurchase+' 品',money(total)))+btn('村人からの寄付',"go('donation')",'mini touch-target')+`<div class="bottom">${btn('仕入れを確定','finishPurchase()','primary touch-target')}${steps()}</div>`}
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
 if(!shopLayout()[selectedShelf])return;
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
  if(!shopLayout()[selectedShelf])return;
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
function stocking(){
 if(!shopPanelOpen)return title('店舗の陳列','04 / 06')+shopLayoutView()+
 card(row('棚の設置数',economyState.shelfCount+' 棚')+btn('大工へ棚増設を依頼',"go('residents');sub=1;render()",'mini'))+next('仲間の支援へ');
 const items=shelfItems(),capacity=config.development.shelfCapacity;
 const totalValue=items.reduce((sum,item)=>sum+saleValue(item),0);
 const stockItems=stock.filter(i=>!i.forged);
 const perPage=8,pages=Math.max(1,Math.ceil(stockItems.length/perPage));page=Math.max(0,Math.min(page,pages-1));
 const visibleStock=stockItems.slice(page*perPage,(page+1)*perPage);
 const pager=pages>1?'<div class="page">'+btn('‹','page=Math.max(0,page-1);render()','mini')+'<small>'+(page+1)+' / '+pages+'</small>'+btn('›','page=Math.min('+(pages-1)+',page+1);render()','mini')+'</div>':'';
 const details=card('<div class="row"><h2>棚 '+(selectedShelf+1)+'</h2><b>'+items.length+' / '+capacity+' 点</b></div>'+
 row('棚の商品総額',money(totalValue))+note(esc(shelfSummary())));
 const shelfSection='<div class="card shop-folder-content shop-shelf-section"><div class="row"><h2>棚の商品</h2><small>×で倉庫へ戻す</small></div>'+
 '<div class="shop-product-list">'+items.map(i=>shopItemCard(i,'shelf')).join('')+
 Array.from({length:Math.max(0,capacity-items.length)},()=>'<div class="shop-empty-slot" aria-label="空き枠">＋</div>').join('')+'</div>'+
 '</div>';
 const stockSection='<div class="card shop-folder-content shop-stock-section"><div class="row"><h2>倉庫から補充 ('+stockItems.length+')</h2><small>＋で棚に補充</small></div>'+
 (visibleStock.length?'<div class="shop-product-list">'+visibleStock.map(i=>shopItemCard(i,'stock')).join('')+'</div>':note('商品がありません。'))+
 pager+'</div>';
 return title('店舗の陳列','04 / 06')+btn('‹ 店舗レイアウトへ戻る','shopPanelOpen=false;page=0;render()','mini')+details+shelfSection+stockSection+next('仲間の支援へ');
}

function support(routine=false){
 const funding=card(`<div class="row"><h2>第${party+1}パーティの支度金</h2><b>${money(funds[party])}</b></div><div class="actions funding-controls">${[10,100,1000].map(n=>btn('＋'+n,`if(!partyAway(party)&&funds[party]+${n}<=gold)funds[party]+=${n};render()`,'mini touch-target',`支度金を${n}G加算`)).join('')}${btn('取消',`if(!partyAway(party))funds[party]=0;render()`,'mini touch-target','支度金の予定額を取り消す')}</div>${note('派遣時に消費。パーティごとに管理。')}`);
 if(partyRosterOpen)return title('パーティ編成')+btn('‹ 支援画面へ戻る','partyRosterOpen=false;render()','mini')+partyFormation();
 return title(routine?'仲間への支援':'仲間',away?'遠征中':'活動可能')+
 (routine?destinationView()+funding+partyFormation()+next('今日のお店を開ける'):
 destinationView()+funding+partyFormation()+`<div class="bottom">${note('目的地の選択・出発は経営の支援工程で行います。')}</div>`);
}
function records(){return title('記録')+card(`<h2>日誌</h2><p>日々の商売や冒険の出来事を振り返ります。</p><br>${btn('日誌を開く',"go('journal')",'primary')}`)+card(`<h2>図鑑</h2><p>発見した商品・セット装備・人物を確認します。</p><br>${btn('図鑑を開く','openEncyclopedia()','primary')}`)}
function journal(){let days=['春 2日','春 1日'];return title('店主の日誌')+`<div class="page">${btn('‹','page=0;render()')}<b>${days[page]}</b>${btn('›','page=1;render()')}</div>`+card(`<div class="ledger">${row('商売','売上 480 G')}${row('仕入れ','300 G')}${row('仲間への支援','支度金 100 G')}${row('遠征','周辺の森へ出発')}${row('現金収支','＋80 G')}</div>`)+note('日付ごとに短い記録を表示。会話全文は重ねない。')+`<div class="bottom">${btn('記録に戻る',`go('records')`)}</div>`}
function renderBase(){ $('#date').textContent=`1年 春${day}日 · ${phases[phase]}`;$('#gold').textContent=money(gold);$('#nav').innerHTML=navs.map(([id,icon,s])=>`<button class="${screen===id||screen==='equipment'&&equipmentOrigin?.screen===id||id==='home'&&screen==='trade'||id==='records'&&['journal','encyclopedia'].includes(screen)?'active':''}" onclick="go('${id}')"><span>${icon}</span>${s}</button>`).join('');$('#view').innerHTML=({home,trade,tradingReport:tradingReportView,equipment:equipmentView,catalog:catalogView,encyclopedia:encyclopediaView,donation:donationView,warehouse:()=>warehouse(false),adventurers:()=>support(false),residents,records,journal,settings}[screen]||home)();}

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
function shape(d){return `<span class="item-art"><img src="${esc(d.image)}" alt="" loading="lazy" decoding="async" draggable="false"></span>`}
function warehouseArtwork(item){const d=ItemCore.dimensions(item,types),board={width:8,height:8},rotated=item.rotation%2;return `<span class="warehouse-art ${stock[selected]===item?'is-selected':''}" style="left:${item.x/board.width*100}%;top:${item.y/board.height*100}%;width:${d.width/board.width*100}%;height:${d.height/board.height*100}%"><img src="${esc(def(item).image)}" alt="" draggable="false" style="width:${rotated?d.height/d.width*100:100}%;height:${rotated?d.width/d.height*100:100}%;transform:translate(-50%,-50%) rotate(${rotated?90:0}deg)"></span>`}


function storeItem(instance){const position=ItemCore.findSpace(instance,stock,types,warehouseSize);if(!position)return false;Object.assign(instance,position);stock.push(instance);return true}
function reset(persistReset=true){shopPanelOpen=false;warehouseSize={...config.warehouse};cancelEquipmentDrag();equipmentSelectedUid=null;selectedShelf=0;tradingState={rumors:[],report:null};resetRescue();resetEconomy();if(persistReset)saveReady=true;dungeonProgress={};selectedDungeon=config.dungeons[0].id;equipment={};autoEquip={};brokenTargets={};expeditions=[];returnReport=[];lastSales=0;equipCharacter=null;equipmentOrigin=null;characterPanel="equipment";equipmentSlot="weapon";equipPage=0;day=2;phase=0;gold=config.development.initialGold;counts=[0,0,0];pending=[];stock=[];shelf=[];funds=[0,0,0];party=0;partySlot=0;rosterPage=0;chapter=0;availableCharacterIds=characters.filter(c=>c.joinChapter===chapter).map(c=>c.id);parties=[availableCharacterIds.slice(0,3),[],[]];away=false;selected=0;page=0;uid=0;encyclopedia=EncyclopediaCore.create();encyclopediaSelection=null;for(const id of config.development.initialItemIds){if(!fitsWarehouse(definitions[id]))continue;const item={...newItem(id),durability:10,maxDurability:10};if(!storeItem(item))pending.push(item)}go('home')};
function itemList(items,fn){const size=pending.length?Math.min(2,config.ui.pageSize):config.ui.pageSize;page=Math.min(page,Math.max(0,Math.ceil(items.length/size)-1));return `<div class="list">${items.slice(page*size,page*size+size).map((item,i)=>`<button class="item ${selected===page*size+i?'active':''}" onclick="${fn.replaceAll('INDEX',page*size+i)}"><span><b>${esc(itemName(item))}</b><small class="block">${esc(itemMeta(item))}</small></span><span class="item-mini">${shape(def(item))}</span></button>`).join('')||note('商品はありません')}</div>`+pager(items.length,size)};
function pager(length,size){const pages=Math.max(1,Math.ceil(length/size));return `<div class="page"><button class="mini" ${page===0?'disabled':''} onclick="page--;render()">‹</button><small>${page+1} / ${pages} ページ · ${length}件</small><button class="mini" ${page===pages-1?'disabled':''} onclick="page++;render()">›</button></div>`}
function openCatalog(origin){catalogOrigin=origin;catalogDetail=false;page=0;screen='catalog';render()}
function filteredItems(){return catalog.items.filter(d=>(!catalogSlot||types[d.typeId].slot===catalogSlot)&&(!catalogFilter||d.typeId===catalogFilter)&&(!catalogQuery||d.name.includes(catalogQuery)))}
function catalogView(){if(catalogDetail)return catalogItemView();const items=filteredItems();return title('アイテム設定一覧',`${catalog.items.length}種類`)+`<div class="catalog-filters"><select aria-label="装備枠" onchange="catalogSlot=this.value;catalogFilter='';page=0;render()"><option value="">すべての枠</option>${Object.entries(catalog.slots).map(([id,name])=>`<option value="${id}" ${catalogSlot===id?'selected':''}>${name}</option>`).join('')}</select><select aria-label="装備種類" onchange="catalogFilter=this.value;page=0;render()"><option value="">すべての種類</option>${catalog.types.filter(t=>!catalogSlot||t.slot===catalogSlot).map(t=>`<option value="${t.id}" ${catalogFilter===t.id?'selected':''}>${esc(t.label)}</option>`).join('')}</select></div><form class="actions" onsubmit="event.preventDefault();catalogQuery=this.elements.query.value.trim();page=0;render()"><input name="query" aria-label="アイテム名検索" placeholder="アイテム名を検索" value="${esc(catalogQuery)}"><button class="mini">検索</button></form><div class="catalog-list">${items.slice(page*config.ui.pageSize,(page+1)*config.ui.pageSize).map(d=>`<button class="item" onclick="catalogItemId='${d.id}';catalogDetail=true;render()"><span><b>${esc(d.name)}</b><small class="block">${esc(types[d.typeId].label)} · ${catalog.elements[d.element]} · ${d.price==null?'価格未設定':d.price+' G'}</small><small class="block">${esc(d.description||'説明未設定')}</small></span>${shape(d)}</button>`).join('')||note('一致するアイテムはありません')}</div>${pager(items.length,config.ui.pageSize)}<div class="bottom">${note('正式価格・能力は未設定。装備の耐久度は個体ごとに管理。')}${btn('戻る',`go('${catalogOrigin}')`)}</div>`}
function catalogItemView(){const d=definitions[catalogItemId],t=types[d.typeId];return title('アイテム詳細','登録済み')+card(`<div class="row"><div><h2>${esc(d.name)}</h2><small>${esc(t.label)}</small></div>${shape(d)}</div><div class="ledger">${row('装備枠',t.slot?catalog.slots[t.slot]:'装備不可')}${row('寸法（横×縦）',t.width?`${t.width} × ${t.height}`:'未設定')}${row('形状の指定',esc(t.shapeLabel||'未設定'))}${row('属性',catalog.elements[d.element])}${row('価格',d.price===null?'未設定':esc(d.price)+' G')+row('商品説明',esc(d.description||'未設定'))}${row('能力',d.stats===null?'未設定':esc(JSON.stringify(d.stats)))}${row('耐久',t.slot?'基準10（仕入れ時8〜12）':'装備対象外')}</div>`)+(d.effect?card(`<h2>素材の用途</h2><p>${catalog.elements[d.effect.element]}属性付与</p>${note('付与量・費用・対象・消費ルールは未設定。')}`):'')+note('ID: '+d.id)+`<div class="bottom">${btn('一覧へ戻る','catalogDetail=false;render()','primary')}</div>`}
let warehouseShowStock=false;
function showIncomingWarehouseItem(){warehouseShowStock=false;render()}
function warehouseCell(x,y){const hit=stock.find(item=>{const d=ItemCore.dimensions(item,types);return d&&x>=item.x&&x<item.x+d.width&&y>=item.y&&y<item.y+d.height});if(hit){const index=stock.indexOf(hit);if(selected===index){warehouseShowStock=true;rotateSelected();render();return}selected=index;warehouseShowStock=true;render();return}const item=stock[selected];if(!item)return;const position=ItemCore.findNearby(item,x,y,item.rotation,stock,types,warehouseSize);if(!position)return;Object.assign(item,position);render()}
function rotateSelected(){const item=stock[selected];if(!item)return;const rotation=(item.rotation+1)%2;const position=ItemCore.findNearby(item,item.x,item.y,rotation,stock,types,warehouseSize,true);if(!position)return;Object.assign(item,position);render()}
function warehouseUsed(){return stock.reduce((sum,item)=>{const d=ItemCore.dimensions(item,types);return sum+d.width*d.height},0)}
function warehouseSummary(){return `${warehouseSize.width}×${warehouseSize.height} · ${warehouseUsed()}/${warehouseSize.width*warehouseSize.height}マス`}
function warehouseItemStats(item){const stats=def(item).stats;if(!stats||typeof stats!=='object')return '能力値：未設定';const labels={attack:'攻撃',defense:'防御',hp:'HP'};const values=Object.entries(stats).filter(([key,value])=>Object.hasOwn(labels,key)&&typeof value==='number').map(([key,value])=>`${labels[key]}${value>=0?'＋':''}${value}`);return values.length?values.join(' ／ '):'能力値：未設定'}
function warehouseWorkspace(routine=false){selected=Math.min(selected,Math.max(0,stock.length-1));const item=stock[selected],board={width:8,height:8};let grid=`<div class="grid real-board" style="grid-template-columns:repeat(${board.width},1fr);--board-rows:${board.height}">`;for(let y=0;y<board.height;y++)for(let x=0;x<board.width;x++){const locked=x>=warehouseSize.width||y>=warehouseSize.height;const index=locked?-1:stock.findIndex(i=>{const d=ItemCore.dimensions(i,types);return x>=i.x&&x<i.x+d.width&&y>=i.y&&y<i.y+d.height});grid+=`<button class="${locked?'warehouse-locked ':''}${index>=0?'filled':''} ${index===selected?'selected':''}" data-x="${x}" data-y="${y}" ${locked?'disabled':`onclick="warehouseCell(${x},${y})"`} aria-label="${locked?'未開放':`${x+1}列${y+1}行 ${index>=0?esc(itemName(stock[index])):'空き'}`}"></button>`}grid+=stock.map(warehouseArtwork).join('')+'</div>';return warehouseItemPanel()+`<div class="warehouse-board-area"><div class="warehouse-pagination" aria-label="倉庫ページ"><button type="button" disabled aria-label="前の倉庫ページ">‹</button><span>1 / 1</span><button type="button" disabled aria-label="次の倉庫ページ">›</button></div>`+grid+`</div><div class="warehouse-footer">`+(routine?next(phase===2?'陳列へ':'経営の次の工程へ'):(pending.length?`<div class="bottom">${btn('取引へ戻る',`go('trade')`,'primary')}</div>`:''))+`</div>`};
function finishPurchase(){if(counts.some(n=>n>0))buy();else{phase=2;go('home')}}
function buy(){if(pending.length){phase=2;go('trade');return}const total=counts.reduce((a,n,i)=>a+n*merchantPrice(i),0);if(!counts.some(n=>n>0))return info('回数を選択','商人の＋で回数を選んでください。');if(total>gold)return info('所持金不足','仕入れ回数を減らしてください。');const pools=[['weapon'],['offhand','head','body'],['accessory']].map(slots=>catalog.items.filter(d=>d.status==='active'&&Number.isInteger(d.unlockChapter)&&d.unlockChapter<=chapter&&slots.includes(types[d.typeId].slot)&&fitsWarehouse(d)));if(counts.some((n,i)=>n>0&&!pools[i].length))return info('仕入れできません','現在の倉庫サイズに合う商品がありません。');pending=counts.flatMap((n,i)=>Array.from({length:n*balanceRuntime.itemsPerPurchase},()=>newItem(pools[i][Math.floor(Math.random()*pools[i].length)].id)));warehouseShowStock=false;gold-=total;counts=[0,0,0];phase=2;go('trade')};
function receive(){if(!pending.length)return;if(!storeItem(pending[0]))return;selected=stock.length-1;pending.shift();warehouseShowStock=false;render()}
function replenish(){if(!shopLayout()[selectedShelf])return info('棚が未配置です','先に棚を配置してください。');if(!stock.length||shelfItems().length>=config.development.shelfCapacity)return info('補充できません','在庫と棚の空きを確認してください。');if(stock[selected]?.forged)return info('陳列できません','鍛冶済み装備は手動装備または破棄してください。');if(!stock[selected])return;const item=stock.splice(selected,1)[0];item.shelfId=selectedShelf;shelf.push(item);selected=0;page=0;discoverShelfSets();render()};
function returnShelf(){const item=shelfItems().at(-1);if(!item)return;if(!storeItem(item))return info('倉庫に入りません','倉庫を整理してください。');shelf.splice(shelf.indexOf(item),1);delete item.shelfId;render()}
function sales(){const ch=tradingChapter(),rumors=tradingState.rumors.filter(r=>r.startDay<=day&&day<r.endDay);return title('本日の営業','06 / 06')+card(row('本日の来店予定',`${ch.visitors.min}〜${ch.visitors.max}人`)+row('陳列中',shelf.length+'品')+note('翌日へ進むと購入を判定します。売れ残りは持ち越します。'))+card(`<h2>お店の噂</h2>${note(rumors.map(r=>esc(tradingConfig.rumors.find(d=>d.id===r.id).name)+' · あと'+(r.endDay-day)+'日').join(' ／ ')||'現在の噂はありません。')}`)+note('固定価格で販売。客層・所持金・購入率は開発用の仮設定。')+`<div class="bottom">${btn('翌日へ · 朝の報告','finishDay()','primary')}${steps()}</div>`};

function downloadConfig(kind){const data=kind==='items'?catalog:config;const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=kind==='items'?'item-catalog.json':'game-settings.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function settings(){return title('設定')+card(`<h2>進行データ</h2><div class="actions">${btn('JSON書き出し','exportGame()')}${btn('JSON読み込み',"document.querySelector('#saveInput').click()")}</div><input id="saveInput" type="file" accept="application/json,.json" hidden onchange="importGame(this.files[0])">${note(catalogMigrationNotice||saveError||'操作ごとにこのブラウザへ自動保存します。')}`)+card(`<h2>表示スキン</h2><div class="actions">${[['','標準'],['paper','紙'],['night','夜']].map(([id,s])=>btn(s,`document.documentElement.dataset.skin='${id}';render()`)).join('')}</div>`)+card(`<h2>アイテム設定 · ${catalog.items.length}種類</h2>${btn('設定されたアイテムを確認',`openCatalog('settings')`)}<br>${note('JSONを編集して再読み込みすると反映されます。')}`)+card(`<h2>設定JSONの書き出し</h2><div class="actions">${btn('アイテム定義',`downloadConfig('items')`)}${btn('確認用設定',`downloadConfig('settings')`)}</div>`)+note('正式価格・能力は未設定。耐久度は個体ごとに管理。')+`<div class="bottom">${btn('経営に戻る',`go('home')`,'primary')}</div>`};
function render(){rescueUnpaidBill();renderBase();persist()}
async function loadItemSettings(){try{const responses=await Promise.all(['data/item-catalog.json','data/game-settings.json','data/encyclopedia.json','data/characters.json','data/economy.json','data/trading.json'].map(path=>fetch(path,{cache:'no-store'})));if(responses.some(r=>!r.ok))throw Error('設定ファイルが読み込めません');[catalog,config,encyclopediaDefinitions,characters,economyConfig,tradingConfig]=await Promise.all(responses.map(r=>r.json()));initializeBalance();ItemCore.validate(catalog,config);validateEconomyConfig(economyConfig);validateRescueConfig();validateDungeonConfig();validateAdventurerConfig();validateWarehouseConfig();types=Object.fromEntries(catalog.types.map(t=>[t.id,t]));definitions=Object.fromEntries(catalog.items.map(d=>[d.id,d]));validateTradingConfig();prices.splice(0,prices.length,...config.development.merchantCosts);const saved=readStoredGame();saveReady=false;reset(false);if(saved){try{applySave(saved);saveReady=true;go('home')}catch(error){info('保存データを読み込めません',error.message)}}else{saveReady=!saveError;persist()}}catch(error){$('#view').innerHTML=title('設定の読み込みエラー')+note(esc(error.message))+note('HTTPプレビューから開いてください。JSONを修正した場合は構文とIDを確認してください。')+btn('再読み込み','location.reload()')}}

// Procurement results and warehouse organisation share one workspace.
function warehouseItemPanel(){
 const incoming=pending.length&&!warehouseShowStock,item=incoming?pending[0]:stock[selected];
 const header=pending.length?`<div class="row"><h2>商品情報</h2><small>仕入れ結果 · 残り${pending.length}品</small></div>`:'<h2>商品情報</h2>';
 const choose=pending.length&&warehouseShowStock?btn('未収納の商品を見る','showIncomingWarehouseItem()','mini'):'';
 const info=item?`<div class="row"><div><b ${incoming?'class="incoming-draggable" data-drag-incoming="true" title="倉庫へドラッグ"':''}>${incoming?'↕ ':''}${esc(itemName(item))}</b><small class="block">${incoming?esc(itemMeta(item))+' ／ ':''}${esc(warehouseItemStats(item))}</small></div>${incoming?'':btn('↻ 回転','rotateSelected()','mini')}</div>`:note('商品がありません');
 const actions=incoming?(()=>{const canStore=!!ItemCore.findSpace(item,stock,types,warehouseSize);return `<div class="actions">${btn(canStore?'収納':'収納不可','receive()','primary mini').replace('<button ',canStore?'<button ':'<button disabled ')}${btn('引取 '+money(buybackValue(item)),'buybackIncoming()','mini')}</div>`})():item?`<div class="actions">${btn('商人へ引取 '+money(buybackValue(item)),"confirmStockAction('buyback')",'mini')}${btn('破棄',"confirmStockAction('discard')",'mini')}</div>`:'';
 return `<section class="card warehouse-item-panel">${header}${choose}${info}${actions}</section>`;
}
function combinedWarehouse(routine=true){let content=warehouseWorkspace(routine);if(pending.length)content=content.replace('onclick="advance()"','disabled onclick="advance()"');return content}
function trade(){return combinedWarehouse(true)};
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
