// Shared PNG atlases. Regions are presentation data, independent of stock dimensions.
const itemAtlas = new URL('../../../../assets/skins/fantasy/raster/items.png', import.meta.url).href;
const itemRegions = {
  iron_sword: [83,7,148,371], iron_axe: [396,16,178,362],
  oak_shield: [637,62,290,298], leather_armor: [958,66,266,295],
  potion: [56,389,202,268], silver_ring: [346,412,254,226],
  crystal: [693,378,197,302], herb_bundle: [974,387,252,286],
  bread: [18,728,303,222], steel_sword: [389,634,161,376],
  reinforced_shield: [635,689,284,294], chain_armor: [941,689,296,309],
  charm: [72,990,166,253],
};
export const itemArtwork = Object.fromEntries(Object.entries(itemRegions).map(([id,[x,y,width,height]]) => [id, {
  imageUrl: itemAtlas, imageRegion: { x, y, width, height, atlasWidth: 1254, atlasHeight: 1254 },
}]));

const characterAtlas = new URL('../../../../assets/skins/fantasy/raster/characters.png', import.meta.url).href;
const characterRegions = {
  lina: [7,190,512,715], bran: [558,122,451,780], noa: [1039,177,475,728],
};
const characters = Object.fromEntries(Object.entries(characterRegions).map(([id,[x,y,width,height]]) => [id, {
  imageUrl: characterAtlas, imageRegion: { x, y, width, height, atlasWidth:1536, atlasHeight:1024 },
}]));
// Existing customer roles share the approved art; identities remain locale/data keys.
export const characterArtwork = Object.fromEntries(Object.entries({
  lina:'lina', bran:'bran', noa:'noa', weapons:'bran', armor:'bran', tools:'noa',
  traveler:'lina', swordsman:'lina', guard:'bran', explorer:'lina', wanderer:'noa',
}).map(([id,source]) => [id,characters[source]]));
