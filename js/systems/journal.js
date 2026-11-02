export function addJournal(state, type, details = {}) {
  state.campaign.journal.push({ day: state.campaign.day, type, details: structuredClone(details) });
}
