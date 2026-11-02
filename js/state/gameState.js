// Only committed game data belongs here; the selected skin supplies starting data.
export function createGameState(skin) {
  return {
    skinId: skin.id,
    contentVersion: skin.contentVersion,
    ...structuredClone(skin.initialState),
  };
}
