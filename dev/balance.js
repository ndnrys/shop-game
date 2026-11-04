(async()=>{
 const $=id=>document.getElementById(id),status=$('status');
 if(!Balance.enabled({hostname:location.hostname,search:'?dev=balance'})){$('mode').textContent='無効：このツールは localhost / 127.0.0.1 / ::1 のHTTPサーバー専用です。本番ホストでは調整値を読み書きしません。';document.querySelectorAll('button,input').forEach(e=>e.disabled=true);return}
 $('mode').textContent='ローカル開発専用 · 通常URL・本番ホストでは調整値は無効';
 try{
 const [game,economy,trading]=await Promise.all(['game-settings','economy','trading'].map(async name=>{const r=await fetch('../data/'+name+'.json');if(!r.ok)throw Error('設定を読み込めません');return r.json()}));
 const registry=Balance.create({game,economy,trading}),get=(obj,path)=>path.reduce((v,k)=>v[k],obj);let current;
 try{current=Balance.read(localStorage,registry)}catch(e){current=registry.defaults;status.textContent='保存値を無視しました：'+e.message}
 const inputs=new Map(),cells=new Map();
 for(const group of ['game','economy','trading','runtime']){
 const section=document.createElement('section'),heading=document.createElement('h2');heading.textContent={game:'経済・仕入れ・救済',economy:'固定費・治療',trading:'売買・客層・棚効果',runtime:'仕入れ・遠征・価格・税'}[group];section.append(heading);
 const table=document.createElement('table');table.innerHTML='<thead><tr><th>項目 / 反映タイミング</th><th>初期値</th><th>現在値</th><th>変更</th></tr></thead>';const body=document.createElement('tbody');table.append(body);
 for(const field of registry.fields.filter(e=>e.path[0]===group)){
 const row=document.createElement('tr'),label=document.createElement('td'),base=document.createElement('td'),value=document.createElement('td'),changed=document.createElement('td'),input=document.createElement('input');
 label.textContent=field.label;const timing=document.createElement('small');timing.textContent=field.timing;label.append(timing);base.textContent=field.defaultValue;input.type='number';input.min=field.min;input.max=field.max;input.step=field.integer?'1':'any';input.value=get(current,field.path);input.setAttribute('aria-label',field.label);value.append(input);row.append(label,base,value,changed);body.append(row);inputs.set(field.id,input);cells.set(field.id,changed);
 input.addEventListener('input',()=>{changed.textContent='未適用';input.removeAttribute('aria-invalid')});
 }
 section.append(table);$('fields').append(section);
 }
 function refresh(){for(const field of registry.fields){inputs.get(field.id).value=get(current,field.path);inputs.get(field.id).removeAttribute('aria-invalid');const changed=get(current,field.path)!==field.defaultValue;cells.get(field.id).textContent=changed?'変更あり':'—';cells.get(field.id).className=changed?'changed':''}}
 function data(){const overrides={};for(const field of registry.fields){const input=inputs.get(field.id),n=input.value===''?NaN:Number(input.value);if(!input.checkValidity()||!Number.isFinite(n)){input.setAttribute('aria-invalid','true');throw Error(field.label+'：有効な数値を入力してください')}if(n!==field.defaultValue)overrides[field.id]=n}return {version:1,overrides}}
 function save(payload){const next=registry.validate(payload);localStorage.setItem(Balance.key,JSON.stringify(payload));current=next;refresh();status.textContent='保存済み。開発モードの別タブにも反映しました。'}
 $('apply').onclick=()=>{try{save(data())}catch(e){status.textContent=e.message}};
 $('reset').onclick=()=>{try{save({version:1,overrides:{}})}catch(e){status.textContent=e.message}};
 $('export').onclick=()=>{try{const payload=data();registry.validate(payload);const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='shop-game-balance.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){status.textContent=e.message}};
 $('import').onchange=async event=>{try{const file=event.target.files[0];if(file)save(JSON.parse(await file.text()))}catch(e){status.textContent='読み込み失敗：'+e.message}finally{event.target.value=''}};
 window.addEventListener('storage',e=>{if(e.key===Balance.key||e.key===null)try{current=Balance.read(localStorage,registry);refresh();status.textContent='別タブの変更を読み込みました。'}catch(error){status.textContent=error.message}});refresh();
 }catch(e){status.textContent=e.message}
})();
