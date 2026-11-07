// Equipment operations and the compact, paginated support screen.
let equipment={},autoEquip={},brokenTargets={},expeditions=[],returnReport=[],lastSales=0;
let dungeonProgress={},selectedDungeon='forest';
let equipCharacter=null,equipmentSlot='weapon',equipPage=0,equipmentOrigin=null,characterPanel='equipment',equipmentSelectedUid=null;
const partyAway=index=>expeditions.some(e=>e.party===index);
const isAway=id=>expeditions.some(e=>e.members.includes(id));
function gear(id){return equipment[id]??={}}
function canEquip(id,item){const c=characters.find(c=>c.id===id);return !!c&&config.adventurers.jobEquipment[c.initialJobId]?.includes(item.typeId)===true}
function companionStats(id){
 const stats=AdventurerCore.stats(characters.find(c=>c.id===id).initialStats,economyState.companions[id]?.growth);
 for(const item of Object.values(gear(id)).filter(Boolean)){
  if(item.durability<=0)continue;
  const bonus=definitions[item.itemId]?.stats;
  if(!bonus)continue;
  for(const key of ['hp','attack','defense']){
   if(Number.isFinite(bonus[key]))stats[key]+=bonus[key];
  }
 }
 return stats;
}
function growthPolicy(id){return economyState.companions[id]?.growthPolicy||config.adventurers.growth.defaultPolicy}
function setGrowthPolicy(policy){
 if(!availableCharacterIds.includes(equipCharacter)||!Object.hasOwn(config.adventurers.growth.policies,policy)||companionStatus(equipCharacter)==='dead')return;
 (economyState.companions[equipCharacter]??={}).growthPolicy=policy;render();
}
function grantExpeditionExperience(members,progress){
 if(progress<=0)return;
 const rules=config.adventurers.growth,share=Math.floor(progress/members.length);
 for(const id of members){
  const c=characters.find(c=>c.id===id),result=AdventurerCore.gainExperience(economyState.companions[id]||{},share,rules,c.initialLevel);
  economyState.companions[id]=result.state;
  returnReport.push(`${c.name}：経験値＋${formatExperience(share)}${result.levels?`・Lv.${result.state.level}（${rules.policies[growthPolicy(id)].name}で${result.levels*rules.pointsPerLevel}ポイント成長）`:''}`);
 }
}
function selectCharacterPanel(panel){if(!['equipment','growth'].includes(panel))return;cancelEquipmentDrag();equipmentSelectedUid=null;characterPanel=panel;render()}
function validateAdventurerConfig(){
 const a=config.adventurers,r=a?.risk,valid=n=>Number.isFinite(n)&&n>=0;
 if(!r||!['injuryRate','severeRate','deathRate','tutorialDeathCap'].every(k=>valid(r[k])&&r[k]<=1)||r.severeRate>1||r.injuryRate+r.deathRate>1||!Number.isSafeInteger(r.tutorialChapter)||r.tutorialChapter<0||!valid(r.denominatorOffset)||r.denominatorOffset<=0||!['injuryRecoveryFactor','severeRecoveryFactor'].every(k=>valid(r[k])&&r[k]>0)||r.severeRecoveryFactor<r.injuryRecoveryFactor||!Number.isSafeInteger(r.minRecoveryDays)||r.minRecoveryDays<1||!Number.isSafeInteger(r.maxRecoveryDays)||r.maxRecoveryDays<r.minRecoveryDays)throw Error('冒険者リスク設定が不正です');
 const g=a.growth;
 if(!g||g.pointsPerLevel!==3||!g.policies||Object.keys(g.policies).length!==4||!['balanced','attack','defense','hp'].every(id=>Object.hasOwn(g.policies,id))||!Object.hasOwn(g.policies,g.defaultPolicy))throw Error('育成設定が不正です');
 if(!g.experience||!Number.isSafeInteger(g.experience.baseRequired)||g.experience.baseRequired<1||!Number.isSafeInteger(g.experience.perLevel)||g.experience.perLevel<0)throw Error('必要経験値が不正です');
 for(const p of Object.values(g.policies))if(typeof p.name!=='string'||!['attack','defense','hp'].every(k=>Number.isSafeInteger(p[k])&&p[k]>=0)||p.attack+p.defense+p.hp!==g.pointsPerLevel)throw Error('育成配分は合計3ポイントにしてください');
 for(const c of characters){const allowed=a.jobEquipment?.[c.initialJobId];if(!Array.isArray(allowed)||allowed.some(id=>!catalog.types.some(t=>t.id===id)))throw Error('職業の装備制限が未設定です')}
}
function expeditionHealth(members,d,random=Math.random){
 const rules=config.adventurers.risk;
 return Object.fromEntries(members.map(id=>[id,AdventurerCore.outcome(AdventurerCore.risks(companionStats(id),d.danger,rules,chapter===rules.tutorialChapter),random)]));
}
function applyExpeditionHealth(trip){
 for(const [id,result] of Object.entries(trip.health||{})){
  if(result.status==='healthy')continue;
  const state=economyState.companions[id]??={};
  if(result.status==='dead'){state.dead=true;delete state.recoveryDay}
  else if(!state.dead)state.recoveryDay=day+result.recoveryDays;
  const label={dead:'死亡',severe:'重傷',injured:'負傷'}[result.status];
  returnReport.push(`${characters.find(c=>c.id===id).name}：${label}${result.status==='dead'?'':`・${state.recoveryDay}日朝に自然回復`}`);
 }
}
function prepareEquipment(ids){for(const id of ids)for(const slot of Object.keys(catalog.slots)){
 if(gear(id)[slot]||!autoEquip[id]?.[slot]||!brokenTargets[id]?.[slot])continue;
 const item=EquipmentCore.replacement(stock,brokenTargets[id][slot]);if(!item||!canEquip(id,item))continue;
 stock.splice(stock.indexOf(item),1);item.x=null;item.y=null;gear(id)[slot]=item;delete brokenTargets[id][slot];
}}
function validateDungeonConfig(){
 if(!Array.isArray(config.dungeons)||!config.dungeons.length)throw Error('遠征先設定が必要です');
 const ids=new Set(config.dungeons.map(d=>d.id));
 if(ids.size!==config.dungeons.length)throw Error('遠征先IDが重複しています');
 for(const d of config.dungeons){
  if(!/^[a-z][a-z0-9_]*$/.test(d.id)||typeof d.name!=='string'||!Number.isSafeInteger(d.chapter)||d.chapter<0||!Number.isSafeInteger(d.requiredProgress)||d.requiredProgress<1||!Number.isFinite(d.danger)||d.danger<0||!Number.isFinite(d.attributeBonus)||d.attributeBonus<0||!Array.isArray(d.requires)||d.requires.some(id=>!ids.has(id)||id===d.id)||!d.recommendedAttributes||typeof d.recommendedAttributes!=='object'||Array.isArray(d.recommendedAttributes)||Object.entries(d.recommendedAttributes).some(([key,n])=>key==='none'||!Object.hasOwn(catalog.elements,key)||!Number.isFinite(n)||n<=0))throw Error('遠征先設定が不正です');
 }
 for(const item of catalog.items)if(item.attributes!==undefined&&(!item.attributes||typeof item.attributes!=='object'||Array.isArray(item.attributes)||Object.entries(item.attributes).some(([key,n])=>key==='none'||!Object.hasOwn(catalog.elements,key)||!Number.isFinite(n)||n<0)))throw Error('装備属性値が不正です');
}
function dungeonCleared(id){const d=config.dungeons.find(d=>d.id===id);return !!d&&(dungeonProgress[id]||0)>=d.requiredProgress}
function dungeonAvailable(d){return d.chapter===chapter&&d.requires.every(dungeonCleared)}
function expeditionPower(members,d){
 let attack=0;const attributes={};
 for(const id of members){attack+=companionStats(id).attack;
  for(const item of Object.values(gear(id)).filter(Boolean)){
   const definition=definitions[item.itemId];
   // Explicit attribute values only; element names do not imply a numerical value.
   for(const [key,value] of Object.entries(definition.attributes||{}))attributes[key]=(attributes[key]||0)+value;
  }
 }
 const favorable=Object.keys(d.recommendedAttributes).reduce((sum,key)=>sum+(attributes[key]||0),0);
 return {attack,attributes,bonus:favorable*d.attributeBonus};
}
function expeditionSafetyLabel(id,d){
 const rules=config.adventurers.risk;
 const risk=AdventurerCore.risks(companionStats(id),d.danger,rules,chapter===rules.tutorialChapter);
 const chance=risk.injury+risk.severe+risk.death;
 return chance<0.10?'安全':chance<0.20?'注意':'危険';
}
function destinationView(){
 const choices=config.dungeons.filter(d=>d.chapter===chapter);
 if(!choices.some(d=>d.id===selectedDungeon))selectedDungeon=choices[0]?.id;
 const d=choices.find(d=>d.id===selectedDungeon);if(!d)return note('この章の遠征先は未設定です。');
 const members=parties[party].filter(id=>id&&companionStatus(id)==='waiting');
 const power=expeditionPower(members,d);
 const attrs=values=>Object.entries(values).map(([key,n])=>`${esc(catalog.elements[key]||key)} ${n}`).join('・')||'なし';
 return card(`<div class="actions">${choices.map(x=>btn(esc(x.name),`selectedDungeon='${x.id}';render()`,x.id===d.id?'active':'')).join('')}</div><h2>${esc(d.name)} · 翌朝帰還</h2>${row('攻略進度',`${Math.round((dungeonProgress[d.id]||0)/d.requiredProgress*100)}%${dungeonCleared(d.id)?' · クリア':''}`)}${row('凶悪度',d.danger)}${note(`推奨属性：${attrs(d.recommendedAttributes)} ／ 装備合計：${attrs(power.attributes)}`)}${note(`攻撃 ${power.attack} ＋ 属性ボーナス ${power.bonus}。属性不足でも遠征可能。`)}${dungeonAvailable(d)?'':note('前のダンジョンをクリアすると解放。')}`);
}
function depart(){
 if(phase!==4||(screen!=='home'&&screen!=='adventurers')||partyAway(party))return;
 const destination=config.dungeons.find(d=>d.id===selectedDungeon);if(!destination||!dungeonAvailable(destination))return;
 const members=parties[party].filter(id=>id&&companionStatus(id)==='waiting');if(!members.length)return info('派遣できません','パーティに仲間を編成してください。');
 if(members.some(isAway))return;
 if(funds[party]>gold)return info('所持金不足','支度金が所持金を超えています。');
 prepareEquipment(members);gold-=funds[party];ledgerMoney('funding',funds[party]);funds[party]=0;
 expeditions.push({party,members:[...members],returnDay:day+1,dungeonId:destination.id,power:expeditionPower(members,destination),health:expeditionHealth(members,destination)});away=true;render();
}
let groupedReturnReport=[];
function resolveExpeditions(){
 returnReport=[];groupedReturnReport=[];
 const due=expeditions.filter(e=>e.returnDay<=day);
 for(const trip of due){
  const destination=config.dungeons.find(d=>d.id===trip.dungeonId);
  const group={destination:destination?.name||'派遣先未記録',dungeonId:trip.dungeonId,party:trip.party,members:[],progress:'',totalProgress:0,cleared:false};
  if(destination){
   const d=destination,before=dungeonProgress[d.id]||0;
   dungeonProgress[d.id]=Math.min(d.requiredProgress,before+trip.power.attack+trip.power.bonus);
   grantExpeditionExperience(trip.members,dungeonProgress[d.id]-before);
   group.progress=`攻略 +${Math.round(dungeonProgress[d.id]/d.requiredProgress*100)-Math.round(before/d.requiredProgress*100)}%`;
   group.totalProgress=Math.round(dungeonProgress[d.id]/d.requiredProgress*100);ledgerExpedition(d.id,trip.party,Math.round(dungeonProgress[d.id]/d.requiredProgress*100)-Math.round(before/d.requiredProgress*100),group.totalProgress,trip.members);
   group.cleared=dungeonCleared(d.id);
  }
  applyExpeditionHealth(trip);
  for(const id of trip.members){
   const c=characters.find(c=>c.id===id);
   const member={name:c?.name||id,image:c?.images?.normal||'',events:[]};
   const health=trip.health?.[id];
   if(health?.status==='injured'||health?.status==='severe')member.events.push(`${health.status==='severe'?'重傷':'負傷'} · 回復まで${health.recoveryDays}日（${gameDate(day+health.recoveryDays)}朝）`);
   else if(health?.status==='dead')member.events.push('死亡');
   const before=Object.values(gear(id)).filter(Boolean);
   const broken=EquipmentCore.wear(gear(id),balanceRuntime.expeditionWear);brokenTargets[id]??={};
   for(const result of broken){brokenTargets[id][result.slot]=result.itemId;member.events.push(`${definitions[result.itemId]?.name||result.itemId}が破損`)}
   for(const item of before){const record=EncyclopediaCore.acquire(encyclopedia,item.itemId);if(!record.usedInstances.includes(item.uid))record.usedInstances.push(item.uid);record.expeditions++}
   for(const item of before){
    if(item.durability>=1&&item.durability<=3){const status={3:'摩耗しています',2:'損傷しています',1:'激しく損傷しています'}[item.durability];member.events.push(`${definitions[item.itemId]?.name||item.itemId}が${status}`)}
   }
   group.members.push(member);
  }
  groupedReturnReport.push(group);
 }
 expeditions=expeditions.filter(e=>e.returnDay>day);away=expeditions.length>0;
}
function changeEquipment(uid=null,slot=equipmentSlot,quiet=false){
 const id=equipCharacter;if(!Object.hasOwn(catalog.slots,slot))return false;if(!availableCharacterIds.includes(id)||isAway(id))return;
 const old=gear(id)[slot],next=uid===null?null:stock.find(i=>i.uid===uid);
 if(uid!==null&&(!next||type(next).slot!==slot||next.durability<1||!canEquip(id,next)||companionStatus(id)==='dead'))return;
 // Plan the old item's return before mutating either inventory.
 const remaining=stock.filter(i=>i!==next);
 const position=old?ItemCore.findSpace(old,remaining,types,warehouseSize):null;
 if(old&&!position){if(!quiet)info('倉庫に入りません','装備を戻す空きを作ってください。');return false}
 stock=remaining;if(old){Object.assign(old,position);stock.push(old)}
 if(next){next.x=null;next.y=null}gear(id)[slot]=next;delete (brokenTargets[id]??={})[slot];equipmentSlot=slot;equipmentSelectedUid=null;equipPage=0;selected=0;render();return true;
}
function openCharacterEquipment(id){
 if(Date.now()<=partySuppressClick||!availableCharacterIds.includes(id))return;
 if(screen!=='equipment')equipmentOrigin={screen,sub,page,party,partySlot,rosterPage};
 cancelEquipmentDrag();equipmentSelectedUid=null;equipCharacter=id;characterPanel='equipment';equipmentSlot='weapon';equipPage=0;screen='equipment';render();
}
function closeCharacterEquipment(){
 cancelEquipmentDrag();equipmentSelectedUid=null;
 if(equipmentOrigin){({screen,sub,page,party,partySlot,rosterPage}=equipmentOrigin);equipmentOrigin=null;render()}
 else go('adventurers');
}
function moveEquipmentCharacter(direction){
 const all=availableCharacters(),index=all.findIndex(c=>c.id===equipCharacter),next=all[index+direction];
 if(!next)return;cancelEquipmentDrag();equipmentSelectedUid=null;equipCharacter=next.id;equipPage=0;render();
}
function selectEquipmentSlot(slot){
 if(Date.now()<equipmentSuppressClick||!Object.hasOwn(catalog.slots,slot))return;
 if(equipmentSelectedUid!==null){changeEquipment(equipmentSelectedUid,slot,true);return}
 equipmentSlot=slot;render();
}
function selectEquipmentItem(uid){
 if(Date.now()<equipmentSuppressClick||isAway(equipCharacter)||companionStatus(equipCharacter)==='dead')return;
 const item=stock.find(i=>i.uid===uid);if(!item||!canEquip(equipCharacter,item))return;
 equipmentSelectedUid=equipmentSelectedUid===uid?null:uid;
 if(equipmentSelectedUid!==null)equipmentSlot=type(item).slot;
 render();
}
function equipmentInventoryPage(direction){cancelEquipmentDrag();equipPage+=direction;render()}

function equipmentView(){
 if(!availableCharacterIds.includes(equipCharacter))equipCharacter=availableCharacters()[0]?.id;
 if(!equipCharacter)return `<div class="heading"><h1>装備</h1>${btn('×','closeCharacterEquipment()')}</div>`+note('仲間がいません。');
 const id=equipCharacter,c=characters.find(c=>c.id===id),item=gear(id)[equipmentSlot],locked=isAway(id),all=availableCharacters(),index=all.findIndex(c=>c.id===id),stats=companionStats(id);
 const candidates=stock.filter(i=>canEquip(id,i)),size=2,total=Math.max(1,Math.ceil(candidates.length/size));equipPage=Math.min(equipPage,total-1);
 const chosen=stock.find(i=>i.uid===equipmentSelectedUid);
 const attributes=Object.entries(stats.attributes).map(([id,n])=>`${catalog.elements[id]||id}${n}`).join('・')||'なし';
 const heading=`<section class="character-equipment"><div class="heading"><h1>${characterPanel==='growth'?'育成':'装備'}</h1><div class="actions character-view-actions">${btn(characterPanel==='growth'?'装備へ':'育成へ',`selectCharacterPanel('${characterPanel==='growth'?'equipment':'growth'}')`,'mini')}<button class="gear-close" aria-label="装備画面を閉じる" onclick="closeCharacterEquipment()">×</button></div></div>
 <div class="character-switch"><button class="mini" aria-label="前のキャラクター" ${index===0?'disabled':''} onclick="moveEquipmentCharacter(-1)">‹ 前</button><div class="character-identity">${characterArt(c,'normal')}<div><h2>${esc(c.name)} · ${characterPanel==='growth'?'育成':'装備'}</h2><small>${esc(c.jobName)} · Lv.${companionLevel(id)}${{away:' · 遠征中',recovering:' · 療養中',dead:' · 死亡'}[companionStatus(id)]||''}</small></div></div><button class="mini" aria-label="次のキャラクター" ${index===all.length-1?'disabled':''} onclick="moveEquipmentCharacter(1)">次 ›</button></div>
 <div class="character-stats" aria-label="本人のステータス"><span>生存力 <b>${stats.hp}</b></span><span>攻撃 <b>${stats.attack}</b></span><span>防御 <b>${stats.defense}</b></span><small>固有属性 ${esc(attributes)}</small></div>
`;
 if(characterPanel==='growth')return heading+growthView(id)+'</section>';
 return heading+`
 <div class="equipment-slots">${Object.entries(catalog.slots).map(([slot,label])=>{const equipped=gear(id)[slot];return `<button data-equipment-slot="${slot}" ${!locked&&equipped?`onpointerdown="startEquipmentDrag(event,null,'${slot}')"`:''} class="equipment-slot ${slot===equipmentSlot?'active':''} ${chosen&&type(chosen).slot===slot?'equipment-target':''}" aria-pressed="${slot===equipmentSlot}" onclick="selectEquipmentSlot('${slot}')"><small>${label}</small><b>${equipped?esc(itemName(equipped)):'未装備'}</b><small>${chosen&&type(chosen).slot===slot?'ここに装備':equipped?`耐久 ${equipped.durability}/${equipped.maxDurability}${equipped.forged?' · 鍛冶済み':''}`:'−'}</small></button>`}).join('')}</div>
 <div class="equipment-controls"><div class="row"><label><input type="checkbox" ${autoEquip[id]?.[equipmentSlot]?'checked':''} onchange="(autoEquip[equipCharacter]??={})[equipmentSlot]=this.checked;render()"> ${catalog.slots[equipmentSlot]}の自動再装備</label><button class="mini" ${locked||!item?'disabled':''} onclick="changeEquipment()">外す</button></div><small>${locked?'遠征中は装備変更できません。':brokenTargets[id]?.[equipmentSlot]?'補充待ち：'+esc(definitions[brokenTargets[id][equipmentSlot]].name):chosen?esc(itemName(chosen))+'：枠をタップ／ドラッグで装備。':'商品を選んで枠へ。装備を倉庫へドラッグで外す。'}</small></div>
 <div class="equipment-inventory" data-equipment-warehouse="true"><h2>倉庫 · 装備候補 ${candidates.length}点</h2><div class="gear-candidates">${candidates.slice(equipPage*size,(equipPage+1)*size).map(i=>`<button data-equipment-item="${i.uid}" class="item ${equipmentSelectedUid===i.uid?'active':''}" aria-pressed="${equipmentSelectedUid===i.uid}" ${locked||companionStatus(id)==='dead'?'disabled':`onpointerdown="startEquipmentDrag(event,${i.uid})"`} onclick="selectEquipmentItem(${i.uid})"><span><b>${esc(itemName(i))}</b><small class="block">${catalog.slots[type(i).slot]} · 耐久 ${i.durability}/${i.maxDurability}${i.forged?' · 鍛冶済み':''}</small></span><span class="gear-item-art">${shape(def(i))}</span></button>`).join('')||note('この職業で装備できる在庫はありません。')}</div></div>
 <div class="page"><button aria-label="倉庫アイテムの前のページ" ${equipPage===0?'disabled':''} onclick="equipmentInventoryPage(-1)">‹</button><small>${equipPage+1}/${total}</small><button aria-label="倉庫アイテムの次のページ" ${equipPage===total-1?'disabled':''} onclick="equipmentInventoryPage(1)">›</button></div></section>`;
}
const formatExperience=value=>value.toLocaleString('ja-JP');
function growthView(id){
 const rules=config.adventurers.growth,selectedPolicy=growthPolicy(id),growth=economyState.companions[id]?.growth||{};
 return card(`${row('次のレベルまでの経験値',`${formatExperience(economyState.companions[id]?.experience||0)} / ${formatExperience(AdventurerCore.experienceRequired(companionLevel(id),rules.experience))}`)}<progress aria-label="次のレベルまでの経験値" value="${economyState.companions[id]?.experience||0}" max="${AdventurerCore.experienceRequired(companionLevel(id),rules.experience)}"></progress>${note('遠征の進度 ÷ 人数（切り捨て）を獲得。')}<h2>レベルアップごとに3ポイント</h2>${note('次のレベルアップから適用。これまでの成長はそのまま。')}<div class="growth-policies" role="group" aria-label="育成方針">${Object.entries(rules.policies).map(([key,p])=>`<button aria-pressed="${key===selectedPolicy}" class="${key===selectedPolicy?'active':''}" ${companionStatus(id)==='dead'?'disabled':''} onclick="setGrowthPolicy('${key}')"><b>${esc(p.name)}</b><small>攻撃＋${p.attack} ／ 防御＋${p.defense} ／ HP＋${p.hp}</small></button>`).join('')}</div>`)+card(`<h2>これまでの成長</h2>${row('攻撃 / 防御 / HP',`＋${growth.attack||0} / ＋${growth.defense||0} / ＋${growth.hp||0}`)}`);
}
function saleValue(item){return type(item).slot?EquipmentCore.price(item,def(item).price??config.development.salePrice,balanceRuntime.minimumPriceRatio):(def(item).price??config.development.salePrice)}
function buybackValue(item){return config.development.salePrice>0?Math.floor(saleValue(item)*config.development.buybackPrice/config.development.salePrice):0}
function buybackIncoming(){const item=pending[0];if(!item||item.forged)return;gold+=buybackValue(item);ledgerMoney('otherIncome',buybackValue(item));pending.shift();render()}
function buybackStock(){const item=stock[selected];if(!item)return;if(item.forged)return info('引取できません','鍛冶済み装備は手動装備または破棄してください。');gold+=buybackValue(item);ledgerMoney('otherIncome',buybackValue(item));stock.splice(selected,1);selected=0;render()}
function discardStock(){if(!stock[selected])return;stock.splice(selected,1);selected=0;render()}
function finishDay(){if(phase!==5)return;advance()}
