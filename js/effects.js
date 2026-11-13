/* Retain loaded/decoded chapter images so expression changes never start a fetch. */
const ChapterImages=(()=>{
 const records=new Map();let preparation=0;
 function load(src){
  if(records.has(src))return records.get(src).promise;
  const record={image:null,ready:false,promise:null};records.set(src,record);
  record.promise=new Promise(resolve=>{
   if(typeof Image==='undefined'){resolve(false);return}
   const image=new Image();record.image=image;image.decoding='async';let finished=false;
   const finish=ready=>{if(finished)return;finished=true;clearTimeout(timer);record.ready=ready;resolve(ready)};
   const timer=setTimeout(()=>finish(false),15000);
   image.onload=()=>{finish(image.naturalWidth>0);image.decode?.().then(()=>{record.decoded=true},()=>{})};
   image.onerror=()=>finish(false);image.src=src;
  });return record.promise;
 }
 async function prepare(sources,onProgress=()=>{}){
  const token=++preparation,unique=[...new Set(sources.filter(Boolean))];let index=0,done=0;onProgress(done,unique.length);
  async function worker(){while(index<unique.length&&token===preparation){const src=unique[index++];await load(src);onProgress(++done,unique.length)}}
  await Promise.all(Array.from({length:Math.min(8,unique.length)},worker));return unique.filter(src=>!records.get(src)?.ready);
 }
 return {prepare,retain:sources=>{const keep=new Set(sources);for(const src of records.keys())if(!keep.has(src))records.delete(src)},ready:src=>!!records.get(src)?.ready,image:src=>records.get(src)?.image,get size(){return records.size}};
})();
/* Presentation only: callers commit and save game results before playing. */
const GameEffects=(()=>{
 const scenes=new Map();let active=false;
 const text=(key,fallback)=>typeof t==='function'?t('ui.effects.'+key,fallback):fallback;
 function register(name,scene){scenes.set(name,scene)}
 function play(name,data={}){
  if(active||!scenes.has(name))return false;
  active=true;const previous=document.activeElement,dialog=document.createElement('dialog');
  dialog.className='game-effect';dialog.setAttribute('aria-label',text('label','仕入れ演出'));
  let cleanup=()=>{},done=false;
  const finish=()=>{if(done)return;done=true;cleanup();dialog.close();dialog.remove();active=false;if(previous?.isConnected)previous.focus()};
  cleanup=scenes.get(name)(dialog,data,finish)||(()=>{});
  dialog.addEventListener('close',finish,{once:true});
  document.body.append(dialog);dialog.showModal();dialog.querySelector('button')?.focus();return true;
 }
 register('purchase',(root,{items=[],merchants=[],additionalPurchase=null,availableGold=()=>0}={},finish)=>{
  let timer;
  const button=(text,action)=>{const b=document.createElement('button');b.textContent=text;b.addEventListener('click',action);return b};
  function base(title){root.replaceChildren();root.dataset.stage='delivery';const h=document.createElement('h2');h.textContent=title;root.append(h)}
  function results(){
   clearTimeout(timer);base(text('results','仕入れた商品'));root.dataset.stage='results';const count=document.createElement('p');count.textContent=`${text('received','届いた品物')} ${items.length}品`;const meta=document.createElement('div');meta.className='effect-results-meta';meta.append(count);if(additionalPurchase){const gold=document.createElement('p');gold.className='effect-current-gold';gold.innerHTML='所持金 <strong>'+availableGold().toLocaleString()+' <span class="currency-unit">G</span></strong>';meta.append(gold)}root.append(meta);
   const grid=document.createElement('div');grid.className='effect-products effect-products-list';
   const grouped=new Map();for(const item of items){const key=item.id||item.name;if(grouped.has(key))grouped.get(key).owned++;else grouped.set(key,{...item,owned:1,quantity:0})}
   const lines=[...grouped.values()];let purchaseButton;
   const update=()=>{const total=lines.reduce((sum,item)=>sum+item.quantity*item.price,0);purchaseButton.textContent='選んだ商品を追加購入 '+total+' G';purchaseButton.disabled=total<=0||total>availableGold()};
   lines.forEach(item=>{const card=document.createElement('article'),img=document.createElement('img'),label=document.createElement('b'),owned=document.createElement('small');img.src=item.image;img.alt='';label.textContent=item.name;owned.textContent='取得 '+item.owned+'個';card.append(img,label,owned);
    if(additionalPurchase){const controls=document.createElement('div');controls.className='effect-item-quantity';const count=document.createElement('span');count.textContent='0';const minus=button('−',()=>{item.quantity=Math.max(0,item.quantity-1);count.textContent=item.quantity;update()}),plus=button('＋',()=>{item.quantity++;count.textContent=item.quantity;update()});controls.append(minus,count,plus);const price=document.createElement('small');price.innerHTML='1個 '+item.price.toLocaleString()+' <span class="currency-unit">G</span>';card.append(price,controls)}grid.append(card)});root.append(grid);
   if(additionalPurchase){purchaseButton=button('',()=>{const selected=lines.filter(item=>item.quantity>0);if(additionalPurchase(selected)){for(const item of selected)for(let i=0;i<item.quantity;i++)items.push({...item});results()}});purchaseButton.className='effect-additional-purchase';root.append(purchaseButton);update()}
   root.append(button(text('warehouse','倉庫整理へ'),finish));
  }

  function box(){
   base(text('unpack','届いた品物を確かめましょう'));root.dataset.stage='unpack';
   const scene=document.createElement('div');scene.className='effect-box-scene';
   items.slice(0,3).forEach((item,i)=>{const img=document.createElement('img');img.src=item.image;img.alt=item.name;img.style.setProperty('--order',i);scene.append(img)});
   root.append(scene,button(text('show','商品を見る'),results));timer=setTimeout(results,1920);
  }
  function character(title,src,alt,clerk,next){
   base(title);
   const stage=document.createElement('div'),motion=document.createElement('div'),img=document.createElement('img');
   stage.className='effect-merchant-stage'+(clerk?' effect-clerk-stage':'');
   motion.className='effect-character-motion';
   img.className=clerk?'effect-clerk-portrait':'effect-merchant-portrait';
   img.src=src;img.alt=alt;
   img.addEventListener('error',()=>{img.hidden=true},{once:true});
   motion.append(img);stage.append(motion);
   if(!clerk){const host=document.createElement('img');host.className='effect-host';host.src='assets/shopkeeper/warm/shopkeeper-normal.webp';host.alt=text('clerk','店員');stage.append(host)}
   root.append(stage,button(text('skip','演出をスキップ'),results));
   // Gently fade into the shop for 900ms, then hold for 500ms.
   timer=setTimeout(next,1400);
  }
  function clerk(){character(text('handoff','ありがとうございます。お預かりします'),'assets/shopkeeper/warm/shopkeeper-normal.webp',text('clerk','店員'),true,box)}
  function arrival(index=0){
   if(index>=merchants.length){clerk();return}
   const merchant=merchants[index],names=['武器商','防具商','道具商'],files=['weapon','armor','tool'];
   if(!files[merchant]){arrival(index+1);return}
   character(text('arrival'+merchant,names[merchant]+'からの仕入れ'),'assets/merchants/warm/'+files[merchant]+'-normal.webp',names[merchant],false,()=>arrival(index+1));
  }
  root.addEventListener('cancel',e=>{e.preventDefault();results()});arrival();return()=>clearTimeout(timer);
 });
 let clearMorning=()=>{};
 function morning(){
  clearMorning();
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return false;
  const shell=document.querySelector('.shell');if(!shell)return false;
  const year=Math.floor((day-1)/20)+1,season=Math.floor(((day-1)%20)/5),date=(day-1)%5+1,seasonKeys=['spring','summer','autumn','winter'],seasonNames=['春','夏','秋','冬'];
  const label=document.createElement('div');label.className='morning-date';label.setAttribute('aria-hidden','true');
  const yearLabel=document.createElement('span'),dateLabel=document.createElement('strong');
  yearLabel.textContent=t('ui.morning.year','{year}年目').replace('{year}',year);dateLabel.textContent=t('ui.morning.date','{season}{date}日').replace('{season}',t('ui.season.'+seasonKeys[season],seasonNames[season])).replace('{date}',date);label.append(yearLabel,dateLabel);shell.append(label);
  let timer;
  const cleanup=()=>{clearTimeout(timer);label.remove();shell.classList.remove('morning-reveal');shell.removeEventListener('animationend',ended);clearMorning=()=>{}};
  const ended=event=>{if(event.animationName==='morning-light')cleanup()};
  clearMorning=cleanup;shell.classList.add('morning-reveal');shell.addEventListener('animationend',ended);timer=setTimeout(cleanup,2000);return true;
 }
 return{register,play,morning,get active(){return active}};
})();
