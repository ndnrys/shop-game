/* Pure item rules. No DOM, display names, or pricing assumptions. */
(function(root){
 function validate(c,s){
  if(c.schemaVersion!==1||s.schemaVersion!==1)throw Error('未対応の設定バージョンです');
  const ids=new Set(),types=new Map();
  for(const t of c.types){if(types.has(t.id))throw Error('装備種類IDが重複');types.set(t.id,t);if(t.slot!==null&&!Object.hasOwn(c.slots,t.slot))throw Error('装備枠が不正');if(!((t.width===null&&t.height===null)||(Number.isInteger(t.width)&&t.width>0&&Number.isInteger(t.height)&&t.height>0)))throw Error('寸法が不正');}
  for(const i of c.items){if(!/^[a-z][a-z0-9_]*$/.test(i.id))throw Error('アイテムIDの形式が不正');if(ids.has(i.id))throw Error('アイテムIDが重複');ids.add(i.id);if(!types.has(i.typeId)||!Object.hasOwn(c.elements,i.element)||!['active','planned'].includes(i.status)||typeof i.name!=='string')throw Error('アイテム設定が不正');}
  for(const key of ['width','height'])if(!Number.isInteger(s.warehouse[key])||s.warehouse[key]<1||s.warehouse[key]>20)throw Error('倉庫寸法は1〜20');
  if(!Number.isInteger(s.ui.pageSize)||s.ui.pageSize<1||s.ui.pageSize>3)throw Error('画面内の表示数は1〜3');
  const p=s.prototype;if(!Array.isArray(p.merchantCosts)||p.merchantCosts.length!==3||p.merchantCosts.some(n=>!Number.isFinite(n)||n<0)||!['initialGold','salePrice','buybackPrice','shelfCapacity'].every(k=>Number.isInteger(p[k])&&p[k]>=0))throw Error('確認用設定が不正');
  if(p.initialItemIds.some(id=>!ids.has(id)))throw Error('初期アイテムIDが不正');return true;
 }
 function dimensions(item,types,rotation=item.rotation||0){let t=types[item.typeId];if(!t||t.width===null)return null;return rotation%2?{width:t.height,height:t.width}:{width:t.width,height:t.height};}
 function canPlace(item,x,y,rotation,inventory,types,board){const d=dimensions(item,types,rotation);if(!d||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x+d.width>board.width||y+d.height>board.height)return false;return inventory.every(other=>{if(other.uid===item.uid||other.x===null||other.x===undefined)return true;const od=dimensions(other,types);return !od||x+d.width<=other.x||other.x+od.width<=x||y+d.height<=other.y||other.y+od.height<=y;});}
 function findSpace(item,inventory,types,board){for(const rotation of [0,1])for(let y=0;y<board.height;y++)for(let x=0;x<board.width;x++)if(canPlace(item,x,y,rotation,inventory,types,board))return{x,y,rotation};return null;}
 // Keep the requested placement when valid, otherwise choose the nearest free
 // rectangle. Rotation preserves the previous centre when the anchor cannot fit.
 function findNearby(item,x,y,rotation,inventory,types,board,keepCentre=false){
  if(canPlace(item,x,y,rotation,inventory,types,board))return{x,y,rotation};
  const d=dimensions(item,types,rotation),old=dimensions(item,types);
  if(!d||!old)return null;
  const centreX=x+(keepCentre?old.width:d.width)/2;
  const centreY=y+(keepCentre?old.height:d.height)/2;
  let best=null,bestDistance=Infinity;
  for(let cy=0;cy<=board.height-d.height;cy++)for(let cx=0;cx<=board.width-d.width;cx++){
   if(!canPlace(item,cx,cy,rotation,inventory,types,board))continue;
   const distance=(cx+d.width/2-centreX)**2+(cy+d.height/2-centreY)**2;
   if(distance<bestDistance){bestDistance=distance;best={x:cx,y:cy,rotation};}
  }
  return best;
 }
 root.ItemCore={validate,dimensions,canPlace,findSpace,findNearby};
})(globalThis);
