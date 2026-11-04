// Rescue state is independent of the unimplemented chapter-completion flow.
let rescueState,donationState,donationAdapter=null,donationBusy=false;
const rescueText={title:'国からの借入',donation:'村人からの寄付',unavailable:'広告は準備中です。実広告SDKは未接続です。'};
function resetRescue(){rescueState={count:0,totalLoans:0,chapters:{},last:null};donationState={date:null,used:0,rewards:[]}}
function validateRescueConfig(){
 const b=config.bankruptcy,d=config.donation,int=n=>Number.isSafeInteger(n)&&n>0;
 if(!b||!Number.isFinite(b.clearFundsMultiplier)||b.clearFundsMultiplier<1||!Number.isFinite(b.maxClearFundsMultiplier)||b.maxClearFundsMultiplier<1)throw Error('破産設定が不正です');
 for(const id of Object.keys(economyConfig.chapters)){const c=b.chapters?.[id];if(!int(c?.loanAmount)||!int(c?.baseClearFunds))throw Error('章の借入設定が不正です')}
 if(!int(d?.itemsPerAd)||!int(d.dailyAdLimit)||d.resetTimeZone!=='UTC'||d.resetHour!==0||d.rewardPool!=='all')throw Error('寄付設定が不正です');
}
function clearFunds(id=economyChapterId(chapter),state=rescueState){const b=config.bankruptcy,c=b.chapters[id];return Math.min(Math.floor(c.baseClearFunds*b.maxClearFundsMultiplier),c.baseClearFunds+Math.ceil((state.chapters[id]||0)*b.clearFundsMultiplier))}
function rescueUnpaidBill(){
 const expense=bankruptcyExpense();if(!expense||!expense.shortfall)return;
 const id=economyState.bill.chapterId,c=config.bankruptcy.chapters[id],before=clearFunds(id);
 // A large bill may require multiple configured loans; settle the saved bill once.
 const times=Math.ceil(expense.shortfall/c.loanAmount),amount=times*c.loanAmount;
 gold+=amount;rescueState.count+=times;rescueState.totalLoans+=amount;rescueState.chapters[id]=(rescueState.chapters[id]||0)+amount;
 rescueState.last={day,amount,before,after:clearFunds(id),times};settleEconomyBill();
}
function rescueReport(){const last=rescueState.last;return row('クリア必要資金',money(clearFunds()))+row('破産回数 / 累計借入',`${rescueState.count}回 / ${money(rescueState.totalLoans)}`)+(last?.day===day?note(`破産救済：国から${money(last.amount)}の資金提供。必要資金 ${money(last.before)} → ${money(last.after)}。固定費を支払いました。`):'')}
function donationDate(now=Date.now()){return new Date(now).toISOString().slice(0,10)}
function donationRemaining(now=Date.now()){return config.donation.dailyAdLimit-(donationState.date===donationDate(now)?donationState.used:0)}
// SDK integration: register an adapter with showRewardedAd() resolving {completed:true} only on verified completion.
// No adapter or completion button is installed in normal play.
function registerDonationAdapter(adapter){if(!adapter||typeof adapter.showRewardedAd!=='function')throw Error('広告インターフェースが不正です');donationAdapter=adapter}
async function watchDonation(){
 if(donationBusy||!donationAdapter||pending.length||donationRemaining()<=0)return;
 const claimState=donationState;donationBusy=true;render();
 try{
  const result=await donationAdapter.showRewardedAd();
  if(donationState!==claimState||result?.completed!==true||pending.length||donationRemaining()<=0)return;
  const pool=catalog.items.filter(d=>d.status==='active'&&fitsWarehouse(d));if(!pool.length)return;
  const ids=Array.from({length:config.donation.itemsPerAd},()=>pool[Math.floor(Math.random()*pool.length)].id);
  const date=donationDate();if(donationState.date!==date){donationState.date=date;donationState.used=0}
  pending=ids.map(newItem);donationState.used++;donationState.rewards=ids;
  // The reward and quota are persisted together; the existing intake handles full warehouses.
  persist();
 }catch(error){info('広告を完了できませんでした','報酬と利用回数は変更していません。')}
 finally{donationBusy=false;render()}
}
function donationView(){return title(rescueText.donation)+card(row('本日の残り視聴回数',donationRemaining()+'回')+note('UTC 00:00に更新。広告1回の正常完了で商品'+config.donation.itemsPerAd+'個。')+note(donationAdapter?'広告の正常完了後に入荷待ちへ保存します。':rescueText.unavailable)+`<button onclick="watchDonation()" ${!donationAdapter||donationBusy||pending.length||donationRemaining()<=0?'disabled':''}>${donationBusy?'広告視聴中':'広告を視聴する'}</button>`)+card('<h2>前回の獲得報酬</h2>'+note(donationState.rewards.map(id=>esc(definitions[id].name)).join('・')||'まだありません。'))+note('倉庫が満杯でも入荷待ちとして保持。全品を収納または引取するまで次へ進みません。')+`<div class="bottom">${pending.length?btn('入荷品を振り分ける',"go('trade')",'primary'):btn('経営に戻る',"go('home')")}</div>`}
function validateRescueSave(s,fail){
 s.rescueState??={count:0,totalLoans:0,chapters:{},last:null};s.donationState??={date:null,used:0,rewards:[]};
 const r=s.rescueState,d=s.donationState,int=n=>Number.isSafeInteger(n)&&n>=0;
 if(!r||!int(r.count)||!int(r.totalLoans)||!r.chapters||typeof r.chapters!=='object'||Array.isArray(r.chapters))fail();
 if(Object.entries(r.chapters).some(([id,n])=>!config.bankruptcy.chapters[id]||!int(n))||Object.values(r.chapters).reduce((a,n)=>a+n,0)!==r.totalLoans)fail();
 if(r.last!==null&&(!r.last||!['day','amount','before','after','times'].every(k=>int(r.last[k]))))fail();
 if(!d||!(d.date===null||typeof d.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d.date)&&!isNaN(Date.parse(d.date)))||!int(d.used)||d.used>config.donation.dailyAdLimit||d.date===null&&d.used!==0||!Array.isArray(d.rewards)||d.rewards.length>config.donation.itemsPerAd||d.rewards.some(id=>!definitions[id]))fail();
}
