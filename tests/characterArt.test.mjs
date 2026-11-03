import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import campaign from '../js/data/skins/fantasy/campaign.js';
import { characterArt } from '../js/ui/characterArt.js';

test('all 27 profiles resolve to supplied PNG sheets with valid pose regions', () => {
  assert.equal(campaign.characters.length, 27);
  for (const character of campaign.characters) {
    const artwork = campaign.presentation.characters[character.id];
    for (const pose of ['normal', 'icon', 'battle', 'resting', 'dead']) {
      const art = artwork.poses[pose];
      const png = readFileSync(new URL(art.imageUrl));
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      assert.equal(png.readUInt32BE(16), art.imageRegion.atlasWidth);
      assert.equal(png.readUInt32BE(20), art.imageRegion.atlasHeight);
      assert.ok(art.imageRegion.x + art.imageRegion.width <= png.readUInt32BE(16));
    }
  }
});

test('portraits follow individual health and expedition participation without changing state', () => {
  const art = campaign.presentation.characters.kyle;
  const c = { day: 2, heroes: [{ id: 'kyle', health: 'healthy', recoverUntil: 0 }], expedition: null };
  assert.equal(characterArt(art, 'kyle', c), art.poses.normal);
  c.expedition = { heroIds: ['kyle'] };
  assert.equal(characterArt(art, 'kyle', c), art.poses.battle);
  c.expedition.heroIds = ['mira'];
  assert.equal(characterArt(art, 'kyle', c), art.poses.normal);
  c.heroes[0].recoverUntil = 5;
  c.heroes[0].health = 'light';
  assert.equal(characterArt(art, 'kyle', c), art.poses.resting);
  c.heroes[0].health = 'dead';
  assert.equal(characterArt(art, 'kyle', c), art.poses.dead);
  c.heroes[0].health = 'reviving';
  assert.equal(characterArt(art, 'kyle', c), art.poses.resting);
  c.heroes[0].recoverUntil = 2;
  assert.equal(characterArt(art, 'kyle', c), art.poses.normal);
  assert.equal(characterArt('npc.png', 'npc', c), 'npc.png');
});
