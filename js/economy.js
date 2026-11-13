// Daily costs are settled once, using the previous evening's state.
let economyConfig,economyState;
const economyChapterId=number=>number===0?'prologue':number===8?'finale':`chapter_${number}`;
function validateEconomyConfig(data){
 const valid=n=>Number.isSafeInteger(n)&&n>=0;
 if(!data?.chapters||!valid(data.maximumShelves)||data.maximumShelves<2||!valid(data.healing?.costPerLevel))throw Error('治療単価が未設定または不正です');
 for(const values of Object.values(data.chapters))for(const key of ['seasonTax','shopMaintenancePerShelf','companionMaintenancePerPerson','shelfExpansionCost'])if(!valid(values[key]))throw Error('経済設定が未設定または不正です');
}
function resetEconomy(){economyState={version:1,shelfCount:2,companions:{},bill:null,shelfLayout:[null,null]}}
function shelfCapacity(){return config.development.shelfCapacity*economyState.shelfCount}
function companionStatus(id){const state=economyState.companions[id];return state?.dead?'dead':isAway(id)?'away':state?.recoveryDay>day?'recovering':'waiting'}
function companionLevel(id){return economyState.companions[id]?.level??characters.find(c=>c.id===id).initialLevel}
function recoverCompanions(){for(const c of Object.values(economyState.companions))if(!c.dead&&c.recoveryDay<=day)delete c.recoveryDay}
function closeEconomyDay(){
 if(economyState.bill?.status==='unpaid'||economyState.bill?.day===day)return;
 const chapterId=economyChapterId(chapter),rates=economyConfig.chapters[chapterId];
 if(!rates)throw Error('現在の章の経済設定がありません');
 const count=availableCharacterIds.filter(id=>['waiting','recovering'].includes(companionStatus(id))).length;
 const bill={day,chapterId,shelfCount:economyState.shelfCount,companionCount:count,shop:rates.shopMaintenancePerShelf*economyState.shelfCount,companions:rates.companionMaintenancePerPerson*count,tax:day%balanceRuntime.taxPeriod===0?rates.seasonTax:0,status:'unpaid'};
 bill.total=bill.shop+bill.companions+bill.tax;economyState.bill=bill;settleEconomyBill();
}
function settleEconomyBill(){const bill=economyState.bill;if(!bill||bill.status!=='unpaid'||gold<bill.total)return false;gold-=bill.total;ledgerMoney('expenses',bill.total,bill.day);bill.status='paid';return true}
// Bankruptcy integration reads this saved, unpaid bill. No substitute bankruptcy rule.
function bankruptcyExpense(){const b=economyState.bill;return b?.status==='unpaid'?{day:b.day,amount:b.total,shortfall:Math.max(0,b.total-gold)}:null}
function retryEconomyBill(){settleEconomyBill();render()}
function economyReport(){return rescueReport()+economyBillReport()}
function economyBillReport(){const b=economyState.bill;if(!b)return note('初回の朝は固定費の徴収なし。');return row('店舗管理費',money(b.shop))+row('仲間維持費',money(b.companions))+row('季節税',money(b.tax))+row('固定費',money(b.total))+(b.status==='paid'?note('支払済み'):note('所持金不足・未払い。支払いが済むまで経営を進められません。')+btn('支払いを再確認','retryEconomyBill()','mini'))}
function healCompanion(id){if(!availableCharacterIds.includes(id)||companionStatus(id)!=='recovering')return;const cost=companionLevel(id)*economyConfig.healing.costPerLevel;if(gold<cost)return info('所持金不足','治療費が足りません。');gold-=cost;ledgerMoney('expenses',cost);delete economyState.companions[id].recoveryDay;render()}
function expandShelf(){if(economyState.shelfCount>=economyConfig.maximumShelves)return;const cost=economyConfig.chapters[economyChapterId(chapter)]?.shelfExpansionCost;if(cost==null)return info('増設できません','この章の増設費が未設定です。');if(gold<cost)return info('所持金不足','棚の増設費が足りません。');gold-=cost;ledgerMoney('expenses',cost);economyState.shelfCount++;economyState.shelfLayout.push(null);render()}
function validateWarehouseConfig(){
 const w=config.warehouseExpansion;
 if(!w||JSON.stringify(w.sizes)!=='[5,6,7,8]'||!Array.isArray(w.costs)||w.costs.length!==3||w.costs.some(n=>!Number.isSafeInteger(n)||n<0)||w.legacySize!==8||config.warehouse.width!==config.warehouse.height||!w.sizes.includes(config.warehouse.width))throw Error('倉庫拡張設定が不正です');
 const pages=config.warehousePageExpansion;if(pages&&(pages.cost!==null||pages.size!==null)&&(!Number.isSafeInteger(pages.cost)||pages.cost<0||!w.sizes.includes(pages.size)))throw Error('倉庫ページ追加設定が不正です');
}
function warehouseUpgrade(){const i=config.warehouseExpansion.sizes.indexOf(warehouseSize.width);return i>=0&&i<3?{size:config.warehouseExpansion.sizes[i+1],cost:config.warehouseExpansion.costs[i]}:null}
function expandWarehouse(){
 const upgrade=warehouseUpgrade();if(!upgrade||gold<upgrade.cost)return;
 cancelEquipmentDrag();gold-=upgrade.cost;ledgerMoney('expenses',upgrade.cost);warehouseSize={width:upgrade.size,height:upgrade.size};warehouseBoards();render();
}
function carpenterView(){
 const cost=economyConfig.chapters[economyChapterId(chapter)]?.shelfExpansionCost,upgrade=warehouseUpgrade();
 return card('<h2>大工 · 倉庫拡張</h2>'+row('現在の倉庫',warehouseSummary())+(upgrade?`<button class="primary touch-target" ${gold<upgrade.cost?'disabled':''} onclick="expandWarehouse()">${upgrade.size}×${upgrade.size}へ拡張 · ${money(upgrade.cost)}</button>`:note('最大の8×8まで拡張済み。')))+card('<h2>大工 · 棚増設</h2>'+row('設置棚数 / 陳列上限',`${economyState.shelfCount}棚 / ${shelfCapacity()}点`)+btn(economyState.shelfCount>=economyConfig.maximumShelves?'最大4棚まで増設済み':'棚を1つ増設 '+(cost==null?'未設定':money(cost)),'expandShelf()','mini touch-target').replace('<button ',economyState.shelfCount>=economyConfig.maximumShelves?'<button disabled ':'<button '));
}
function residents(){
 const all=availableCharacters(),size=2;page=Math.min(page,Math.max(0,Math.ceil(all.length/size)-1));
 return title('村の住人')+btn('‹ 経営に戻る',"go('home')",'mini')+`<div class="tabs">${btn('教会 · 治療','sub=0;page=0;render()',sub!==1?'active':'')}${btn('大工 · 拡張','sub=1;page=0;render()',sub===1?'active':'')}</div>`+(sub===1?carpenterView():card('<h2>教会 · 治療</h2>'+all.slice(page*size,(page+1)*size).map(c=>{const status=companionStatus(c.id),cost=companionLevel(c.id)*economyConfig.healing.costPerLevel;return row(esc(c.name)+' · Lv.'+companionLevel(c.id),{waiting:'待機中',away:'遠征中',recovering:'療養中',dead:'死亡中'}[status])+(status==='recovering'?`<div class="actions"><small>${economyState.companions[c.id].recoveryDay}日朝に自然回復</small>${btn('治療 '+money(cost),`healCompanion('${c.id}')`,'mini')}</div>`:'')}).join('')+pager(all.length,size))+note(`治療は1人につきLv×${economyConfig.healing.costPerLevel} G。自然回復は無料。`))+'';
}
function validateEconomySave(s,fail){
 s.economyState??={version:1,shelfCount:1,companions:{},bill:null};
 if(!economyConfig.chapters[economyChapterId(s.chapter)])fail();
 const e=s.economyState,int=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
 if(e.shelfLayout===undefined)e.shelfLayout=Array.from({length:e.shelfCount},()=>null);
 if(!Array.isArray(e.shelfLayout)||e.shelfLayout.length!==e.shelfCount)fail();
 for(let i=0;i<e.shelfLayout.length;i++){
  const p=e.shelfLayout[i];if(p===null)continue;
  if(!p||!int(p.x)||!int(p.y)||p.x+2>8||p.y+2>8)fail();
  for(let j=0;j<i;j++){const q=e.shelfLayout[j];if(q&&p.x<q.x+2&&q.x<p.x+2&&p.y<q.y+2&&q.y<p.y+2)fail()}
 }

 if(e.version!==1||!int(e.shelfCount,1)||!e.companions||typeof e.companions!=='object'||Array.isArray(e.companions))fail();
 for(const [id,c] of Object.entries(e.companions))if(!characters.some(x=>x.id===id)||!c||typeof c!=='object'||(c.dead!==undefined&&typeof c.dead!=='boolean')||(c.level!==undefined&&!int(c.level,1))||(c.recoveryDay!==undefined&&!int(c.recoveryDay,1)))fail();
 for(const [id,c] of Object.entries(e.companions)){
  if(c.experience!==undefined&&!int(c.experience))fail();
  if(c.growthPolicy!==undefined&&!Object.hasOwn(config.adventurers.growth.policies,c.growthPolicy))fail();
  if(c.growth!==undefined){if(!c.growth||typeof c.growth!=='object'||Array.isArray(c.growth)||Object.keys(c.growth).length!==3||!['attack','defense','hp'].every(k=>int(c.growth[k]))||!Number.isSafeInteger(c.growth.attack+c.growth.defense+c.growth.hp)||(c.growth.attack+c.growth.defense+c.growth.hp)%3!==0)fail();const initial=characters.find(x=>x.id===id);if(c.growth.attack+c.growth.defense+c.growth.hp>3*Math.max(0,(c.level??initial.initialLevel)-initial.initialLevel)||!['attack','defense','hp'].every(k=>Number.isSafeInteger(initial.initialStats[k]+c.growth[k])))fail()}
 }
 const b=e.bill;
 if(b!==null){if(!b||!int(b.day,1)||b.day!==s.day-1||!economyConfig.chapters[b.chapterId]||!['paid','unpaid'].includes(b.status)||!['shelfCount','companionCount','shop','companions','tax','total'].every(k=>int(b[k]))||b.shelfCount<1||b.total!==b.shop+b.companions+b.tax)fail()}
}

function warehousePageUpgrade(){const rule=config.warehousePageExpansion;return rule&&Number.isSafeInteger(rule.cost)&&rule.cost>=0&&config.warehouseExpansion.sizes.includes(rule.size)?rule:null}
function addWarehousePage(){const rule=warehousePageUpgrade();if(!rule||gold<rule.cost)return;cancelWarehouseDrag();warehouseBoards().push({width:rule.size,height:rule.size});gold-=rule.cost;ledgerMoney('expenses',rule.cost);switchWarehousePage(warehousePages.length-1)}
function openWarehouseExpansionDialog(){renderWarehouseExpansionDialog();document.querySelector('#warehouseExpansionDialog').showModal()}
function renderWarehouseExpansionDialog(){
 const dialog=document.querySelector('#warehouseExpansionDialog');if(!dialog)return;
 const pageUpgrade=warehousePageUpgrade(),upgrade=warehouseUpgrade(),shelfCost=economyConfig.chapters[economyChapterId(chapter)]?.shelfExpansionCost;
 dialog.innerHTML=`<div class="warehouse-expansion-heading"><h2 id="warehouseExpansionTitle">拡張</h2><button class="wood-control" aria-label="閉じる" onclick="this.closest('dialog').close()">×</button></div><p class="warehouse-expansion-gold">所持金 ${money(gold)}</p><div class="warehouse-expansion-choices"><button class="wood-control" data-expansion="grid" onclick="expandWarehouse()" ${!upgrade||gold<upgrade.cost?'disabled':''}>${uiIcon('box')}<span><b>枠の拡張</b><small>${upgrade?`${warehouseSize.width}×${warehouseSize.height} → ${upgrade.size}×${upgrade.size}`:'最大の8×8まで拡張済み'}</small></span><strong>${upgrade?money(upgrade.cost):'最大'}</strong></button><button class="wood-control" data-expansion="shelf" onclick="expandShelf()" ${economyState.shelfCount>=economyConfig.maximumShelves||shelfCost==null||gold<shelfCost?'disabled':''}>${uiIcon('shelf')}<span><b>棚の増設</b><small>棚を1つ追加 · 現在${economyState.shelfCount}/${economyConfig.maximumShelves}棚</small></span><strong>${shelfCost==null?'未設定':money(shelfCost)}</strong></button><button class="wood-control" data-expansion="page" onclick="addWarehousePage()" ${!pageUpgrade||gold<pageUpgrade.cost?'disabled':''}>${uiIcon('book')}<span><b>倉庫のページを増やす</b><small>${pageUpgrade?`${pageUpgrade.size}×${pageUpgrade.size}の倉庫を追加 · 現在${warehouseBoards().length}ページ`:'追加条件は未設定'}</small></span><strong>${pageUpgrade?money(pageUpgrade.cost):'未設定'}</strong></button></div>`;
 translateVisibleText();formatCurrencyUnits(dialog);
}
