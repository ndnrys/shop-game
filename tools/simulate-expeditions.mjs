// Expedition-only balance check with growth and individual risks; no equipment bonuses, paid healing or economy.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(read('js/adventurer-core.js'),context);
const core=vm.runInContext('AdventurerCore',context);
const config=JSON.parse(read('data/game-settings.json'));
const members=JSON.parse(read('data/characters.json')).filter(c=>c.joinChapter===0);
const dungeons=config.dungeons.filter(d=>d.chapter===0);
const runs=10000,results=[];
for(const policy of Object.keys(config.adventurers.growth.policies)){
 let seed=12345;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const finishes=[];let deaths=0;
 for(let run=0;run<runs;run++){
  const party=members.map(c=>({initial:c.initialStats,initialLevel:c.initialLevel,state:{growthPolicy:policy},ready:0,dead:false}));
  let dungeon=0,progress=0;
  for(let day=1;day<=90;day++){
   const d=dungeons[dungeon],active=party.filter(c=>!c.dead&&c.ready<=day);
   if(!active.length)continue;
   const stats=active.map(c=>core.stats(c.initial,c.state.growth));
   const delta=Math.min(d.requiredProgress-progress,stats.reduce((n,c)=>n+c.attack,0));
   progress+=delta;
   // Risks use departure stats; newly gained growth applies to the following expedition.
   const outcomes=stats.map(s=>core.outcome(core.risks(s,d.danger,config.adventurers.risk,true),random));
   for(const [index,c] of active.entries()){
    c.state=core.gainExperience(c.state,Math.floor(delta/active.length),config.adventurers.growth,c.initialLevel).state;
    const result=outcomes[index];
    if(result.status==='dead'){c.dead=true;deaths++}
    else c.ready=day+1+result.recoveryDays;
   }
   if(progress>=d.requiredProgress){
    dungeon++;progress=0;
    if(dungeon===dungeons.length){finishes.push(day);break}
   }
  }
 }
 finishes.sort((a,b)=>a-b);
 results.push({policy,runs,completed:finishes.length,medianExpeditionDays:finishes[Math.floor(finishes.length/2)],meanExpeditionDays:finishes.reduce((a,b)=>a+b,0)/finishes.length,p90ExpeditionDays:finishes[Math.floor(finishes.length*.9)],deaths});
}
console.log(JSON.stringify(results,null,2));
