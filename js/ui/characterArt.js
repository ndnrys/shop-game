// Pose selection is presentation only; it does not modify character state.
export function characterArt(artwork, id, campaign) {
  if (!artwork?.poses) return artwork;
  const hero = campaign.heroes.find(entry => entry.id === id);
  const pose = hero?.health === 'dead' ? 'dead'
    : hero?.recoverUntil > campaign.day ? 'resting'
    : campaign.expedition?.heroIds.includes(id) ? 'battle' : 'normal';
  return artwork.poses[pose] ?? artwork;
}
