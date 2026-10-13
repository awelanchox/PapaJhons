import { createGame, addCard, removeCard, finishRound, undoRound, getTotals, getLosers, validateState } from './game.js';

const $ = (id) => document.getElementById(id);
const storageKey = 'papayou.game.v1';
let names = [];
let state = null;
let selectedId = null;
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const sum = (cards) => cards.reduce((total, value) => total + value, 0);

function notice(message) {
  $('notice').textContent = message;
  $('notice').classList.toggle('hidden', !message);
}
function persist() {
  try {
    if (state) localStorage.setItem(storageKey, JSON.stringify(state));
    else localStorage.removeItem(storageKey);
  } catch {
    notice('No se ha podido guardar la partida. Puedes seguir jugando, pero se perderá al cerrar esta página.');
  }
}
function change(action) {
  try {
    notice('');
    action();
    persist();
    render();
  } catch (error) {
    notice(error.message);
  }
}
function renderSetup() {
  $('players-list').innerHTML = names.length ? names.map((name, index) => `<span class="player-chip">${escape(name)}<button class="button ghost" data-remove-player="${index}" aria-label="Quitar a ${escape(name)}">×</button></span>`).join('') : '<p class="empty-state">Todavía no hay jugadores. ¿Quién se apunta?</p>';
  $('start').disabled = names.length < 2;
  $('player-name').disabled = names.length >= 12;
  $('player-form').querySelector('button').disabled = names.length >= 12;
}
function render() {
  $('setup').classList.toggle('hidden', Boolean(state));
  $('game').classList.toggle('hidden', !state);
  if (!state) { renderSetup(); return; }
  if (!state.players.some((player) => player.id === selectedId)) selectedId = state.players[0].id;
  const totals = getTotals(state);
  const losers = getLosers(state);
  const ended = losers.length > 0;
  const player = state.players.find((item) => item.id === selectedId);
  const cards = state.draft[selectedId];
  for (const button of $('card-grid').querySelectorAll('[data-card]')) {
    const value = Number(button.dataset.card);
    const owner = state.players.find((item) => state.draft[item.id].includes(value));
    button.disabled = ended || Boolean(owner);
    button.title = owner ? `Asignada a ${owner.name}` : `Añadir ${value} puntos a ${player.name}`;
    const cardName = value === 40 ? 'Papa Johns (40 puntos)' : `Carta ${value}`;
    button.setAttribute('aria-label', owner ? `${cardName}, asignada a ${owner.name}` : `Añadir ${cardName} a ${player.name}`);
  }
  $('round-title').textContent = ended ? 'Partida terminada' : `Ronda ${state.rounds.length + 1}`;
  $('result').classList.toggle('hidden', !ended);
  $('result').textContent = ended ? `${losers.length > 1 ? 'Empate: pierden' : 'Pierde'} ${state.players.filter((item) => losers.includes(item.id)).map((item) => item.name).join(' y ')} con ${Math.max(...Object.values(totals))} puntos de penalización. Se ha alcanzado el límite de 250.` : '';
  $('scoreboard').innerHTML = state.players.map((item, index) => `<div class="score-row"><span class="avatar" aria-hidden="true">${index + 1}</span><div class="score-details"><div class="score-name">${escape(item.name)}${losers.includes(item.id) ? ' · Pierde' : ''}</div><div class="progress-track" role="progressbar" aria-label="Penalizaciones de ${escape(item.name)}" aria-valuemin="0" aria-valuemax="250" aria-valuenow="${Math.min(totals[item.id], 250)}" aria-valuetext="${totals[item.id]} de 250 puntos"><div class="progress-fill" style="width:${Math.min(totals[item.id] / 250 * 100, 100)}%"></div></div><div class="score-meta">${ended ? 'Total final' : `En esta ronda: +${sum(state.draft[item.id])}`}</div></div><span class="score">${totals[item.id]}<small> / 250</small></span></div>`).join('');
  $('round-editor').classList.toggle('hidden', ended);
  $('player-tabs').innerHTML = state.players.map((item) => `<button class="player-tab ${item.id === selectedId ? 'active' : ''}" data-player="${escape(item.id)}" aria-pressed="${item.id === selectedId}">${escape(item.name)}</button>`).join('');
  $('draft-total').textContent = `+${sum(cards)} puntos`;
  $('selected-label').textContent = `CARTAS DE ${player.name.toLocaleUpperCase('es')}`;
  $('selected-cards').innerHTML = cards.length ? cards.map((value, index) => `<button class="selected-card ${value === 40 ? 'special' : ''}" data-remove-card="${index}" aria-label="Quitar ${value === 40 ? 'Papa Johns (40 puntos)' : `carta ${value}`} de ${escape(player.name)}">${value === 40 ? 'Papa Johns · 40' : value}<span aria-hidden="true"> ×</span></button>`).join('') : '<p class="empty-state">Sin cartas. Esta ronda suma 0 puntos.</p>';
  $('round-summary').innerHTML = state.players.map((item) => `<div><span>${escape(item.name)}</span><strong>+${sum(state.draft[item.id])}</strong></div>`).join('');
  $('finish-round').textContent = `Cerrar ronda ${state.rounds.length + 1}`;
  $('undo-round').disabled = state.rounds.length === 0 || Object.values(state.draft).some((values) => values.length > 0);
  $('undo-round').title = Object.values(state.draft).some((values) => values.length > 0) ? 'Quita las cartas de la ronda actual antes de recuperar la anterior.' : 'Recupera las cartas de la última ronda para corregirlas.';
  $('history').innerHTML = state.rounds.length ? `<div class="history-scroll"><table class="history-table"><thead><tr><th scope="col">Ronda</th>${state.players.map((item) => `<th scope="col">${escape(item.name)}</th>`).join('')}</tr></thead><tbody>${state.rounds.map((round, index) => `<tr><th scope="row">${index + 1}</th>${state.players.map((item) => `<td>+${round.scores[item.id]}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr><th scope="row">Total</th>${state.players.map((item) => `<td>${totals[item.id]}</td>`).join('')}</tr></tfoot></table></div>` : '<p class="empty-state">El historial aparecerá al cerrar la primera ronda.</p>';
}

$('card-grid').innerHTML = [...Array.from({ length: 20 }, (_, index) => index + 1), 40].map((value) => `<button class="card-button ${value === 40 ? 'special' : ''}" data-card="${value}" aria-label="Añadir ${value === 40 ? 'Papa Johns (40 puntos)' : `carta de ${value} puntos`}">${value}<small>${value === 40 ? 'Papa Johns' : `+${value}`}</small></button>`).join('');
$('player-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('player-name').value.trim();
  if (!name) { notice('Escribe un nombre para el jugador.'); return; }
  if (names.some((item) => item.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) { notice('Ese jugador ya está en la mesa. Usa un nombre distinto.'); return; }
  if (names.length >= 12) return;
  names.push(name);
  $('player-name').value = '';
  notice('');
  renderSetup();
  $('player-name').focus();
});
$('players-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-player]');
  if (button) { names.splice(Number(button.dataset.removePlayer), 1); renderSetup(); }
});
$('start').addEventListener('click', () => change(() => { state = createGame(names); selectedId = state.players[0].id; }));
$('player-tabs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-player]');
  if (button) { selectedId = button.dataset.player; render(); }
});
$('card-grid').addEventListener('click', (event) => {
  const button = event.target.closest('[data-card]');
  if (button) change(() => {
    const roundNumber = state.rounds.length + 1;
    addCard(state, selectedId, Number(button.dataset.card));
    if (state.rounds.length === roundNumber) {
      notice(`Ronda ${roundNumber} cerrada: todas las cartas están repartidas. Los jugadores sin cartas suman 0 puntos.`);
    }
  });
});
$('selected-cards').addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-card]');
  if (button) change(() => removeCard(state, selectedId, Number(button.dataset.removeCard)));
});
$('finish-round').addEventListener('click', () => change(() => finishRound(state)));
$('undo-round').addEventListener('click', () => change(() => undoRound(state)));
$('new-game').addEventListener('click', () => $('confirm-dialog').showModal());
$('confirm-dialog').addEventListener('close', () => {
  if ($('confirm-dialog').returnValue === 'confirm') change(() => { names = state.players.map((player) => player.name); state = null; selectedId = null; });
});
try {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (validateState(parsed)) state = parsed;
    else notice('La partida guardada no es válida. Crea una nueva partida.');
  }
} catch {
  notice('No se ha podido leer la partida guardada. Puedes crear una nueva.');
}
render();
