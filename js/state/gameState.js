// Only committed game data belongs here; the selected skin supplies starting data.
export function createGameState(skin) {
  return {
    skinId: skin.id,
    contentVersion: skin.contentVersion,
    ...structuredClone(skin.initialState),
    ...(skin.campaign ? { campaign: {
      phase: "report", parties: [{ id: "party-1", members: Array.from({ length: skin.campaign.partySize }, (_, index) => skin.campaign.heroes[index]?.id ?? null), funds: 0 }],
      gold: skin.campaign.startingGold, day: 1, region: "village", seed: 20261102,
      nextItemId: 1, trade: null, expedition: null, defeated: false, dungeonProgress: Object.fromEntries(skin.campaign.dungeons.map(dungeon => [dungeon.id, 0])), departure: null,
      heroes: skin.campaign.heroes.map(hero => ({ ...hero, equipment: {}, giftedEquipment: [], level: hero.level ?? 1, pendingGrowth: 0, experience: 0, recoverUntil: 0 })),
      today: { sales: 0, cogs: 0, purchasing: 0, buyback: 0, support: 0, rewards: 0, aid: 0 },
      opened: false, customerVisits: [], aidDay: 0, journal: [], milestones: { purchased: false, sold: false, supported: false },
    } } : {}),
  };
}
