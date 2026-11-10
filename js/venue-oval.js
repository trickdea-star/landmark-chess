// Venue: a stately oval office (generic, no official seals).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTex, std, phys, mesh, keyLight, rand } from './vutil.js';
import { pbrMat } from './assets.js';

const FLOOR = -4.2, RX = 44, RZ = 35, H = 40;

class Ellipse3 extends THREE.Curve {
  constructor(rx, rz, y) { super(); this.rx = rx; this.rz = rz; this.y = y; }
  getPoint(t, target = new THREE.Vector3()) { const a = t * Math.PI * 2; return target.set(Math.cos(a) * this.rx, this.y, Math.sin(a) * this.rz); }
}

const onWall = (a, inset = 0.99) => new THREE.Vector3(Math.cos(a) * RX * inset, 0, Math.sin(a) * RZ * inset);
const faceCenter = (p) => Math.atan2(-p.x, -p.z);

function star(g, cx, cy, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.4 : r, a = -Math.PI / 2 + (i * Math.PI) / 5;
    i ? g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
}

function usFlag() {
  return canvasTex(760, 400, (g, w, h) => {
    const sh = h / 13;
    for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#b22234'; g.fillRect(0, i * sh, w, sh + 1); }
    const cw = w * 0.4, ch = sh * 7;
    g.fillStyle = '#3c3b6e'; g.fillRect(0, 0, cw, ch);
    g.fillStyle = '#ffffff';
    for (let row = 0; row < 9; row++) {
      const n = row % 2 ? 5 : 6;
      for (let c = 0; c < n; c++) {
        const x = (cw / 12) * (row % 2 ? 2 * c + 2 : 2 * c + 1), y = (ch / 10) * (row + 1);
        star(g, x, y, 9);
      }
    }
  });
}

function navyFlag() {
  return canvasTex(512, 300, (g, w, h) => {
    g.fillStyle = '#1b2654'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e2b955';
    for (let i = 0; i < 13; i++) { const a = (i / 13) * Math.PI * 2; star(g, w / 2 + Math.cos(a) * 80, h / 2 + Math.sin(a) * 80, 10); }
    g.beginPath(); g.arc(w / 2, h / 2, 40, 0, Math.PI * 2); g.fill();
    g.fillRect(0, h - 14, w, 14); g.fillRect(w - 14, 0, 14, h);
  });
}

function carpetTex() {
  return canvasTex(1024, 1024, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#16295a'; g.fillRect(0, 0, w, w);
    const ring = (r, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke(); };
    ring(500, '#c9a24a', 22); ring(470, '#e7cf8a', 4); ring(455, '#c9a24a', 3);
    g.fillStyle = '#d7b765';
    for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2; g.save(); g.translate(c + Math.cos(a) * 430, c + Math.sin(a) * 430); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 14, 6, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
    ring(395, '#c9a24a', 3);
    // sunburst + ring of stars (generic medallion)
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      g.fillStyle = i % 2 ? 'rgba(231,207,138,0.55)' : 'rgba(201,162,74,0.35)';
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, 250, a, a + Math.PI / 48); g.closePath(); g.fill();
    }
    g.fillStyle = '#16295a'; g.beginPath(); g.arc(c, c, 160, 0, Math.PI * 2); g.fill();
    ring(160, '#e7cf8a', 6); ring(252, '#c9a24a', 5);
    g.fillStyle = '#f1dc9c';
    for (let i = 0; i < 50; i++) { const a = (i / 50) * Math.PI * 2; star(g, c + Math.cos(a) * 205, c + Math.sin(a) * 205, 11); }
    g.fillStyle = '#e2c46e'; star(g, c, c, 90);
  });
}

function windowTex() {
  return canvasTex(256, 600, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#cfe6ff'); gr.addColorStop(0.7, '#fbf7ee'); gr.addColorStop(1, '#d9e8c9');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(120,150,110,0.5)'; g.fillRect(0, h * 0.82, w, h * 0.18);
    g.fillStyle = '#ffffff';
    for (let i = 0; i <= 3; i++) g.fillRect((i * (w - 10)) / 3, 0, 10, h);
    for (let j = 0; j <= 6; j++) g.fillRect(0, (j * (h - 10)) / 6, w, 10);
  });
}

function paintingTex() {
  const r = rand(11);
  return canvasTex(400, 500, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#f0d9a8'); gr.addColorStop(0.55, '#c88d5a'); gr.addColorStop(0.56, '#4f5b3a'); gr.addColorStop(1, '#2a3021');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(40,50,30,${0.4 + i * 0.12})`; g.beginPath(); g.moveTo(0, h * 0.56); for (let x = 0; x <= w; x += 20) g.lineTo(x, h * (0.5 + i * 0.05) - Math.sin(x / 60 + i) * 18 - r() * 8); g.lineTo(w, h); g.lineTo(0, h); g.fill(); }
    g.fillStyle = 'rgba(255,240,200,0.7)'; g.beginPath(); g.arc(w * 0.7, h * 0.3, 28, 0, Math.PI * 2); g.fill();
  });
}

function drape(width, height, mat) {
  const geo = new THREE.PlaneGeometry(width, height, 40, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 5.5) * 0.28 + Math.sin(p.getX(i) * 13) * 0.06);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

function flagCloth(tex) {
  const L = 6.5, Hh = 3.8, geo = new THREE.PlaneGeometry(L, Hh, 40, 12);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = (p.getX(i) + L / 2) / L;
    p.setY(i, p.getY(i) - u * u * 2.6);
    p.setZ(i, Math.sin(u * 9) * 0.35 * u);
  }
  geo.translate(L / 2, 0, 0); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, phys('#ffffff', 0.75, 0, { map: tex, side: THREE.DoubleSide, sheen: 0.6 }));
  m.castShadow = true;
  return m;
}

export async function buildOval() {
  const g = new THREE.Group();
  const white = std('#f7f2e6', 0.6), gold = phys('#c9a24a', 0.32, 0.85);
  // real photo-scanned materials (Poly Haven, CC0)
  const [parquet, cream, wainMat, mahogany, uph, leather] = await Promise.all([
    pbrMat('herringbone_parquet', { repeat: [14, 14], roughness: 0.8 }),
    pbrMat('painted_plaster_wall', { repeat: [30, 5], arm: false, color: '#f3e6c8', roughness: 0.92, normalScale: 0.6 }),
    pbrMat('painted_plaster_wall', { repeat: [30, 1], arm: false, color: '#fbf3e2', roughness: 0.65, normalScale: 0.4 }),
    pbrMat('rosewood_veneer1', { physical: true, repeat: [2, 2], color: '#b07a62', roughness: 0.6, clearcoat: 0.5, clearcoatRoughness: 0.35 }),
    pbrMat('quatrefoil_jacquard_fabric', { physical: true, repeat: [3, 3], color: '#f1dda4', roughness: 1, sheen: 0.7, sheenColor: '#fff2c4' }),
    pbrMat('brown_leather', { physical: true, repeat: [2, 2], color: '#5a3c2e', roughness: 0.75, clearcoat: 0.35 }),
  ]);

  // floor, carpet, walls, ceiling
  mesh(new THREE.PlaneGeometry(110, 110).rotateX(-Math.PI / 2), parquet, { y: FLOOR, cast: false, parent: g });
  const carpet = mesh(new THREE.CircleGeometry(1, 128).rotateX(-Math.PI / 2), std('#ffffff', 0.95, 0, { map: carpetTex() }), { y: FLOOR + 0.03, cast: false, parent: g });
  carpet.scale.set(33, 1, 26);
  const wall = mesh(new THREE.CylinderGeometry(1, 1, H, 160, 1, true), cream, { y: FLOOR + H / 2, cast: false, parent: g });
  cream.side = THREE.BackSide; wainMat.side = THREE.BackSide; wall.scale.set(RX, 1, RZ);
  const wains = mesh(new THREE.CylinderGeometry(1, 1, 8, 160, 1, true), wainMat, { y: FLOOR + 4, cast: false, parent: g });
  wains.scale.set(RX - 0.25, 1, RZ - 0.25);
  for (const [y, r] of [[FLOOR + 8, 0.35], [FLOOR + 0.5, 0.5], [FLOOR + H - 0.8, 1.0], [FLOOR + H - 2.4, 0.45]]) {
    mesh(new THREE.TubeGeometry(new Ellipse3(RX - 0.3, RZ - 0.3, y), 240, r, 8, true), white, { cast: false, parent: g });
  }
  const ceil = mesh(new THREE.CircleGeometry(1, 128).rotateX(Math.PI / 2), std('#fbf6ea', 0.9, 0, {
    map: canvasTex(512, 512, (c, w) => {
      c.fillStyle = '#fbf6ea'; c.fillRect(0, 0, w, w);
      c.strokeStyle = 'rgba(160,130,80,0.35)';
      for (const [r, lw] of [[240, 6], [150, 4], [70, 8], [40, 3]]) { c.lineWidth = lw; c.beginPath(); c.arc(w / 2, w / 2, r, 0, Math.PI * 2); c.stroke(); }
    }),
  }), { y: FLOOR + H, cast: false, parent: g });
  ceil.scale.set(RX, 1, RZ);

  // windows + drapes on the far (south) wall
  const winMat = new THREE.MeshBasicMaterial({ map: windowTex(), color: new THREE.Color(1.7, 1.7, 1.7) });
  const drapeMat = phys('#c49a3e', 0.42, 0.2, { side: THREE.DoubleSide, sheen: 1, sheenColor: '#ffe7a3' });
  for (const a of [-Math.PI / 2 - 0.36, -Math.PI / 2, -Math.PI / 2 + 0.36]) {
    const p = onWall(a, 0.985), ry = faceCenter(p);
    const holder = new THREE.Group(); holder.position.copy(p); holder.rotation.y = ry; g.add(holder);
    mesh(new THREE.PlaneGeometry(8.6, 20.4), white, { y: FLOOR + 19, z: -0.05, cast: false, parent: holder });
    mesh(new THREE.PlaneGeometry(7.4, 19), winMat, { y: FLOOR + 19, z: 0.02, cast: false, parent: holder });
    for (const s of [-1, 1]) { const d = drape(3.4, 24, drapeMat); d.position.set(s * 5.4, FLOOR + 17.5, 0.9); d.castShadow = true; holder.add(d); }
    mesh(new THREE.BoxGeometry(14.5, 2.6, 1.2), drapeMat, { y: FLOOR + 30, z: 0.9, parent: holder });
  }

  // doors east + west
  const doorMat = std('#fbf7ee', 0.5, 0, {
    map: canvasTex(256, 512, (c, w, h) => { c.fillStyle = '#fbf7ee'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(150,130,100,0.6)'; c.lineWidth = 6; for (const [x, y, ww, hh] of [[30, 30, 80, 200], [146, 30, 80, 200], [30, 270, 80, 210], [146, 270, 80, 210]]) c.strokeRect(x, y, ww, hh); }),
  });
  for (const a of [0.15, Math.PI - 0.15]) {
    const p = onWall(a, 0.985);
    const d = mesh(new THREE.BoxGeometry(7, 15, 0.4), doorMat, { x: p.x, y: FLOOR + 7.5, z: p.z, ry: faceCenter(p), cast: false, parent: g });
    mesh(new THREE.SphereGeometry(0.28, 16, 12), gold, { x: 2.8, y: 0, z: 0.3, parent: d });
  }

  // desk + chair
  const desk = new THREE.Group(); desk.position.set(0, FLOOR, -24); g.add(desk);
  mesh(new RoundedBoxGeometry(14, 5.3, 6.6, 3, 0.15), mahogany, { y: 2.65, parent: desk });
  mesh(new THREE.BoxGeometry(14.6, 0.35, 7.1), mahogany, { y: 5.45, parent: desk });
  mesh(new THREE.BoxGeometry(12.6, 0.06, 5.6), std('#22402c', 0.7), { y: 5.65, parent: desk });
  for (const x of [-4.6, 4.6]) mesh(new THREE.BoxGeometry(3.6, 3.6, 0.2), phys('#3a1b0e', 0.4), { x, y: 2.6, z: 3.35, parent: desk });
  mesh(new THREE.TorusGeometry(1.1, 0.12, 12, 40), gold, { y: 2.8, z: 3.38, parent: desk });
  mesh(new THREE.BoxGeometry(1.4, 0.9, 0.9), std('#1b1b1b', 0.4), { x: -4, y: 6.1, z: 1, parent: desk });
  mesh(new RoundedBoxGeometry(4.6, 1.2, 4.2, 3, 0.4), leather, { y: 3, z: -5.5, parent: desk });
  mesh(new RoundedBoxGeometry(4.8, 7, 1, 3, 0.4), leather, { y: 6.6, z: -7.4, parent: desk });

  // flags
  const flags = [];
  for (const [x, tex] of [[-10, usFlag()], [10, navyFlag()]]) {
    const pole = new THREE.Group(); pole.position.set(x, FLOOR, -28); g.add(pole);
    mesh(new THREE.CylinderGeometry(0.16, 0.16, 20, 12), gold, { y: 10, parent: pole });
    mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.6, 20), gold, { y: 0.3, parent: pole });
    mesh(new THREE.SphereGeometry(0.45, 16, 12), gold, { y: 20.3, parent: pole });
    mesh(new THREE.ConeGeometry(0.3, 1.2, 12), gold, { y: 21.2, parent: pole });
    const f = flagCloth(tex); f.position.y = 17.5; f.rotation.y = x < 0 ? 0.9 : Math.PI - 0.9; pole.add(f);
    flags.push(f);
  }

  // fireplace + painting (behind the white player)
  const fp = new THREE.Group(); fp.position.copy(onWall(Math.PI / 2, 0.97)); fp.position.y = FLOOR; fp.rotation.y = Math.PI; g.add(fp);
  const marble = phys('#f2efe8', 0.25, 0, { clearcoat: 0.6 });
  mesh(new THREE.BoxGeometry(13, 1, 2.6), marble, { y: 9.5, parent: fp });
  for (const x of [-5.3, 5.3]) mesh(new THREE.BoxGeometry(2.2, 9, 1.8), marble, { x, y: 4.5, parent: fp });
  mesh(new THREE.BoxGeometry(8.4, 7, 0.3), std('#120c08', 0.9), { y: 3.6, z: -0.6, parent: fp });
  const fireMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 0.3), transparent: true, opacity: 0.85 });
  const fire = mesh(new THREE.PlaneGeometry(5, 2.6), fireMat, { y: 1.6, z: -0.3, cast: false, parent: fp });
  const fireLight = new THREE.PointLight('#ff8a3a', 60, 40, 1.6); fireLight.position.set(0, 2.5, 2); fp.add(fireLight);
  mesh(new THREE.BoxGeometry(8.4, 10.4, 0.5), gold, { y: 18, z: 0.2, parent: fp });
  mesh(new THREE.PlaneGeometry(7.4, 9.4), std('#ffffff', 0.8, 0, { map: paintingTex() }), { y: 18, z: 0.48, cast: false, parent: fp });

  // sofas + coffee table
  for (const s of [-1, 1]) {
    const so = new THREE.Group(); so.position.set(s * 11, FLOOR, 0); g.add(so);
    mesh(new RoundedBoxGeometry(5, 2.4, 15, 3, 0.4), uph, { y: 1.8, parent: so });
    mesh(new RoundedBoxGeometry(1.5, 4.4, 15, 3, 0.5), uph, { x: s * 2.6, y: 3.5, parent: so });
    for (const z of [-7.4, 7.4]) mesh(new RoundedBoxGeometry(5.2, 3.6, 1.2, 3, 0.45), uph, { y: 2.3, z, parent: so });
  }
  const tableTop = new RoundedBoxGeometry(14.2, 0.55, 11.6, 3, 0.15);
  mesh(tableTop, mahogany, { y: -0.32 - 0.275, parent: g });
  mesh(new THREE.BoxGeometry(13.2, 0.9, 10.6), mahogany, { y: -1.2, parent: g });
  for (const [x, z] of [[-6.3, -5], [6.3, -5], [-6.3, 5], [6.3, 5]]) mesh(new THREE.CylinderGeometry(0.35, 0.2, 3.3, 14), mahogany, { x, y: FLOOR + 1.65, z, parent: g });

  // lights
  g.add(new THREE.HemisphereLight('#fff3df', '#4a3a2a', 0.9));
  const key = keyLight('#fff0d4', 2.2, new THREE.Vector3(-9, 28, -20));
  g.add(key, key.target);
  const fill = new THREE.DirectionalLight('#cfe0ff', 0.45); fill.position.set(12, 16, 18); g.add(fill);

  return {
    group: g,
    background: new THREE.Color('#2a2118'),
    exposure: 1.05,
    board: { style: 'wood', light: '#dcbc8c', dark: '#6a3d20', lightVein: '#8a6a40', darkVein: '#2a140a', border: '#3d1d0f', borderStyle: 'wood', borderVein: '#120804', trim: '#d1ad57', letters: '#f2d690', frame: '#9c6a55', roughness: 0.32, clearcoat: 0.9, seed: 21,
      lightTex: 'white_maple_veneer', darkTex: 'black_walnut_veneer_01', borderTex: 'rosewood_veneer1', borderTint: '#9c6a55', darkTint: '#7a5844', normalScale: 0.45, crop: 0.28 },
    pieces: {
      white: { tex: 'white', color: '#fff7ea', roughness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.15, sheen: 0.2, sheenColor: '#fff8e6' },
      black: { tex: 'black', color: '#ffffff', roughness: 0.5, clearcoat: 0.8, clearcoatRoughness: 0.1 },
    },
    update(t) {
      fireLight.intensity = 50 + Math.sin(t * 13) * 8 + Math.sin(t * 7.3) * 6;
      fire.scale.y = 1 + Math.sin(t * 9) * 0.08;
      flags.forEach((f, i) => { f.rotation.z = Math.sin(t * 0.7 + i) * 0.015; });
    },
  };
}
