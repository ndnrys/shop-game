// Pure trading calculations. Candidates reserve physical UIDs within each shelf.
const TradingCore=(()=>{
 const range=(r,random)=>r.min+Math.floor(random()*(r.max-r.min+1));
 function candidates(items,sets,definitions,types,settings,price){
  const result=[];
  for(const shelfId of new Set(items.map(i=>i.shelfId??0))){
   const remaining=items.filter(i=>(i.shelfId??0)===shelfId&&!i.forged);
   for(const set of sets){
    while(true){
     const chosen=[];
     for(const id of set.itemIds){const item=remaining.find(i=>i.itemId===id&&!chosen.includes(i)&&(settings.rules.allowUsedInSets||i.durability===i.maxDurability));if(!item)break;chosen.push(item)}
     if(!set.itemIds.length||chosen.length!==set.itemIds.length)break;
     result.push({shelfId,setId:set.id,items:chosen,effect:'set',bonus:settings.effects.set.bonus,price:chosen.reduce((n,i)=>n+price(i),0)});
     for(const item of chosen)remaining.splice(remaining.indexOf(item),1);
    }
   }
   // Reserved set units cannot be sold individually. Surplus never gets the set bonus.
   for(const item of remaining){
    const group=items.filter(i=>(i.shelfId??0)===shelfId&&!i.forged);
    const slot=types[definitions[item.itemId].typeId].slot;
    const effect=group.filter(i=>i.itemId===item.itemId).length>=settings.effects.identical.minimum?'identical':slot&&group.filter(i=>types[definitions[i.itemId].typeId].slot===slot).length>=settings.effects.slot.minimum?'slot':'normal';
    result.push({shelfId,items:[item],effect,bonus:settings.effects[effect]?.bonus??0,price:price(item)});
   }
  }
  return result;
 }
 function probability(candidate,customer,definitions,settings){
  const base=candidate.items.reduce((n,i)=>n+(customer.items[i.itemId]??customer.categories[definitions[i.itemId].typeId]??customer.probability),0)/candidate.items.length;
  return Math.max(settings.rules.minProbability,Math.min(settings.rules.maxProbability,base+candidate.bonus));
 }
 function weights(settings,chapter,rumors,day){return settings.customers.map(customer=>({customer,weight:chapter.customers[customer.id].weight*rumors.filter(r=>r.startDay<=day&&day<r.endDay).reduce((w,r)=>w*(settings.rumors.find(d=>d.id===r.id).weights[customer.id]??1),1)}))}
 function simulate({items,sets,definitions,types,settings,chapter,rumors,day,price,random=Math.random}){
  let remaining=[...items],revenue=0;const visits=[],count=range(chapter.visitors,random),pool=weights(settings,chapter,rumors,day),total=pool.reduce((n,c)=>n+c.weight,0);
  for(let v=0;v<count;v++){
   if(total<=0)break;
   let draw=random()*total;const customer=(pool.find(c=>(draw-=c.weight)<0)||pool[pool.length-1]).customer;
   const money=range(chapter.customers[customer.id].money,random),options=candidates(remaining,sets,definitions,types,settings,price).filter(c=>c.price<=money);
   const candidate=options.length?options[Math.floor(random()*options.length)]:null;
   const purchased=candidate&&random()<probability(candidate,customer,definitions,settings)?candidate:null;
   visits.push({customerId:customer.id,money,price:purchased?.price??0,itemIds:purchased?purchased.items.map(i=>i.itemId):[],uids:purchased?purchased.items.map(i=>i.uid):[],setId:purchased?.setId??null});
   if(purchased){revenue+=purchased.price;const sold=new Set(purchased.items.map(i=>i.uid));remaining=remaining.filter(i=>!sold.has(i.uid))}
  }
  return {remaining,revenue,visits};
 }
 return {candidates,probability,weights,simulate};
})();
