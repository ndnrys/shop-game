const SAVE_KEY='shop-game-save';let saveError='',saveReady=false,catalogMigrationNotice='';
function snapshot(){return {version:EquipmentCore.version,catalogVersion:catalog.contentVersion,day,phase,gold,warehouseSize,counts,pending,stock,shelf,funds,chapter,availableCharacterIds,parties,uid,equipment,autoEquip,brokenTargets,dungeonProgress,expeditions,returnReport,lastSales,encyclopedia,economyState,rescueState,donationState,tradingState,ledgerHistory}}
function readStoredGame(){try{return typeof localStorage==='undefined'?null:JSON.parse(localStorage.getItem(SAVE_KEY)||'null')}catch(error){saveError='保存データを読めません。JSONのバックアップから復元してください。';return null}}
function persist(){if(!saveReady||typeof localStorage==='undefined')return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(snapshot()));saveError=''}catch(error){saveError='自動保存できません。JSONを書き出して保管してください。'}}
function validateSave(raw){
 const s=JSON.parse(JSON.stringify(raw));const fail=()=>{throw Error('保存データの形式または値が不正です')};
 if(!s||![1,2].includes(s.version))throw Error('対応する保存バージョンは1・2です');
 const previousCatalog=s.catalogVersion??1;
 if(previousCatalog!==catalog.contentVersion&&previousCatalog!==catalog.migration.fromContentVersion)throw Error('対応しないアイテム一覧の保存データです');
 if(previousCatalog!==catalog.contentVersion){
  const retired=new Set(catalog.migration.removedItemIds);let removed=0;
  const keep=item=>{if(item&&retired.has(item.itemId)){removed++;return false}return true};
  for(const key of ['stock','pending','shelf'])if(Array.isArray(s[key]))s[key]=s[key].filter(keep);
  for(const slots of Object.values(s.equipment||{}))for(const [slot,item] of Object.entries(slots||{}))if(item&&!keep(item))slots[slot]=null;
  for(const slots of Object.values(s.brokenTargets||{}))for(const [slot,id] of Object.entries(slots||{}))if(retired.has(id))delete slots[slot];
  for(const id of Object.keys(s.encyclopedia?.items||{}))if(retired.has(id))delete s.encyclopedia.items[id];
  s.catalogMigrationRemoved=removed;
 }
 s.catalogVersion=catalog.contentVersion;

 const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
 if(!integer(s.day,1)||!integer(s.phase)||s.phase>5||!integer(s.gold)||!integer(s.chapter))fail();
 for(const k of ['counts','funds'])if(!Array.isArray(s[k])||s[k].length!==3||!s[k].every(n=>integer(n)))fail();
 const ids=new Set(characters.map(c=>c.id)),seen=new Set(),assigned=new Set();
 if(!Array.isArray(s.availableCharacterIds)||new Set(s.availableCharacterIds).size!==s.availableCharacterIds.length||s.availableCharacterIds.some(id=>!ids.has(id)))fail();
 if(!Array.isArray(s.parties)||s.parties.length!==3)fail();
 for(const members of s.parties){if(!Array.isArray(members)||members.length>3)fail();for(const id of members){if(id===null)continue;if(!s.availableCharacterIds.includes(id)||assigned.has(id))fail();assigned.add(id)}}
 const migrate=item=>{if(!item||!integer(item.uid,1)||seen.has(item.uid)||!definitions[item.itemId])fail();seen.add(item.uid);const d=definitions[item.itemId];return {...(types[d.typeId].slot?EquipmentCore.normalize(item):item),typeId:d.typeId}};
 for(const k of ['stock','pending','shelf']){if(!Array.isArray(s[k]))fail();s[k]=s[k].map(migrate)}
 if(s.warehouseSize===undefined)s.warehouseSize={width:config.warehouseExpansion.legacySize,height:config.warehouseExpansion.legacySize};
 if(!s.warehouseSize||!config.warehouseExpansion.sizes.includes(s.warehouseSize.width)||s.warehouseSize.width!==s.warehouseSize.height)fail();
 for(const item of s.stock)if(![0,1].includes(item.rotation)||!ItemCore.canPlace(item,item.x,item.y,item.rotation,s.stock,types,s.warehouseSize))fail();
 validateEconomySave(s,fail);
 if(s.shelf.length>config.development.shelfCapacity*s.economyState.shelfCount||s.shelf.some(i=>i.forged))fail();
 s.ledgerHistory??=[];if(!Array.isArray(s.ledgerHistory)||s.ledgerHistory.some(e=>!e||!Number.isSafeInteger(e.day)||e.day<1||['sales','purchases','funding','expenses','otherIncome'].some(k=>!Number.isSafeInteger(e[k])||e[k]<0)||!Array.isArray(e.expeditions)||e.expeditions.some(x=>!config.dungeons.some(d=>d.id===x.dungeonId)||!Number.isInteger(x.party)||x.party<0||x.party>2||!Number.isInteger(x.gain)||x.gain<0||x.gain>100||!Number.isInteger(x.total)||x.total<0||x.total>100)))fail();s.equipment??={};s.autoEquip??={};s.brokenTargets??={};s.expeditions??=[];s.returnReport??=[];s.lastSales??=0;
 for(const [id,slots] of Object.entries(s.equipment)){if(!ids.has(id)||!slots||typeof slots!=='object')fail();for(const [slot,item] of Object.entries(slots)){if(!Object.hasOwn(catalog.slots,slot))fail();if(item){slots[slot]=migrate(item);if(types[slots[slot].typeId].slot!==slot)fail()}}}
 for(const [key,boolean] of [['autoEquip',true],['brokenTargets',false]])for(const [id,slots] of Object.entries(s[key])){if(!ids.has(id)||!slots||typeof slots!=='object')fail();for(const [slot,value] of Object.entries(slots))if(!Object.hasOwn(catalog.slots,slot)||(boolean?typeof value!=='boolean':!definitions[value]||types[definitions[value].typeId].slot!==slot))fail()}
 s.dungeonProgress??={};
 if(!s.dungeonProgress||typeof s.dungeonProgress!=='object'||Array.isArray(s.dungeonProgress))fail();
 for(const [id,value] of Object.entries(s.dungeonProgress)){const d=config.dungeons.find(d=>d.id===id);if(!d||!Number.isFinite(value)||value<0||value>d.requiredProgress)fail()}
 for(const trip of (Array.isArray(s.expeditions)?s.expeditions:[])){if(trip.dungeonId!==undefined){if(!config.dungeons.some(d=>d.id===trip.dungeonId)||!trip.power||!['attack','bonus'].every(k=>Number.isFinite(trip.power[k])&&trip.power[k]>=0))fail()}}
 if(!Array.isArray(s.expeditions)||s.expeditions.length>3)fail();const travelers=new Set(),tripParties=new Set();
 for(const trip of s.expeditions){if(!integer(trip.party)||trip.party>2||tripParties.has(trip.party)||!integer(trip.returnDay,s.day+1)||trip.returnDay!==s.day+1||!Array.isArray(trip.members)||trip.members.length<1||trip.members.length>3)fail();tripParties.add(trip.party);for(const id of trip.members){if(!s.parties[trip.party].includes(id)||travelers.has(id))fail();travelers.add(id)}}
 for(const trip of s.expeditions)if(trip.health!==undefined){
  if(!trip.dungeonId||!trip.health||typeof trip.health!=='object'||Array.isArray(trip.health)||Object.keys(trip.health).length!==trip.members.length)fail();
  for(const id of trip.members){const r=trip.health[id];if(!r||!['healthy','injured','severe','dead'].includes(r.status)||!integer(r.recoveryDays)||(['healthy','dead'].includes(r.status)?r.recoveryDays!==0:r.recoveryDays<1))fail()}
 }
 if(!Array.isArray(s.returnReport)||s.returnReport.some(x=>typeof x!=='string')||!integer(s.lastSales))fail();
 if(!s.encyclopedia||['items','sets','people'].some(k=>!s.encyclopedia[k]||typeof s.encyclopedia[k]!=='object'||Array.isArray(s.encyclopedia[k])))fail();
 for(const [id,r] of Object.entries(s.encyclopedia.items)){if(!definitions[id]||!r||!integer(r.sold)||!integer(r.expeditions)||!Array.isArray(r.usedInstances)||r.usedInstances.some(n=>!integer(n,1))||r.discovered!==true)fail()}
 for(const [id,r] of Object.entries(s.encyclopedia.sets)){if(!encyclopediaDefinitions.sets.some(d=>d.id===id)||!r||!integer(r.expeditions)||!Array.isArray(r.usedCombinations)||r.discovered!==true)fail()}
 for(const [id,r] of Object.entries(s.encyclopedia.people))if(!encyclopediaDefinitions.people.some(d=>d.id===id)||!r||r.discovered!==true)fail();
 validateRescueSave(s,fail);validateTradingSave(s,fail);
 s.uid=Math.max(integer(s.uid)?s.uid:0,...seen);s.version=EquipmentCore.version;return s;
}
function applySave(raw){const s=validateSave(raw);cancelEquipmentDrag();equipmentSelectedUid=null;catalogMigrationNotice=s.catalogMigrationRemoved?`アイテム一覧を更新し、廃止品${s.catalogMigrationRemoved}点を取り除きました。共通の商品・所持金・日数は維持しました。`:'';({day,phase,gold,warehouseSize,counts,pending,stock,shelf,funds,chapter,availableCharacterIds,parties,uid,equipment,autoEquip,brokenTargets,dungeonProgress,expeditions,returnReport,lastSales,encyclopedia,economyState,rescueState,donationState,tradingState,ledgerHistory}=s);selectedShelf=0;away=expeditions.length>0;party=0;partySlot=0;selected=0;page=0;equipPage=0;equipCharacter=null;equipmentOrigin=null;characterPanel='equipment'}
function exportGame(){const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot(),null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='shop-game-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function importGame(file){if(!file)return;try{if(file.size>5*1024*1024)throw Error('ファイルは5MB以内にしてください');const data=JSON.parse(await file.text());applySave(data);saveReady=true;go('home');info('読み込み完了','進行データを復元しました。')}catch(error){info('読み込めません',error.message)}}
