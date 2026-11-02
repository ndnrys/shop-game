// Persisted PRNG: reloading does not reroll a pending delivery or expedition.
export function random(campaign) {
  campaign.seed = (Math.imul(campaign.seed, 1664525) + 1013904223) >>> 0;
  return campaign.seed / 4294967296;
}
