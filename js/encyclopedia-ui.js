// Discovery and expedition records are stored with the game save.
let encyclopediaDefinitions={sets:[],people:[]};
let encyclopedia=EncyclopediaCore.create(), encyclopediaTab='items', encyclopediaSelection=null;
const encyclopediaText={title:'図鑑',items:'商品',sets:'セット装備',people:'人物',unknown:'？？？',discovered:'発見済み',undiscovered:'未発見',back:'一覧へ戻る'};
function openEncyclopedia(){encyclopediaSelection=null;page=0;screen='encyclopedia';render()}
function encyclopediaTiles(entries,records){
 const text=encyclopediaText;
 return entries.slice(page*9,(page+1)*9).map(d=>btn(`${records[d.id]&&encyclopediaTab==='items'?shape(d):'<span class="unknown-art">？</span>'}<b>${esc(records[d.id]?d.name:text.unknown)}</b><small>${records[d.id]?text.discovered:text.undiscovered}</small>`,`encyclopediaSelection='${d.id}';render()`,'encyclopedia-tile')).join('');
}
function slideEncyclopediaPage(value){
 if(screen!=='encyclopedia'||encyclopediaSelection)return;
 const entries=encyclopediaTab==='items'?catalog.items:encyclopediaDefinitions[encyclopediaTab],pages=Math.max(1,Math.ceil(entries.length/9)),next=Number(value);
 if(!Number.isFinite(next))return;
 page=Math.max(0,Math.min(pages-1,Math.round(next)));
 const grid=document.querySelector('.encyclopedia-grid'),slider=document.querySelector('#encyclopediaPageSlider'),output=document.querySelector('#encyclopediaPageNumber');
 if(grid)grid.innerHTML=encyclopediaTiles(entries,encyclopedia[encyclopediaTab]);
 if(slider){slider.value=page;slider.setAttribute('aria-valuetext',`${page+1} / ${pages}`)}
 if(output)output.textContent=`${page+1} / ${pages}`;
 translateVisibleText();
}
function encyclopediaView(){
 const t=encyclopediaText;
 const entries=encyclopediaTab==='items'?catalog.items:encyclopediaDefinitions[encyclopediaTab];
 const records=encyclopedia[encyclopediaTab];
 const tabs=`<div class="tabs">${['items','sets','people'].map(id=>btn(t[id],`encyclopediaTab='${id}';encyclopediaSelection=null;page=0;render()`,encyclopediaTab===id?'active':'')).join('')}</div>`;
 const heading=title(t.title,`${entries.filter(d=>records[d.id]).length} / ${entries.length} 発見済み`);
 const selectedEntry=entries.find(d=>d.id===encyclopediaSelection);
 if(selectedEntry){
  const d=selectedEntry,r=records[d.id];
  let content=card(`<h2>${esc(r?d.name:t.unknown)}</h2>`+note(r?t.discovered:t.undiscovered));
  if(r&&encyclopediaTab==='items'){
   const type=types[d.typeId];
   content=card(`<div class="row"><div><h2>${esc(d.name)}</h2>${esc(type.label)} · ${esc(catalog.elements[d.element])}</div>${shape(d)}</div><div class="ledger">${row('価格',d.price==null?'未設定':esc(d.price)+' G')}${row('能力',d.stats==null?'未設定':esc(JSON.stringify(d.stats)))}${row('耐久',type.slot?'基準10（仕入れ時8〜12）':'装備対象外')}${row('販売個数',r.sold)}${row('冒険使用本数',r.usedInstances.length)}${row('遠征使用回数',r.expeditions)}</div>`);
  }else if(r&&encyclopediaTab==='sets'){
   content=card(`<h2>${esc(d.name)}</h2><div class="ledger">${row('構成商品',d.itemIds.map(id=>esc(definitions[id].name)).join('＋'))}${row('冒険使用',r.usedCombinations.length?'使用済み':'未使用')}${row('冒険使用セット数',r.usedCombinations.length)}${row('遠征使用回数',r.expeditions)}</div>`);
  }else if(r&&encyclopediaTab==='people'){
   content=card(`<h2>${esc(d.name)}</h2><p>${esc(d.role)}</p><p>${esc(d.description)}</p>`);
  }
  return heading+tabs+`<section class="encyclopedia-detail">${content}</section>`+`<div class="bottom">${btn(t.back,'encyclopediaSelection=null;render()')}</div>`;
 }
 const size=9,pages=Math.max(1,Math.ceil(entries.length/size));page=Math.max(0,Math.min(page,pages-1));
 const discovered=entries.filter(d=>records[d.id]).length;
 return heading+`<progress aria-label="図鑑の発見率" value="${discovered}" max="${Math.max(1,entries.length)}"></progress>`+tabs+`<div class="encyclopedia-grid">${encyclopediaTiles(entries,records)}</div><div class="encyclopedia-page-slider"><input id="encyclopediaPageSlider" type="range" min="0" max="${pages-1}" step="1" value="${page}" ${pages===1?'disabled':''} aria-label="図鑑のページ" aria-valuetext="${page+1} / ${pages}" oninput="slideEncyclopediaPage(this.value)"><output id="encyclopediaPageNumber" for="encyclopediaPageSlider" aria-live="polite">${page+1} / ${pages}</output></div>`+`<div class="bottom">${btn('記録に戻る',"go('records')",'mini')}</div>`;
}
