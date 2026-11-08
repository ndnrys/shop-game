/**
 * shop-game Google Sheets editor (private spreadsheet only).
 * Script properties: GITHUB_TOKEN (fine-grained Contents: Read and write, scoped to ndnrys/shop-game).
 * Never publish this script as a web app or share its spreadsheet with editors you do not trust.
 */
const SHOP = {repo:'ndnrys/shop-game',branch:'development',files:{
  'game-settings':'data/game-settings.json',
  'economy':'data/economy.json',
  'trading':'data/trading.json',
  'characters':'data/characters.json'
}};
function onOpen() {
  SpreadsheetApp.getUi().createMenu('ゲーム管理')
    .addItem('GitHubから設定を取得（初回・再取得）','shopLoad')
    .addItem('設定を保存・送信','shopSave').addToUi();
}
function shopToken_() {
  const token=PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if(!token) throw Error('スクリプトプロパティ GITHUB_TOKEN を設定してください');
  return token;
}
function shopApi_(path,method,body) {
  const url='https://api.github.com/repos/'+SHOP.repo+'/contents/'+path.split('/').map(encodeURIComponent).join('/')+'?ref='+SHOP.branch;
  const opts={method:method||'get',muteHttpExceptions:true,headers:{
    Authorization:'Bearer '+shopToken_(),Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28'
  }};
  if(body)opts.payload=JSON.stringify(body);
  const response=UrlFetchApp.fetch(url,opts);
  const status=response.getResponseCode();
  if(status<200||status>=300)throw Error('GitHub API '+status+' ('+path+'): '+response.getContentText().slice(0,250));
  return JSON.parse(response.getContentText());
}
function shopDecode_(s) {return Utilities.newBlob(Utilities.base64Decode(s.replace(/\s/g,''))).getDataAsString('UTF-8')}
function shopEncode_(s) {return Utilities.base64Encode(Utilities.newBlob(s,'application/json').getBytes())}
function shopFlatten_(value,path,rows) {
  if(value&&typeof value==='object') {
    for(const k of Object.keys(value))shopFlatten_(value[k],path.concat(k),rows);
  }else rows.push([JSON.stringify(path),JSON.stringify(value)]);
}
function shopAssign_(root,path,value) {
  let target=root;
  for(let i=0;i<path.length-1;i++)target=target[path[i]];
  target[path[path.length-1]]=value;
}
function shopGet_(root,path) {return path.reduce((o,k)=>o[k],root)}

/** C列の説明は表示専用。GitHubへの送信対象には含めない。 */
function shopDescription_(name,rawPath) {
  const p=JSON.parse(rawPath), k=p[p.length-1], parent=p[p.length-2];
  const labels={
    schemaVersion:'データ形式のバージョン。通常は変更しません。',
    status:'設定データの状態（暫定値など）。',notes:'開発上の注意書き。',
    width:'倉庫の横幅（マス）。',height:'倉庫の縦幅（マス）。',pageSize:'一覧の1ページの表示件数。',
    initialGold:'ゲーム開始時の所持金（G）。',merchantCosts:'仕入れ費用の候補（G）の配列。',
    prologueMerchantCosts:'村での仕入れ費用候補（G）の配列。',
    salePrice:'正式価格がない商品の仮販売価格（G）。',buybackPrice:'商人引取の計算に使う仮価格（G）。',
    shelfCapacity:'棚1つに置ける商品数。',initialItemIds:'初期所持商品のID一覧。',
    clearFundsMultiplier:'破産救済の必要資金に対する累計借入の倍率。',
    maxClearFundsMultiplier:'破産救済の必要資金倍率の上限。',
    baseClearFunds:'章ごとの救済判定の基本必要資金（G）。',
    loanAmount:'救済1口あたりの借入額（G）。',
    itemsPerAd:'報酬広告1回あたりの入荷品数。',
    dailyAdLimit:'1日あたりの報酬広告の上限回数。',
    resetTimeZone:'広告回数リセットの基準タイムゾーン。',
    resetHour:'広告回数をリセットする時刻（時）。',
    rewardPool:'広告報酬の抽選対象。',
    requiredProgress:'ダンジョン攻略に必要な進行値。',
    danger:'ダンジョンの危険度。',requires:'攻略前提となるダンジョンID。',
    recommendedAttributes:'攻略で推奨される属性と値。',
    attributeBonus:'推奨属性による攻略補正。',
    injuryRate:'負傷判定の基準確率（0〜1）。',
    severeRate:'重傷判定の基準確率（0〜1）。',
    deathRate:'死亡判定の基準確率（0〜1）。',
    tutorialChapter:'チュートリアル扱いの章番号。',
    tutorialDeathCap:'チュートリアルでの死亡確率の上限（0〜1）。',
    denominatorOffset:'負傷・死亡判定の計算に使う分母補正。',
    injuryRecoveryFactor:'通常負傷の回復日数係数。',
    severeRecoveryFactor:'重傷の回復日数係数。',
    minRecoveryDays:'回復に必要な最短日数。',
    maxRecoveryDays:'回復に必要な最長日数。',
    defaultPolicy:'レベルアップ時の標準成長方針ID。',
    pointsPerLevel:'レベルアップ時の能力上昇ポイント数。',
    baseRequired:'レベルアップに必要な基本経験値。',
    perLevel:'レベルごとの必要経験値増分。',
    sizes:'倉庫拡張で選べるサイズ（マス）の一覧。',
    costs:'倉庫拡張に必要な費用（G）の一覧。',
    legacySize:'旧セーブデータの倉庫サイズ。',
    clearDungeonId:'章クリア判定の対象ダンジョンID。',
    enemyName:'章クリア時の敵の表示名。',
    nextChapter:'次の章番号。',nextName:'次の章の表示名。',
    memberLimit:'次章へ連れていける仲間の人数上限。',
    seasonTax:'定期的に支払う税金（G）。',
    shopMaintenancePerShelf:'棚1つあたりの維持費（G）。',
    companionMaintenancePerPerson:'仲間1人あたりの維持費（G）。',
    shelfExpansionCost:'棚を増設する費用（G）。',
    costPerLevel:'治療費のレベルあたり単価（G）。',
    bonus:'購入確率に加える補正（0.3なら30パーセントポイント）。',
    minimum:'効果の発動に必要な最低商品数。',
    minProbability:'購入確率の下限（0〜1）。',
    maxProbability:'購入確率の上限（0〜1）。',
    setPriority:'セット販売を優先する順序。',
    selection:'商品候補の選択方式。',
    allowUsedInSets:'中古品をセット販売に含めるか。',
    probability:'買い物客の商品の購入傾向の基準確率（0〜1）。',
    visitors:'来店人数の設定。',weight:'客層の出現比率に使う重み。',
    id:'内部識別子。参照関係があるため原則変更しません。',
    name:'ゲーム内の表示名。',chapter:'対象の章番号。',
    joinChapter:'仲間が加入する章番号。',
    initialJobId:'仲間の初期職業ID。',
    initialLevel:'仲間の初期レベル。',
    nameKey:'名前の翻訳キー。',descriptionKey:'説明文の翻訳キー。',
    initialEquipment:'初期装備の設定。',
    jobName:'職業の表示名。',
    hp:'HPの初期値または成長配分。',
    attack:'攻撃力の初期値または成長配分。',
    defense:'防御力の初期値または成長配分。'
  };
  if(name==='characters') {
    const person='キャラクター'+(Number(p[0])+1)+'人目';
    if(p.includes('images'))return person+'の画像ファイルパス（変更時は実ファイルと一致させてください）。';
    if(p.includes('attributes'))return person+'の固有属性値。';
    return person+'：'+(labels[k]||'キャラクター定義の項目。');
  }
  if(name==='trading') {
    if(p.includes('money'))return '客層 '+(p[p.indexOf('customers')+1]||'')+' の所持金'+(k==='min'?'下限':k==='max'?'上限':'設定')+'（G）。';
    if(p.includes('categories'))return '客層の装備カテゴリ「'+k+'」の購入傾向（0〜1）。';
    if(p.includes('items'))return '客層の商品「'+k+'」の購入傾向（0〜1）。';
    if(k==='min'||k==='max')return '章ごとの来店人数の'+(k==='min'?'最小':'最大')+'値。';
    if(k==='weight')return '章ごとの客層「'+parent+'」の出現重み。';
  }
  if(name==='game-settings'&&p.includes('jobEquipment'))return '職業「'+p[2]+'」が装備可能なカテゴリID。';
  if(name==='game-settings'&&p.includes('dungeons'))return 'ダンジョン'+(Number(p[1])+1)+'件目：'+(labels[k]||'設定値。');
  if(name==='game-settings'&&p.includes('policies'))return '成長方針「'+p[3]+'」：'+(labels[k]||'設定値。');
  if(k==='min'||k==='max')return '設定範囲の'+(k==='min'?'下限':'上限')+'。';
  if(typeof k==='number')return '配列の'+(k+1)+'番目の値。';
  return labels[k]||'「'+p.join(' / ')+'」の設定値。詳細な仕様は関連する設定ガイドを参照してください。';
}

function shopLoad() {
  const ui=SpreadsheetApp.getUi();
  if(ui.alert('GitHubの設定で各シートを上書きします。未送信の編集は失われます。',ui.ButtonSet.OK_CANCEL)!==ui.Button.OK)return;
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const fetched={};
  for(const [name,path] of Object.entries(SHOP.files)){
    const file=shopApi_(path);
    const data=JSON.parse(shopDecode_(file.content));
    const rows=[];shopFlatten_(data,[],rows);
    fetched[name]={sha:file.sha,rows};
  }
  for(const [name,info] of Object.entries(fetched)){
    const sheet=ss.getSheetByName(name)||ss.insertSheet(name);
    sheet.clearContents();
    sheet.getRange('A:C').setNumberFormat('@');
    sheet.getRange(1,1,1,3).setValues([['設定パス（変更不可）','値（JSON形式）','説明（編集不要）']]);
    if(info.rows.length)sheet.getRange(2,1,info.rows.length,3).setValues(info.rows.map(row=>row.concat(shopDescription_(name,row[0]))));
    sheet.setColumnWidth(3,460);
    sheet.getRange(1,1,1,3).setFontWeight('bold');
    sheet.setFrozenRows(1);
    
  }
  PropertiesService.getDocumentProperties().setProperty('SHOP_BASE_SHAS',JSON.stringify(Object.fromEntries(Object.entries(fetched).map(([n,v])=>[n,v.sha]))));
  ui.alert('取得完了。値の列だけを編集してください。保存メニューを実行するまで送信されません。');
}
function shopSave() {
  const ui=SpreadsheetApp.getUi(),ss=SpreadsheetApp.getActiveSpreadsheet();
  const lock=LockService.getDocumentLock();
  if(!lock.tryLock(1000))throw Error('別の保存処理が実行中です');
  try {
    const saved=JSON.parse(PropertiesService.getDocumentProperties().getProperty('SHOP_BASE_SHAS')||'{}');
    const changes=[];
    // Validate ALL sheets before any write. Refuse stale base to avoid overwriting concurrent changes.
    for(const [name,path] of Object.entries(SHOP.files)){
      if(!saved[name])throw Error('先に「GitHubから設定を取得」を実行してください');
      const remote=shopApi_(path),original=JSON.parse(shopDecode_(remote.content));
      if(remote.sha!==saved[name])throw Error(name+' はGitHub側で更新されています。送信せず、再取得して変更をやり直してください');
      const sheet=ss.getSheetByName(name);
      if(!sheet)throw Error('シートがありません: '+name);
      const rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues():[];
      const expected=[];shopFlatten_(original,[],expected);
      const byPath=new Map(expected.map(([p,v])=>[p,v]));
      if(rows.length!==expected.length)throw Error(name+': 行数が変わっています');
      const seen=new Set();
      for(const [rawPath,rawValue] of rows){
        const p=String(rawPath);
        if(!byPath.has(p)||seen.has(p))throw Error(name+': 設定パスが不正または重複しています: '+p);
        seen.add(p);
        let v;
        try{v=JSON.parse(String(rawValue))}catch(e){throw Error(name+': JSON形式が不正: '+p)}
        const old=JSON.parse(byPath.get(p));
        if(old===null ? v!==null&&typeof v!=='number'&&typeof v!=='string' : typeof v!==typeof old)
          throw Error(name+': 値の型が不正: '+p);
        if(typeof v==='number'&&!Number.isFinite(v))throw Error(name+': 数値が不正: '+p);
        shopAssign_(original,JSON.parse(p),v);
      }
      if(name==='characters') { const ids=original.map(c=>c.id); if(ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)throw Error('characters: IDが不正または重複しています'); }
      changes.push({name,path,sha:remote.sha,content:JSON.stringify(original,null,2)+'\n'});
    }
    if(ui.alert('確認','developmentブランチの設定JSONを更新します。よろしいですか？',ui.ButtonSet.OK_CANCEL)!==ui.Button.OK)return;
    // Contents API commits per file; an interruption can partially update the three files.
    const next={...saved};
    for(const change of changes){
      const current=shopApi_(change.path);
      if(current.sha!==change.sha)throw Error(change.name+': 送信直前にGitHub側が更新されました');
      const previous=shopDecode_(current.content);
      if(previous===change.content)continue;
      const url='https://api.github.com/repos/'+SHOP.repo+'/contents/'+change.path.split('/').map(encodeURIComponent).join('/');
      const response=UrlFetchApp.fetch(url,{method:'put',muteHttpExceptions:true,contentType:'application/json',
        headers:{Authorization:'Bearer '+shopToken_(),Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
        payload:JSON.stringify({message:'設定: スプレッドシートから更新',branch:SHOP.branch,sha:change.sha,content:shopEncode_(change.content)})});
      if(response.getResponseCode()!==200)throw Error(change.name+': 更新失敗 HTTP '+response.getResponseCode()+'。一部のファイルは送信済みの可能性があります');
      next[change.name]=JSON.parse(response.getContentText()).content.sha;
      PropertiesService.getDocumentProperties().setProperty('SHOP_BASE_SHAS',JSON.stringify(next));
    }
    ui.alert('送信完了。developmentへコミットしました。mainや公開ゲームには自動反映されません。');
  }finally{lock.releaseLock()}
}
