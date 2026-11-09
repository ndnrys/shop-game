/* Presentation only: callers commit and save game results before playing. */
const GameEffects=(()=>{
 const scenes=new Map();let active=false;
 const artwork={merchantEyes:'',clerkEyes:'',merchantNeutral:'',merchantGrin:'',clerkSurprised:''};
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
 register('purchase',(root,{items=[],expression='neutral'}={},finish)=>{
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
  function cut(kind){
   base(kind==='eyes'?'商談開始':'商談成立');const stage=document.createElement('div');stage.className='effect-cutins';
   for(const who of ['merchant','clerk']){
    const panel=document.createElement('div');panel.className=`effect-cutin effect-${who}`;
    const key=who==='merchant'?(kind==='eyes'?'merchantEyes':expression==='grin'?'merchantGrin':'merchantNeutral'):(kind==='eyes'?'clerkEyes':'clerkSurprised');
    if(artwork[key]){const img=document.createElement('img');img.src=artwork[key];img.alt=(who==='merchant'?'商人':'店員')+(kind==='eyes'?'の目元':'の口元');panel.append(img)}else{
     const label=document.createElement('small');label.textContent=who==='merchant'?'仕入先の商人':'店員';const face=document.createElement('span');face.className=`effect-face ${kind} ${key}`;face.textContent=kind==='eyes'?'◡ ◡':who==='clerk'?'○':expression==='grin'?'◡':'―';panel.append(label,face);
    }stage.append(panel);
   }root.append(stage,button('演出をスキップ',results));
   timer=setTimeout(()=>{if(kind==='eyes')cut('mouth');else{stage.classList.add('leaving');timer=setTimeout(box,450)}},1100);
  }
  function box(){base('商品が届きました');const scene=document.createElement('div');scene.className='effect-box-scene';scene.innerHTML='<div class="effect-box"><div class="effect-box-lid"></div><span>✦</span></div>';root.append(scene,button('商品を見る',results));timer=setTimeout(results,1400)}
  root.addEventListener('cancel',e=>{e.preventDefault();results()});cut('eyes');return()=>clearTimeout(timer);
 });
 return{register,play,artwork,get active(){return active}};
})();
