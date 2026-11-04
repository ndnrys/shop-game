// Individual expedition risks. All tuning values are supplied by settings.
const AdventurerCore=(()=>{
 function risks(stats,danger,rules,tutorial){
  const injury=rules.injuryRate*danger/(danger+stats.defense+rules.denominatorOffset);
  const severe=injury*rules.severeRate*danger/(danger+stats.hp+rules.denominatorOffset);
  const rawDeath=rules.deathRate*danger/(danger+stats.defense+stats.hp+rules.denominatorOffset);
  const death=tutorial?Math.min(rawDeath,rules.tutorialDeathCap):rawDeath;
  const days=multiplier=>Math.max(rules.minRecoveryDays,Math.min(rules.maxRecoveryDays,Math.ceil(danger*multiplier/(stats.hp+rules.denominatorOffset))));
  return {injury,severe,death,injuryDays:days(rules.injuryRecoveryFactor),severeDays:days(rules.severeRecoveryFactor)};
 }
 function outcome(risk,random=Math.random){
  const roll=random();
  if(roll<risk.death)return {status:'dead',recoveryDays:0};
  if(roll<risk.death+risk.severe)return {status:'severe',recoveryDays:risk.severeDays};
  if(roll<risk.death+risk.injury)return {status:'injured',recoveryDays:risk.injuryDays};
  return {status:'healthy',recoveryDays:0};
 }
 function stats(initial,growth={}){
  return {...initial,attack:initial.attack+(growth.attack||0),defense:initial.defense+(growth.defense||0),hp:initial.hp+(growth.hp||0)};
 }
 function grow(state,levels,rules,initialLevel){
  if(!Number.isSafeInteger(levels)||levels<0)throw Error('成長回数が不正です');
  const policy=rules.policies[state.growthPolicy||rules.defaultPolicy];
  if(!policy)throw Error('育成方針が不正です');
  const growth={...state.growth};
  for(const key of ['attack','defense','hp'])growth[key]=(growth[key]||0)+policy[key]*levels;
  const level=(state.level??initialLevel)+levels;
  if(!Number.isSafeInteger(level)||Object.values(growth).some(n=>!Number.isSafeInteger(n)))throw Error('成長値が上限を超えています');
  return {...state,level,growth};
 }
 function experienceRequired(level,rules){return rules.baseRequired+(level-1)*rules.perLevel}
 function gainExperience(state,amount,rules,initialLevel){
  if(!Number.isSafeInteger(amount)||amount<0)throw Error('経験値が不正です');
  const level=state.level??initialLevel,total=(state.experience||0)+amount;
  const required=experienceRequired(level,rules.experience),increment=rules.experience.perLevel;
  if(!Number.isSafeInteger(total)||!Number.isSafeInteger(required))throw Error('経験値が上限を超えています');
  // Binary search handles large imported experience without an unbounded level-up loop.
  const spent=n=>n*required+n*(n-1)/2*increment;
  let low=0,high=Math.floor(total/required);
  while(low<high){const mid=low+Math.ceil((high-low)/2);if(spent(mid)<=total)low=mid;else high=mid-1}
  const next=low?grow(state,low,rules,initialLevel):{...state};
  next.growthPolicy=state.growthPolicy||rules.defaultPolicy;
  next.experience=total-spent(low);
  return {state:next,levels:low};
 }
 return {risks,outcome,stats,grow,experienceRequired,gainExperience};
})();
