// Individual equipment rules; independent of UI and item definitions.
const EquipmentCore = (() => {
 const version=2;
 function roll(random=Math.random){const n=random();return n<.1?8:n<.3?9:n<.7?10:n<.9?11:12}
 function normalize(item){
  const copy={...item};
  if(copy.maxDurability===undefined&&copy.durability===undefined){copy.maxDurability=10;copy.durability=copy.used?5:10}
  if(!Number.isSafeInteger(copy.maxDurability)||copy.maxDurability<1||!Number.isSafeInteger(copy.durability)||copy.durability<1||copy.durability>copy.maxDurability)throw Error('耐久度が不正です');
  if(copy.forged!==undefined&&typeof copy.forged!=='boolean')throw Error('鍛冶フラグが不正です');if(copy.forgeType!=null&&typeof copy.forgeType!=='string')throw Error('加工内容が不正です');copy.forged=copy.forged===true;copy.forgeType=copy.forgeType??null;delete copy.used;return copy;
 }
 function price(item,newPrice){if(item.forged||item.durability<=0)return 0;return Math.floor(newPrice*Math.max(.1,item.durability/item.maxDurability))}
 function replacement(stock,itemId){return stock.filter(i=>i.itemId===itemId&&!i.forged&&i.durability>0).sort((a,b)=>a.maxDurability-b.maxDurability||a.durability-b.durability||a.uid-b.uid)[0]||null}
 function wear(equipment){const broken=[];for(const [slot,item] of Object.entries(equipment)){if(!item)continue;item.durability--;if(item.durability<=0){broken.push({slot,itemId:item.itemId,uid:item.uid});equipment[slot]=null}}return broken}
 return {version,roll,normalize,price,replacement,wear};
})();
