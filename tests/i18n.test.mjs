import test from 'node:test';
import assert from 'node:assert/strict';
import commonJa from '../js/data/locales/ja.js';
import commonEn from '../js/data/locales/en.js';
import skin from '../js/data/skins/fantasy/index.js';
import { createSession } from '../js/application/createSession.js';
import { makeSave } from '../js/systems/save.js';

for (const [name, ja, en] of [['common', commonJa, commonEn], ['fantasy', skin.locales.ja, skin.locales.en]]) {
  test(`${name}: English covers every Japanese key and retains interpolation parameters`, () => {
    assert.deepEqual(Object.keys(en).sort(), Object.keys(ja).sort());
    const parameters = text => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(ja)) {
      assert.deepEqual(parameters(en[key]), parameters(ja[key]), key);
      assert.ok(!/[\u3040-\u30ff\u3400-\u9fff]/.test(en[key]), `Untranslated: ${key}`);
    }
  });
}
test('switching language changes labels without changing game state or save data', () => {
  const game = createSession(skin);
  const snapshot = JSON.stringify(makeSave(game.state));
  let changes = 0;
  game.subscribe(() => changes++);
  assert.equal(game.i18n.setLocale('en'), true);
  assert.equal(game.i18n.t('home.phase.report'), 'Morning report');
  assert.equal(game.i18n.itemName('iron_sword'), 'Iron sword');
  assert.equal(game.i18n.setLocale('ja'), true);
  assert.equal(game.i18n.t('home.phase.report'), '朝の報告');
  assert.equal(JSON.stringify(makeSave(game.state)), snapshot);
  assert.equal(changes, 0);
});
