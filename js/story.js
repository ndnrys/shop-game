// Story progression is separate from shop calculations and customer-weight rumors.
let storyConfig,storyState;
function createStoryState(){return {version:1,occurred:[],read:[],queue:[],page:0,capitalParty:[],departed:false,migrationPending:false,morningReportPending:false}}
function storyRead(id){return storyState.read.includes(id)}
function storyPercent(id){const d=config.dungeons.find(d=>d.id===id);return d?dungeonProgressPercent(d):0}
function collectStoryEvents(){
 if(!storyState||storyState.migrationPending||phase!==0)return;
 for(const event of storyConfig.events){
  const c=event.condition;
  if(event.chapter!==chapter||storyState.occurred.includes(event.id)||(c.day&&day<c.day)||(c.after&&!storyState.occurred.includes(c.after))||(c.merchantVisited&&!storyState.merchantVisited)||(c.allAfter&&c.allAfter.some(id=>!storyState.occurred.includes(id)))||(c.progress&&storyPercent(c.progress[0])<c.progress[1]))continue;
  storyState.occurred.push(event.id);storyState.queue.push(event.id);storyState.morningReportPending=true;
 }
}
function storyDestinationAvailable(d){return !d.legacy&&!storyState.migrationPending&&!storyState.departed&&day>=2&&storyRead(storyConfig.destinationReports[d.id])}
function storyPending(){return !!storyState?.queue.length}
function beginStoryReport(){if(storyPending())go('storyReport');else advance()}
function nextStoryPage(){
 const event=storyConfig.events.find(e=>e.id===storyState.queue[0]);if(!event)return;
 if(storyState.page<event.pages.length-1)storyState.page++;
 else{
  if(!storyRead(event.id)){
   storyState.read.push(event.id);
   if(event.effect==='recruit'){
    const recruits=characters.filter(c=>c.joinChapter===1).map(c=>c.id);
    availableCharacterIds=[...new Set([...availableCharacterIds,...recruits])];
    parties=[recruits.slice(0,3),parties.flat().filter(id=>id&& !recruits.includes(id)).slice(0,3),[]];
   }
  }
  storyState.queue.shift();storyState.page=0;
 }
 if(!storyPending())go('home');else render();
}
function storyDialogue(p){
 const character=p.speakerId&&characters.find(c=>c.id===p.speakerId);
 return clerkDialogue(p.text).replace('alt="案内役の店員"',`alt="${esc(p.speaker)}"`).replace(shopkeeperImage(),character?character.images.normal:shopkeeperImage());
}
function storyReportView(){
 const event=storyConfig.events.find(e=>e.id===storyState.queue[0]);if(!event)return report();
 const p=event.pages[storyState.page],last=storyState.queue.length===1&&storyState.page===event.pages.length-1;
 const controls=`<div class="bottom">${btn(last?'毎日の報告へ':'次へ','nextStoryPage()','primary')}</div>`;
 const visitor=p.speakerId?characters.find(c=>c.id===p.speakerId):null;
 const image=visitor?.images.normal||(p.speaker==='商人'?'assets/merchants/warm/weapon-normal.webp':null);
 if(image)return title(p.speaker)+customerScene(p.text,image,p.speaker)+controls;
 return report(false,{...p,controls});
}
function finishMorningReport(review=false){
 if(storyPending()){beginStoryReport();return}
 storyState.morningReportPending=false;
 if(review||villageCompletion().ready||storyTravelReady())go('home');else advance();
}
// Re-evaluate current funds and every active companion; never latch a past achievement.
function chapterClearConditions(){
 const targetGold=clearFunds(),funded=gold>=targetGold;
 const dungeonId=chapter===0?config.chapterProgression.prologue.clearDungeonId:chapter===1?'old_checkpoint':null;
 const conquered=!!dungeonId&&dungeonCleared(dungeonId);
 const deadIds=availableCharacterIds.filter(id=>companionStatus(id)==='dead');
 const allAlive=availableCharacterIds.length>0&&deadIds.length===0;
 return {targetGold,funded,conquered,deadIds,allAlive,ready:funded&&conquered&&allAlive};
}
function chapterClearGuidance(){
 const state=chapterClearConditions();
 if(!state.conquered||state.ready)return '<p>今日も一日がんばりましょう！</p><p>仕入れにいってきまーす！</p>';
 return `<p>メイン派遣先は攻略済みです。出発には目標金額と全員生存が必要です。</p><p>所持金 ${money(gold)} / 目標 ${money(state.targetGold)}</p>${state.allAlive?'':`<p>蘇生が必要な仲間：${state.deadIds.length}人</p>`}`;
}
function storyTravelReady(){return chapter===1&&phase===0&&!storyState.morningReportPending&&!storyState.migrationPending&&!storyState.departed&&chapterClearConditions().ready&&storyRead('chapter_one_clear')&&!storyPending()&&!expeditions.length&&!pending.length&&economyState.bill?.status!=='unpaid'}
function toggleCapitalCompanion(id){
 if(!storyTravelReady()||!availableCharacterIds.includes(id)||companionStatus(id)==='dead')return;
 const ids=storyState.capitalParty;storyState.capitalParty=ids.includes(id)?ids.filter(x=>x!==id):ids.length<2?[...ids,id]:ids;render();
}
function capitalDepartureView(){
 const ids=storyState.capitalParty,eligible=availableCharacters().filter(c=>companionStatus(c.id)!=='dead');
 const authorized=ids.some(id=>['leon','elma'].includes(id));
 return `<section class="story-panel"><h1>${storyState.departed?'王都へ出発':'王都への同行者'}</h1>${clerkDialogue(storyState.departed?'商人の護衛として仲間と王都へ向かいます。出店に役立つ知人を紹介してもらいましょう。今回の物語はここまでです。':authorized?'警備隊長から、レオンさん・エルマさんの同行は報告書の配達と説明の任務として認める、と伝言を預かっています。':'商人の護衛として同行する二人を選んでください。選ばれなかった二人には、この街に残ってもらいます。')}${card(`<div class="actions departure-roster">${eligible.map(c=>btn(characterArt(c)+`<span>${esc(characterName(c))}</span>`,`toggleCapitalCompanion('${c.id}')`,ids.includes(c.id)?'active':'',characterName(c)).replace('<button ',`<button aria-pressed="${ids.includes(c.id)}" ${storyState.departed?'disabled':''} `)).join('')}</div>`)}<p>所持金・商品と全員の装備・育成・負傷状態を保持します。同行 ${ids.length} / 2人</p><div class="bottom">${storyState.departed?btn('設定・セーブ',"go('settings')"):`<button class="primary" onclick="confirmCapitalDeparture()" ${ids.length!==2||!storyTravelReady()?'disabled':''}>この二人と王都へ出発</button>`}</div></section>`;
}
function confirmCapitalDeparture(){
 const ids=storyState.capitalParty;if(!storyTravelReady()||ids.length!==2||new Set(ids).size!==2||ids.some(id=>!availableCharacterIds.includes(id)||companionStatus(id)==='dead'))return;
 storyState.departed=true;go('capitalDeparture');
}
function migrationView(){return `<section class="story-panel"><h1>新しい物語への切替</h1>${clerkDialogue('今回の物語は、港町と街道の街を舞台に進みます。旧版の討伐実績は、新しい事件の攻略実績には読み替えません。')}<p>所持金・商品・装備・育成・負傷・過去の帳簿を保持し、現在の章の物語を冒頭から始めます。旧版の派遣中の仲間は予定どおり翌朝に帰還します。旧派遣の結果は新しい地点の攻略には加算しません。</p><div class="bottom">${btn('移行前のJSONを書き出す','exportGame()')}${btn('この章の新しい物語を始める','acceptStoryMigration()','primary')}</div></section>`}
function acceptStoryMigration(){if(!storyState.migrationPending)return;storyState.migrationPending=false;if(phase!==5)phase=0;collectStoryEvents();go('home')}
function customerStoryLine(visit,random=Math.random){
 const eligible=storyConfig.rumors.filter(r=>r.chapter===chapter&&storyRead(r.after));
 const w=storyConfig.dialogueWeights,choices=[['normal',w.normal],['daily',w.daily],['story',eligible.length?w.story:0]],total=choices.reduce((s,c)=>s+c[1],0);let roll=random()*total,kind='normal';
 for(const [key,weight] of choices){roll-=weight;if(roll<0){kind=key;break}}
 if(kind==='story')return eligible[Math.min(eligible.length-1,Math.floor(random()*eligible.length))].text;
 if(kind==='daily'){const lines=storyConfig.dailyLines;return lines[Math.min(lines.length-1,Math.floor(random()*lines.length))]}
 return visit.itemIds.length?'いい買い物ができた！':'今日は見送ろうかな';
}
let storyLogPage=0;
function storyLogView(){
 const pages=storyConfig.events.filter(e=>storyRead(e.id)).flatMap(e=>e.pages);
 storyLogPage=Math.max(0,Math.min(storyLogPage,pages.length-1));const p=pages[storyLogPage];
 return `<section class="story-panel"><h1>これまでの物語</h1>${p?`<h2>${esc(p.speaker)}</h2>${storyDialogue(p)}`:note('まだ記録はありません。')}<div class="bottom"><div class="actions">${btn('前へ','storyLogPage--;render()','mini')}${note(`${pages.length?storyLogPage+1:0} / ${pages.length}`)}${btn('次へ','storyLogPage++;render()','mini')}</div>${btn('経営に戻る',"go('home')")}</div></section>`;
}
function validateStorySave(s,fail){
 if(s.storyState===undefined){s.storyState=createStoryState();s.storyState.migrationPending=true;s.storyState.legacyChapter=s.chapter;}
 const state=s.storyState,ids=new Set(storyConfig.events.map(e=>e.id));
 if(!state||state.version!==1||!['occurred','read','queue','capitalParty'].every(k=>Array.isArray(state[k])&&new Set(state[k]).size===state[k].length)||['occurred','read','queue'].some(k=>state[k].some(id=>!ids.has(id)))||state.read.some(id=>!state.occurred.includes(id))||state.queue.some(id=>!state.occurred.includes(id)||state.read.includes(id))||state.occurred.some(id=>!state.read.includes(id)&&!state.queue.includes(id))||!Number.isSafeInteger(state.page)||state.page<0||typeof state.departed!=='boolean'||typeof state.migrationPending!=='boolean')fail();
 state.morningReportPending??=state.queue.length>0;if(typeof state.morningReportPending!=='boolean')fail();
 const event=storyConfig.events.find(e=>e.id===state.queue[0]);if(event?state.page>=event.pages.length:state.page!==0)fail();
 if(state.capitalParty.length>2||state.capitalParty.some(id=>!s.availableCharacterIds.includes(id))||(state.departed&&(s.chapter!==1||state.capitalParty.length!==2||!state.read.includes('chapter_one_clear'))))fail();
 if(state.occurred.some(id=>storyConfig.events.find(e=>e.id===id).chapter>s.chapter)||state.queue.some(id=>storyConfig.events.find(e=>e.id===id).chapter!==s.chapter))fail();
 if(state.escort!==undefined&&!['kyle','gares','mira'].includes(state.escort))fail();if(state.merchantVisited!==undefined&&typeof state.merchantVisited!=='boolean')fail();
 s.groupedReturnReport??=[];
 if(!Array.isArray(s.groupedReturnReport)||s.groupedReturnReport.some(g=>!g||typeof g.destination!=='string'||!Number.isInteger(g.party)||g.party<0||g.party>2||typeof g.progress!=='string'||!Number.isFinite(g.totalProgress)||g.totalProgress<0||g.totalProgress>100||!Array.isArray(g.members)||g.members.length>3||g.members.some(m=>!m||!characters.some(c=>c.id===m.id)||typeof m.name!=='string'||!Number.isSafeInteger(m.levelUps)||m.levelUps<0||!Array.isArray(m.events)||m.events.some(x=>typeof x!=='string'))))fail();
}
function validateStoryConfig(){
 if(storyConfig.version!==1||new Set(storyConfig.events.map(e=>e.id)).size!==storyConfig.events.length)throw Error('物語設定が不正です');
 for(const e of storyConfig.events)if(!e.id||![0,1].includes(e.chapter)||!e.pages.length||e.pages.some(p=>typeof p.text!=='string'||!p.text||typeof p.speaker!=='string')||(e.condition.after&&!storyConfig.events.some(p=>p.id===e.condition.after))||(e.condition.progress&&!config.dungeons.some(d=>d.id===e.condition.progress[0])))throw Error('物語イベントが不正です');
 const w=storyConfig.dialogueWeights;if(!['normal','daily','story'].every(k=>Number.isFinite(w[k])&&w[k]>=0)||w.normal+w.daily+w.story<=0)throw Error('会話抽選設定が不正です');
}
