export function currentChapter(campaign, config) {
  return config.chapters.find(chapter => chapter.id === campaign.chapterId);
}
export function chapterOverview(campaign, config) {
  const chapter = currentChapter(campaign, config);
  const dungeon = config.dungeons.find(entry => entry.id === chapter.enemy.dungeonId);
  const progress = dungeon ? campaign.dungeonProgress[dungeon.id] : 0;
  return { chapter, progress, required: dungeon?.requiredProgress ?? 0,
    percent: dungeon ? Math.floor(100 * progress / dungeon.requiredProgress) : 0,
    cleared: !!dungeon && progress >= dungeon.requiredProgress,
    releaseEnd: config.releaseProfiles[config.activeRelease].at(-1) === chapter.id };
}
