// Computer opponent: Stockfish (in a Web Worker) with a small built-in fallback engine.
const SF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js';

// level 1..10 -> engine settings
export const LEVELS = [
  { name: 'Beginner', local: 1 },
  { name: 'Novice', local: 2 },
  { name: 'Casual', skill: 3, depth: 3, ms: 250 },
  { name: 'Club', skill: 6, depth: 5, ms: 400 },
  { name: 'Strong', skill: 9, depth: 7, ms: 600 },
  { name: 'Expert', skill: 12, depth: 9, ms: 800 },
  { name: 'Master', skill: 15, depth: 11, ms: 1000 },
  { name: 'Grandmaster', skill: 18, depth: 14, ms: 1400 },
  { name: 'Super GM', skill: 20, depth: 18, ms: 2000 },
];

export class Engine {
  constructor() {
    this.ready = false;
    this.failed = false;
    this.pending = null;
    try {
      const blob = new Blob([`importScripts('${SF_URL}');`], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));
      this.worker.onmessage = (e) => this._line(String(e.data));
      this.worker.onerror = () => { this.failed = true; };
      this.worker.postMessage('uci');
      this.worker.postMessage('isready');
    } catch (err) {
      this.failed = true;
    }
  }

  _line(line) {
    if (line === 'readyok') this.ready = true;
    if (line.startsWith('bestmove') && this.pending) {
      const mv = line.split(' ')[1];
      const p = this.pending; this.pending = null;
      p(mv && mv !== '(none)' ? { from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: mv[4] } : null);
    }
  }

  // Returns {from,to,promotion} for the side to move in `fen`.
  async bestMove(fen, levelIndex, ChessCtor) {
    const L = LEVELS[levelIndex] || LEVELS[3];
    const t0 = performance.now();
    let mv = null;
    if (L.local || this.failed || !this.worker) {
      mv = localMove(fen, L.local || 3, ChessCtor);
    } else {
      mv = await new Promise((resolve) => {
        this.pending = resolve;
        this.worker.postMessage('ucinewgame');
        this.worker.postMessage(`setoption name Skill Level value ${L.skill}`);
        this.worker.postMessage(`position fen ${fen}`);
        this.worker.postMessage(`go depth ${L.depth} movetime ${L.ms}`);
        setTimeout(() => { if (this.pending === resolve) { this.worker.postMessage('stop'); } }, L.ms + 4000);
        setTimeout(() => { if (this.pending === resolve) { this.pending = null; this.failed = true; resolve(localMove(fen, 3, ChessCtor)); } }, L.ms + 9000);
      });
    }
    const wait = 450 - (performance.now() - t0);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    return mv;
  }

  stop() { if (this.pending && this.worker) this.worker.postMessage('stop'); }
}

// --- tiny fallback engine (also plays the two easiest levels) ---
const VAL = { p: 100, n: 310, b: 330, r: 500, q: 900, k: 0 };

function evaluate(game) {
  let s = 0;
  game.board().forEach((row, ri) => row.forEach((p, fi) => {
    if (!p) return;
    let v = VAL[p.type];
    const center = 3.5 - Math.max(Math.abs(3.5 - fi), Math.abs(3.5 - ri));
    if (p.type === 'n' || p.type === 'b') v += center * 8;
    if (p.type === 'p') v += (p.color === 'w' ? 6 - ri : ri - 1) * 6 + center * 3;
    s += p.color === 'w' ? v : -v;
  }));
  return s;
}

function search(game, depth, alpha, beta) {
  if (game.in_checkmate()) return -100000;
  if (game.in_draw() || game.in_stalemate()) return 0;
  if (depth === 0) return (game.turn() === 'w' ? 1 : -1) * evaluate(game);
  const moves = game.moves({ verbose: true }).sort((a, b) => (b.captured ? VAL[b.captured] : 0) - (a.captured ? VAL[a.captured] : 0));
  let best = -Infinity;
  for (const m of moves) {
    game.move(m);
    const v = -search(game, depth - 1, -beta, -alpha);
    game.undo();
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

export function localMove(fen, level, ChessCtor) {
  const game = new ChessCtor(fen);
  const moves = game.moves({ verbose: true });
  if (!moves.length) return null;
  if (level === 1 && Math.random() < 0.55) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    return { from: m.from, to: m.to, promotion: m.promotion ? 'q' : undefined };
  }
  const depth = level === 1 ? 1 : level === 2 ? 2 : 3;
  let best = null, bestV = -Infinity;
  for (const m of moves.sort(() => Math.random() - 0.5)) {
    game.move(m);
    const v = -search(game, depth - 1, -Infinity, Infinity) + Math.random() * (level <= 2 ? 40 : 8);
    game.undo();
    if (v > bestV) { bestV = v; best = m; }
  }
  return { from: best.from, to: best.to, promotion: best.promotion ? 'q' : undefined };
}
