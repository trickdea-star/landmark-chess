# Landmark Chess

3D chess in three legendary places: **the Oval Office**, **the Titanic wreck**, and **the torch of the
Statue of Liberty**. Play the computer (9 levels, Stockfish), a friend anywhere in the world (invite
link), or two players on one device. Works in any modern browser, desktop or phone. Nothing to install.

## Run it locally

```bash
python -m http.server 8767 --directory C:\Users\DeatrickJohnson\Projects\landmark-chess
```

Open http://localhost:8767. (It has to be served over http; opening `index.html` directly won't load
the modules.)

## How online play works

- Player 1: **Menu → Online Friend → Create a game**. Send the link (or the 6-letter code).
- Player 2: open the link and press **Join**.
- The two browsers connect peer-to-peer (WebRTC) using the free PeerJS matchmaking service. There is
  no server of our own. Moves, chat, draw offers, resign and rematch (colors swap) all go over that link.
- For a friend in another house to join, the game must be hosted on the internet (e.g. GitHub Pages).
  `localhost` only works on this computer.
- If someone refreshes or drops, they can reopen the same link while the host's game is still open
  and the game resumes.

## Files

| File | What it does |
|------|--------------|
| `index.html`, `css/style.css` | Page, menus, side panel |
| `js/main.js` | Game controller: rules (chess.js), clicks, computer turns, online messages, UI |
| `js/board3d.js` | Three.js renderer: board, pieces, highlights, camera, move animations |
| `js/assets.js` | Loads the real textures, piece models and sky from `assets/` |
| `js/pieces.js` | Built-in procedural pieces (fallback if the scanned set can't load) |
| `js/venues.js` | Venue list; each venue lives in `venue-*.js` |
| `js/venue-oval.js`, `venue-titanic.js`, `venue-liberty.js` | The three scenes, lights, board + piece colors |
| `js/engine.js` | Stockfish in a Web Worker + a small built-in engine (levels 1–2, and fallback) |
| `js/net.js` | PeerJS online play |
| `js/sound.js` | Synthesized sound effects and ambience |
| `assets/` | Web-ready textures (WebP), the scanned piece shapes (`pieces/pieces.glb`) and the sunset sky |
| `tools/build_assets.py` | Downloads the Poly Haven originals and rebuilds `assets/` |

### Rebuilding the assets

```bash
python tools/build_assets.py <some-temp-folder>
```

Downloads go to the temp folder; the shrunk web versions land in `assets/`. To use another Poly Haven
texture, add its id to `TEXTURES` in the script, rebuild, then use it with `pbrMat('<id>', {...})`.
The "Fast" graphics button turns off ambient occlusion and bloom for phones.

### Adding a venue

Copy one of the `venue-*.js` files, change the scene, then register it in `js/venues.js`. A venue's
async `build()` returns `{ group, background, fog, exposure, board, pieces, update(t, dt) }`. It must put a
flat surface (a table) at `y = -0.32` under the board, at least 14 × 11.6 units, because captured pieces
are lined up there.

## Credits

- [three.js](https://threejs.org) r160 (MIT): 3D rendering
- [chess.js](https://github.com/jhlywa/chess.js) 0.10.3 (BSD-2): rules
- [Stockfish.js](https://github.com/niklasf/stockfish.js) 10.0.2 (GPLv3): computer opponent, loaded
  unmodified from cdnjs
- [PeerJS](https://peerjs.com) 1.5.4 (MIT): online play
- [Poly Haven](https://polyhaven.com) (CC0): the photo-scanned chess set (by Riley Queen), all surface textures,
  and the *Belfast Sunset (Pure Sky)* sky

Venues are original tributes built in code. No official seals, logos or real portraits are used.
