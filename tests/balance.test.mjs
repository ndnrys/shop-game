import test from 'node:test';
import assert from 'node:assert/strict';
import skin from '../js/data/skins/fantasy/index.js';
import { simulateRun } from '../tools/simulate-mvp.mjs';

test('different trading and funding strategies can finish a complete campaign and survive reloads',()=>{
  for(const [index,policy] of ['balanced','frugal','generous','merchant-mix'].entries()) {
    const run=simulateRun((Math.imul(index+1,2654435761)^20261102)>>>0,policy);
    assert.equal(run.cleared,true,policy);
    assert.ok(run.day>1&&run.day<=120,`${policy}: ${run.day}`);
    assert.deepEqual(run.dungeonProgress,{forest:60,camp:140},policy);
    assert.ok(run.firstDungeonClearDay>1,policy);
    assert.ok(run.levels.every(level=>level>1),policy);
    assert.ok(run.reloads>0,policy);
  }
});
