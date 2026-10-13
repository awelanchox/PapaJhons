import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, addCard, finishRound, undoRound } from './game.js';
import { standings, roundStandings, saveRecord } from './history.js';

test('clasifica menos y más puntos incluyendo empates y rondas a cero', () => {
  const players = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(standings(players, { a: 0, b: 40, c: 0 }), { winners: ['a', 'c'], losers: ['b'] });
  assert.deepEqual(standings(players, { a: 0, b: 0, c: 0 }), { winners: ['a', 'b', 'c'], losers: ['a', 'b', 'c'] });
});

test('distingue ganadores de la ronda y líderes por acumulado', () => {
  const game = createGame(['Ana', 'Luis']);
  const [ana, luis] = game.players;
  addCard(game, ana.id, 40);
  addCard(game, luis.id, 1);
  finishRound(game);
  addCard(game, luis.id, 20);
  finishRound(game);
  assert.deepEqual(roundStandings(game), [
    { round: { winners: [luis.id], losers: [ana.id] }, cumulative: { winners: [luis.id], losers: [ana.id] } },
    { round: { winners: [ana.id], losers: [luis.id] }, cumulative: { winners: [luis.id], losers: [ana.id] } },
  ]);
});

test('corregir una partida actualiza su registro sin duplicarla ni borrar partidas anteriores', () => {
  const first = createGame(['Ana', 'Luis']);
  addCard(first, first.players[0].id, 40);
  finishRound(first);
  let records = saveRecord([], first, 'first', '2026-10-13T10:00:00Z', 'interrupted');
  const second = createGame(['Ana', 'Eva']);
  addCard(second, second.players[1].id, 20);
  finishRound(second);
  records = saveRecord(records, second, 'second', '2026-10-13T11:00:00Z', 'playing');
  assert.deepEqual(records.map(({ id }) => id), ['first', 'second']);
  addCard(second, second.players[0].id, 40);
  finishRound(second);
  records = saveRecord(records, second, 'second', '2026-10-13T11:00:00Z', 'playing');
  assert.equal(records[1].game.rounds.length, 2);
  undoRound(second);
  records = saveRecord(records, second, 'second', '2026-10-13T11:00:00Z', 'playing');
  assert.equal(records[1].game.rounds.length, 1);
  assert.equal(records[0].status, 'interrupted');
  assert.equal(records[0].game.players[1].name, 'Luis');
  assert.equal(records[0].game.rounds[0].scores[first.players[0].id], 40);
  records = saveRecord(records, createGame(['Ana', 'Eva']), 'second', '2026-10-13T11:00:00Z', 'playing');
  assert.deepEqual(records.map(({ id }) => id), ['first']);
});
