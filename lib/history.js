// lib/history.js
// History is stored newest-first: history[0] is the current state,
// history[N] is N turns back. The implicit reverse-chronological order
// has tripped people up — these helpers make it explicit.

export function pushHistory(history, entry) {
  return [entry, ...history];
}

// Drops the current entry and returns { previous, rest }. previous is the
// new "current" state to apply; rest is the remaining history (with the
// new current still at [0]).
export function popHistory(history) {
  if (history.length < 2) return { previous: null, rest: [] };
  const [, ...rest] = history;
  return { previous: rest[0], rest };
}
