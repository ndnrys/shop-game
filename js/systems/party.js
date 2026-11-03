// Parties own their member slots and expedition funds; characters own equipment.
export function setPartyMembers(campaign, config, partyId, members) {
  const party = campaign.parties.find(entry => entry.id === partyId);
  if (!party || !Array.isArray(members) || members.length > config.partySize || members.some(id => id !== null && !campaign.heroes.some(hero => hero.id === id))) return { ok: false, reason: 'mvp.error.party' };
  const ids = members.filter(id => id !== null);
  if (new Set(ids).size !== ids.length || campaign.parties.some(other => other.id !== partyId && other.members.some(id => id !== null && ids.includes(id)))) return { ok: false, reason: 'mvp.error.party' };
  party.members = [...members, ...Array(config.partySize - members.length).fill(null)];
  return { ok: true };
}

export function assignPartyMember(campaign, config, partyId, index, heroId) {
  const party = campaign.parties.find(entry => entry.id === partyId);
  if (!party || !Number.isInteger(index) || index < 0 || index >= config.partySize || (heroId !== null && !campaign.heroes.some(hero => hero.id === heroId))) return { ok: false, reason: 'mvp.error.party' };
  const previous = heroId === null ? -1 : party.members.indexOf(heroId);
  if (previous >= 0 && previous !== index) party.members[previous] = party.members[index];
  if (heroId !== null) for (const other of campaign.parties) {
    if (other !== party) other.members = other.members.map(id => id === heroId ? null : id);
  }
  party.members[index] = heroId;
  return { ok: true };
}

export function createParty(campaign, config) {
  if (campaign.parties.length >= config.maximumParties) return { ok: false, reason: 'party.limit' };
  campaign.parties.push({ id: `party-${campaign.parties.length + 1}`, members: Array(config.partySize).fill(null), funds: 0 });
  return { ok: true };
}

export function fundParty(campaign, partyId, amount) {
  const party = campaign.parties.find(entry => entry.id === partyId);
  if (!party) return { ok: false, reason: 'mvp.error.party' };
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > campaign.gold || !Number.isSafeInteger(party.funds + amount)) return { ok: false, reason: 'mvp.error.money' };
  campaign.gold -= amount;
  campaign.today.support += amount;
  party.funds += amount;
  campaign.milestones.supported = true;
  return { ok: true };
}
