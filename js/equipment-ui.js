// Equipment operations and the compact, paginated support screen.
let equipment={},autoEquip={},brokenTargets={},expeditions=[],returnReport=[],lastSales=0;
let equipCharacter=null,equipmentSlot='weapon',equipPage=0,equipmentOrigin=null;
const partyAway=index=>expeditions.some(e=>e.party===index);
const isAway=id=>expeditions.some(e=>e.members.includes(id));
function gear(id){return equipment[id]??={}}
function prepareEquipment(ids){for(const id of ids)for(const slot of Object.keys(catalog.slots)){
 if(gear(id)[slot]||!autoEquip[id]?.[slot]||!brokenTargets[id]?.[slot])continue;
 const item=EquipmentCore.replacement(stock,brokenTargets[id][slot]);if(!item)continue;
 stock.splice(stock.indexOf(item),1);item.x=null;item.y=null;gear(id)[slot]=item;delete brokenTargets[id][slot];
}}
function depart(){
 if(phase!==4||screen!=='home'||partyAway(party))return;
 const members=parties[party].filter(id=>id&&companionStatus(id)==='waiting');if(!members.length)return info('派遣できません','パーティに仲間を編成してください。');
 if(members.some(isAway))return;
 if(funds[party]>gold)return info('所持金不足','支度金が所持金を超えています。');
 prepareEquipment(members);gold-=funds[party];funds[party]=0;
 expeditions.push({party,members:[...members],returnDay:day+1});away=true;render();
}
function resolveExpeditions(){
 returnReport=[];
 const due=expeditions.filter(e=>e.returnDay<=day);
 for(const trip of due){let count=0;for(const id of trip.members){
  const before=Object.values(gear(id)).filter(Boolean);
  const broken=EquipmentCore.wear(gear(id),balanceRuntime.expeditionWear);brokenTargets[id]??={};
  for(const result of broken){brokenTargets[id][result.slot]=result.itemId;count++;returnReport.push(`${characters.find(c=>c.id===id).name}：${definitions[result.itemId].name}が破損`)}
  for(const item of before){const record=EncyclopediaCore.acquire(encyclopedia,item.itemId);if(!record.usedInstances.includes(item.uid))record.usedInstances.push(item.uid);record.expeditions++}
 }returnReport.unshift(`第${trip.party+1}パーティ帰還・装備耐久−1・破損${count}点`)}
 expeditions=expeditions.filter(e=>e.returnDay>day);away=expeditions.length>0;
}
function changeEquipment(uid=null){
 const id=equipCharacter,slot=equipmentSlot;if(!availableCharacterIds.includes(id)||isAway(id))return;
 const old=gear(id)[slot],next=uid===null?null:stock.find(i=>i.uid===uid);
 if(uid!==null&&(!next||type(next).slot!==slot||next.durability<1))return;
 // Plan the old item's return before mutating either inventory.
 const remaining=stock.filter(i=>i!==next);
 const position=old?ItemCore.findSpace(old,remaining,types,config.warehouse):null;
 if(old&&!position)return info('倉庫に入りません','装備を戻す空きを作ってください。');
 stock=remaining;if(old){Object.assign(old,position);stock.push(old)}
 if(next){next.x=null;next.y=null}gear(id)[slot]=next;delete (brokenTargets[id]??={})[slot];equipPage=0;selected=0;render();
}
function openCharacterEquipment(id){
 if(Date.now()<=partySuppressClick||!availableCharacterIds.includes(id))return;
 if(screen!=='equipment')equipmentOrigin={screen,sub,page,party,partySlot,rosterPage};
 equipCharacter=id;equipmentSlot='weapon';equipPage=0;screen='equipment';render();
}
function closeCharacterEquipment(){
 if(equipmentOrigin){({screen,sub,page,party,partySlot,rosterPage}=equipmentOrigin);equipmentOrigin=null;render()}
 else go('adventurers');
}
function moveEquipmentCharacter(direction){
 const all=availableCharacters(),index=all.findIndex(c=>c.id===equipCharacter),next=all[index+direction];
 if(!next)return;equipCharacter=next.id;equipPage=0;render();
}
function selectEquipmentSlot(slot){if(!Object.hasOwn(catalog.slots,slot))return;equipmentSlot=slot;equipPage=0;render()}
function equipmentView(){
 if(!availableCharacterIds.includes(equipCharacter))equipCharacter=availableCharacters()[0]?.id;
 if(!equipCharacter)return `<div class="heading"><h1>装備</h1>${btn('×','closeCharacterEquipment()')}</div>`+note('仲間がいません。');
 const id=equipCharacter,c=characters.find(c=>c.id===id),item=gear(id)[equipmentSlot],locked=isAway(id),all=availableCharacters(),index=all.findIndex(c=>c.id===id),stats=c.initialStats;
 const candidates=stock.filter(i=>type(i).slot===equipmentSlot),size=2,total=Math.max(1,Math.ceil(candidates.length/size));equipPage=Math.min(equipPage,total-1);
 const attributes=Object.entries(stats.attributes).map(([id,n])=>`${catalog.elements[id]||id}${n}`).join('・')||'なし';
 return `<section class="character-equipment"><div class="heading"><h1>装備</h1><button class="gear-close" aria-label="装備画面を閉じる" onclick="closeCharacterEquipment()">×</button></div>
 <div class="character-switch"><button class="mini" aria-label="前のキャラクター" ${index===0?'disabled':''} onclick="moveEquipmentCharacter(-1)">‹ 前</button><div><h2>${esc(c.name)} · 装備</h2><small>${esc(c.jobName)} · Lv.${c.initialLevel}${locked?' · 遠征中':''}</small></div><button class="mini" aria-label="次のキャラクター" ${index===all.length-1?'disabled':''} onclick="moveEquipmentCharacter(1)">次 ›</button></div>
 <div class="character-stats" aria-label="本人のステータス"><span>HP <b>${stats.hp}</b></span><span>攻撃 <b>${stats.attack}</b></span><span>防御 <b>${stats.defense}</b></span><small>固有属性 ${esc(attributes)}</small></div>
 <div class="equipment-slots">${Object.entries(catalog.slots).map(([slot,label])=>{const equipped=gear(id)[slot];return `<button class="equipment-slot ${slot===equipmentSlot?'active':''}" aria-pressed="${slot===equipmentSlot}" onclick="selectEquipmentSlot('${slot}')"><small>${label}</small><b>${equipped?esc(itemName(equipped)):'未装備'}</b><small>${equipped?`耐久 ${equipped.durability}/${equipped.maxDurability}${equipped.forged?' · 鍛冶済み':''}`:'−'}</small></button>`}).join('')}</div>
 <div class="equipment-controls"><div class="row"><label><input type="checkbox" ${autoEquip[id]?.[equipmentSlot]?'checked':''} onchange="(autoEquip[equipCharacter]??={})[equipmentSlot]=this.checked;render()"> ${catalog.slots[equipmentSlot]}の自動再装備</label><button class="mini" ${locked||!item?'disabled':''} onclick="changeEquipment()">外す</button></div><small>${locked?'遠征中は装備変更できません。':brokenTargets[id]?.[equipmentSlot]?'補充待ち：'+esc(definitions[brokenTargets[id][equipmentSlot]].name):'破損後、次の出発時に同じ商品の未鍛冶品を補充。'}</small></div>
 <div class="equipment-inventory"><h2>倉庫 · ${catalog.slots[equipmentSlot]} ${candidates.length}点</h2><div class="gear-candidates">${candidates.slice(equipPage*size,(equipPage+1)*size).map(i=>`<button class="item" ${locked?'disabled':''} onclick="changeEquipment(${i.uid})"><span><b>${esc(itemName(i))}</b><small class="block">耐久 ${i.durability}/${i.maxDurability}${i.forged?' · 鍛冶済み':''}</small></span><span class="gear-item-art">${shape(def(i))}</span></button>`).join('')||note('対応する倉庫在庫はありません。')}</div></div>
 <div class="page"><button aria-label="倉庫アイテムの前のページ" ${equipPage===0?'disabled':''} onclick="equipPage--;render()">‹</button><small>${equipPage+1}/${total}</small><button aria-label="倉庫アイテムの次のページ" ${equipPage===total-1?'disabled':''} onclick="equipPage++;render()">›</button></div></section>`;
}
function saleValue(item){return type(item).slot?EquipmentCore.price(item,def(item).price??config.development.salePrice,balanceRuntime.minimumPriceRatio):(def(item).price??config.development.salePrice)}
function buybackValue(item){return config.development.salePrice>0?Math.floor(saleValue(item)*config.development.buybackPrice/config.development.salePrice):0}
function buybackIncoming(){const item=pending[0];if(!item||item.forged)return;gold+=buybackValue(item);pending.shift();render()}
function buybackStock(){const item=stock[selected];if(!item)return;if(item.forged)return info('引取できません','鍛冶済み装備は手動装備または破棄してください。');gold+=buybackValue(item);stock.splice(selected,1);selected=0;render()}
function discardStock(){if(!stock[selected])return;stock.splice(selected,1);selected=0;render()}
function finishDay(){if(phase!==5)return;advance()}
