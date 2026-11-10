/* Presentation only: callers commit and save game results before playing. */
const GameEffects=(()=>{
 const scenes=new Map();let active=false;
 function register(name,scene){scenes.set(name,scene)}
 function play(name,data={}){
  if(active||!scenes.has(name))return false;
  active=true;const previous=document.activeElement,dialog=document.createElement('dialog');
  dialog.className='game-effect';dialog.setAttribute('aria-label','仕入れ演出');
  let cleanup=()=>{},done=false;
  const finish=()=>{if(done)return;done=true;cleanup();dialog.close();dialog.remove();active=false;if(previous?.isConnected)previous.focus()};
  cleanup=scenes.get(name)(dialog,data,finish)||(()=>{});
  dialog.addEventListener('close',finish,{once:true});
  document.body.append(dialog);dialog.showModal();dialog.querySelector('button')?.focus();return true;
 }
 register('purchase',(root,{items=[],merchants=[]}={},finish)=>{
  let timer,page=0;const size=4;
  const button=(text,action)=>{const b=document.createElement('button');b.textContent=text;b.addEventListener('click',action);return b};
  function base(title){root.replaceChildren();const h=document.createElement('h2');h.textContent=title;root.append(h)}
  function results(){
   clearTimeout(timer);base('仕入れた商品');const count=document.createElement('p');count.textContent=`${items.length}品が届きました · ${page+1} / ${Math.max(1,Math.ceil(items.length/size))}`;root.append(count);
   const grid=document.createElement('div');grid.className='effect-products';
   items.slice(page*size,(page+1)*size).forEach(item=>{const card=document.createElement('article'),img=document.createElement('img'),label=document.createElement('b');img.src=item.image;img.alt='';label.textContent=item.name;card.append(img,label);grid.append(card)});root.append(grid);
   const controls=document.createElement('div');controls.className='effect-controls';
   const back=button('前へ',()=>{page--;results()});back.disabled=page===0;controls.append(back);
   if((page+1)*size<items.length)controls.append(button('次へ',()=>{page++;results()}));else controls.append(button('倉庫整理へ',finish));root.append(controls);controls.querySelector('button:not(:disabled)')?.focus();
  }
  function box(){
   base('商品が届きました');const scene=document.createElement('div'),img=document.createElement('img');
   scene.className='effect-box-scene';img.className='effect-box';img.alt='宝箱が開いて商品が現れる';
   // The fully open final frame starts at 1120ms; hold it for 800ms.
   img.addEventListener('load',()=>{if(!root.contains(img))return;clearTimeout(timer);timer=setTimeout(results,1920)},{once:true});
   img.addEventListener('error',()=>{if(root.contains(img))results()},{once:true});
   scene.append(img);root.append(scene,button('商品を見る',results));
   timer=setTimeout(results,4000);
   // A fresh URL restarts the GIF for each purchase, including cached images.
   img.src='assets/effects/open_box.gif?play='+Date.now();
  }
  function character(title,src,alt,clerk,next){
   base(title);
   const stage=document.createElement('div'),motion=document.createElement('div'),img=document.createElement('img');
   stage.className='effect-merchant-stage'+(clerk?' effect-clerk-stage':'');
   motion.className='effect-character-motion';
   img.className=clerk?'effect-clerk-portrait':'effect-merchant-portrait';
   img.src=src;img.alt=alt;
   img.addEventListener('error',()=>{img.hidden=true},{once:true});
   motion.append(img);stage.append(motion);root.append(stage,button('演出をスキップ',results));
   // Travel for 900ms, then remain at the destination for 500ms.
   timer=setTimeout(next,1400);
  }
  function clerk(){character('店員が商品を受け取ります','assets/shopkeeper/warm/shopkeeper-surprised.webp','驚く店員',true,box)}
  function arrival(index=0){
   if(index>=merchants.length){clerk();return}
   const merchant=merchants[index],names=['武器商','防具商','道具商'],files=['weapon','armor','tool'];
   if(!files[merchant]){arrival(index+1);return}
   character(names[merchant]+'からの仕入れ','assets/merchants/warm/'+files[merchant]+'-normal.webp',names[merchant],false,()=>arrival(index+1));
  }
  root.addEventListener('cancel',e=>{e.preventDefault();results()});arrival();return()=>clearTimeout(timer);
 });
 return{register,play,get active(){return active}};
})();
