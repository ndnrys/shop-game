// Equipment operations and the compact, paginated support screen.
let equipment={},autoEquip={},brokenTargets={},expeditions=[],returnReport=[],lastSales=0;
let dungeonProgress={},selectedDungeon='forest';
let equipCharacter=null,equipmentSlot='weapon',equipPage=0,equipmentOrigin=null,characterPanel='equipment',equipmentSelectedUid=null,equipmentSelectedSlot=null,equipmentUndo=null;
const partyAway=index=>expeditions.some(e=>e.party===index);
const isAway=id=>expeditions.some(e=>e.members.includes(id));
function gear(id){return equipment[id]??={}}
function canEquip(id,item){const c=characters.find(c=>c.id===id);return !!c&&config.adventurers.jobEquipment[c.initialJobId]?.includes(item.typeId)===true}
function companionBaseStats(id){
 const character=characters.find(c=>c.id===id);
 return AdventurerCore.stats(character.initialStats,economyState.companions[id]?.growth);
}
function companionStats(id){
 const stats=companionBaseStats(id);
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
function selectCharacterPanel(panel){if(!['equipment','growth'].includes(panel))return;cancelEquipmentDrag();equipmentSelectedUid=null;equipmentSelectedSlot=null;characterPanel=panel;render()}
function validateAdventurerConfig(){
 const a=config.adventurers,r=a?.risk,valid=n=>Number.isFinite(n)&&n>=0;
 if(!r||!['injuryRate','severeRate','deathRate','tutorialDeathCap'].every(k=>valid(r[k])&&r[k]<=1)||r.severeRate>1||r.injuryRate+r.deathRate>1||!Number.isSafeInteger(r.tutorialChapter)||r.tutorialChapter<0||!valid(r.denominatorOffset)||r.denominatorOffset<=0||!['injuryRecoveryFactor','severeRecoveryFactor'].every(k=>valid(r[k])&&r[k]>0)||r.severeRecoveryFactor<r.injuryRecoveryFactor||!Number.isSafeInteger(r.minRecoveryDays)||r.minRecoveryDays<1||!Number.isSafeInteger(r.maxRecoveryDays)||r.maxRecoveryDays<r.minRecoveryDays)throw Error('冒険者リスク設定が不正です');
 const g=a.growth;
 if(!g||g.pointsPerLevel!==3||!g.policies||Object.keys(g.policies).length!==4||!['balanced','attack','defense','hp'].every(id=>Object.hasOwn(g.policies,id))||!Object.hasOwn(g.policies,g.defaultPolicy))throw Error('育成設定が不正です');
 if(!g.experience||!Number.isSafeInteger(g.experience.baseRequired)||g.experience.baseRequired<1||!Number.isSafeInteger(g.experience.perLevel)||g.experience.perLevel<0)throw Error('必要経験値が不正です');
 for(const p of Object.values(g.policies))if(typeof p.name!=='string'||!['attack','defense','hp'].every(k=>Number.isSafeInteger(p[k])&&p[k]>=0)||p.attack+p.defense+p.hp!==g.pointsPerLevel)throw Error('育成配分は合計3ポイントにしてください');
 for(const c of characters){const allowed=a.jobEquipment?.[c.initialJobId];if(!Array.isArray(allowed)||allowed.some(id=>!catalog.types.some(t=>t.id===id)))throw Error('職業の装備制限が未設定です')}
}
function expeditionHealth(members,d,random=Math.random,items=supplies[party]){
 const rules=config.adventurers.risk;
 return Object.fromEntries(members.map(id=>{
  const stats={...companionStats(id)};stats.hp+=items[0];stats.defense+=items[1];
  const result=AdventurerCore.outcome(AdventurerCore.risks(stats,d.danger,rules,chapter===rules.tutorialChapter,members.length),random);
  if(['injured','severe'].includes(result.status))result.recoveryDays=Math.max(1,result.recoveryDays-items[2]);
  return [id,result];
 }));
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
 const transition=config.chapterProgression?.prologue;
 if(!transition||transition.nextChapter!==1||transition.memberLimit!==1||!config.dungeons?.some(d=>d.id===transition.clearDungeonId&&d.chapter===0)||!['name','nextName','enemyName'].every(k=>typeof transition[k]==='string'&&transition[k].length))throw Error('章の移動設定が不正です');
 if(!Array.isArray(config.dungeons)||!config.dungeons.length)throw Error('遠征先設定が必要です');
 const ids=new Set(config.dungeons.map(d=>d.id));
 if(ids.size!==config.dungeons.length)throw Error('遠征先IDが重複しています');
 for(const d of config.dungeons){
  if(!/^[a-z][a-z0-9_]*$/.test(d.id)||typeof d.name!=='string'||!Number.isSafeInteger(d.chapter)||d.chapter<0||!Number.isSafeInteger(d.requiredProgress)||d.requiredProgress<1||!Number.isFinite(d.danger)||d.danger<0||!Number.isFinite(d.attributeBonus)||d.attributeBonus<0||!Array.isArray(d.requires)||d.requires.some(id=>!ids.has(id)||id===d.id)||!d.recommendedAttributes||typeof d.recommendedAttributes!=='object'||Array.isArray(d.recommendedAttributes)||Object.entries(d.recommendedAttributes).some(([key,n])=>key==='none'||!Object.hasOwn(catalog.elements,key)||!Number.isFinite(n)||n<=0))throw Error('遠征先設定が不正です');
 }
 for(const item of catalog.items)if(item.attributes!==undefined&&(!item.attributes||typeof item.attributes!=='object'||Array.isArray(item.attributes)||Object.entries(item.attributes).some(([key,n])=>key==='none'||!Object.hasOwn(catalog.elements,key)||!Number.isFinite(n)||n<0)))throw Error('装備属性値が不正です');
}
function dungeonCleared(id){const d=config.dungeons.find(d=>d.id===id);return !!d&&(dungeonProgress[id]||0)>=d.requiredProgress}
function dungeonProgressPercent(d,progress=dungeonProgress[d.id]||0){return Math.min(100,Math.max(0,Math.floor(progress/d.requiredProgress*100)))}
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
 const stats={...companionStats(id)};stats.hp+=supplies[party][0];stats.defense+=supplies[party][1];
 const partySize=parties[party].filter(memberId=>memberId&&companionStatus(memberId)==='waiting').length;
 const risk=AdventurerCore.risks(stats,d.danger,rules,chapter===rules.tutorialChapter,partySize);
 const chance=risk.injury+risk.severe+risk.death;
 return chance<0.10?'安全':chance<0.20?'注意':'危険';
}
let destinationScrollTimer=null;
function availableDestinations(){return config.dungeons.filter(dungeonAvailable)}
function moveDestination(delta){const choices=availableDestinations(),index=choices.findIndex(d=>d.id===selectedDungeon),next=choices[Math.max(0,Math.min(choices.length-1,index+delta))];if(next&&next.id!==selectedDungeon){selectedDungeon=next.id;render()}}
function scheduleDestinationSelection(element){clearTimeout(destinationScrollTimer);destinationScrollTimer=setTimeout(()=>{if(!element.isConnected||!element.clientWidth)return;const cards=[...element.querySelectorAll('[data-destination]')],index=Math.round(element.scrollLeft/element.clientWidth),id=cards[index]?.dataset.destination;if(id&&id!==selectedDungeon){selectedDungeon=id;render()}},120)}
function restoreDestinationCarousel(){const element=$('.destination-carousel');if(!element)return;const cards=[...element.querySelectorAll('[data-destination]')],index=cards.findIndex(card=>card.dataset.destination===selectedDungeon);element.scrollLeft=Math.max(0,index)*element.clientWidth}
function destinationView(){
 const choices=availableDestinations();
 if(!choices.some(d=>d.id===selectedDungeon))selectedDungeon=choices[0]?.id;
 const index=choices.findIndex(d=>d.id===selectedDungeon);
 if(!choices.length)return note(t('text.行ける派遣先がありません','行ける派遣先がありません'));
 const attrs=values=>Object.entries(values).map(([key,n])=>`${esc(catalog.elements[key]||key)} ${n}`).join('・')||t('text.なし','なし');
 return `<section class="destination-panel"><div class="destination-carousel" role="group" aria-label="${t('text.派遣先','派遣先')}" tabindex="0" onscroll="scheduleDestinationSelection(this)" onkeydown="if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();moveDestination(event.key==='ArrowRight'?1:-1)}">${choices.map(d=>`<article class="destination-card" data-destination="${d.id}" data-selected="${d.id===selectedDungeon}" aria-hidden="${d.id!==selectedDungeon}"><img class="destination-art" src="${esc(d.image)}" alt="" draggable="false"><div class="destination-glass"><h2>${esc(d.name)}</h2><div class="destination-progress"><span>${t('text.攻略','攻略')}</span><b>${dungeonProgressPercent(d)}%</b></div><div class="destination-info"><div><span>${t('text.凶悪度','凶悪度')}</span><b>${d.danger}</b></div><div><span>${t('text.帰還','帰還')}</span><b>${t('ui.destination.nextMorning','翌朝')}</b></div><div><span>${t('text.推奨属性','推奨属性')}</span><b>${attrs(d.recommendedAttributes)}</b></div></div></div></article>`).join('')}</div>${choices.length>1?`<div class="destination-controls"><button type="button" data-destination-prev aria-label="${t('text.前の派遣先','前の派遣先')}" onclick="moveDestination(-1)" ${index===0?'disabled':''}>‹</button><small>${index+1} / ${choices.length}</small><button type="button" data-destination-next aria-label="${t('text.次の派遣先','次の派遣先')}" onclick="moveDestination(1)" ${index===choices.length-1?'disabled':''}>›</button></div>`:''}</section>`;
}

function depart(){
 if(phase!==4||(screen!=='home'&&screen!=='adventurers')||partyAway(party))return;
 const destination=config.dungeons.find(d=>d.id===selectedDungeon);if(!destination||!dungeonAvailable(destination))return;
 const members=parties[party].filter(id=>id&&companionStatus(id)==='waiting');if(!members.length)return info('派遣できません','パーティに仲間を編成してください。');
 if(members.some(isAway))return;
 const cost=supplyCost(supplies[party]);
 if(cost>gold)return info('所持金不足','遠征物資の費用が所持金を超えています。');
 prepareEquipment(members);gold-=cost;ledgerMoney('funding',cost);
 expeditions.push({party,members:[...members],returnDay:day+1,dungeonId:destination.id,power:expeditionPower(members,destination),health:expeditionHealth(members,destination)});supplies[party]=[0,0,0];away=true;render();
}
function recallExpedition(partyId=party){
 if(!Number.isInteger(partyId)||partyId<0||partyId>=parties.length)return;
 const trip=expeditions.find(e=>e.party===partyId);
 if(!trip)return;
 expeditions=expeditions.filter(e=>e!==trip);away=expeditions.length>0;
 render();
}
let groupedReturnReport=[];
function resolveExpeditions(){
 returnReport=[];groupedReturnReport=[];
 const due=expeditions.filter(e=>e.returnDay<=day);
 for(const trip of due){
  const destination=config.dungeons.find(d=>d.id===trip.dungeonId);
  const previousLevels=Object.fromEntries(trip.members.map(id=>[id,companionLevel(id)]));
  const group={destination:destination?.name||'派遣先未記録',dungeonId:trip.dungeonId,party:trip.party,members:[],progress:'',totalProgress:0,cleared:false};
  if(destination){
   const d=destination,before=dungeonProgress[d.id]||0;
   dungeonProgress[d.id]=Math.min(d.requiredProgress,before+trip.power.attack+trip.power.bonus);
   grantExpeditionExperience(trip.members,dungeonProgress[d.id]-before);
   const totalProgress=dungeonProgressPercent(d),addedProgress=totalProgress-dungeonProgressPercent(d,before);
   group.progress=`攻略 +${addedProgress}%`;
   group.totalProgress=totalProgress;ledgerExpedition(d.id,trip.party,addedProgress,totalProgress,trip.members);
   group.cleared=dungeonCleared(d.id);
  }
  applyExpeditionHealth(trip);
  for(const id of trip.members){
   const c=characters.find(c=>c.id===id);
   const health=trip.health?.[id];
   const status=health?.status==='dead'?'dead':['injured','severe'].includes(health?.status)?'recovering':'waiting';
   const member={id,name:c?.name||id,...companionPortrait(c,status),levelUps:companionLevel(id)-previousLevels[id],events:[]};
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
function undoEquipmentChange(){
 if(!equipmentUndo||screen!=='equipment')return;
 const previous=equipmentUndo;equipmentUndo=null;
 stock=previous.stock;
 gear(previous.id)[previous.slot]=previous.item;
 if(previous.broken===undefined)delete (brokenTargets[previous.id]??={})[previous.slot];
 else (brokenTargets[previous.id]??={})[previous.slot]=previous.broken;
 equipmentSlot=previous.slot;equipmentSelectedUid=null;equipmentSelectedSlot=null;equipPage=previous.page;selected=0;render();
}
function changeEquipment(uid=null,slot=equipmentSlot,quiet=false){
 const id=equipCharacter;if(!Object.hasOwn(catalog.slots,slot))return false;if(!availableCharacterIds.includes(id)||isAway(id))return;
 const old=gear(id)[slot],next=uid===null?null:stock.find(i=>i.uid===uid);
 if(uid!==null&&(!next||type(next).slot!==slot||next.durability<1||!canEquip(id,next)||companionStatus(id)==='dead'))return;
 // Plan the old item's return before mutating either inventory.
 const remaining=stock.filter(i=>i!==next);
 const position=old?ItemCore.findSpace(old,remaining,types,warehouseSize):null;
 if(old&&!position){if(!quiet)info('倉庫に入りません','装備を戻す空きを作ってください。');return false}
 equipmentUndo={id,slot,stock:structuredClone(stock),item:old?structuredClone(old):old,broken:brokenTargets[id]?.[slot],page:equipPage};
 stock=remaining;if(old){Object.assign(old,position);stock.push(old)}
 if(next){next.x=null;next.y=null}gear(id)[slot]=next;delete (brokenTargets[id]??={})[slot];equipmentSlot=slot;equipmentSelectedUid=null;equipPage=0;equipmentSelectedSlot=null;selected=0;render();return true;
}
function openCharacterEquipment(id){
 if(Date.now()<=partySuppressClick||!availableCharacterIds.includes(id))return;
 if(screen!=='equipment')equipmentOrigin={screen,sub,page,party,partySlot,rosterPage};
 cancelEquipmentDrag();equipmentSelectedUid=null;equipmentSelectedSlot=null;equipmentUndo=null;equipCharacter=id;characterPanel='equipment';equipmentSlot='weapon';equipPage=0;screen='equipment';render();
}
function closeCharacterEquipment(){
 cancelEquipmentDrag();equipmentSelectedUid=null;equipmentSelectedSlot=null;equipmentUndo=null;
 if(equipmentOrigin){({screen,sub,page,party,partySlot,rosterPage}=equipmentOrigin);equipmentOrigin=null;render()}
 else go('adventurers');
}
function moveEquipmentCharacter(direction){
 const all=availableCharacters(),index=all.findIndex(c=>c.id===equipCharacter),next=all.length?all[(index+direction+all.length)%all.length]:null;
 if(!next)return;cancelEquipmentDrag();equipmentSelectedUid=null;equipmentSelectedSlot=null;equipmentUndo=null;equipCharacter=next.id;equipPage=0;render();
}
function selectEquipmentSlot(slot){
 if(Date.now()<equipmentSuppressClick||!Object.hasOwn(catalog.slots,slot))return;
 if(equipmentSelectedUid!==null){const item=stock.find(i=>i.uid===equipmentSelectedUid);if(item&&type(item).slot===slot)changeEquipment(item.uid,slot);return}
 if(equipmentSelectedSlot===slot&&gear(equipCharacter)[slot]&&!isAway(equipCharacter)){changeEquipment(null,slot);return}
 equipmentSelectedUid=null;equipmentSelectedSlot=slot;equipmentSlot=slot;render();
}
function selectEquipmentItem(uid){
 if(Date.now()<equipmentSuppressClick||isAway(equipCharacter)||companionStatus(equipCharacter)==='dead')return;
 const item=stock.find(i=>i.uid===uid);if(!item||!canEquip(equipCharacter,item))return;
 if(equipmentSelectedUid===uid){changeEquipment(uid,type(item).slot);return}
 equipmentSelectedUid=uid;equipmentSelectedSlot=null;equipmentSlot=type(item).slot;
 render();
}
function equipmentInventoryPage(direction){cancelEquipmentDrag();equipPage+=direction;render()}

function equipmentView(){
 if(!availableCharacterIds.includes(equipCharacter))equipCharacter=availableCharacters()[0]?.id;
 if(!equipCharacter)return `<div class="heading"><h1>装備</h1>${btn('×','closeCharacterEquipment()')}</div>`+note('仲間がいません。');
 const id=equipCharacter,c=characters.find(c=>c.id===id),item=gear(id)[equipmentSlot],locked=isAway(id),all=availableCharacters(),index=all.findIndex(c=>c.id===id),stats=characterPanel==='growth'?companionBaseStats(id):companionStats(id);
 const candidates=stock.filter(i=>canEquip(id,i)),size=3,total=Math.max(1,Math.ceil(candidates.length/size));equipPage=Math.min(equipPage,total-1);
 const chosen=stock.find(i=>i.uid===equipmentSelectedUid);
 const cardStats=item=>item?warehouseItemStats(item):'−';
 const attributes=Object.entries(stats.attributes).map(([id,n])=>`${catalog.elements[id]||id}${n}`).join('・')||'なし';
 const footer=`<div class="equipment-footer">${btn(characterPanel==='growth'?'装備へ':'育成へ',`selectCharacterPanel('${characterPanel==='growth'?'equipment':'growth'}')`,'equipment-panel-switch')}<div class="equipment-return">${btn('戻る','closeCharacterEquipment()','primary')}</div></div>`;
 const heading=`<section class="character-equipment" onpointerdown="startCharacterSwipe(event)"><button class="character-edge-arrow character-edge-prev" aria-label="前のキャラクター" ${all.length<2?'disabled':''} onclick="moveEquipmentCharacter(-1)">‹</button><button class="character-edge-arrow character-edge-next" aria-label="次のキャラクター" ${all.length<2?'disabled':''} onclick="moveEquipmentCharacter(1)">›</button><div class="equipment-character-backdrop" aria-hidden="true"><img src="${esc(c.images.full||c.images.normal)}" class="${companionStatus(id)==='dead'?'companion-grayscale':''}" alt="" draggable="false"></div>
 <div class="equipment-stage"><div class="equipment-information"><div class="equipment-sheet"><span class="character-level-watermark" aria-label="レベル ${companionLevel(id)}">Lv.${companionLevel(id)}</span><div class="character-switch"><div><div class="equipment-name-line"><h2>${esc(characterName(c))}</h2><small class="equipment-job">${esc(characterJob(c))}</small></div>${{away:'<small class="equipment-status">遠征中</small>',recovering:'<small class="equipment-status">療養中</small>',dead:'<small class="equipment-status">死亡</small>'}[companionStatus(id)]||''}</div></div>
 <div class="equipment-profile"><div class="character-stats" aria-label="${characterPanel==='growth'?'装備補正を除いたステータス':'装備補正込みのステータス'}"><span><span>♥ 生存力</span> <b>${stats.hp}</b></span><span><span>⚔ 攻撃</span> <b>${stats.attack}</b></span><span><span>⬟ 防御</span> <b>${stats.defense}</b></span><small>固有属性 ${esc(attributes)}</small></div></div>
`;
 if(characterPanel==='growth')return heading+growthView(id)+'</div></div></div>'+footer+'</section>';
 return heading+`
 <h2 class="section-ribbon">装備中</h2><div class="equipment-slots">${Object.entries(catalog.slots).map(([slot,label])=>{const equipped=gear(id)[slot];return `<div class="equipment-slot-row"><button data-equipment-slot="${slot}" ${!locked&&equipped?`onpointerdown="startEquipmentDrag(event,null,'${slot}')"`:''} class="equipment-slot ${slot===equipmentSlot?'active':''} ${chosen&&type(chosen).slot===slot?'equipment-target':''}" aria-label="${esc(label)} · ${equipped?esc(itemName(equipped)):'未装備'}" aria-pressed="${slot===equipmentSlot}" onclick="selectEquipmentSlot('${slot}')"><small>${label}</small>${equipped?`<span class="gear-item-art${type(equipped).height/type(equipped).width>=5?' gear-item-art-tall':''}">${shape(def(equipped))}</span>`:'<span class="equipment-empty">＋</span>'}${equipped?`<meter class="durability-meter" min="0" max="${equipped.maxDurability}" value="${equipped.durability}" aria-label="耐久 ${equipped.durability}/${equipped.maxDurability}"></meter>`:''}<b>${equipped?esc(itemName(equipped)):'未装備'}</b><small class="equipped-stats">${cardStats(equipped)}</small><small>${chosen&&type(chosen).slot===slot?'ここに装備':equipped?`耐久 ${equipped.durability}/${equipped.maxDurability}${equipped.forged?' · 鍛冶済み':''}`:'−'}</small></button><label class="equipment-auto-equip"><input type="checkbox" data-auto-slot="${slot}" aria-label="${esc(label)}の再装備" ${autoEquip[id]?.[slot]?'checked':''} ${locked||companionStatus(id)==='dead'?'disabled':''} onchange="(autoEquip[equipCharacter]??={})['${slot}']=this.checked;render()"> 再装備</label></div>`}).join('')}</div>
 <div class="equipment-controls"><div class="row"><button class="mini" ${locked||!equipmentUndo?'disabled':''} onclick="undoEquipmentChange()">元に戻す</button></div>${locked?'<small>遠征中は装備変更できません。</small>':brokenTargets[id]?.[equipmentSlot]?'<small>補充待ち：'+esc(definitions[brokenTargets[id][equipmentSlot]].name)+'</small>':''}</div></div></div></div>
 <div class="equipment-inventory" data-equipment-warehouse="true"><h2 class="section-ribbon">倉庫の装備 <small>${candidates.length}点 · ${equipPage+1}/${total}</small></h2><div class="equipment-inventory-row"><button class="equipment-page-arrow" aria-label="倉庫アイテムの前のページ" ${equipPage===0?'disabled':''} onclick="equipmentInventoryPage(-1)">‹</button><div class="gear-candidates">${candidates.slice(equipPage*size,(equipPage+1)*size).map(i=>`<button data-equipment-item="${i.uid}" class="item ${equipmentSelectedUid===i.uid?'active':''}" aria-pressed="${equipmentSelectedUid===i.uid}" ${locked||companionStatus(id)==='dead'?'disabled':`onpointerdown="startEquipmentDrag(event,${i.uid})"`} onclick="selectEquipmentItem(${i.uid})"><span><b>${esc(itemName(i))}</b><small class="gear-candidate-stats">${esc(warehouseItemStats(i))}</small><small class="block">耐久 ${i.durability}/${i.maxDurability}${i.forged?' · 鍛冶済み':''}</small></span><span class="gear-item-art">${shape(def(i))}</span></button>`).join('')||note('この職業で装備できる在庫はありません。')}</div><button class="equipment-page-arrow" aria-label="倉庫アイテムの次のページ" ${equipPage===total-1?'disabled':''} onclick="equipmentInventoryPage(1)">›</button></div></div>
 ${footer}</section>`;
}
const formatExperience=value=>value.toLocaleString('ja-JP');
function growthView(id){
 const rules=config.adventurers.growth,selectedPolicy=growthPolicy(id),growth=economyState.companions[id]?.growth||{};
 return card(`${row('次のレベルまでの経験値',`${formatExperience(economyState.companions[id]?.experience||0)} / ${formatExperience(AdventurerCore.experienceRequired(companionLevel(id),rules.experience))}`)}<progress aria-label="次のレベルまでの経験値" value="${economyState.companions[id]?.experience||0}" max="${AdventurerCore.experienceRequired(companionLevel(id),rules.experience)}"></progress><h2>育成方針</h2>${note('次のレベルから適用（3ポイント）')}<div class="growth-policies" role="group" aria-label="育成方針">${Object.entries(rules.policies).map(([key,p])=>`<button aria-pressed="${key===selectedPolicy}" class="${key===selectedPolicy?'active':''}" ${companionStatus(id)==='dead'?'disabled':''} onclick="setGrowthPolicy('${key}')"><b>${esc(p.name)}</b><small>攻撃＋${p.attack} ／ 防御＋${p.defense} ／ 生存力＋${p.hp}</small></button>`).join('')}</div>`)+card(`<h2>これまでの成長</h2>${row('攻撃 / 防御 / 生存力',`＋${growth.attack||0} / ＋${growth.defense||0} / ＋${growth.hp||0}`)}`);
}
function saleValue(item){return type(item).slot?EquipmentCore.price(item,def(item).price??config.development.salePrice,balanceRuntime.minimumPriceRatio):(def(item).price??config.development.salePrice)}
function buybackValue(item){return config.development.salePrice>0?Math.floor(saleValue(item)*config.development.buybackPrice/config.development.salePrice):0}
function buybackIncoming(){const item=incomingWarehouseItem();if(!item||item.forged)return;gold+=buybackValue(item);ledgerMoney('otherIncome',buybackValue(item));pending.splice(pending.indexOf(item),1);render()}
function buybackStock(){const item=stock[selected];if(!item)return;if(item.forged)return info('引取できません','鍛冶済み装備は手動で装備してください。');gold+=buybackValue(item);ledgerMoney('otherIncome',buybackValue(item));stock.splice(selected,1);selected=0;render()}
function finishDay(){if(phase!==5)return;const previousDay=day;advance();if(day===previousDay+1&&phase===0)GameEffects.morning()}
