// Only committed game data belongs here; the selected skin supplies starting data.
export function createGameState(skin) {
  return {
    skinId: skin.id,
    contentVersion: skin.contentVersion,
    ...structuredClone(skin.initialState),
    ...(skin.campaign ? { campaign: {
      gold: skin.campaign.startingGold, day: 1, region: "village", seed: 20261102,
      nextItemId: 1, trade: null, expedition: null, defeated: false, departure: null,
      heroes: skin.campaign.heroes.map(hero => ({ ...hero, equipment: null, funds: 0 })),
      today: { sales: 0, cogs: 0, purchasing: 0, buyback: 0, support: 0, rewards: 0, aid: 0 },
      opened: false, aidDay: 0, journal: [], milestones: { purchased: false, sold: false, supported: false },
    } } : {}),
  };
}
