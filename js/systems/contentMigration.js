// Content identifiers changed when replacing the prototype companions. Preserve
// owned items, growth, RNG, membership, pending results and journal references.
export function migrateCompanionContent(state, config) {
  const c = state.campaign;
  if (!c) return;
  const heroId = id => config.legacyHeroIds[id] ?? id;
  const migrateHero = hero => {
    hero.id = heroId(hero.id);
    hero.startingLevel ??= 1;
    hero.jobId = config.legacyJobIds[hero.jobId] ?? hero.jobId;
    hero.attributes ??= { ...(config.heroes.find(initial => initial.id === hero.id)?.attributes ?? {}) };
  };
  for (const hero of [...(c.heroes ?? []), ...(c.departure?.companions ?? [])]) migrateHero(hero);
  for (const party of c.parties ?? []) party.members = party.members.map(heroId);
  if (c.partyIds) c.partyIds = c.partyIds.map(heroId);
  if (c.expedition) {
    c.expedition.heroIds = c.expedition.heroIds.map(heroId);
    for (const risk of c.expedition.risks ?? []) risk.heroId = heroId(risk.heroId);
  }
  if (c.departure) c.departure.heroIds = c.departure.heroIds.map(heroId);
  for (const entry of c.journal ?? []) if (entry.details?.heroId) entry.details.heroId = heroId(entry.details.heroId);
  c.chapterId ??= config.releaseProfiles.mvp[0];
  if (c.expedition) c.expedition.experienceBonusPercent ??= 0;
}
