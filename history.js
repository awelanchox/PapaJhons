export function standings(players, scores) {
  const values = players.map(({ id }) => scores[id]);
  const low = Math.min(...values);
  const high = Math.max(...values);
  return {
    winners: players.filter(({ id }) => scores[id] === low).map(({ id }) => id),
    losers: players.filter(({ id }) => scores[id] === high).map(({ id }) => id),
  };
}

export function roundStandings(game) {
  const totals = Object.fromEntries(game.players.map(({ id }) => [id, 0]));
  return game.rounds.map((round) => {
    for (const { id } of game.players) totals[id] += round.scores[id];
    return { round: standings(game.players, round.scores), cumulative: standings(game.players, totals) };
  });
}

export function saveRecord(records, game, id, startedAt, status) {
  const remaining = records.filter((record) => record.id !== id);
  if (!game.rounds.length) return remaining;
  return [...remaining, { id, startedAt, status, game: structuredClone(game) }];
}
