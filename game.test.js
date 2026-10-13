import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, addCard, removeCard, finishRound, undoRound, getTotals, getLosers, validateState } from './game.js';

const allCards = [...Array.from({ length: 20 }, (_, index) => index + 1), 40];
const copy = (state) => JSON.parse(JSON.stringify(state));
function give(state, id, cards) {
  for (const value of cards) addCard(state, id, value);
}
function score240(state, id) {
  give(state, id, allCards.filter((value) => value !== 10));
  finishRound(state);
}

test('los nombres se normalizan y los límites de jugadores se respetan', () => {
  const state = createGame([' Ana ', 'Luis']);
  assert.equal(state.players[0].name, 'Ana');
  assert.equal(validateState(state), true);
  assert.equal(createGame(Array.from({ length: 12 }, (_, i) => `Jugador ${i}`)).players.length, 12);
  for (const names of [['Solo'], ['Ana', ' '], ['Ana', ' aNA '], ['Ana', 2], Array.from({ length: 13 }, (_, i) => `J${i}`)]) {
    assert.throws(() => createGame(names), Error);
  }
});

test('una carta solo puede asignarse una vez entre todos los jugadores', () => {
  const state = createGame(['Ana', 'Luis']);
  const [ana, luis] = state.players;
  give(state, ana.id, [1, 20, 40]);
  for (const value of [1, 20, 40]) {
    const before = copy(state);
    assert.throws(() => addCard(state, ana.id, value), Error);
    assert.throws(() => addCard(state, luis.id, value), Error);
    assert.deepEqual(state, before);
  }
  for (const value of [0, 21, 39, 41, 1.5, NaN, '1']) {
    assert.throws(() => addCard(state, ana.id, value), Error);
  }
  assert.throws(() => addCard(state, 'desconocido', 2), Error);
});

test('quitar una carta permite asignarla a otro jugador sin cambiar las demás', () => {
  const state = createGame(['Ana', 'Luis']);
  const [ana, luis] = state.players;
  give(state, ana.id, [1, 20, 40]);
  removeCard(state, ana.id, 1);
  addCard(state, luis.id, 20);
  assert.deepEqual(state.draft, { [ana.id]: [1, 40], [luis.id]: [20] });
  for (const index of [-1, 2, 0.5, '0']) assert.throws(() => removeCard(state, ana.id, index), Error);
});

test('repartir todas las cartas cierra la ronda y registra cero para quien no tiene cartas', () => {
  const state = createGame(['Ana', 'Luis', 'Eva']);
  const [ana, luis, eva] = state.players;
  give(state, ana.id, allCards.slice(0, 10));
  give(state, luis.id, allCards.slice(10, -1));
  assert.equal(state.rounds.length, 0);
  addCard(state, luis.id, 40);
  assert.equal(state.rounds.length, 1);
  assert.deepEqual(getTotals(state), { [ana.id]: 55, [luis.id]: 195, [eva.id]: 0 });
  assert.deepEqual(state.rounds[0].cards[eva.id], []);
  assert.deepEqual(state.draft, { [ana.id]: [], [luis.id]: [], [eva.id]: [] });
  addCard(state, eva.id, 40);
  assert.deepEqual(state.draft[eva.id], [40]);
});

test('el cierre manual suma solo las cartas asignadas y admite rondas sin puntos', () => {
  const state = createGame(['Ana', 'Luis']);
  const [ana, luis] = state.players;
  finishRound(state);
  assert.deepEqual(getTotals(state), { [ana.id]: 0, [luis.id]: 0 });
  give(state, ana.id, [20, 40]);
  finishRound(state);
  addCard(state, luis.id, 20);
  assert.deepEqual(getTotals(state), { [ana.id]: 60, [luis.id]: 0 });
  assert.deepEqual(state.rounds[1].cards[ana.id], [20, 40]);
});

test('deshacer recupera las cartas y mantiene su exclusividad', () => {
  const state = createGame(['Ana', 'Luis']);
  const [ana, luis] = state.players;
  give(state, ana.id, allCards.slice(0, 10));
  give(state, luis.id, allCards.slice(10));
  undoRound(state);
  assert.equal(state.rounds.length, 0);
  assert.deepEqual(state.draft[ana.id], allCards.slice(0, 10));
  assert.throws(() => addCard(state, luis.id, 1), Error);
  assert.throws(() => undoRound(state), Error);
  finishRound(state);
  addCard(state, ana.id, 1);
  const before = copy(state);
  assert.throws(() => undoRound(state), Error);
  assert.deepEqual(state, before);
});

test('llegar exactamente a 250 termina la partida y deshacer permite corregirla', () => {
  const state = createGame(['Ana', 'Luis']);
  const [ana, luis] = state.players;
  score240(state, ana.id);
  assert.deepEqual(getLosers(state), []);
  addCard(state, ana.id, 10);
  finishRound(state);
  assert.deepEqual(getTotals(state), { [ana.id]: 250, [luis.id]: 0 });
  assert.deepEqual(getLosers(state), [ana.id]);
  assert.throws(() => addCard(state, luis.id, 1), Error);
  assert.throws(() => finishRound(state), Error);
  undoRound(state);
  assert.deepEqual(getLosers(state), []);
  assert.deepEqual(state.draft[ana.id], [10]);
});

test('el reparto completo puede finalizar automáticamente la partida', () => {
  const state = createGame(['Ana', 'Luis']);
  const [ana, luis] = state.players;
  give(state, ana.id, allCards);
  assert.deepEqual(getTotals(state), { [ana.id]: 250, [luis.id]: 0 });
  assert.deepEqual(getLosers(state), [ana.id]);
  assert.equal(validateState(state), true);
});

test('pierde el total mayor y se reconocen los empates', () => {
  const state = createGame(['Ana', 'Luis']);
  const [ana, luis] = state.players;
  score240(state, ana.id);
  score240(state, luis.id);
  addCard(state, ana.id, 10);
  addCard(state, luis.id, 20);
  finishRound(state);
  assert.deepEqual(getLosers(state), [luis.id]);
  undoRound(state);
  removeCard(state, luis.id, 0);
  give(state, luis.id, [1, 9]);
  finishRound(state);
  assert.deepEqual(getTotals(state), { [ana.id]: 250, [luis.id]: 250 });
  assert.deepEqual(getLosers(state), [ana.id, luis.id]);
});

test('validación de guardado rechaza cartas duplicadas, puntuaciones falsas y rondas posteriores al final', () => {
  const state = createGame(['Ana', 'Luis']);
  const [ana, luis] = state.players;
  addCard(state, ana.id, 20);
  assert.equal(validateState(copy(state)), true);
  const draftDuplicate = copy(state);
  draftDuplicate.draft[luis.id].push(20);
  assert.equal(validateState(draftDuplicate), false);
  finishRound(state);
  const roundDuplicate = copy(state);
  roundDuplicate.rounds[0].cards[luis.id] = [20];
  roundDuplicate.rounds[0].scores[luis.id] = 20;
  assert.equal(validateState(roundDuplicate), false);
  const wrongScore = copy(state);
  wrongScore.rounds[0].scores[ana.id] = 19;
  assert.equal(validateState(wrongScore), false);
  const invalidCard = copy(state);
  invalidCard.draft[luis.id] = [21];
  assert.equal(validateState(invalidCard), false);
  assert.equal(validateState(null), false);
  assert.equal(validateState([]), false);
  const final = createGame(['Ana', 'Luis']);
  give(final, final.players[0].id, allCards);
  const later = copy(final);
  later.rounds.push({ cards: { [ana.id]: [], [luis.id]: [] }, scores: { [ana.id]: 0, [luis.id]: 0 } });
  assert.equal(validateState(later), false);
  final.draft[luis.id].push(1);
  assert.equal(validateState(final), false);
});
