// Online play: peer-to-peer over WebRTC (PeerJS public broker). No server of our own needed.
const PREFIX = 'landmark-chess-v1-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const newCode = () => Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');

export class Net {
  constructor(handlers) {
    this.h = handlers; // { onStatus(text), onConnected(), onMessage(msg), onClosed(), onError(text) }
    this.peer = null;
    this.conn = null;
    this.role = null;
  }

  host(code = newCode()) {
    this.close();
    this.role = 'host'; this.code = code;
    this.peer = new window.Peer(PREFIX + code);
    this.peer.on('open', () => this.h.onStatus?.('waiting', code));
    this.peer.on('connection', (conn) => {
      if (this.conn && this.conn.open) { conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); }); return; }
      this._wire(conn);
    });
    this.peer.on('error', (e) => {
      if (e.type === 'unavailable-id') return this.host(newCode());
      this.h.onError?.(this._explain(e));
    });
    this.peer.on('disconnected', () => { try { this.peer.reconnect(); } catch { /* ignore */ } });
    return code;
  }

  join(code) {
    this.close();
    this.role = 'guest'; this.code = code.toUpperCase().trim();
    this.peer = new window.Peer();
    this.peer.on('open', () => {
      this.h.onStatus?.('connecting', this.code);
      this._wire(this.peer.connect(PREFIX + this.code, { reliable: true }));
    });
    this.peer.on('error', (e) => this.h.onError?.(this._explain(e)));
  }

  _wire(conn) {
    this.conn = conn;
    conn.on('open', () => this.h.onConnected?.(this.role));
    conn.on('data', (msg) => this.h.onMessage?.(msg));
    conn.on('close', () => { if (this.conn === conn) { this.conn = null; this.h.onClosed?.(); } });
    conn.on('error', () => this.h.onError?.('Connection error.'));
  }

  send(msg) { if (this.conn && this.conn.open) this.conn.send(msg); }

  get connected() { return !!(this.conn && this.conn.open); }

  _explain(e) {
    switch (e.type) {
      case 'peer-unavailable': return 'No game found with that code. Check the code and make sure your friend’s game is still open.';
      case 'network': case 'server-error': case 'socket-error': case 'socket-closed': return 'Can’t reach the matchmaking server. Check your internet connection.';
      case 'browser-incompatible': return 'This browser doesn’t support online play.';
      default: return 'Online error: ' + (e.message || e.type);
    }
  }

  close() {
    try { this.conn?.close(); } catch { /* ignore */ }
    try { this.peer?.destroy(); } catch { /* ignore */ }
    this.conn = null; this.peer = null; this.role = null;
  }
}
