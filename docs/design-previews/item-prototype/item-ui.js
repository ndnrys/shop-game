/* Adds the JSON-driven item specification to the existing screen flow. */
let catalog,config,definitions={},types={},uid=0,catalogFilter='',catalogQuery='',catalogSlot='',showPlanned=false,catalogItemId=null,catalogDetail=false,catalogOrigin='warehouse';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const originalRender=render;
function def(instance){return definitions[instance.itemId]}
function type(instance){return types[def(instance).typeId]}
function newItem(id){return{uid:++uid,itemId:id,typeId:definitions[id].typeId,x:null,y:null,rotation:0}}
function itemName(instance){return def(instance).name}
function itemMeta(instance){const d=def(instance),t=type(instance);return `${t.label} · ${t.width?`${t.width}×${t.height}`:'寸法未設定'} · ${catalog.elements[d.element]}`}
function shape(d){const t=types[d.typeId];if(!t.width)return '<div class="shape-empty">寸法未設定</div>';return `<div class="shape" style="grid-template-columns:repeat(${t.width},10px)">${Array.from({length:t.width*t.height},()=>'<i></i>').join('')}</div>`}
function storeItem(instance){const position=ItemCore.findSpace(instance,stock,types,config.warehouse);if(!position)return false;Object.assign(instance,position);stock.push(instance);return true}
reset=function(){day=2;phase=0;gold=config.prototype.initialGold;counts=[0,0,0];pending=[];stock=[];shelf=[];funds=0;away=false;selected=0;page=0;uid=0;for(const id of config.prototype.initialItemIds){if(!storeItem(newItem(id)))throw Error('初期在庫が倉庫に入りません')}go('home')};
itemList=function(items,fn){const size=config.ui.pageSize;page=Math.min(page,Math.max(0,Math.ceil(items.length/size)-1));return `<div class="list">${items.slice(page*size,page*size+size).map((item,i)=>`<button class="item ${selected===page*size+i?'active':''}" onclick="${fn.replaceAll('INDEX',page*size+i)}"><span><b>${esc(itemName(item))}</b><small class="block">${esc(itemMeta(item))}</small></span><span class="item-mini">${shape(def(item))}</span></button>`).join('')||note('商品はありません')}</div>`+pager(items.length,size)};
function pager(length,size){const pages=Math.max(1,Math.ceil(length/size));return `<div class="page"><button class="mini" ${page===0?'disabled':''} onclick="page--;render()">‹</button><small>${page+1} / ${pages} ページ · ${length}件</small><button class="mini" ${page===pages-1?'disabled':''} onclick="page++;render()">›</button></div>`}
function openCatalog(origin){catalogOrigin=origin;catalogDetail=false;page=0;screen='catalog';render()}
function filteredItems(){return catalog.items.filter(d=>(showPlanned||d.status==='active')&&(!catalogSlot||(catalogSlot==='material'?types[d.typeId].slot===null:types[d.typeId].slot===catalogSlot))&&(!catalogFilter||d.typeId===catalogFilter)&&(!catalogQuery||d.name.includes(catalogQuery)))}
function catalogView(){if(catalogDetail)return catalogItemView();const items=filteredItems();return title('アイテム設定一覧',`${catalog.items.length}種類`)+`<div class="catalog-filters"><select aria-label="装備枠" onchange="catalogSlot=this.value;catalogFilter='';page=0;render()"><option value="">すべての枠</option>${Object.entries({...catalog.slots,material:'鍛冶素材'}).map(([id,name])=>`<option value="${id}" ${catalogSlot===id?'selected':''}>${name}</option>`).join('')}</select><select aria-label="装備種類" onchange="catalogFilter=this.value;page=0;render()"><option value="">すべての種類</option>${catalog.types.filter(t=>!catalogSlot||(catalogSlot==='material'?t.slot===null:t.slot===catalogSlot)).map(t=>`<option value="${t.id}" ${catalogFilter===t.id?'selected':''}>${esc(t.label)}</option>`).join('')}</select></div><form class="actions" onsubmit="event.preventDefault();catalogQuery=this.elements.query.value.trim();page=0;render()"><input name="query" aria-label="アイテム名検索" placeholder="アイテム名を検索" value="${esc(catalogQuery)}"><button class="mini">検索</button></form><label class="muted"><input type="checkbox" ${showPlanned?'checked':''} onchange="showPlanned=this.checked;page=0;render()"> 将来候補2種を含める</label><div class="catalog-list">${items.slice(page*config.ui.pageSize,(page+1)*config.ui.pageSize).map(d=>`<button class="item" onclick="catalogItemId='${d.id}';catalogDetail=true;render()"><span><b>${esc(d.name)}</b><small class="block">${esc(types[d.typeId].label)} · ${catalog.elements[d.element]}${d.status==='planned'?' · 将来候補':''}</small></span>${shape(d)}</button>`).join('')||note('一致するアイテムはありません')}</div>${pager(items.length,config.ui.pageSize)}<div class="bottom">${note('未指定の価格・能力・耐久は未設定のまま保存。')}${btn('戻る',`go('${catalogOrigin}')`)}</div>`}
function catalogItemView(){const d=definitions[catalogItemId],t=types[d.typeId];return title('アイテム詳細',d.status==='planned'?'将来候補':'登録済み')+card(`<div class="row"><div><h2>${esc(d.name)}</h2><small>${esc(t.label)}</small></div>${shape(d)}</div><div class="ledger">${row('装備枠',t.slot?catalog.slots[t.slot]:'装備不可')}${row('寸法（横×縦）',t.width?`${t.width} × ${t.height}`:'未設定')}${row('形状の指定',esc(t.shapeLabel||'未設定'))}${row('属性',catalog.elements[d.element])}${row('価格',d.price===null?'未設定':esc(d.price)+' G')}${row('能力',d.stats===null?'未設定':esc(JSON.stringify(d.stats)))}${row('耐久',d.durability===null?'未設定':esc(JSON.stringify(d.durability)))}</div>`)+(d.effect?card(`<h2>素材の用途</h2><p>${catalog.elements[d.effect.element]}属性付与</p>${note('付与量・費用・対象・消費ルールは未設定。')}`):'')+(t.id==='body_light'?note('配置は指定寸法2×3を使用。「正方形」は原文の形状表記。'):'')+note('ID: '+d.id)+`<div class="bottom">${btn('一覧へ戻る','catalogDetail=false;render()','primary')}</div>`}
function warehouseCell(x,y){const hit=stock.find(item=>{const d=ItemCore.dimensions(item,types);return d&&x>=item.x&&x<item.x+d.width&&y>=item.y&&y<item.y+d.height});if(hit){const index=stock.indexOf(hit);if(selected===index){rotateSelected();return}selected=index;render();return}const item=stock[selected];if(!item)return;const position=ItemCore.findNearby(item,x,y,item.rotation,stock,types,config.warehouse);if(!position)return;Object.assign(item,position);render()}
function rotateSelected(){const item=stock[selected];if(!item)return;const rotation=(item.rotation+1)%2;const position=ItemCore.findNearby(item,item.x,item.y,rotation,stock,types,config.warehouse,true);if(!position)return;Object.assign(item,position);render()}
warehouse=function(routine=false){selected=Math.min(selected,Math.max(0,stock.length-1));const item=stock[selected],board=config.warehouse,used=stock.reduce((a,i)=>{const d=ItemCore.dimensions(i,types);return a+d.width*d.height},0);let grid=`<div class="grid real-board" style="grid-template-columns:repeat(${board.width},1fr);--board-rows:${board.height}">`;for(let y=0;y<board.height;y++)for(let x=0;x<board.width;x++){const index=stock.findIndex(i=>{const d=ItemCore.dimensions(i,types);return x>=i.x&&x<i.x+d.width&&y>=i.y&&y<i.y+d.height});grid+=`<button class="${index>=0?'filled':''} ${index===selected?'selected':''}" data-x="${x}" data-y="${y}" onclick="warehouseCell(${x},${y})" aria-label="${x+1}列${y+1}行 ${index>=0?esc(itemName(stock[index])):'空き'}">${index>=0?index+1:''}</button>`}grid+='</div>';return title('倉庫',`${used}/${board.width*board.height}マス`)+`<div class="tabs">${btn('配置','sub=0;render()',sub===0?'active':'')}${btn('商品一覧','sub=1;render()',sub===1?'active':'')}${btn('種類一覧',`openCatalog('warehouse')`)}</div>`+(sub?itemList(stock,'selected=INDEX;render()'):grid)+card(`<div class="row"><div><h2>${item?esc(itemName(item)):'商品なし'}</h2><small>${item?esc(itemMeta(item)):'入荷した商品を収納してください。'}</small></div>${btn('↻ 回転','rotateSelected()','mini')}</div>`)+note('クリックで選択／選択中は回転／長押しでドラッグ。')+(routine?next('陳列へ'):`<div class="bottom">${btn(pending.length?'取引へ戻る':'経営に戻る',`go('${pending.length?'trade':'home'}')`,'primary')}</div>`)};
buy=function(){const total=counts.reduce((a,n,i)=>a+n*prices[i],0);if(!total)return info('回数を選択','商人の＋で回数を選んでください。');if(total>gold)return info('所持金不足','仕入れ回数を減らしてください。');const pools=[['weapon'],['offhand','head','body'],['accessory']].map(slots=>catalog.items.filter(d=>d.status==='active'&&slots.includes(types[d.typeId].slot)));pending=counts.flatMap((n,i)=>Array.from({length:n},()=>newItem(pools[i][Math.floor(Math.random()*pools[i].length)].id)));gold-=total;counts=[0,0,0];go('trade')};
function receive(){if(!pending.length)return;if(!storeItem(pending[0]))return info('倉庫に入りません','倉庫を整理するか、商人へ引き取ってもらってください。');selected=stock.length-1;pending.shift();render()}
trade=function(){const i=pending[0];return title('入荷品の振り分け',`残り ${pending.length}品`)+(i?card(`<div class="row"><div><h2>${esc(itemName(i))}</h2><small>${esc(itemMeta(i))}</small></div>${shape(def(i))}</div><br>${note('正式価格は未設定。引取額は動作確認用。')}<br><div class="actions">${btn('倉庫へ収納','receive()','primary')}${btn('商人へ渡す · '+money(config.prototype.buybackPrice),'pending.shift();gold+=config.prototype.buybackPrice;render()')}</div>`):card('<h2>入荷品の処理が完了しました</h2>'))+card(row('倉庫の商品',stock.length+'点'))+note('仕入れの抽選・費用は既存モックの確認用設定です。')+`<div class="bottom">${btn('倉庫を整理',`go('warehouse')`)}<button class="primary" ${pending.length?'disabled':''} onclick="phase=2;go('home')">取引を終える · 倉庫整理へ</button></div>`};
replenish=function(){if(!stock.length||shelf.length>=config.prototype.shelfCapacity)return info('補充できません','在庫と棚の空きを確認してください。');shelf.push(stock.splice(selected,1)[0]);selected=0;page=0;render()};
function returnShelf(){if(!shelf.length)return;if(!storeItem(shelf[shelf.length-1]))return info('倉庫に入りません','倉庫を整理してください。');shelf.pop();render()}
const originalStocking=stocking;stocking=function(){return originalStocking().replace('stock.push(shelf.pop());render()','returnShelf()').replace('8 点',config.prototype.shelfCapacity+' 点')};
sales=function(){return title('本日の営業','06 / 06')+card('<h2>旅の冒険者が来店</h2><p>「今日は何が並んでいるんだい？」</p>')+card(`<h2>購入結果</h2>${shelf.length?row(esc(itemName(shelf[0])),money(config.prototype.salePrice)):note('陳列がないため販売なし。')}`)+note('価格は既存モックの動作確認用。正式価格は未設定。')+`<div class="hero-placeholder">販売した品は翌日への操作で棚から除去</div><div class="bottom">${btn('翌日へ · 朝の報告',`if(shelf.length){gold+=config.prototype.salePrice;shelf.shift()}advance()`,'primary')}${steps()}</div>`};

function downloadConfig(kind){const data=kind==='items'?catalog:config;const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=kind==='items'?'item-catalog.json':'game-settings.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
settings=function(){return title('設定')+card(`<h2>表示スキン</h2><div class="actions">${[['','標準'],['paper','紙'],['night','夜']].map(([id,s])=>btn(s,`document.documentElement.dataset.skin='${id}';render()`)).join('')}</div>`)+card(`<h2>アイテム設定 · ${catalog.items.length}種類</h2>${btn('設定されたアイテムを確認',`openCatalog('settings')`)}<br>${note('JSONを編集して再読み込みすると反映されます。')}`)+card(`<h2>設定JSONの書き出し</h2><div class="actions">${btn('アイテム定義',`downloadConfig('items')`)}${btn('確認用設定',`downloadConfig('settings')`)}</div>`)+note('価格・能力・耐久は未設定。素材寸法と複合属性は未確定。')+`<div class="bottom">${btn('経営に戻る',`go('home')`,'primary')}</div>`};
render=function(){if(screen==='catalog'){$('#date').textContent=`1年 春${day}日 · ${phases[phase]}`;$('#gold').textContent=money(gold);$('#view').innerHTML=catalogView();return}originalRender()};
async function loadItemSettings(){try{const responses=await Promise.all(['data/item-catalog.json','data/game-settings.json'].map(path=>fetch(path,{cache:'no-store'})));if(responses.some(r=>!r.ok))throw Error('設定ファイルが読み込めません');[catalog,config]=await Promise.all(responses.map(r=>r.json()));ItemCore.validate(catalog,config);types=Object.fromEntries(catalog.types.map(t=>[t.id,t]));definitions=Object.fromEntries(catalog.items.map(d=>[d.id,d]));prices.splice(0,prices.length,...config.prototype.merchantCosts);reset()}catch(error){$('#view').innerHTML=title('設定の読み込みエラー')+note(esc(error.message))+note('HTTPプレビューから開いてください。JSONを修正した場合は構文とIDを確認してください。')+btn('再読み込み','location.reload()')}}
loadItemSettings();

// Procurement results and warehouse organisation share one workspace.
const warehouseWorkspace=warehouse;
function intakePanel(){const item=pending[0];return `<section class="card intake"><div class="row"><h2>仕入れ結果 · 残り${pending.length}品</h2>${item?`<small>${esc(type(item).width)}×${esc(type(item).height)} · ${catalog.elements[def(item).element]}</small>`:''}</div>${item?`<div class="row"><b class="incoming-draggable" data-drag-incoming="true" title="倉庫へドラッグ">↕ ${esc(itemName(item))}</b><div class="actions">${btn('収納','receive()','primary mini')}${btn('引取 '+money(config.prototype.buybackPrice),'pending.shift();gold+=config.prototype.buybackPrice;render()','mini')}</div></div>`:note('入荷品の振り分け完了。倉庫の配置を調整できます。')}</section>`}
function combinedWarehouse(routine=true){let content=warehouseWorkspace(routine);content=content.replace(title('倉庫',`${stock.reduce((a,i)=>{const d=ItemCore.dimensions(i,types);return a+d.width*d.height},0)}/${config.warehouse.width*config.warehouse.height}マス`),title('仕入れ結果・倉庫整理',`${stock.length}点を保管`));content=content.replace('<div class="tabs">',intakePanel()+'<div class="tabs">');if(pending.length)content=content.replace('onclick="advance()"','disabled onclick="advance()"');return content}
trade=function(){return combinedWarehouse(true)};
warehouse=function(routine=false){return (pending.length||routine&&phase===2)?combinedWarehouse(true):warehouseWorkspace(routine)};
const buyWithResults=buy;
buy=function(){buyWithResults();if(screen==='trade'){phase=2;render()}};

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
  if(event.isPrimary===false||event.button!==0||drag)return;
  const incoming=event.target.closest('[data-drag-incoming]');
  const cell=event.target.closest('.real-board button');
  if(!incoming&&!cell)return;
  let item,offsetX=0,offsetY=0;
  if(incoming)item=pending[0];
  else{const x=Number(cell.dataset.x),y=Number(cell.dataset.y);item=stock.find(i=>{const d=ItemCore.dimensions(i,types);return x>=i.x&&x<i.x+d.width&&y>=i.y&&y<i.y+d.height});if(item){offsetX=x-item.x;offsetY=y-item.y;}}
  if(!item)return;
  drag={item,incoming:Boolean(incoming),pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,offsetX,offsetY,active:false,position:null,ghost:null,holdTimer:null};
  drag.holdTimer=setTimeout(()=>{if(!drag)return;drag.active=true;root.setPointerCapture?.(drag.pointerId);root.classList.add('dragging');drag.ghost=document.createElement('div');drag.ghost.className='drag-ghost';drag.ghost.textContent=itemName(drag.item);document.body.append(drag.ghost);update(event);},100);
 });
 root.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.pointerId)return;
  if(!drag.active){if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>6){suppressClickUntil=Date.now()+1000;cleanup();}return;}
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
 root.addEventListener('lostpointercapture',cleanup);
 window.addEventListener('blur',cleanup);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&drag){suppressClickUntil=Date.now()+400;cleanup();}});
})();
