// The current main has no encounter, equipment or save subsystem.
let encyclopediaDefinitions={sets:[],people:[]};
let encyclopedia=EncyclopediaCore.create(), encyclopediaTab='items', encyclopediaSelection=null;
const encyclopediaText={title:'図鑑',items:'商品',sets:'セット装備',people:'人物',unknown:'？？？',discovered:'発見済み',undiscovered:'未発見',back:'一覧へ戻る'};
function openEncyclopedia(){encyclopediaSelection=null;page=0;screen='encyclopedia';render()}
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
   content=card(`<div class="row"><div><h2>${esc(d.name)}</h2>${esc(type.label)} · ${esc(catalog.elements[d.element])}</div>${shape(d)}</div><div class="ledger">${row('価格',d.price==null?'未設定':esc(d.price)+' G')}${row('能力',d.stats==null?'未設定':esc(JSON.stringify(d.stats)))}${row('耐久',d.durability==null?'未設定':esc(JSON.stringify(d.durability)))}${row('販売個数',r.sold)}${row('冒険使用本数',r.usedInstances.length)}${row('遠征使用回数',r.expeditions)}</div>`);
  }else if(r&&encyclopediaTab==='sets'){
   content=card(`<h2>${esc(d.name)}</h2><div class="ledger">${row('構成商品',d.itemIds.map(id=>esc(definitions[id].name)).join('＋'))}${row('冒険使用',r.usedCombinations.length?'使用済み':'未使用')}${row('冒険使用セット数',r.usedCombinations.length)}${row('遠征使用回数',r.expeditions)}</div>`);
  }else if(r&&encyclopediaTab==='people'){
   content=card(`<h2>${esc(d.name)}</h2><p>${esc(d.role)}</p><p>${esc(d.description)}</p>`);
  }
  return heading+tabs+`<section class="encyclopedia-detail">${content}</section>`+`<div class="bottom">${btn(t.back,'encyclopediaSelection=null;render()')}</div>`;
 }
 // Fit the page to the viewport while keeping the navigation visible.
 const size=Math.max(2,Math.min(6,Math.floor(((window.innerHeight||568)-370)/65)));page=Math.min(page,Math.max(0,Math.ceil(entries.length/size)-1));
 return heading+tabs+`<div class="list">${entries.slice(page*size,(page+1)*size).map(d=>btn(`<span><b>${esc(records[d.id]?d.name:t.unknown)}</b><small class="block">${records[d.id]?t.discovered:t.undiscovered}</small></span><span aria-hidden="true">${records[d.id]&&encyclopediaTab==='items'?shape(d):'？'}</span>`,`encyclopediaSelection='${d.id}';render()`,'item')).join('')}</div>`+(entries.length?pager(entries.length,size):note('人物の遭遇処理は未実装です。登録対象の接続は保留中です。'))+`<div class="bottom">${note('装備・遠征・保存との連動は未実装です。再読み込みで記録は初期化されます。')}${btn('記録に戻る',"go('records')")}</div>`;
}
