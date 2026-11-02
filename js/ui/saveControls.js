import { makeSave, parseSave, saveGame } from "../systems/save.js";
import { createGameState } from "../state/gameState.js";

export function mountSaveControls(root, game, skin, loadFailed = false) {
  const events = new AbortController();
  const status = root.querySelector('#save-status');
  const { t } = game.i18n;
  let queue=Promise.resolve();
  let revision=0;
  let savingAllowed=!loadFailed;
  function message(key) {
    status.textContent=t(key);
    status.classList.toggle('save-error',key.includes('failed')||key.includes('invalid')||key.includes('Error'));
  }
  function save() {
    if(!savingAllowed) return;
    const snapshot=makeSave(game.state); const current=++revision;
    message('mvp.save.saving');
    queue=queue.catch(()=>{}).then(()=>saveGame(skin.id,snapshot));
    queue.then(()=>{ if(current===revision) message('mvp.save.saved'); },()=>{ if(current===revision) message('mvp.save.failed'); });
  }
  const unsubscribe=game.subscribe(save);
  if(loadFailed) message('mvp.save.invalid'); else save();
  root.addEventListener('click',async event=>{
    const action=event.target.closest('[data-save]')?.dataset.save;
    if(action==='export') {
      const blob=new Blob([JSON.stringify(makeSave(game.state),null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');
      a.href=url;a.download=`shop-game-${skin.id}-day-${game.state.campaign?.day??1}.json`;a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    if(action==='reset' && window.confirm(t('mvp.resetConfirm'))) {
      savingAllowed=false;await queue.catch(()=>{});
      try { await saveGame(skin.id,makeSave(createGameState(skin)));location.hash='home';location.reload(); }
      catch { message('mvp.save.failed');savingAllowed=true; }
    }
  },{signal:events.signal});
  root.querySelector('#save-import').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    try {
      if(file.size>5000000)throw new Error('Too large');
      const state=parseSave(await file.text(),skin);
      if(!window.confirm(t('mvp.importConfirm')))return;
      savingAllowed=false;await queue.catch(()=>{});
      await saveGame(skin.id,makeSave(state));location.hash='home';location.reload();
    } catch { message('mvp.importError');savingAllowed=!loadFailed; }
    finally { event.target.value=''; }
  },{signal:events.signal});
  return { destroy(){unsubscribe();events.abort();} };
}
