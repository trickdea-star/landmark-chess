// 3D renderer: board, pieces, highlights, camera, picking and move animation.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { pieceGeometries } from './pieces.js';
import { VENUES } from './venues.js';
import { loadPieces, setMaxAnisotropy, image as texImage, pbrMat } from './assets.js';

// Seam-free regions (in 1024px coords) inside each tile of tiled stone textures, so a square never shows grout.
const STONE_TILES = {
  marble_01: [[22, 4, 348, 206], [354, 4, 660, 206], [666, 4, 1020, 206], [64, 218, 473, 452], [478, 218, 708, 452], [714, 218, 1020, 452],
    [4, 462, 312, 695], [318, 462, 602, 695], [608, 462, 934, 695], [70, 705, 318, 1018], [324, 705, 576, 1018], [582, 705, 834, 1018], [840, 705, 1020, 1018]],
};

const FILES = 'abcdefgh';
export const TABLE_Y = -0.32; // venues put a surface here (board base + captured pieces)
export const sqToXZ = (sq) => ({ x: FILES.indexOf(sq[0]) - 3.5, z: 3.5 - (parseInt(sq[1], 10) - 1) });
function xzToSq(x, z) {
  const f = Math.floor(x + 4), r = Math.floor(4 - z);
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return FILES[f] + (r + 1);
}
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function texturePatch(g, x, y, w, h, style, color, rand, vertical) {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  if (style === 'wood') {
    for (let i = 0; i < 46; i++) {
      g.strokeStyle = color; g.globalAlpha = 0.04 + rand() * 0.12; g.lineWidth = 1 + rand() * 3;
      g.beginPath();
      const o = rand() * (vertical ? w : h), amp = 3 + rand() * 8, ph = rand() * 6;
      for (let s = 0; s <= 24; s++) {
        const u = (s / 24) * (vertical ? h : w);
        const v = o + Math.sin(u / 40 + ph) * amp + Math.sin(u / 11 + ph * 2) * 1.5;
        vertical ? (s ? g.lineTo(x + v, y + u) : g.moveTo(x + v, y + u)) : (s ? g.lineTo(x + u, y + v) : g.moveTo(x + u, y + v));
      }
      g.stroke();
    }
  } else if (style === 'metal') {
    for (let i = 0; i < 120; i++) {
      g.strokeStyle = rand() > 0.5 ? '#ffffff' : '#000000'; g.globalAlpha = 0.03 + rand() * 0.05; g.lineWidth = 1;
      const yy = y + rand() * h; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy + (rand() - 0.5) * 6); g.stroke();
    }
  } else { // marble
    for (let i = 0; i < 6; i++) {
      const gr = g.createRadialGradient(x + rand() * w, y + rand() * h, 0, x + rand() * w, y + rand() * h, w * (0.4 + rand() * 0.6));
      gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.05 + rand() * 0.06; g.fillStyle = gr; g.fillRect(x, y, w, h);
    }
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = color; g.globalAlpha = 0.1 + rand() * 0.3; g.lineWidth = 0.6 + rand() * 2.6;
      g.beginPath(); g.moveTo(x + rand() * w * 0.3 - w * 0.2, y + rand() * h);
      g.bezierCurveTo(x + rand() * w, y + rand() * h, x + rand() * w, y + rand() * h, x + w * 1.1, y + rand() * h);
      g.stroke();
    }
  }
  g.restore(); g.globalAlpha = 1;
}

function makeBoardTexture(skin, aniso) {
  const N = 2048, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d'), rand = rng(skin.seed || 7);
  const B = N * (0.6 / 9.2), S = (N - 2 * B) / 8;
  g.fillStyle = skin.border; g.fillRect(0, 0, N, N);
  texturePatch(g, 0, 0, N, N, skin.borderStyle || 'wood', skin.borderVein || '#000', rand, false);
  for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
    const light = (f + r) % 2 === 1, x = B + f * S, y = B + (7 - r) * S;
    g.fillStyle = light ? skin.light : skin.dark; g.fillRect(x, y, S, S);
    texturePatch(g, x, y, S, S, skin.style || 'marble', light ? skin.lightVein : skin.darkVein, rand, (f + r) % 2 === 0);
  }
  g.strokeStyle = skin.trim; g.lineWidth = 10; g.strokeRect(B - 9, B - 9, 8 * S + 18, 8 * S + 18);
  g.lineWidth = 3; g.strokeRect(B - 26, B - 26, 8 * S + 52, 8 * S + 52);
  g.fillStyle = skin.letters; g.font = `600 ${Math.round(B * 0.42)}px Georgia, 'Times New Roman', serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 8; i++) {
    g.fillText(FILES[i].toUpperCase(), B + (i + 0.5) * S, N - B / 2);
    g.fillText(FILES[i].toUpperCase(), B + (i + 0.5) * S, B / 2);
    g.fillText(String(8 - i), B / 2, B + (i + 0.5) * S);
    g.fillText(String(8 - i), N - B / 2, B + (i + 0.5) * S);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  return t;
}

async function boardImages(skin) {
  const get = (id) => (id ? Promise.all([texImage(id, 'diff'), texImage(id, 'nor')]) : Promise.resolve([null, null]));
  const [light, dark, border] = await Promise.all([get(skin.lightTex), get(skin.darkTex), get(skin.borderTex)]);
  return { light, dark, border };
}

// Board top built from real photo textures: colour map + matching normal map (wood grain / stone relief).
function makeBoardMaps(skin, imgs, aniso) {
  const N = 2048, B = N * (0.6 / 9.2), S = (N - 2 * B) / 8, rand = rng(skin.seed || 7);
  const canvas = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
  const cd = canvas(), cn = canvas(), gd = cd.getContext('2d'), gn = cn.getContext('2d');
  gn.fillStyle = '#8080ff'; gn.fillRect(0, 0, N, N);
  const tint = (x, y, w, h, color) => {
    if (!color) return;
    gd.globalCompositeOperation = 'multiply'; gd.fillStyle = color; gd.fillRect(x, y, w, h);
    gd.globalCompositeOperation = 'source-over';
  };
  // border: tile the border texture all over, squares go on top
  const [bd, bn] = imgs.border;
  if (bd) {
    const T = N / 2.6;
    for (let x = 0; x < N; x += T) for (let y = 0; y < N; y += T) { gd.drawImage(bd, x, y, T, T); if (bn) gn.drawImage(bn, x, y, T, T); }
    tint(0, 0, N, N, skin.borderTint);
  } else { gd.fillStyle = skin.border; gd.fillRect(0, 0, N, N); }
  const crop = (img, id) => {
    const k = img.width / 1024, tiles = STONE_TILES[id];
    if (tiles) {
      const [x0, y0, x1, y1] = tiles[Math.floor(rand() * tiles.length)].map((v) => v * k);
      const size = Math.min(x1 - x0, y1 - y0) * (0.8 + rand() * 0.2);
      return [x0 + rand() * (x1 - x0 - size), y0 + rand() * (y1 - y0 - size), size];
    }
    const size = img.width * (skin.crop || 0.3);
    return [rand() * (img.width - size), rand() * (img.height - size), size];
  };
  for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
    const light = (f + r) % 2 === 1, x = B + f * S, y = B + (7 - r) * S;
    const [d, n] = light ? imgs.light : imgs.dark, id = light ? skin.lightTex : skin.darkTex;
    const [sx, sy, sz] = crop(d, id);
    gd.drawImage(d, sx, sy, sz, sz, x, y, S + 0.5, S + 0.5);
    if (n) { const k = n.width / d.width; gn.drawImage(n, sx * k, sy * k, sz * k, sz * k, x, y, S + 0.5, S + 0.5); }
    tint(x, y, S + 0.5, S + 0.5, light ? skin.lightTint : skin.darkTint);
    const v = (rand() - 0.5) * 0.08; // tiny per-square variation, like real inlaid squares
    gd.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; gd.fillRect(x, y, S, S);
  }
  gd.strokeStyle = skin.trim; gd.lineWidth = 10; gd.strokeRect(B - 9, B - 9, 8 * S + 18, 8 * S + 18);
  gd.lineWidth = 3; gd.strokeRect(B - 26, B - 26, 8 * S + 52, 8 * S + 52);
  gd.fillStyle = skin.letters; gd.font = `600 ${Math.round(B * 0.42)}px Georgia, 'Times New Roman', serif`;
  gd.textAlign = 'center'; gd.textBaseline = 'middle';
  gd.shadowColor = 'rgba(0,0,0,0.5)'; gd.shadowBlur = 6;
  for (let i = 0; i < 8; i++) {
    gd.fillText(FILES[i].toUpperCase(), B + (i + 0.5) * S, N - B / 2);
    gd.fillText(FILES[i].toUpperCase(), B + (i + 0.5) * S, B / 2);
    gd.fillText(String(8 - i), B / 2, B + (i + 0.5) * S);
    gd.fillText(String(8 - i), N - B / 2, B + (i + 0.5) * S);
  }
  const map = new THREE.CanvasTexture(cd); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = aniso;
  const normalMap = new THREE.CanvasTexture(cn); normalMap.colorSpace = THREE.NoColorSpace; normalMap.anisotropy = aniso;
  return { map, normalMap };
}

function glowTexture(inner, outer = 'rgba(0,0,0,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) { for (const v of Object.values(m)) if (v && v.isTexture) v.dispose(); m.dispose(); }
  });
}

export class Board3D {
  constructor(container) {
    this.container = container;
    this.onSquare = () => {};
    this.hoverFilter = () => false;
    this.isTarget = () => false;
    this.tweens = [];
    this.meshes = new Map(); // square -> mesh
    this.selectedMesh = null;
    this.cinematic = true;
    this.clock = new THREE.Clock();

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);
    setMaxAnisotropy(r.capabilities.getMaxAnisotropy());
    this.scan = null; // photo-scanned piece set, once loaded

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
    this.camera.position.set(0, 9, 11);
    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, { enablePan: false, enableDamping: true, dampingFactor: 0.08, minDistance: 7, maxDistance: 24, maxPolarAngle: 1.38, minPolarAngle: 0.12 });
    this.pmrem = new THREE.PMREMGenerator(r);

    this.boardGroup = new THREE.Group();
    this.pieceGroup = new THREE.Group();
    this.hlGroup = new THREE.Group();
    this.scene.add(this.boardGroup, this.pieceGroup, this.hlGroup);
    this._buildHighlights();

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._bindPointer();

    this.setQuality(matchMedia('(pointer: coarse)').matches ? 'low' : 'high');
    new ResizeObserver(() => this._resize()).observe(container);
    this._resize();
    r.setAnimationLoop(() => this._frame());
  }

  // ---------- quality / post ----------
  setQuality(q) {
    this.quality = q;
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : 1.25));
    this.shadowSize = q === 'high' ? 2048 : 1024;
    this.scene.traverse((o) => {
      if (o.isLight && o.castShadow && o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; o.shadow.mapSize.set(this.shadowSize, this.shadowSize); }
    });
    if (q === 'high') {
      // multisampled target keeps edges smooth through the effects chain
      this.composer = new EffectComposer(r, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      // ambient occlusion: soft contact shadows where pieces meet the board, in creases and corners
      this.gtao = new GTAOPass(this.scene, this.camera, 256, 256);
      this.gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 2, thickness: 1.5, scale: 1.1, samples: 16 });
      this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 16 });
      this.gtao.blendIntensity = 0.9;
      // GTAO only hides points/lines from its depth pass; glows, light shafts and highlight planes would
      // otherwise read as solid walls and paint big dark wedges, so hide every see-through object too.
      this.gtao.overrideVisibility = function () {
        const cache = this._visibilityCache;
        this.scene.traverse((o) => {
          cache.set(o, o.visible);
          const m = o.material;
          if (o.isPoints || o.isLine || o.isSprite || (m && !Array.isArray(m) && (m.transparent || m.depthWrite === false))) o.visible = false;
        });
      };
      this.composer.addPass(this.gtao);
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.22, 0.5, 0.93);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    } else {
      this.composer = null;
    }
    this._resize();
  }

  _resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
    // keep the board centred in the part of the screen the side panel doesn't cover
    const ins = this.getInsets?.() || {}, right = ins.right || 0, bottom = ins.bottom || 0;
    if (right || bottom) this.camera.setViewOffset(w, h, right / 2, bottom / 2, w, h); else this.camera.clearViewOffset();
    const tv = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    this.fitDistance = Math.max(12, 5.4 / (tv * Math.max(0.3, (w - right) / h)), 5.2 / (tv * Math.max(0.3, (h - bottom) / h)));
    this.controls.maxDistance = Math.max(24, this.fitDistance + 6);
  }

  // ---------- venue ----------
  async loadAssets() { this.scan = await loadPieces(); }

  async setVenue(key) {
    const def = VENUES[key] || VENUES.oval;
    this.venueKey = key;
    const token = (this._venueToken = (this._venueToken || 0) + 1);
    const v = await def.build({ renderer: this.renderer, quality: this.quality });
    if (token !== this._venueToken) { disposeTree(v.group); return; } // another venue was picked meanwhile
    if (this.venue) { this.scene.remove(this.venue.group); disposeTree(this.venue.group); }
    this.scene.fog = null; this.scene.background = null; this.scene.environment = null;
    this.venue = v;
    this.scene.add(v.group);
    this.scene.background = v.background || null;
    this.scene.fog = v.fog || null;
    this.renderer.toneMappingExposure = v.exposure ?? 1;
    v.group.traverse((o) => { if (o.isLight && o.castShadow) o.shadow.mapSize.set(this.shadowSize, this.shadowSize); });
    await this._buildBoard(v.board);
    this._buildPieceMaterials(v.pieces);
    this._restyleMeshes();
    // reflections: capture the venue itself (without board/pieces) into an environment map
    this.boardGroup.visible = this.pieceGroup.visible = this.hlGroup.visible = false;
    if (this.envRT) this.envRT.dispose();
    v.update?.(0, 0);
    this.envRT = this.pmrem.fromScene(this.scene, 0.035, 0.1, 400);
    this.boardGroup.visible = this.pieceGroup.visible = this.hlGroup.visible = true;
    this.scene.environment = this.envRT.texture;
  }

  async _buildBoard(skin) {
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    const imgs = skin.lightTex ? await boardImages(skin) : null;
    const maps = imgs && imgs.light[0] && imgs.dark[0] ? makeBoardMaps(skin, imgs, aniso) : { map: makeBoardTexture(skin, aniso), normalMap: null };
    const frameParams = { color: skin.frame, roughness: skin.frameRough ?? 0.45, metalness: skin.frameMetal ?? 0, clearcoat: 0.6, clearcoatRoughness: 0.25 };
    const frameMat = skin.borderTex ? await pbrMat(skin.borderTex, { physical: true, repeat: [2, 2], ...frameParams }) : new THREE.MeshPhysicalMaterial(frameParams);
    disposeTree(this.boardGroup); this.boardGroup.clear();
    const frame = new THREE.Mesh(new RoundedBoxGeometry(9.5, -TABLE_Y, 9.5, 4, 0.1), frameMat);
    frame.position.y = TABLE_Y / 2; frame.castShadow = true; frame.receiveShadow = true;
    const topMat = new THREE.MeshPhysicalMaterial({ ...maps, roughness: skin.roughness ?? 0.28, metalness: skin.metalness ?? 0, clearcoat: skin.clearcoat ?? 0.8, clearcoatRoughness: 0.12, envMapIntensity: skin.envIntensity ?? 1 });
    if (maps.normalMap) topMat.normalScale.set(skin.normalScale ?? 0.6, skin.normalScale ?? 0.6);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 9.2).rotateX(-Math.PI / 2), topMat);
    top.position.y = 0.002; top.receiveShadow = true;
    this.boardTop = top;
    this.boardGroup.add(frame, top);
  }

  _buildPieceMaterials(skin) {
    if (this.pieceMats) Object.values(this.pieceMats).forEach((m) => m.dispose());
    const sc = this.scan?.tex;
    const mk = (s, color) => {
      const m = new THREE.MeshPhysicalMaterial({ color: s.color, roughness: s.roughness ?? 0.3, metalness: s.metalness ?? 0, clearcoat: s.clearcoat ?? 0.7, clearcoatRoughness: s.clearcoatRoughness ?? 0.15, sheen: s.sheen ?? 0, sheenColor: s.sheenColor || '#ffffff', envMapIntensity: s.envIntensity ?? 1, emissive: s.emissive || '#000000', emissiveIntensity: s.emissiveIntensity ?? 0, iridescence: s.iridescence ?? 0 });
      if (sc) {
        // scanned set: real stone colour (or a tinted copy of it), surface relief, roughness and crevice shading
        m.map = sc[s.tex || (color === 'w' ? 'white' : 'black')];
        m.normalMap = sc.nor; m.roughnessMap = sc.arm; m.aoMap = sc.arm;
        m.normalScale.set(s.normalScale ?? 1, s.normalScale ?? 1);
        if (s.scanRoughness != null) m.roughness = s.scanRoughness;
      }
      return m;
    };
    this.pieceMats = { w: mk(skin.white, 'w'), b: mk(skin.black, 'b') };
  }

  _restyleMeshes() {
    this.pieceGroup.traverse((o) => { if (o.isMesh && o.userData.color) o.material = this.pieceMats[o.userData.color]; });
  }

  // ---------- pieces ----------
  _makePiece(type, color, sq = null) {
    const m = new THREE.Mesh((this.scan?.geos || pieceGeometries())[type] || pieceGeometries()[type], this.pieceMats[color]);
    m.userData = { type, color, sharedGeo: true };
    m.castShadow = m.receiveShadow = true;
    if (type === 'n') {
      // face the centre of the board, turned a little toward the opponent, so the horse profile reads clearly
      const left = !sq || 'abcd'.includes(sq[0]), tilt = color === 'w' ? 0.45 : -0.45;
      m.rotation.y = left ? tilt : Math.PI - tilt;
    } else if (this.scan) m.rotation.y = (color === 'w' ? 0 : Math.PI) + (Math.random() - 0.5) * 0.3;
    else m.rotation.y = Math.random() * Math.PI * 2;
    return m;
  }

  _graveSlot(color, i) {
    const side = color === 'w' ? -1 : 1, col = Math.floor(i / 8), row = i % 8;
    return new THREE.Vector3(side * (5.35 + col * 0.72), TABLE_Y, side * (3.5 - row));
  }

  // board: chess.js board() array; captured: {w:[types], b:[types]}
  setPosition(board, captured = { w: [], b: [] }) {
    this.gen = (this.gen || 0) + 1;
    this.tweens = this.tweens.filter((t) => !t.piece);
    this.selectedMesh = null;
    this.pieceGroup.clear();
    this.meshes.clear();
    this.grave = { w: [], b: [] };
    board.forEach((row, ri) => row.forEach((p, fi) => {
      if (!p) return;
      const sq = FILES[fi] + (8 - ri), m = this._makePiece(p.type, p.color, sq), { x, z } = sqToXZ(sq);
      m.position.set(x, 0, z); m.userData.sq = sq;
      this.pieceGroup.add(m); this.meshes.set(sq, m);
    }));
    for (const c of ['w', 'b']) for (const t of captured[c]) this._toGrave(this._makePiece(t, c), true);
  }

  _toGrave(m, instant) {
    const c = m.userData.color, slot = this._graveSlot(c, this.grave[c].length);
    this.grave[c].push(m); m.userData.sq = null;
    if (!m.parent) this.pieceGroup.add(m);
    if (instant) { m.position.copy(slot); m.scale.setScalar(0.78); return Promise.resolve(); }
    return this._arc(m, slot, 1.4, 650, 0.78);
  }

  _arc(m, to, lift, dur, scaleTo = null) {
    const from = m.position.clone(), s0 = m.scale.x;
    return new Promise((resolve) => this.tweens.push({
      piece: true, t0: performance.now(), dur,
      update: (k) => {
        const e = ease(k);
        m.position.lerpVectors(from, to, e);
        m.position.y = THREE.MathUtils.lerp(from.y, to.y, e) + Math.sin(Math.PI * e) * lift;
        if (scaleTo) m.scale.setScalar(THREE.MathUtils.lerp(s0, scaleTo, e));
      },
      done: resolve,
    }));
  }

  // move: chess.js verbose move object. Returns a promise resolved when the animation finishes.
  async animateMove(mv) {
    this.select(null);
    const m = this.meshes.get(mv.from);
    if (!m) return;
    const jobs = [];
    let capSq = mv.flags.includes('e') ? mv.to[0] + mv.from[1] : mv.flags.includes('c') ? mv.to : null;
    if (capSq && this.meshes.get(capSq)) {
      const cm = this.meshes.get(capSq); this.meshes.delete(capSq);
      jobs.push(new Promise((r) => setTimeout(r, 220)).then(() => this._toGrave(cm)));
    }
    this.meshes.delete(mv.from);
    const { x, z } = sqToXZ(mv.to), dist = Math.hypot(m.position.x - x, m.position.z - z);
    jobs.push(this._arc(m, new THREE.Vector3(x, 0, z), mv.piece === 'n' ? 0.9 : 0.25 + dist * 0.04, 260 + dist * 55));
    m.userData.sq = mv.to; this.meshes.set(mv.to, m);
    if (mv.flags.includes('k') || mv.flags.includes('q')) {
      const rank = mv.from[1], rf = (mv.flags.includes('k') ? 'h' : 'a') + rank, rt = (mv.flags.includes('k') ? 'f' : 'd') + rank;
      const rm = this.meshes.get(rf);
      if (rm) {
        this.meshes.delete(rf); this.meshes.set(rt, rm); rm.userData.sq = rt;
        const p = sqToXZ(rt);
        jobs.push(new Promise((r) => setTimeout(r, 120)).then(() => this._arc(rm, new THREE.Vector3(p.x, 0, p.z), 0.6, 420)));
      }
    }
    const gen = this.gen;
    await Promise.all(jobs);
    if (gen !== this.gen) return; // board was re-synced meanwhile
    if (mv.promotion) {
      const nm = this._makePiece(mv.promotion, mv.color, mv.to);
      nm.position.copy(m.position); nm.userData.sq = mv.to;
      this.pieceGroup.remove(m); this.pieceGroup.add(nm); this.meshes.set(mv.to, nm);
      nm.scale.setScalar(0.2);
      await new Promise((r) => this.tweens.push({ piece: true, t0: performance.now(), dur: 380, update: (k) => nm.scale.setScalar(0.2 + 0.8 * ease(k) + Math.sin(Math.PI * k) * 0.25), done: r }));
    }
  }

  // ---------- highlights ----------
  _buildHighlights() {
    const sqGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false });
    this.hlSelected = new THREE.Mesh(sqGeo, mat('#ffd36b', 0.5));
    this.hlHover = new THREE.Mesh(sqGeo, mat('#ffffff', 0.16));
    this.hlLast = [new THREE.Mesh(sqGeo, mat('#d8ff7a', 0.24)), new THREE.Mesh(sqGeo, mat('#d8ff7a', 0.32))];
    this.hlCheck = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,40,30,1)'), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
    this.hlHint = [new THREE.Mesh(sqGeo, mat('#62c3ff', 0.45)), new THREE.Mesh(sqGeo, mat('#62c3ff', 0.45))];
    for (const m of [this.hlSelected, this.hlHover, ...this.hlLast, this.hlCheck, ...this.hlHint]) { m.visible = false; m.position.y = 0.006; this.hlGroup.add(m); }
    this.hlCheck.position.y = 0.008;
    this.dotGeo = new THREE.CircleGeometry(0.15, 32).rotateX(-Math.PI / 2);
    this.ringGeo = new THREE.RingGeometry(0.38, 0.47, 48).rotateX(-Math.PI / 2);
    this.dotMat = new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false });
    this.targets = [];
  }

  _place(m, sq) { if (!sq) { m.visible = false; return; } const p = sqToXZ(sq); m.position.x = p.x; m.position.z = p.z; m.visible = true; }

  select(sq, targets = []) {
    this._place(this.hlSelected, sq);
    if (this.selectedMesh && !this.tweens.some((t) => t.piece)) this.selectedMesh.position.y = 0;
    this.selectedMesh = sq ? this.meshes.get(sq) || null : null;
    for (const t of this.targets) this.hlGroup.remove(t);
    this.targets = targets.map(({ sq: s, capture }) => {
      const m = new THREE.Mesh(capture ? this.ringGeo : this.dotGeo, this.dotMat);
      const p = sqToXZ(s); m.position.set(p.x, 0.012, p.z);
      this.hlGroup.add(m); return m;
    });
  }

  setLastMove(from, to) { this._place(this.hlLast[0], from); this._place(this.hlLast[1], to); }
  setCheck(sq) { this._place(this.hlCheck, sq); }
  setHint(from, to) { this._place(this.hlHint[0], from); this._place(this.hlHint[1], to); }

  // ---------- camera ----------
  _viewFor(color) {
    const d = this.fitDistance || 13, polar = 0.86;
    return { r: d, phi: polar, theta: color === 'b' ? Math.PI : 0 };
  }

  setView(color, instant = false) {
    this.viewColor = color;
    this.cinematic = false;
    const to = this._viewFor(color);
    if (instant) { this._applySpherical(to); return; }
    const s = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    let dTheta = to.theta - s.theta; dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
    const from = { r: s.radius, phi: s.phi, theta: s.theta };
    this.controls.enabled = false;
    this.tweens.push({ t0: performance.now(), dur: 1500, update: (k) => {
      const e = ease(k);
      this._applySpherical({ r: from.r + (to.r - from.r) * e, phi: from.phi + (to.phi - from.phi) * e, theta: from.theta + dTheta * e });
    }, done: () => { this.controls.enabled = true; } });
  }

  _applySpherical({ r, phi, theta }) {
    this.camera.position.setFromSpherical(new THREE.Spherical(r, phi, theta)).add(this.controls.target);
    this.camera.lookAt(this.controls.target);
  }

  setCinematic(on) { this.cinematic = on; this.controls.enabled = !on; }

  // re-measure (e.g. after the side panel appears) and ease the camera to the new framing
  refit() {
    const before = this.fitDistance;
    this._resize();
    if (!this.cinematic && this.viewColor && Math.abs(before - this.fitDistance) > 0.3) this.setView(this.viewColor);
  }

  // ---------- input ----------
  _bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      if (!down || this.cinematic) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
      if (moved > 8) return;
      const sq = this._pick(e);
      if (sq) this.onSquare(sq);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || this.cinematic) return;
      const sq = this._pick(e);
      this._place(this.hlHover, sq && this.hoverFilter(sq) ? sq : null);
      el.style.cursor = sq && this.hoverFilter(sq) ? 'pointer' : 'grab';
    });
  }

  _pick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const onBoard = [...this.meshes.values()];
    const hits = this.raycaster.intersectObjects([...onBoard, this.boardTop], false);
    const pieceHit = hits.find((h) => h.object.userData.sq), boardHit = hits.find((h) => h.object === this.boardTop);
    const pieceSq = pieceHit?.object.userData.sq || null, boardSq = boardHit ? xzToSq(boardHit.point.x, boardHit.point.z) : null;
    // a tall piece in front shouldn't block clicking a legal destination behind it
    if (pieceSq && this.isTarget(pieceSq)) return pieceSq;
    if (boardSq && this.isTarget(boardSq)) return boardSq;
    return pieceSq || boardSq;
  }

  // ---------- loop ----------
  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05), t = this.clock.elapsedTime, now = performance.now();
    this.tweens = this.tweens.filter((tw) => {
      const k = Math.min(1, (now - tw.t0) / tw.dur);
      tw.update(k);
      if (k >= 1) { tw.done?.(); return false; }
      return true;
    });
    if (this.cinematic) {
      const r = 16, a = t * 0.06;
      this.camera.position.set(Math.sin(a) * r, 6.5 + Math.sin(t * 0.2) * 0.8, Math.cos(a) * r);
      this.camera.lookAt(0, 0.4, 0);
    } else if (this.controls.enabled) this.controls.update();
    if (this.selectedMesh && !this.tweens.some((tw) => tw.piece)) this.selectedMesh.position.y = 0.16 + Math.sin(t * 4) * 0.035;
    if (this.hlCheck.visible) this.hlCheck.material.opacity = 0.65 + Math.sin(t * 6) * 0.3;
    for (const m of this.targets) m.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
    this.venue?.update?.(t, dt, this.camera);
    if (this.composer) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
  }
}
