// Venue: the torch balcony high above the harbor at sunset.
import * as THREE from 'three';
import { canvasTex, std, phys, mesh, keyLight, gradientSky, softDot, cloudTex, rand } from './vutil.js';

// The flame stands to the side of the board so neither player's camera is inside it.
const BALC = -3.9, F = new THREE.Vector3(-15, 0, 0), RAIL_R = 24, WATER = -150;

// A twisted, lobed, pointed flame (lathe + per-vertex twist and ripples).
function flameGeometry(scale = 1, lobes = 5, seed = 0) {
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const k = i / 40;
    const r = 3.9 * Math.pow(Math.sin(Math.min(1, k * 1.25) * Math.PI * 0.5 + 0.25), 1.2) * Math.pow(1 - k, 0.85);
    pts.push(new THREE.Vector2(Math.max(0.001, r), k * 15));
  }
  const g = new THREE.LatheGeometry(pts, 72);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = y / 15;
    const rad = Math.hypot(x, z), th = Math.atan2(z, x);
    const rr = rad * (1 + 0.3 * Math.sin(lobes * th + k * 7 + seed) * Math.min(1, k * 2.5));
    const t2 = th + k * 1.4 + Math.sin(k * 5 + seed) * 0.2;
    p.setXYZ(i, Math.cos(t2) * rr + Math.sin(k * 4 + seed) * k * 0.8, y, Math.sin(t2) * rr);
  }
  g.computeVertexNormals();
  g.scale(scale, scale, scale);
  return g;
}

function windowsTex(r) {
  return canvasTex(128, 256, (c, w, h) => {
    c.fillStyle = '#000000'; c.fillRect(0, 0, w, h);
    for (let y = 4; y < h; y += 8) for (let x = 4; x < w; x += 8) {
      if (r() < 0.32) { const v = 150 + r() * 105; c.fillStyle = `rgb(${v},${v * 0.82},${v * 0.5})`; c.fillRect(x, y, 4, 5); }
    }
  });
}

function waterNormals(r) {
  const t = canvasTex(256, 256, (c, w) => {
    const img = c.createImageData(w, w), d = img.data;
    const waves = Array.from({ length: 10 }, () => ({ kx: Math.round((r() - 0.5) * 16), ky: Math.round((r() - 0.5) * 16), p: r() * 6, a: 0.3 + r() * 0.7 }));
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
      let dx = 0, dy = 0;
      for (const q of waves) { const ph = ((q.kx * x + q.ky * y) / w) * Math.PI * 2 + q.p, cs = Math.cos(ph) * q.a; dx += cs * q.kx; dy += cs * q.ky; }
      const i = (y * w + x) * 4;
      d[i] = 128 + dx * 2.2; d[i + 1] = 128 + dy * 2.2; d[i + 2] = 255; d[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }, { srgb: false, repeat: [60, 60] });
  return t;
}

export function buildLiberty() {
  const g = new THREE.Group(), r = rand(1886);
  const patina = std('#4f9580', 0.62, 0.35, {
    map: canvasTex(256, 256, (c, w) => {
      c.fillStyle = '#5aa18a'; c.fillRect(0, 0, w, w);
      for (let i = 0; i < 1600; i++) { const v = r(); c.fillStyle = v > 0.5 ? `rgba(40,90,75,${r() * 0.35})` : `rgba(150,210,190,${r() * 0.3})`; c.fillRect(r() * w, r() * w, 2 + r() * 8, 2 + r() * 8); }
      c.strokeStyle = 'rgba(30,70,60,0.5)'; c.lineWidth = 2; for (let x = 0; x <= w; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, w); c.stroke(); c.beginPath(); c.moveTo(0, x); c.lineTo(w, x); c.stroke(); }
    }, { repeat: [6, 6] }),
  });
  const gold = phys('#f0c35c', 0.22, 1, { emissive: '#ff9d2e', emissiveIntensity: 0.55, clearcoat: 0.5 });

  // balcony floor, torch cup and arm
  mesh(new THREE.CylinderGeometry(RAIL_R + 0.8, RAIL_R + 0.8, 1, 120), patina, { x: F.x, y: BALC - 0.5, z: F.z, parent: g });
  mesh(new THREE.CylinderGeometry(RAIL_R + 0.6, 9, 14, 64, 1, true), patina, { x: F.x, y: BALC - 8, z: F.z, cast: false, parent: g });
  for (let i = 0; i < 3; i++) mesh(new THREE.TorusGeometry(RAIL_R + 0.4 - i * 3.6, 0.6, 10, 80), patina, { x: F.x, y: BALC - 1.6 - i * 4.4, z: F.z, rx: Math.PI / 2, parent: g });
  mesh(new THREE.CylinderGeometry(7, 9, 90, 40), patina, { x: F.x - 8, y: BALC - 58, z: F.z + 4, rz: -0.22, rx: 0.1, cast: false, parent: g });

  // railing
  for (const y of [BALC + 3.3, BALC + 1.7]) mesh(new THREE.TorusGeometry(RAIL_R, y > BALC + 3 ? 0.22 : 0.14, 10, 160), patina, { x: F.x, y, z: F.z, rx: Math.PI / 2, parent: g });
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.3, 8), patina, { x: F.x + Math.cos(a) * RAIL_R, y: BALC + 1.65, z: F.z + Math.sin(a) * RAIL_R, parent: g });
  }

  // the golden flame
  mesh(new THREE.CylinderGeometry(3.4, 4.2, 3, 40), patina, { x: F.x, y: BALC + 1.5, z: F.z, parent: g });
  const flame = new THREE.Group(); flame.position.set(F.x, BALC + 2.6, F.z); g.add(flame);
  mesh(flameGeometry(0.85, 5, 0), gold, { parent: flame });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3, s = 0.38 + r() * 0.16;
    mesh(flameGeometry(s, 4, i * 1.7), gold, { x: Math.cos(a) * 1.9, y: 0.4, z: Math.sin(a) * 1.9, rx: Math.sin(a) * 0.3, rz: -Math.cos(a) * 0.3, parent: flame });
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot('rgba(255,200,110,0.9)', 'rgba(255,140,40,0)', 128), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
  glow.scale.set(26, 30, 1); glow.position.set(0, 8, 0); flame.add(glow);
  const flameLight = new THREE.PointLight('#ffb24a', 70, 40, 1.5); flameLight.position.set(0, 9, 0); flame.add(flameLight);

  // pedestal table for the board
  const granite = std('#77716a', 0.55, 0, {
    map: canvasTex(256, 256, (c, w) => { c.fillStyle = '#8a847c'; c.fillRect(0, 0, w, w); for (let i = 0; i < 5000; i++) { const v = 60 + r() * 140; c.fillStyle = `rgba(${v},${v - 5},${v - 12},0.7)`; c.fillRect(r() * w, r() * w, 1.5, 1.5); } }, { repeat: [3, 3] }),
  });
  mesh(new THREE.BoxGeometry(14.2, 0.6, 11.6), granite, { y: -0.62, parent: g });
  mesh(new THREE.BoxGeometry(13.4, 0.5, 10.8), granite, { y: -1.15, parent: g });
  mesh(new THREE.CylinderGeometry(2.4, 3.6, 2.6, 32), granite, { y: BALC + 1.3, parent: g });

  // sky, sun, water, clouds, skyline
  const background = gradientSky([[0, '#0d1f42'], [0.28, '#2c5793'], [0.43, '#e79a62'], [0.5, '#ffd08d'], [0.515, '#c27d63'], [0.7, '#33465e'], [1, '#1e2a3a']]);
  const sunDir = new THREE.Vector3(0.75, 0.16, -0.64).normalize();
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot('rgba(255,236,190,1)', 'rgba(255,160,80,0)', 128), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sunSprite.position.copy(sunDir).multiplyScalar(500); sunSprite.scale.set(160, 160, 1); g.add(sunSprite);
  const key = keyLight('#ffc187', 3.2, sunDir.clone().multiplyScalar(45), 10);
  g.add(key, key.target);
  g.add(new THREE.HemisphereLight('#ffd9b5', '#38506a', 1.0));
  const rim = new THREE.DirectionalLight('#7fa6ff', 0.5); rim.position.set(20, 10, 25); g.add(rim);

  const waterMat = phys('#1d3c58', 0.12, 0.1, { normalMap: waterNormals(r), normalScale: new THREE.Vector2(0.6, 0.6), clearcoat: 1, clearcoatRoughness: 0.05 });
  const water = mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), waterMat, { y: WATER, cast: false, receive: false, parent: g });

  const cloudMat = new THREE.SpriteMaterial({ map: cloudTex(7), color: '#ffd7b8', transparent: true, depthWrite: false, opacity: 0.85 });
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(cloudMat); const a = r() * Math.PI * 2, d = 260 + r() * 220;
    s.position.set(Math.cos(a) * d, -70 + r() * 150, Math.sin(a) * d); s.scale.set(140 + r() * 120, 60 + r() * 40, 1);
    s.userData = { a, d, sp: 0.003 + r() * 0.004 }; g.add(s); clouds.push(s);
  }

  const B = 90, bld = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std('#232838', 0.8, 0.2, { emissive: '#ffffff', emissiveMap: windowsTex(r), emissiveIntensity: 1.4 }), B);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < B; i++) {
    const a = -2.35 + (i / B) * 1.25 + (r() - 0.5) * 0.02, d = 380 + r() * 90, h = 25 + Math.pow(r(), 2) * 120 + (i % 23 === 0 ? 70 : 0);
    dummy.position.set(Math.cos(a) * d, WATER + h / 2, Math.sin(a) * d); dummy.scale.set(8 + r() * 12, h, 8 + r() * 12); dummy.rotation.y = r();
    dummy.updateMatrix(); bld.setMatrixAt(i, dummy.matrix);
  }
  g.add(bld);
  mesh(new THREE.CylinderGeometry(60, 70, 8, 40), std('#3c4a3a', 0.9), { x: 40, y: WATER + 2, z: 120, cast: false, receive: false, parent: g });

  // seagulls
  const gullMat = std('#f4f1ea', 0.7, 0, { side: THREE.DoubleSide });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.35, 0, 0, 0.35, 1.8, 0.1, 0.1, 1.8, 0.1, 0.1, 0, 0, 0.35, 0.9, 0, 0.5], 3));
  wingGeo.computeVertexNormals();
  const gulls = [];
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Group();
    b.add(mesh(new THREE.CapsuleGeometry(0.22, 1.1, 4, 8).rotateX(Math.PI / 2), gullMat, { cast: false }));
    const L = mesh(wingGeo, gullMat, { cast: false }), Rw = mesh(wingGeo, gullMat, { cast: false });
    Rw.scale.x = -1; b.add(L, Rw);
    b.userData = { L, R: Rw, rad: 32 + r() * 22, h: 10 + r() * 14, sp: 0.14 + r() * 0.08, off: r() * 6 };
    g.add(b); gulls.push(b);
  }

  return {
    group: g,
    background,
    fog: new THREE.Fog('#d9a27a', 160, 720),
    exposure: 1.0,
    board: { style: 'marble', light: '#e6e0d4', dark: '#3a3b40', lightVein: '#9a958a', darkVein: '#121216', border: '#4f8f7c', borderStyle: 'metal', trim: '#e6b552', letters: '#f8db93', frame: '#3f7f6c', frameMetal: 0.5, frameRough: 0.45, roughness: 0.4, clearcoat: 0.45, seed: 1776 },
    pieces: {
      white: { color: '#f2c45a', roughness: 0.2, metalness: 1, clearcoat: 0.4, envIntensity: 1.2 },
      black: { color: '#3f8f79', roughness: 0.5, metalness: 0.45, clearcoat: 0.25, envIntensity: 1.1 },
    },
    update(t, dt) {
      flameLight.intensity = 65 + Math.sin(t * 2.3) * 8;
      glow.material.opacity = 0.5 + Math.sin(t * 1.7) * 0.08;
      waterMat.normalMap.offset.set(t * 0.004, t * 0.002);
      for (const c of clouds) { c.userData.a += c.userData.sp * dt; c.position.x = Math.cos(c.userData.a) * c.userData.d; c.position.z = Math.sin(c.userData.a) * c.userData.d; }
      for (const b of gulls) {
        const u = b.userData, a = t * u.sp + u.off;
        b.position.set(F.x + Math.cos(a) * u.rad, u.h + Math.sin(t * 0.7 + u.off) * 1.5, F.z + Math.sin(a) * u.rad);
        b.rotation.y = -a; b.rotation.z = -0.25;
        const f = Math.sin(t * 7 + u.off) * 0.5; u.L.rotation.z = f; u.R.rotation.z = -f;
      }
    },
  };
}
