let tradingConfig,selectedShelf=0,tradingState={rumors:[],report:null};
function tradingChapter(){return tradingConfig.chapters[economyChapterId(chapter)]}
function shelfItems(){return shelf.filter(i=>(i.shelfId??0)===selectedShelf)}
function shelfCandidates(){return TradingCore.candidates(shelf,encyclopediaDefinitions.sets,definitions,types,tradingConfig,saleValue)}
function discoverShelfSets(){for(let n=0;n<economyState.shelfCount;n++)EncyclopediaCore.discoverSets(encyclopedia,encyclopediaDefinitions.sets,shelf.filter(i=>(i.shelfId??0)===n))}
function activateRumor(id){const d=tradingConfig.rumors.find(r=>r.id===id);if(!d)return false;tradingState.rumors=tradingState.rumors.filter(r=>r.id!==id);tradingState.rumors.push({id,startDay:day,endDay:day+d.duration});persist();return true}
function resolveTradingDay(random=Math.random){
 const result=TradingCore.simulate({items:shelf,sets:encyclopediaDefinitions.sets,definitions,types,settings:tradingConfig,chapter:tradingChapter(),rumors:tradingState.rumors,day,price:saleValue,random});
 shelf=result.remaining;lastSales=result.revenue;gold+=lastSales;
 for(const visit of result.visits)for(const id of visit.itemIds)EncyclopediaCore.sold(encyclopedia,id);
 tradingState.report={day,revenue:result.revenue,visits:result.visits};
 tradingState.rumors=tradingState.rumors.filter(r=>r.endDay>day+1);
 discoverShelfSets();
}
function shelfSelector(){return `<div class="page">${btn('‹','selectedShelf=Math.max(0,selectedShelf-1);page=0;render()','mini')}<b>棚 ${selectedShelf+1} / ${economyState.shelfCount}</b>${btn('›','selectedShelf=Math.min(economyState.shelfCount-1,selectedShelf+1);page=0;render()','mini')}</div>`}
function shelfSummary(){const candidates=shelfCandidates().filter(c=>c.shelfId===selectedShelf),names={set:'セット',identical:'同一商品',slot:'同一部位',normal:'通常'};const counts={};for(const c of candidates){const label=names[c.effect]+' +'+Math.round(c.bonus*100)+'%';counts[label]=(counts[label]||0)+1}return Object.entries(counts).map(([label,n])=>`${label}：${n}${label.startsWith('セット')?'組':'品'}`).join(' ／ ')||'陳列なし'}
function validateTradingSave(s,fail){
 s.tradingState??={rumors:[],report:null};const t=s.tradingState;
 if(!t||!Array.isArray(t.rumors))fail();const ids=new Set();
 for(const r of t.rumors){const d=tradingConfig.rumors.find(d=>d.id===r.id);if(!d||ids.has(r.id)||!Number.isSafeInteger(r.startDay)||r.startDay<1||r.startDay>s.day||r.endDay!==r.startDay+d.duration)fail();ids.add(r.id)}
 const used=new Map();for(let n=0;n<s.shelf.length;n++){const item=s.shelf[n];item.shelfId??=Math.floor(n/config.development.shelfCapacity);if(!Number.isSafeInteger(item.shelfId)||item.shelfId<0||item.shelfId>=s.economyState.shelfCount)fail();used.set(item.shelfId,(used.get(item.shelfId)||0)+1)}
 if([...used.values()].some(n=>n>config.development.shelfCapacity))fail();
 if(t.report!==null){const r=t.report;if(!r||!Number.isSafeInteger(r.day)||r.day<1||r.day>=s.day||!Number.isSafeInteger(r.revenue)||r.revenue<0||!Array.isArray(r.visits))fail();let sum=0;const sold=new Set();for(const v of r.visits){if(!tradingConfig.customers.some(c=>c.id===v.customerId)||!Number.isSafeInteger(v.money)||v.money<0||!Number.isSafeInteger(v.price)||v.price<0||v.price>v.money||!Array.isArray(v.itemIds)||v.itemIds.some(id=>!definitions[id])||!Array.isArray(v.uids)||v.uids.length!==v.itemIds.length||v.uids.some(id=>!Number.isSafeInteger(id)||id<1||sold.has(id))||v.setId!==null&&!encyclopediaDefinitions.sets.some(d=>d.id===v.setId)||v.itemIds.length>1&&!v.setId)fail();for(const id of v.uids)sold.add(id);sum+=v.price}if(sum!==r.revenue)fail()}
}
function validateTradingConfig(){
 const c=tradingConfig,fail=()=>{throw Error('売買設定が不正です')},number=n=>Number.isFinite(n)&&n>=0,range=r=>r&&Number.isSafeInteger(r.min)&&Number.isSafeInteger(r.max)&&r.min>=0&&r.max>=r.min;
 if(!c||c.schemaVersion!==1||!c.rules||c.rules.setPriority!=='definitionOrder'||c.rules.selection!=='uniform'||typeof c.rules.allowUsedInSets!=='boolean'||!number(c.rules.minProbability)||!number(c.rules.maxProbability)||c.rules.maxProbability>1||c.rules.minProbability>c.rules.maxProbability)fail();
 for(const id of ['set','identical','slot'])if(!number(c.effects?.[id]?.bonus)||(id!=='set'&&(!Number.isSafeInteger(c.effects[id].minimum)||c.effects[id].minimum<2)))fail();
 if(!Array.isArray(c.customers)||!c.customers.length||new Set(c.customers.map(d=>d.id)).size!==c.customers.length)fail();
 for(const d of c.customers){if(!d.id||typeof d.name!=='string'||!number(d.probability)||d.probability>1||!d.items||!d.categories)fail();for(const [id,n] of Object.entries(d.items))if(!definitions[id]||!number(n)||n>1)fail();for(const [id,n] of Object.entries(d.categories))if(!types[id]||!number(n)||n>1)fail()}
 for(const id of Object.keys(economyConfig.chapters)){const ch=c.chapters?.[id];if(!ch||!range(ch.visitors))fail();for(const d of c.customers)if(!range(ch.customers?.[d.id]?.money)||!number(ch.customers[d.id].weight))fail()}
 if(!Array.isArray(c.rumors)||new Set(c.rumors.map(d=>d.id)).size!==c.rumors.length)fail();for(const r of c.rumors){if(!r.id||typeof r.name!=='string'||!Number.isSafeInteger(r.duration)||r.duration<1||!r.weights)fail();for(const [id,n] of Object.entries(r.weights))if(!c.customers.some(d=>d.id===id)||!number(n))fail()}
 for(const set of encyclopediaDefinitions.sets)if(!Array.isArray(set.itemIds)||!set.itemIds.length||set.itemIds.some(id=>!definitions[id]))fail();
}

function tradingReportSummary(){const r=tradingState.report;return r?row('来店 / 購入',r.visits.length+'人 / '+r.visits.filter(v=>v.uids.length).length+'人')+btn('販売明細','openTradingReport()','mini'):''}
function openTradingReport(){const r=tradingState.report;if(!r)return;page=0;screen='tradingReport';render()}
function tradingReportView(){const r=tradingState.report;if(!r)return report();const size=3;return title('前日の販売明細',money(r.revenue))+r.visits.slice(page*size,(page+1)*size).map(v=>card(row(esc(tradingConfig.customers.find(c=>c.id===v.customerId).name),money(v.price))+note(v.itemIds.length?v.itemIds.map(id=>esc(definitions[id].name)).join(' ＋ '):'購入なし'))).join('')+pager(r.visits.length,size)+`<div class="bottom">${btn('朝の報告へ',"go('home')")}</div>`}
