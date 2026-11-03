import { random } from "./random.js";

export const growthChoices = ["balanced", "attack", "defense", "hp"];

// Randomness is consumed only for a valid, committed individual choice.
export function growHero(campaign, hero, choice) {
  if (!hero || !growthChoices.includes(choice) || !Number.isSafeInteger(hero.pendingGrowth) || hero.pendingGrowth < 1) {
    return { ok: false, reason: "growth.error" };
  }
  const gains = { hp: 1, attack: 1, defense: 1 };
  if (choice !== "balanced") {
    for (const stat of Object.keys(gains)) gains[stat] = 0;
    gains[choice] = 2;
    const others = Object.keys(gains).filter(stat => stat !== choice);
    gains[others[Math.floor(random(campaign) * others.length)]] = 1;
  }
  for (const stat of Object.keys(gains)) hero[stat] += gains[stat];
  hero.pendingGrowth -= 1;
  return { ok: true };
}
