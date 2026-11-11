// Pointer drag previews are transient; the inventory changes only on a valid drop.
let equipmentDrag=null,equipmentSuppressClick=0;
function cancelEquipmentDrag(){equipmentDrag?.cancel()}
function startEquipmentDrag(event,uid,sourceSlot=null){
 if(equipmentDrag||screen!=='equipment'||characterPanel!=='equipment'||isAway(equipCharacter)||event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0))return;
 const id=equipCharacter,item=sourceSlot?gear(id)[sourceSlot]:stock.find(i=>i.uid===uid);
 if(!item||(!sourceSlot&&(!canEquip(id,item)||companionStatus(id)==='dead')))return;
 const pointerId=event.pointerId,originPage=equipPage,source=event.currentTarget,sourceRect=source.getBoundingClientRect(),grabX=event.clientX-sourceRect.left,grabY=event.clientY-sourceRect.top;
 let active=false,ghost=null,target=null,lastPoint={clientX:event.clientX,clientY:event.clientY};
 const current=()=>screen==='equipment'&&characterPanel==='equipment'&&equipCharacter===id&&equipPage===originPage&&!isAway(id)&&(sourceSlot?gear(id)[sourceSlot]===item:stock.includes(item)&&companionStatus(id)!=='dead');
 function clearTarget(){target?.classList.remove('equipment-drop-target');target=null}
 function update(e){
  if(!current()){cancel();return}
  clearTarget();ghost.style.left=e.clientX-grabX+'px';ghost.style.top=e.clientY-grabY+'px';
  const hit=document.elementFromPoint(e.clientX,e.clientY);
  const slot=hit?.closest('[data-equipment-slot]'),warehouse=hit?.closest('[data-equipment-warehouse]');
  if(sourceSlot){if(warehouse)target=warehouse}
  else if(slot?.dataset.equipmentSlot===type(item).slot)target=slot;
  target?.classList.add('equipment-drop-target');ghost.classList.toggle('invalid',!target);
 }
 const timer=setTimeout(()=>{
  if(!current()){cancel();return}
  active=true;ghost=document.createElement('div');ghost.className='drag-ghost equipment-card-drag';ghost.style.width=sourceRect.width+'px';ghost.style.height=sourceRect.height+'px';
  const clone=source.cloneNode(true);clone.removeAttribute('id');clone.removeAttribute('onclick');clone.removeAttribute('onpointerdown');clone.removeAttribute('data-equipment-item');clone.removeAttribute('data-equipment-slot');clone.disabled=false;
  if(sourceSlot){ghost.append(clone)}else{const cards=document.createElement('div');cards.className='gear-candidates';cards.append(clone);ghost.append(cards)}
  source.classList.add('equipment-drag-source');document.body.append(ghost);update(lastPoint);
 },100);
 function cleanup(){clearTimeout(timer);clearTarget();source.classList.remove('equipment-drag-source');ghost?.remove();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',pointerCancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key);equipmentDrag=null}
 function cancel(){if(active)equipmentSuppressClick=Date.now()+400;cleanup()}
 function move(e){if(e.pointerId!==pointerId)return;lastPoint={clientX:e.clientX,clientY:e.clientY};if(!active)return;e.preventDefault();update(e)}
 function up(e){
  if(e.pointerId!==pointerId)return;
  if(!active){cleanup();return}
  e.preventDefault();update(e);if(!equipmentDrag)return;
  const valid=!!target&&current(),slot=sourceSlot||target?.dataset.equipmentSlot;
  equipmentSuppressClick=Date.now()+400;cleanup();
  if(valid)changeEquipment(sourceSlot?null:item.uid,slot,true);
 }
 function pointerCancel(e){if(e.pointerId===pointerId)cancel()}
 function key(e){if(e.key==='Escape')cancel()}
 equipmentDrag={cancel};
 window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',pointerCancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',key);
}
document.addEventListener('click',event=>{
 if(Date.now()<equipmentSuppressClick&&event.target.closest('.character-equipment')){event.preventDefault();event.stopImmediatePropagation()}
},true);
