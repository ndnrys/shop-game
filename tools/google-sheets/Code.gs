/**
 * shop-game Google Sheets editor (private spreadsheet only).
 * Script properties: GITHUB_TOKEN (fine-grained Contents: Read and write, scoped to ndnrys/shop-game).
 * Never publish this script as a web app or share its spreadsheet with editors you do not trust.
 */
const SHOP = {repo:'ndnrys/shop-game',branch:'development',files:{
  'game-settings':'data/game-settings.json',
  'economy':'data/economy.json',
  'trading':'data/trading.json'
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
  if(value&&typeof value==='object'&&!Array.isArray(value)) {
    for(const k of Object.keys(value))shopFlatten_(value[k],path.concat(k),rows);
  }else rows.push([JSON.stringify(path),JSON.stringify(value)]);
}
function shopAssign_(root,path,value) {
  let target=root;
  for(let i=0;i<path.length-1;i++)target=target[path[i]];
  target[path[path.length-1]]=value;
}
function shopGet_(root,path) {return path.reduce((o,k)=>o[k],root)}
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
    sheet.getRange(1,1,1,2).setValues([['設定パス（変更不可）','値（JSON形式）']]);
    if(info.rows.length)sheet.getRange(2,1,info.rows.length,2).setValues(info.rows);
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('@');
    sheet.getRange('B:B').setNumberFormat('@');
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
        if(old===null ? v!==null&&typeof v!=='number'&&typeof v!=='string' : Array.isArray(old)?!Array.isArray(v):typeof v!==typeof old)
          throw Error(name+': 値の型が不正: '+p);
        if(typeof v==='number'&&!Number.isFinite(v))throw Error(name+': 数値が不正: '+p);
        shopAssign_(original,JSON.parse(p),v);
      }
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
