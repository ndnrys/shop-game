// Daily costs are settled once, using the previous evening's state.
let economyConfig,economyState;
const economyChapterId=number=>number===0?'prologue':number===8?'finale':`chapter_${number}`;
function validateEconomyConfig(data){
 const valid=n=>Number.isSafeInteger(n)&&n>=0;
 if(!data?.chapters||!valid(data.healing?.costPerLevel))throw Error('治療単価が未設定または不正です');
 for(const values of Object.values(data.chapters))for(const key of ['seasonTax','shopMaintenancePerShelf','companionMaintenancePerPerson','shelfExpansionCost'])if(!valid(values[key]))throw Error('経済設定が未設定または不正です');
}
function resetEconomy(){economyState={version:1,shelfCount:1,companions:{},bill:null}}
function shelfCapacity(){return config.development.shelfCapacity*economyState.shelfCount}
function companionStatus(id){const state=economyState.companions[id];return state?.dead?'dead':isAway(id)?'away':state?.recoveryDay>day?'recovering':'waiting'}
function companionLevel(id){return economyState.companions[id]?.level??characters.find(c=>c.id===id).initialLevel}
function recoverCompanions(){for(const c of Object.values(economyState.companions))if(!c.dead&&c.recoveryDay<=day)delete c.recoveryDay}
function closeEconomyDay(){
 if(economyState.bill?.status==='unpaid'||economyState.bill?.day===day)return;
 const chapterId=economyChapterId(chapter),rates=economyConfig.chapters[chapterId];
 if(!rates)throw Error('現在の章の経済設定がありません');
 const count=availableCharacterIds.filter(id=>['waiting','recovering'].includes(companionStatus(id))).length;
 const bill={day,chapterId,shelfCount:economyState.shelfCount,companionCount:count,shop:rates.shopMaintenancePerShelf*economyState.shelfCount,companions:rates.companionMaintenancePerPerson*count,tax:day%5===0?rates.seasonTax:0,status:'unpaid'};
 bill.total=bill.shop+bill.companions+bill.tax;economyState.bill=bill;settleEconomyBill();
}
function settleEconomyBill(){const bill=economyState.bill;if(!bill||bill.status!=='unpaid'||gold<bill.total)return false;gold-=bill.total;bill.status='paid';return true}
// Bankruptcy integration reads this saved, unpaid bill. No substitute bankruptcy rule.
function bankruptcyExpense(){const b=economyState.bill;return b?.status==='unpaid'?{day:b.day,amount:b.total,shortfall:Math.max(0,b.total-gold)}:null}
function retryEconomyBill(){settleEconomyBill();render()}
function economyReport(){const b=economyState.bill;if(!b)return note('初回の朝は固定費の徴収なし。');return row('店舗管理費',money(b.shop))+row('仲間維持費',money(b.companions))+row('季節税',money(b.tax))+row(`${b.day}日分の固定費合計`,money(b.total))+(b.status==='paid'?note('支払済み'):note('所持金不足・未払い。支払いが済むまで経営を進められません。')+btn('支払いを再確認','retryEconomyBill()','mini'))}
function healCompanion(id){if(!availableCharacterIds.includes(id)||companionStatus(id)!=='recovering')return;const cost=companionLevel(id)*economyConfig.healing.costPerLevel;if(gold<cost)return info('所持金不足','治療費が足りません。');gold-=cost;delete economyState.companions[id].recoveryDay;render()}
function expandShelf(){const cost=economyConfig.chapters[economyChapterId(chapter)]?.shelfExpansionCost;if(cost==null)return info('増設できません','この章の増設費が未設定です。');if(gold<cost)return info('所持金不足','棚の増設費が足りません。');gold-=cost;economyState.shelfCount++;render()}
function residents(){
 const all=availableCharacters(),size=2;page=Math.min(page,Math.max(0,Math.ceil(all.length/size)-1));
 const cost=economyConfig.chapters[economyChapterId(chapter)]?.shelfExpansionCost;
 return title('村の住人')+card('<h2>教会 · 治療</h2>'+all.slice(page*size,(page+1)*size).map(c=>{const status=companionStatus(c.id),cost=companionLevel(c.id)*economyConfig.healing.costPerLevel;return row(esc(c.name)+' · Lv.'+companionLevel(c.id),{waiting:'待機中',away:'遠征中',recovering:'療養中',dead:'死亡中'}[status])+(status==='recovering'?`<div class="actions"><small>${economyState.companions[c.id].recoveryDay}日朝に自然回復</small>${btn('治療 '+money(cost),`healCompanion('${c.id}')`,'mini')}</div>`:'')}).join('')+pager(all.length,size))+card('<h2>大工 · 棚増設</h2>'+row('設置棚数 / 陳列上限',`${economyState.shelfCount}棚 / ${shelfCapacity()}点`)+btn('棚を1つ増設 '+(cost==null?'未設定':money(cost)),'expandShelf()','mini'))+note(`治療は1人につきLv×${economyConfig.healing.costPerLevel} G。自然回復は無料。`)+`<div class="bottom">${btn('経営に戻る',"go('home')")}</div>`;
}
function validateEconomySave(s,fail){
 s.economyState??={version:1,shelfCount:1,companions:{},bill:null};
 if(!economyConfig.chapters[economyChapterId(s.chapter)])fail();
 const e=s.economyState,int=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
 if(e.version!==1||!int(e.shelfCount,1)||!e.companions||typeof e.companions!=='object'||Array.isArray(e.companions))fail();
 for(const [id,c] of Object.entries(e.companions))if(!characters.some(x=>x.id===id)||!c||typeof c!=='object'||(c.dead!==undefined&&typeof c.dead!=='boolean')||(c.level!==undefined&&!int(c.level,1))||(c.recoveryDay!==undefined&&!int(c.recoveryDay,1)))fail();
 const b=e.bill;
 if(b!==null){if(!b||!int(b.day,1)||b.day!==s.day-1||!economyConfig.chapters[b.chapterId]||!['paid','unpaid'].includes(b.status)||!['shelfCount','companionCount','shop','companions','tax','total'].every(k=>int(b[k]))||b.shelfCount<1||b.total!==b.shop+b.companions+b.tax)fail()}
}
