// Game controller: rules (chess.js), UI, computer and online play.
import { Board3D } from './board3d.js';
import { VENUES } from './venues.js';
import { Engine, LEVELS } from './engine.js';
import { Net } from './net.js';
import { Sound } from './sound.js';

const Chess = window.Chess;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem('lmchess.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('lmchess.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const GLYPH = { w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }, b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' } };
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const other = (c) => (c === 'w' ? 'b' : 'w');
const cname = (c) => (c === 'w' ? 'White' : 'Black');

const board = new Board3D($('#stage'));
board.getInsets = () => {
  const p = $('#panel');
  if (p.classList.contains('hidden')) return {};
  return innerWidth > 860 ? { right: p.offsetWidth + 14 } : { bottom: p.offsetHeight + 8 };
};
addEventListener('resize', () => board.refit());
const engine = new Engine();
const sound = new Sound();
const S = {
  mode: null, myColor: 'w', level: store.get('level', 4) - 1, colorPref: store.get('colorPref', 'w'),
  game: new Chess(), selected: null, targets: [], busy: false, over: false, id: 0,
  names: { w: 'White', b: 'Black' }, venue: store.get('venue', 'oval'), autoFlip: true,
  wantRematch: false, theyWantRematch: false, hostColor: 'w',
};

// ---------- toast ----------
let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// ---------- venues ----------
function renderVenueUI() {
  $('#venuePills').innerHTML = Object.entries(VENUES).map(([k, v]) => `<button data-v="${k}" class="${k === S.venue ? 'active' : ''}">${v.icon} <span class="vn">${v.name}</span><span class="vs">${v.short}</span></button>`).join('');
  $('#venueCards').innerHTML = Object.entries(VENUES).map(([k, v]) => `<button class="venue ${k === S.venue ? 'active' : ''}" data-v="${k}"><div class="art" style="background:${v.card}">${v.icon}</div><div class="txt"><b>${v.name}</b><small>${v.blurb}</small></div></button>`).join('');
  $$('[data-v]').forEach((b) => b.addEventListener('click', () => setVenue(b.dataset.v)));
}

function setVenue(key, first = false) {
  if (!VENUES[key] || (key === S.venue && !first)) return;
  S.venue = key; store.set('venue', key);
  renderVenueUI();
  const L = $('#loading'); L.classList.remove('gone');
  setTimeout(() => {
    try { board.setVenue(key); } catch (e) { console.error(e); toast('Could not build that venue: ' + e.message); }
    if (first) board.setPosition(S.game.board());
    L.classList.add('gone');
    if (sound.ctx) sound.ambience(key);
  }, 30);
}

// ---------- game helpers ----------
const myTurn = () => !S.over && !S.busy && (S.mode === 'local' || S.game.turn() === S.myColor);

function captured() {
  const cap = { w: [], b: [] };
  for (const m of S.game.history({ verbose: true })) if (m.captured) cap[other(m.color)].push(m.captured);
  return cap;
}

function kingSquare(color) {
  const b = S.game.board();
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { const p = b[r][f]; if (p && p.type === 'k' && p.color === color) return 'abcdefgh'[f] + (8 - r); }
  return null;
}

function syncBoard() {
  board.setPosition(S.game.board(), captured());
  const h = S.game.history({ verbose: true }), last = h[h.length - 1];
  board.setLastMove(last?.from, last?.to);
  board.setCheck(S.game.in_check() ? kingSquare(S.game.turn()) : null);
  board.setHint(null, null);
}

function startGame(mode, { myColor = 'w', names, pgn } = {}) {
  S.id++;
  engine.stop();
  S.mode = mode; S.myColor = myColor; S.over = false; S.busy = false; S.selected = null; S.targets = [];
  S.wantRematch = S.theyWantRematch = false;
  S.game = new Chess();
  if (pgn) S.game.load_pgn(pgn);
  S.names = names || { w: 'White', b: 'Black' };
  syncBoard();
  board.select(null);
  $('#menu').classList.add('hidden'); $('#result').classList.add('hidden');
  $('#panel').classList.remove('hidden');
  board._resize();
  board.setView(mode === 'local' ? (S.autoFlip ? S.game.turn() : 'w') : myColor);
  $('#chat').classList.toggle('hidden', mode !== 'online');
  $('#btnUndo').disabled = mode === 'online';
  $('#btnHint').disabled = mode === 'online';
  sound.ambience(S.venue);
  updateUI();
  maybeComputer();
}

function updateUI() {
  const g = S.game, turn = g.turn(), bottom = board.viewColor || 'w', top = other(bottom), cap = captured();
  const mat = (c) => cap[other(c)].reduce((s, t) => s + VAL[t], 0);
  for (const [el, c] of [[$('#pTop'), top], [$('#pBottom'), bottom]]) {
    el.querySelector('.dot').className = 'dot ' + c;
    el.querySelector('.pname').textContent = S.names[c];
    const diff = mat(c) - mat(other(c));
    el.querySelector('.caps').innerHTML = cap[other(c)].sort((a, b) => VAL[b] - VAL[a]).map((t) => GLYPH[other(c)][t]).join('') + (diff > 0 ? `<em>+${diff}</em>` : '');
    el.classList.toggle('turn', !S.over && c === turn);
  }
  let st;
  if (S.over) st = S.overText;
  else if (S.busy && S.mode === 'cpu' && turn !== S.myColor) st = 'Computer is thinking…';
  else if (S.mode === 'online' && !net.connected) st = 'Opponent disconnected';
  else if (S.mode === 'local') st = `${cname(turn)} to move`;
  else st = turn === S.myColor ? 'Your move' : `${S.names[turn]}’s move`;
  if (!S.over && g.in_check()) st += ' — Check!';
  $('#status').textContent = st;
  const h = g.history();
  $('#moves').innerHTML = Array.from({ length: Math.ceil(h.length / 2) }, (_, i) => `<li><span class="${i * 2 === h.length - 1 ? 'last' : ''}">${h[i * 2]}</span><span class="${i * 2 + 1 === h.length - 1 ? 'last' : ''}">${h[i * 2 + 1] || ''}</span></li>`).join('');
  $('#moves').scrollTop = 1e6;
  $('#btnDraw').disabled = $('#btnResign').disabled = S.over;
}

// ---------- input ----------
board.hoverFilter = (sq) => {
  if (!myTurn()) return false;
  const p = S.game.get(sq);
  return (p && p.color === S.game.turn()) || S.targets.some((t) => t.to === sq);
};

board.isTarget = (sq) => S.targets.some((t) => t.to === sq);

board.onSquare = async (sq) => {
  if (S.over || S.busy || !S.mode) return;
  if (!myTurn()) { toast(S.mode === 'online' ? 'Waiting for your opponent…' : 'Not your turn'); return; }
  const hit = S.targets.filter((t) => t.to === sq);
  if (S.selected && hit.length) {
    let promotion;
    if (hit[0].flags.includes('p')) { promotion = await askPromotion(); if (!promotion) return; }
    clearSelection();
    await playMove({ from: hit[0].from, to: sq, promotion });
    return;
  }
  const p = S.game.get(sq);
  if (p && p.color === S.game.turn()) {
    if (S.selected === sq) { clearSelection(); return; }
    S.selected = sq;
    S.targets = S.game.moves({ square: sq, verbose: true });
    board.select(sq, S.targets.map((m) => ({ sq: m.to, capture: !!m.captured })));
    sound.select();
  } else clearSelection();
};

function clearSelection() { S.selected = null; S.targets = []; board.select(null); }

function askPromotion() {
  return new Promise((resolve) => {
    const box = $('#promo'); box.classList.remove('hidden');
    const c = S.game.turn();
    box.querySelectorAll('button').forEach((b) => { b.textContent = GLYPH[c][b.dataset.p]; b.onclick = () => { box.classList.add('hidden'); resolve(b.dataset.p); }; });
    box.onclick = (e) => { if (e.target === box) { box.classList.add('hidden'); resolve(null); } };
  });
}

// ---------- moves ----------
async function playMove(input, remote = false) {
  const id = S.id;
  const mv = S.game.move(input);
  if (!mv) return false;
  if (S.mode === 'online' && !remote) net.send({ t: 'move', from: mv.from, to: mv.to, promotion: mv.promotion, ply: S.game.history().length });
  S.busy = true;
  board.setHint(null, null);
  updateUI();
  // a hidden/throttled tab may not run animation frames: never let that stall the game
  if (document.hidden) syncBoard();
  else {
    let done = false;
    await Promise.race([board.animateMove(mv).then(() => { done = true; }), new Promise((r) => setTimeout(r, 2500))]);
    if (!done) syncBoard();
  }
  if (id !== S.id) return true;
  mv.captured ? sound.capture() : sound.move();
  board.setLastMove(mv.from, mv.to);
  board.setCheck(S.game.in_check() ? kingSquare(S.game.turn()) : null);
  if (S.game.in_check() && !S.game.in_checkmate()) sound.check();
  S.busy = false;
  if (!checkGameOver()) {
    if (S.mode === 'local' && S.autoFlip) { board.setView(S.game.turn()); }
    updateUI();
    maybeComputer();
  }
  return true;
}

async function maybeComputer() {
  if (S.mode !== 'cpu' || S.over || S.game.turn() === S.myColor) return;
  const id = S.id;
  S.busy = true; updateUI();
  const mv = await engine.bestMove(S.game.fen(), S.level, Chess);
  if (id !== S.id) return;
  S.busy = false;
  if (mv) await playMove(mv);
}

function checkGameOver() {
  const g = S.game;
  let title = null, text = '', winner = null;
  if (g.in_checkmate()) {
    winner = other(g.turn()); title = 'Checkmate!';
    text = S.mode === 'local' ? `${cname(winner)} wins.` : winner === S.myColor ? `You checkmated ${S.names[other(S.myColor)]}!` : `${S.names[winner]} checkmated you. Try again?`;
  }
  else if (g.in_stalemate()) { title = 'Stalemate'; text = 'No legal moves — it’s a draw.'; }
  else if (g.in_threefold_repetition()) { title = 'Draw'; text = 'Threefold repetition.'; }
  else if (g.insufficient_material()) { title = 'Draw'; text = 'Not enough pieces left to checkmate.'; }
  else if (g.in_draw()) { title = 'Draw'; text = '50-move rule.'; }
  if (!title) return false;
  endGame(title, text, winner);
  return true;
}

function endGame(title, text, winner) {
  S.over = true; S.busy = false; S.overText = title + (winner ? ` ${cname(winner)} wins` : '');
  clearSelection(); updateUI();
  const mine = S.mode !== 'local';
  const outcome = !winner ? 'draw' : mine ? (winner === S.myColor ? 'win' : 'lose') : 'win';
  $('#resIcon').textContent = outcome === 'win' ? '🏆' : outcome === 'lose' ? '🎖️' : '🤝';
  $('#resTitle').textContent = mine && outcome === 'win' ? 'You win!' : mine && outcome === 'lose' ? title : title;
  $('#resText').textContent = text;
  outcome === 'lose' ? sound.lose() : sound.win();
  setTimeout(() => $('#result').classList.remove('hidden'), 900);
}

// ---------- panel buttons ----------
$('#btnUndo').onclick = () => {
  if (S.busy || !S.mode || S.mode === 'online') return;
  if (S.mode === 'cpu') {
    if (!S.game.history().length) return;
    S.game.undo();
    if (S.game.turn() !== S.myColor && S.game.history().length) S.game.undo();
    if (S.game.turn() !== S.myColor) { S.over = false; syncBoard(); updateUI(); maybeComputer(); return; }
  } else S.game.undo();
  S.over = false; $('#result').classList.add('hidden');
  clearSelection(); syncBoard(); updateUI();
};
$('#btnHint').onclick = async () => {
  if (!myTurn() || S.mode === 'online') return;
  const id = S.id; $('#status').textContent = 'Thinking of a good move…';
  const mv = await engine.bestMove(S.game.fen(), 6, Chess);
  if (id !== S.id || !mv) return;
  board.setHint(mv.from, mv.to); updateUI();
  toast(`Try ${mv.from} → ${mv.to}`);
};
$('#btnFlip').onclick = () => { board.setView(other(board.viewColor || 'w')); setTimeout(updateUI, 50); };
$('#btnResign').onclick = () => {
  if (S.over || !S.mode) return;
  if (!confirm('Resign this game?')) return;
  const loser = S.mode === 'local' ? S.game.turn() : S.myColor;
  if (S.mode === 'online') net.send({ t: 'resign' });
  endGame('Resigned', `${S.names[loser]} resigned. ${S.names[other(loser)]} wins.`, other(loser));
};
$('#btnDraw').onclick = () => {
  if (S.over || !S.mode) return;
  if (S.mode === 'online') { net.send({ t: 'draw-offer' }); toast('Draw offered…'); return; }
  if (S.mode === 'local') { if (confirm('Agree to a draw?')) endGame('Draw', 'Agreed draw.', null); return; }
  const cap = captured(), mat = (c) => cap[other(c)].reduce((s, t) => s + VAL[t], 0);
  const cpu = other(S.myColor);
  if (mat(cpu) - mat(S.myColor) <= -2 || S.game.history().length > 80) endGame('Draw', 'The computer accepted your draw offer.', null);
  else toast('The computer declines the draw. 😏');
};
$('#status').onclick = () => $('#panel').classList.toggle('open');

$('#rematchBtn').onclick = () => {
  $('#result').classList.add('hidden');
  if (S.mode === 'cpu') startCpu();
  else if (S.mode === 'local') startGame('local', { names: { w: 'White', b: 'Black' } });
  else if (S.mode === 'online') {
    S.wantRematch = true; net.send({ t: 'rematch' });
    if (S.theyWantRematch && net.role === 'host') hostStartOnline(true);
    else toast('Rematch requested — waiting for your opponent…', 4000);
  }
};
$('#resMenuBtn').onclick = () => { $('#result').classList.add('hidden'); openMenu(); };
$('#resViewBtn').onclick = () => $('#result').classList.add('hidden');

// ---------- menu ----------
function openMenu() {
  $('#menu').classList.remove('hidden');
  $('#resumeBtn').classList.toggle('hidden', !S.mode);
}
$('#btnMenu').onclick = () => ($('#menu').classList.contains('hidden') ? openMenu() : S.mode && $('#menu').classList.add('hidden'));
$('#resumeBtn').onclick = () => $('#menu').classList.add('hidden');
$$('.tabs button').forEach((b) => b.addEventListener('click', () => {
  $$('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
  $$('.tab').forEach((t) => t.classList.toggle('hidden', t.id !== 'tab-' + b.dataset.tab));
}));
const lvl = $('#lvl');
lvl.value = S.level + 1;
const showLevel = () => { $('#lvlName').textContent = `${lvl.value} · ${LEVELS[lvl.value - 1].name}`; };
lvl.oninput = () => { S.level = lvl.value - 1; store.set('level', +lvl.value); showLevel(); };
showLevel();
$$('#colorPick button').forEach((b) => {
  b.classList.toggle('active', b.dataset.c === S.colorPref);
  b.onclick = () => { S.colorPref = b.dataset.c; store.set('colorPref', b.dataset.c); $$('#colorPick button').forEach((x) => x.classList.toggle('active', x === b)); };
});
function startCpu() {
  const c = S.colorPref === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : S.colorPref;
  const cpuName = `Computer · ${LEVELS[S.level].name}`;
  startGame('cpu', { myColor: c, names: c === 'w' ? { w: 'You', b: cpuName } : { w: cpuName, b: 'You' } });
  if (engine.failed) toast('Using the built-in engine (Stockfish could not load).');
}
$('#startCpu').onclick = startCpu;
$('#startLocal').onclick = () => { S.autoFlip = $('#autoFlip').checked; startGame('local', { names: { w: 'White', b: 'Black' } }); };

// ---------- online ----------
const myName = () => ($('#myName').value.trim() || 'Player').slice(0, 18);
$('#myName').value = store.get('name', '');
$('#myName').onchange = () => store.set('name', $('#myName').value.trim());

const net = new Net({
  onStatus(state, code) {
    if (state === 'waiting') {
      $('#hostBox').classList.remove('hidden');
      $('#roomCode').textContent = code;
      $('#roomLink').value = location.origin + location.pathname + '?room=' + code;
      $('#netMsg').textContent = '';
    } else if (state === 'connecting') $('#netMsg').textContent = `Connecting to game ${code}…`;
  },
  onConnected(role) {
    sound.notify();
    if (role === 'guest') { $('#netMsg').textContent = 'Connected! Starting…'; net.send({ t: 'hello', name: myName() }); }
  },
  onMessage(m) { handleNet(m); },
  onClosed() { toast('Your opponent left the game.', 5000); updateUI(); },
  onError(text) { $('#netMsg').textContent = text; toast(text, 5000); },
});

function hostStartOnline(swap) {
  if (swap) S.hostColor = other(S.hostColor);
  const names = { [S.hostColor]: myName(), [other(S.hostColor)]: S.oppName || 'Friend' };
  startGame('online', { myColor: S.hostColor, names });
  net.send({ t: 'start', color: other(S.hostColor), names });
}

function handleNet(m) {
  switch (m.t) {
    case 'hello':
      S.oppName = (m.name || 'Friend').slice(0, 18);
      if (S.mode === 'online' && !S.over && S.game.history().length) {
        net.send({ t: 'resume', color: other(S.myColor), names: S.names, pgn: S.game.pgn() });
        toast(`${S.oppName} reconnected.`); updateUI();
      } else { toast(`${S.oppName} joined!`); hostStartOnline(false); }
      break;
    case 'start': case 'resume':
      startGame('online', { myColor: m.color, names: m.names, pgn: m.pgn });
      toast(m.t === 'start' ? `Game on! You are ${cname(m.color)}.` : 'Reconnected to your game.');
      break;
    case 'move':
      if (m.ply !== S.game.history().length + 1) { net.send({ t: 'sync-request' }); break; }
      clearSelection(); playMove({ from: m.from, to: m.to, promotion: m.promotion }, true);
      break;
    case 'sync-request': net.send({ t: 'resume', color: other(S.myColor), names: S.names, pgn: S.game.pgn() }); break;
    case 'resign': endGame('Resigned', `${S.names[other(S.myColor)]} resigned. You win!`, S.myColor); break;
    case 'draw-offer':
      if (confirm(`${S.names[other(S.myColor)]} offers a draw. Accept?`)) { net.send({ t: 'draw-accept' }); endGame('Draw', 'Draw agreed.', null); }
      else net.send({ t: 'draw-decline' });
      break;
    case 'draw-accept': endGame('Draw', 'Your draw offer was accepted.', null); break;
    case 'draw-decline': toast('Draw declined.'); break;
    case 'rematch':
      S.theyWantRematch = true;
      if (S.wantRematch && net.role === 'host') hostStartOnline(true);
      else if (!S.wantRematch) toast(`${S.names[other(S.myColor)]} wants a rematch! Press Rematch.`, 5000);
      break;
    case 'chat': addChat(m.text, false); sound.notify(); break;
    case 'full': $('#netMsg').textContent = 'That game already has two players.'; break;
  }
}

$('#hostBtn').onclick = () => { store.set('name', myName()); S.hostColor = 'w'; net.host(); $('#hostBtn').textContent = 'New code'; };
$('#copyLink').onclick = async () => { try { await navigator.clipboard.writeText($('#roomLink').value); toast('Link copied!'); } catch { $('#roomLink').select(); } };
$('#shareLink').onclick = async () => {
  const url = $('#roomLink').value;
  if (navigator.share) { try { await navigator.share({ title: 'Landmark Chess', text: 'Play chess with me!', url }); } catch { /* cancelled */ } }
  else { try { await navigator.clipboard.writeText(url); toast('Link copied!'); } catch { /* ignore */ } }
};
$('#joinBtn').onclick = () => {
  const code = $('#joinCode').value.trim().toUpperCase();
  if (code.length < 4) { $('#netMsg').textContent = 'Enter the 6-letter code from your friend.'; return; }
  store.set('name', myName()); net.join(code);
};

function addChat(text, me) {
  const d = document.createElement('div'); d.className = me ? 'me' : ''; d.textContent = (me ? '' : S.names[other(S.myColor)] + ': ') + text;
  $('#chatLog').appendChild(d); $('#chatLog').scrollTop = 1e6;
  if (!me) toast(`💬 ${text}`);
}
$('#chatForm').onsubmit = (e) => { e.preventDefault(); const t = $('#chatInput').value.trim(); if (!t) return; net.send({ t: 'chat', text: t.slice(0, 140) }); addChat(t, true); $('#chatInput').value = ''; };
$$('.emotes button').forEach((b) => b.onclick = () => { net.send({ t: 'chat', text: b.textContent }); addChat(b.textContent, true); });

// ---------- top bar ----------
const setSoundIcon = () => { $('#btnSound').textContent = sound.muted ? '🔇' : '🔊'; };
sound.muted = store.get('muted', false); setSoundIcon();
$('#btnSound').onclick = () => { sound.setMuted(!sound.muted); store.set('muted', sound.muted); setSoundIcon(); };
const setQIcon = () => { $('#btnQuality').title = `Graphics: ${board.quality} (tap to switch)`; $('#btnQuality').style.opacity = board.quality === 'high' ? 1 : 0.55; };
const savedQ = store.get('quality', null); if (savedQ && savedQ !== board.quality) board.setQuality(savedQ);
setQIcon();
$('#btnQuality').onclick = () => { board.setQuality(board.quality === 'high' ? 'low' : 'high'); store.set('quality', board.quality); setQIcon(); toast(`Graphics: ${board.quality === 'high' ? 'High (glow + sharp shadows)' : 'Fast (better on phones)'}`); };
document.addEventListener('pointerdown', () => { if (!sound.ctx) { sound._ctx(); sound.ambience(S.venue); } }, { once: true });

// ---------- boot ----------
renderVenueUI();
setVenue(S.venue, true);
board.setCinematic(true);
const room = new URLSearchParams(location.search).get('room');
if (room) {
  $$('.tabs button').find((b) => b.dataset.tab === 'online').click();
  $('#joinCode').value = room.toUpperCase();
  history.replaceState(null, '', location.pathname);
  $('#netMsg').textContent = 'You were invited! Type your name and press Join.';
}
window.__lm = { S, board, engine, net }; // handy for debugging in the console
