// Numeric balance registry shared by the developer UI and the game.
const Balance = (() => {
 const key='shop-game-dev-balance-v1';
 const runtimeDefaults={itemsPerPurchase:1,expeditionWear:1,minimumPriceRatio:0.1,taxPeriod:5};
 const labels={development:'経済・仕入れ',initialGold:'初期資金',merchantCosts:'商人別費用',salePrice:'仮販売価格',buybackPrice:'引取基準額（販売基準額との比率）',bankruptcy:'救済・必要資金',clearFundsMultiplier:'借入加算倍率',maxClearFundsMultiplier:'必要資金上限倍率',baseClearFunds:'基本必要資金',loanAmount:'借入額',chapters:'章',prologue:'序章',finale:'終章',economy:'固定費・治療',seasonTax:'季節税',shopMaintenancePerShelf:'棚あたり管理費',companionMaintenancePerPerson:'仲間あたり維持費',shelfExpansionCost:'棚増設費',healing:'治療',costPerLevel:'Lvあたり治療費',trading:'売買',effects:'棚効果',bonus:'購入率加算',minimum:'必要個数',set:'セット',identical:'同一商品',slot:'同一部位',rules:'確率範囲',minProbability:'確率下限',maxProbability:'確率上限',customers:'顧客',probability:'購入確率',categories:'種類別購入率',items:'商品別購入率',visitors:'来店者数',min:'下限',max:'上限',money:'所持金',weight:'構成比',rumors:'噂',weights:'客層倍率',runtime:'仕入れ・遠征・価格・税',itemsPerPurchase:'仕入れ1回の個数',expeditionWear:'遠征1回の耐久消耗',minimumPriceRatio:'耐久による価格下限比率',taxPeriod:'課税周期（日）'};
 const clone=v=>JSON.parse(JSON.stringify(v));
 function create(sources){
  const defaults=clone({...sources,runtime:runtimeDefaults}),entries=[];
  function walk(value,path){if(typeof value==='number'){
   const id=path.join('.'),last=path.at(-1),fraction=['bonus','probability','minProbability','maxProbability','weight','clearFundsMultiplier','maxClearFundsMultiplier','minimumPriceRatio'].includes(last)||path.includes('weights')||path.includes('categories')||path.includes('items');
   let min=['salePrice','loanAmount','taxPeriod','itemsPerPurchase','minimum'].includes(last)?1:0;if(last==='minimum')min=2;
   const max=['probability','minProbability','maxProbability','minimumPriceRatio'].includes(last)||path.includes('categories')||path.includes('items')?1:1000000;
   entries.push({id,path,defaultValue:value,min,max,integer:!fraction,label:path.map(p=>labels[p]||p).join(' / '),timing:last==='initialGold'?'新規ゲーム開始時':'次の関連操作・計算時'});return}
   if(value&&typeof value==='object')for(const [k,v] of Object.entries(value))walk(v,[...path,k]);
  }
  walk(defaults.game.development.initialGold,['game','development','initialGold']);
  for(const k of ['merchantCosts','salePrice','buybackPrice'])walk(defaults.game.development[k],['game','development',k]);
  walk(defaults.game.bankruptcy,['game','bankruptcy']);walk(defaults.economy.chapters,['economy','chapters']);walk(defaults.economy.healing,['economy','healing']);
  for(const k of ['effects','rules','customers','chapters','rumors'])walk(defaults.trading[k],['trading',k]);walk(defaults.runtime,['runtime']);
  // Rumor duration participates in saved-state validation; keep it structural.
  const fields=entries.filter(e=>!e.id.endsWith('.duration'));
  const set=(obj,path,v)=>{let t=obj;for(const k of path.slice(0,-1))t=t[k];t[path.at(-1)]=v};
  function validate(data){
   if(!data||data.version!==1||!data.overrides||typeof data.overrides!=='object'||Array.isArray(data.overrides)||Object.keys(data).some(k=>!['version','overrides'].includes(k)))throw Error('version: 1 と overrides が必要です');
   const result=clone(defaults);
   for(const [id,v] of Object.entries(data.overrides)){const e=fields.find(e=>e.id===id);if(!e)throw Error('未定義の項目: '+id);if(typeof v!=='number'||!Number.isFinite(v)||v<e.min||v>e.max||e.integer&&!Number.isSafeInteger(v))throw Error(e.label+': 範囲 '+e.min+'〜'+e.max+(e.integer?' の整数':''));set(result,e.path,v)}
   function ranges(o){if(!o||typeof o!=='object')return;if(typeof o.min==='number'&&o.min>o.max)throw Error('下限は上限以下にしてください');for(const v of Object.values(o))ranges(v)}ranges(result);
   if(result.trading.rules.minProbability>result.trading.rules.maxProbability)throw Error('確率下限は上限以下にしてください');
   return result;
  }
  return {defaults,fields,validate};
 }
 function enabled(location){return ['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&new URLSearchParams(location.search).get('dev')==='balance'}
 function read(storage,registry){const raw=storage.getItem(key);return raw?registry.validate(JSON.parse(raw)):clone(registry.defaults)}
 return {key,runtimeDefaults,create,enabled,read};
})();
