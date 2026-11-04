// Records are independent of inventory: removing an item never removes discovery.
const EncyclopediaCore = (() => {
 const create = () => ({items:{},sets:{},people:{}});
 function acquire(state, itemId) {
  return state.items[itemId] ??= {discovered:true,sold:0,usedInstances:[],expeditions:0};
 }
 function sold(state, itemId, quantity=1) {
  if (!Number.isSafeInteger(quantity) || quantity<=0) return;
  acquire(state,itemId).sold+=quantity;
 }
 function discoverSets(state, definitions, items) {
  const counts=new Map();
  for(const item of items) counts.set(item.itemId,(counts.get(item.itemId)||0)+1);
  for(const set of definitions) {
   const needed=new Map();
   for(const id of set.itemIds) needed.set(id,(needed.get(id)||0)+1);
   if([...needed].every(([id,n])=>(counts.get(id)||0)>=n))
    state.sets[set.id] ??= {discovered:true,usedCombinations:[],expeditions:0};
  }
 }
 return {create,acquire,sold,discoverSets};
})();
