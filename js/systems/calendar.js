export function calendarDate(day, daysPerSeason = 5) {
  const elapsed = day - 1;
  return { year: Math.floor(elapsed / (daysPerSeason * 4)) + 1, season: Math.floor(elapsed / daysPerSeason) % 4, day: elapsed % daysPerSeason + 1 };
}
