const MIN_PLAYERS = 2;
const MAX_PLAYERS = 12;
const FINISHING_TOTAL = 250;

const INVALID_STATE = 'El estado de la partida no es válido.';
const FINISHED_GAME = 'La partida ya ha terminado.';

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isCardValue(value) {
  return Number.isInteger(value) && ((value >= 1 && value <= 20) || value === 40);
}

function areCardValues(cards) {
  for (let index = 0; index < cards.length; index += 1) {
    if (!hasOwn(cards, index) || !isCardValue(cards[index])) {
      return false;
    }
  }
  return true;
}

function hasExactPlayerKeys(record, playerIds) {
  if (!isRecord(record)) {
    return false;
  }

  const keys = Object.keys(record);
  return keys.length === playerIds.length && playerIds.every((id) => hasOwn(record, id));
}

function sumCards(cards) {
  let total = 0;
  for (const value of cards) {
    total += value;
    if (!Number.isSafeInteger(total)) {
      return null;
    }
  }
  return total;
}

function totalsFor(state) {
  const totals = Object.fromEntries(state.players.map(({ id }) => [id, 0]));
  for (const round of state.rounds) {
    for (const { id } of state.players) {
      totals[id] += round.scores[id];
    }
  }
  return totals;
}

function isFinished(state) {
  const totals = totalsFor(state);
  return state.players.some(({ id }) => totals[id] >= FINISHING_TOTAL);
}

function assertValidState(state) {
  if (!validateState(state)) {
    throw new Error(INVALID_STATE);
  }
}

export function createGame(names) {
  if (!Array.isArray(names) || names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) {
    throw new Error('La partida debe tener entre 2 y 12 jugadores.');
  }

  const normalizedNames = Array.from(names, (name) => {
    if (typeof name !== 'string') {
      throw new Error('Cada jugador debe tener un nombre no vacío.');
    }
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Cada jugador debe tener un nombre no vacío.');
    }
    return trimmed;
  });

  const distinctNames = new Set(normalizedNames.map((name) => name.toLowerCase()));
  if (distinctNames.size !== normalizedNames.length) {
    throw new Error('No se permiten nombres duplicados.');
  }

  const players = normalizedNames.map((name, index) => ({ id: `player-${index + 1}`, name }));
  const draft = Object.fromEntries(players.map(({ id }) => [id, []]));

  return { players, rounds: [], draft };
}

export function addCard(state, playerId, value) {
  assertValidState(state);
  if (!isCardValue(value)) {
    throw new Error('La carta debe valer un entero del 1 al 20 o 40.');
  }
  if (!hasOwn(state.draft, playerId)) {
    throw new Error('El jugador indicado no existe.');
  }
  if (isFinished(state)) {
    throw new Error(FINISHED_GAME);
  }
  if (state.players.some(({ id }) => state.draft[id].includes(value))) {
    throw new Error('Esta carta ya está asignada en esta ronda.');
  }

  state.draft[playerId].push(value);
  if (state.players.reduce((count, { id }) => count + state.draft[id].length, 0) === 21) {
    finishRound(state);
  }
  return state;
}

export function removeCard(state, playerId, index) {
  assertValidState(state);
  if (!hasOwn(state.draft, playerId)) {
    throw new Error('El jugador indicado no existe.');
  }
  if (isFinished(state)) {
    throw new Error(FINISHED_GAME);
  }

  const cards = state.draft[playerId];
  if (!Number.isInteger(index) || index < 0 || index >= cards.length) {
    throw new Error('El índice de carta no es válido.');
  }

  cards.splice(index, 1);
  return state;
}

export function finishRound(state) {
  assertValidState(state);
  if (isFinished(state)) {
    throw new Error(FINISHED_GAME);
  }

  const cards = Object.fromEntries(state.players.map(({ id }) => [id, [...state.draft[id]]]));
  const scores = Object.fromEntries(state.players.map(({ id }) => [id, sumCards(cards[id])]));
  state.rounds.push({ scores, cards });
  state.draft = Object.fromEntries(state.players.map(({ id }) => [id, []]));
  return state;
}

export function undoRound(state) {
  assertValidState(state);
  if (state.players.some(({ id }) => state.draft[id].length > 0)) {
    throw new Error('No se puede deshacer una ronda mientras haya cartas en curso.');
  }
  if (state.rounds.length === 0) {
    throw new Error('No hay rondas para deshacer.');
  }

  const round = state.rounds.pop();
  state.draft = Object.fromEntries(state.players.map(({ id }) => [id, [...round.cards[id]]]));
  return state;
}

export function getTotals(state) {
  assertValidState(state);
  return totalsFor(state);
}

export function getLosers(state) {
  assertValidState(state);
  const totals = totalsFor(state);
  let highest = -1;
  for (const { id } of state.players) {
    if (totals[id] > highest) {
      highest = totals[id];
    }
  }
  if (highest < FINISHING_TOTAL) {
    return [];
  }

  return state.players.filter(({ id }) => totals[id] === highest).map(({ id }) => id);
}

export function validateState(state) {
  try {
    if (!isRecord(state) || !Array.isArray(state.players) || !Array.isArray(state.rounds)) {
      return false;
    }
    if (state.players.length < MIN_PLAYERS || state.players.length > MAX_PLAYERS) {
      return false;
    }

    const playerIds = [];
    const playerIdSet = new Set();
    const playerNames = new Set();
    for (const player of state.players) {
      if (!isRecord(player) || typeof player.id !== 'string' || !player.id || player.id.trim() !== player.id) {
        return false;
      }
      if (typeof player.name !== 'string' || !player.name || player.name.trim() !== player.name) {
        return false;
      }
      const normalizedName = player.name.toLowerCase();
      if (playerIdSet.has(player.id) || playerNames.has(normalizedName)) {
        return false;
      }
      playerIds.push(player.id);
      playerIdSet.add(player.id);
      playerNames.add(normalizedName);
    }

    if (!hasExactPlayerKeys(state.draft, playerIds)) {
      return false;
    }
    const draftValues = new Set();
    for (const id of playerIds) {
      const cards = state.draft[id];
      if (!Array.isArray(cards) || !areCardValues(cards)) {
        return false;
      }
      for (const value of cards) {
        if (draftValues.has(value)) return false;
        draftValues.add(value);
      }
    }

    const totals = Object.fromEntries(playerIds.map((id) => [id, 0]));
    for (let roundIndex = 0; roundIndex < state.rounds.length; roundIndex += 1) {
      const round = state.rounds[roundIndex];
      if (!isRecord(round) || !hasExactPlayerKeys(round.scores, playerIds) || !hasExactPlayerKeys(round.cards, playerIds)) {
        return false;
      }
      const roundValues = new Set();

      for (const id of playerIds) {
        const cards = round.cards[id];
        const score = round.scores[id];
        if (!Array.isArray(cards) || !areCardValues(cards) || !Number.isSafeInteger(score) || score < 0) {
          return false;
        }
        for (const value of cards) {
          if (roundValues.has(value)) return false;
          roundValues.add(value);
        }
        const cardTotal = sumCards(cards);
        if (cardTotal === null || score !== cardTotal) {
          return false;
        }
        totals[id] += score;
        if (!Number.isSafeInteger(totals[id])) {
          return false;
        }
      }

      if (roundIndex < state.rounds.length - 1 && playerIds.some((id) => totals[id] >= FINISHING_TOTAL)) {
        return false;
      }
    }

    const finished = playerIds.some((id) => totals[id] >= FINISHING_TOTAL);
    if (finished && playerIds.some((id) => state.draft[id].length > 0)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
