// Venue: on the deck of a sunken ocean liner, deep underwater.
import * as THREE from 'three';
import { canvasTex, std, phys, mesh, woodTex, softDot, rand } from './vutil.js';

const DECK = -4.4;

// Precomputed looping caustic frames, projected by the sun spotlight.
function causticFrames(n = 24, size = 192) {
  const frames = [];
  for (let f = 0; f < n; f++) {
    const t = (f / n) * Math.PI * 2;
    frames.push(canvasTex(size, size, (g, w, h) => {
      const img = g.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const px = (x / w) * Math.PI * 4, py = (y / h) * Math.PI * 4;
        let ix = px, iy = py, c = 1;
        for (let i = 0; i < 4; i++) {
          const tt = t * (1 - 3.5 / (i + 1));
          ix = px + Math.cos(tt - ix) + Math.sin(tt + iy);
          iy = py + Math.sin(tt - iy) + Math.cos(tt + ix);
          c += 1 / Math.hypot(px / (Math.sin(ix + tt) / 0.005), py / (Math.cos(iy + tt) / 0.005));
        }
        c /= 4;
        let v = 1.17 - Math.pow(c, 1.4);
        v = Math.pow(Math.abs(v), 7);
        const k = Math.min(255, 40 + v * 255);
        const i4 = (y * w + x) * 4; d[i4] = k * 0.8; d[i4 + 1] = k; d[i4 + 2] = k; d[i4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }));
  }
  return frames;
}

function godRayMat() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uOpacity: { value: 0.18 }, uColor: { value: new THREE.Color('#9fe6ff') } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform float uOpacity; uniform vec3 uColor; void main(){ float edge = sin(vUv.x*3.14159); float fade = smoothstep(0.0,0.6,vUv.y); gl_FragColor = vec4(uColor, uOpacity*edge*edge*fade); }',
  });
}

function fishGeometry() {
  const body = new THREE.SphereGeometry(0.5, 12, 8); body.scale(1.4, 0.55, 0.3);
  const tail = new THREE.ConeGeometry(0.35, 0.6, 4); tail.rotateZ(Math.PI / 2); tail.scale(1, 1, 0.25); tail.translate(-0.85, 0, 0);
  const merged = [body.toNonIndexed(), tail.toNonIndexed()];
  const geo = new THREE.BufferGeometry();
  const pos = [], nor = [];
  for (const m of merged) { pos.push(...m.attributes.position.array); nor.push(...m.attributes.normal.array); }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return geo;
}

export function buildTitanic() {
  const g = new THREE.Group(), r = rand(42);
  const rust = std('#4f3526', 0.85, 0.35), rustDark = std('#2c211b', 0.9, 0.3), algae = std('#3c5a43', 0.95, 0.1);
  const hullMat = std('#1f1d1b', 0.8, 0.4, {
    map: canvasTex(512, 256, (c, w, h) => {
      c.fillStyle = '#25211d'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${120 + r() * 60},${60 + r() * 30},${30},${r() * 0.25})`; c.fillRect(r() * w, r() * h, 2 + r() * 14, 2 + r() * 40); }
      c.fillStyle = 'rgba(160,140,110,0.5)'; c.fillRect(0, h * 0.18, w, 6);
    }, { repeat: [4, 1] }),
  });

  // sea floor with dunes
  const floorGeo = new THREE.PlaneGeometry(320, 320, 120, 120).rotateX(-Math.PI / 2);
  const fp = floorGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), z = fp.getZ(i); fp.setY(i, Math.sin(x * 0.05) * 1.2 + Math.cos(z * 0.07 + x * 0.02) * 1.5 + Math.sin(x * 0.21 + z * 0.17) * 0.3); }
  floorGeo.computeVertexNormals();
  const sand = canvasTex(256, 256, (c, w) => { c.fillStyle = '#8a8466'; c.fillRect(0, 0, w, w); for (let i = 0; i < 3000; i++) { const v = 100 + r() * 80; c.fillStyle = `rgba(${v},${v - 6},${v - 30},0.5)`; c.fillRect(r() * w, r() * w, 1.5, 1.5); } }, { repeat: [40, 40] });
  mesh(floorGeo, std('#ffffff', 1, 0, { map: sand }), { y: DECK - 9, cast: false, parent: g });

  // deck and the old table under the board
  const deckTex = woodTex('#5b5546', '#1f2420', { planks: 10, repeat: [6, 4], seed: 9 });
  const deck = new THREE.Group(); deck.rotation.z = 0.025; deck.rotation.x = -0.012; g.add(deck);
  mesh(new THREE.BoxGeometry(70, 1, 44), std('#ffffff', 0.95, 0, { map: deckTex }), { y: DECK - 0.5, cast: false, parent: deck });
  mesh(new THREE.BoxGeometry(70, 8, 44), hullMat, { y: DECK - 5.2, cast: false, parent: deck });
  const tableWood = phys('#3b2a1d', 0.6, 0, { clearcoat: 0.3 });
  mesh(new THREE.BoxGeometry(14.2, 0.6, 11.6), tableWood, { y: -0.62, parent: g });
  mesh(new THREE.BoxGeometry(13.4, 0.8, 10.8), tableWood, { y: -1.2, parent: g });
  for (const [x, z] of [[-6.2, -4.9], [6.2, -4.9], [-6.2, 4.9], [6.2, 4.9]]) mesh(new THREE.CylinderGeometry(0.4, 0.3, 3.6, 12), tableWood, { x, y: DECK + 1.8, z, parent: g });
  for (let i = 0; i < 30; i++) {
    const b = mesh(new THREE.SphereGeometry(0.08 + r() * 0.16, 8, 6), algae, { x: (r() - 0.5) * 13.6, y: -0.6, z: (r() > 0.5 ? 1 : -1) * (5.55 + r() * 0.2), parent: g });
    b.scale.y = 0.45;
  }

  // railings along both sides
  for (const z of [-21, 21]) {
    mesh(new THREE.CylinderGeometry(0.18, 0.18, 70, 10).rotateZ(Math.PI / 2), rust, { y: DECK + 3.6, z, parent: g });
    mesh(new THREE.CylinderGeometry(0.12, 0.12, 70, 8).rotateZ(Math.PI / 2), rust, { y: DECK + 1.8, z, parent: g });
    for (let x = -34; x <= 34; x += 3) mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.6, 8), rust, { x, y: DECK + 1.8, z, rz: (r() - 0.5) * 0.15, parent: g });
  }

  // superstructure with portholes, funnel, mast
  const port = canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = '#d8d0bd'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${90 + r() * 50},${50 + r() * 20},20,${r() * 0.35})`; c.fillRect(r() * w, r() * h, 2 + r() * 6, 4 + r() * 30); }
    for (let x = 32; x < w; x += 64) { c.fillStyle = '#7a5a2e'; c.beginPath(); c.arc(x, h / 2, 16, 0, Math.PI * 2); c.fill(); c.fillStyle = '#0a1418'; c.beginPath(); c.arc(x, h / 2, 11, 0, Math.PI * 2); c.fill(); }
  }, { repeat: [5, 1] });
  mesh(new THREE.BoxGeometry(46, 9, 10), std('#ffffff', 0.85, 0.2, { map: port }), { x: -2, y: DECK + 4.5, z: -30, parent: g });
  mesh(new THREE.BoxGeometry(36, 6, 8), std('#ffffff', 0.85, 0.2, { map: port }), { x: -4, y: DECK + 12, z: -30, parent: g });
  const funnelMat = std('#3d2b1f', 0.8, 0.4, { map: canvasTex(64, 256, (c, w, h) => { c.fillStyle = '#5a3a22'; c.fillRect(0, 0, w, h); c.fillStyle = '#141414'; c.fillRect(0, 0, w, h * 0.22); for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(30,20,10,${r() * 0.4})`; c.fillRect(r() * w, r() * h, 2, 10 + r() * 30); } }) });
  mesh(new THREE.CylinderGeometry(3.2, 3.4, 22, 28), funnelMat, { x: 8, y: DECK + 22, z: -31, rz: 0.12, parent: g });
  mesh(new THREE.CylinderGeometry(3, 3.2, 22, 28), funnelMat, { x: -16, y: DECK + 21, z: -32, rz: 0.12, parent: g });
  mesh(new THREE.CylinderGeometry(0.35, 0.5, 40, 10), rustDark, { x: 30, y: DECK + 18, z: -12, rz: -0.35, parent: g });
  mesh(new THREE.BoxGeometry(14, 3, 3), rustDark, { x: -26, y: DECK + 1.5, z: 12, ry: 0.4, parent: g });
  mesh(new THREE.CylinderGeometry(1.4, 1.8, 2.5, 18), rust, { x: 18, y: DECK + 1.25, z: 10, parent: g });
  mesh(new THREE.TorusGeometry(2.6, 0.35, 10, 28), rust, { x: -22, y: DECK + 0.4, z: -10, rx: Math.PI / 2, parent: g });

  // light: sun from above with dancing caustics, cool fill
  g.add(new THREE.HemisphereLight('#3a9ccc', '#04121a', 0.65));
  const frames = causticFrames();
  const sun = new THREE.SpotLight('#bff2ff', 420, 120, 0.62, 0.6, 1.2);
  sun.position.set(4, 42, 6); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 80;
  sun.map = frames[0];
  g.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#2a7fae', 0.6); fill.position.set(-10, 5, 15); g.add(fill);

  // god rays
  const rays = [];
  for (let i = 0; i < 9; i++) {
    const m = mesh(new THREE.CylinderGeometry(0.4 + r() * 0.8, 2.5 + r() * 3, 70, 16, 1, true), godRayMat(), { x: (r() - 0.5) * 40, y: 26, z: (r() - 0.5) * 30 - 4, rz: (r() - 0.5) * 0.3, rx: (r() - 0.5) * 0.3, cast: false, receive: false, parent: g });
    m.userData.phase = r() * 10; rays.push(m);
  }

  // marine snow + bubbles
  const N = 1400, snowPos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { snowPos[i * 3] = (r() - 0.5) * 80; snowPos[i * 3 + 1] = DECK + r() * 40; snowPos[i * 3 + 2] = (r() - 0.5) * 80; }
  const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ size: 0.16, map: softDot(), transparent: true, opacity: 0.55, depthWrite: false, color: '#cfefff' }));
  g.add(snow);
  const B = 140, bubPos = new Float32Array(B * 3), bubSeed = [];
  const vents = [[-7.5, 6], [8, -8], [-14, -4], [12, 9]];
  for (let i = 0; i < B; i++) { const v = vents[i % vents.length]; bubSeed.push({ v, sp: 1.5 + r() * 2.5, ph: r() * 10 }); bubPos[i * 3] = v[0]; bubPos[i * 3 + 1] = DECK + r() * 30; bubPos[i * 3 + 2] = v[1]; }
  const bubGeo = new THREE.BufferGeometry(); bubGeo.setAttribute('position', new THREE.BufferAttribute(bubPos, 3));
  const bubbles = new THREE.Points(bubGeo, new THREE.PointsMaterial({ size: 0.35, map: softDot('rgba(255,255,255,0.1)', 'rgba(220,250,255,0.9)'), transparent: true, depthWrite: false, opacity: 0.8 }));
  bubbles.material.map = canvasTex(64, 64, (c, w) => { c.strokeStyle = 'rgba(230,250,255,0.95)'; c.lineWidth = 4; c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 4, 0, Math.PI * 2); c.stroke(); c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(w * 0.38, w * 0.36, 5, 0, Math.PI * 2); c.fill(); });
  g.add(bubbles);

  // a school of fish + glowing jellyfish
  const F = 40, fish = new THREE.InstancedMesh(fishGeometry(), std('#9db8c8', 0.35, 0.6), F);
  fish.castShadow = true; g.add(fish);
  const fishData = Array.from({ length: F }, () => ({ rad: 18 + r() * 8, h: 3 + r() * 9, off: r() * 0.9, sp: 0.12 + r() * 0.03, wob: r() * 6 }));
  const dummy = new THREE.Object3D();
  const jellies = [];
  for (let i = 0; i < 4; i++) {
    const j = new THREE.Group();
    const bell = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#ffb3e6', emissive: '#ff6fd0', emissiveIntensity: 1.2, transparent: true, opacity: 0.55, roughness: 0.2, transmission: 0, side: THREE.DoubleSide }));
    j.add(bell);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; const ten = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.01, 3, 4), bell.material); ten.position.set(Math.cos(a) * 0.6, -1.5, Math.sin(a) * 0.6); j.add(ten); }
    j.position.set((r() - 0.5) * 50, 8 + r() * 12, -14 - r() * 20); j.userData.ph = r() * 6;
    g.add(j); jellies.push(j);
  }

  let fi = 0, acc = 0;
  return {
    group: g,
    background: new THREE.Color('#032033'),
    fog: new THREE.FogExp2('#05304a', 0.026),
    exposure: 1.0,
    board: { style: 'marble', light: '#a9b9ab', dark: '#203a3a', lightVein: '#5f7c74', darkVein: '#0f2323', border: '#3e3022', borderStyle: 'wood', borderVein: '#0c0804', trim: '#b38d55', letters: '#dcbf86', frame: '#2d2218', frameMetal: 0.2, roughness: 0.35, clearcoat: 0.6, seed: 77 },
    pieces: {
      white: { color: '#eef4ee', roughness: 0.18, clearcoat: 1, sheen: 1, sheenColor: '#a6e8ff', envIntensity: 1.3 },
      black: { color: '#2f5c4f', roughness: 0.38, metalness: 0.75, clearcoat: 0.3, envIntensity: 1.4 },
    },
    update(t, dt) {
      acc += dt; if (acc > 0.07) { acc = 0; fi = (fi + 1) % frames.length; sun.map = frames[fi]; }
      sun.position.x = 4 + Math.sin(t * 0.3) * 2;
      for (const m of rays) m.material.uniforms.uOpacity.value = 0.1 + Math.sin(t * 0.5 + m.userData.phase) * 0.06;
      const sp = snowGeo.attributes.position;
      for (let i = 0; i < N; i++) { let y = sp.getY(i) - dt * 0.25; if (y < DECK) y += 40; sp.setY(i, y); sp.setX(i, sp.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.1); }
      sp.needsUpdate = true;
      const bp = bubGeo.attributes.position;
      for (let i = 0; i < B; i++) { const s = bubSeed[i]; let y = bp.getY(i) + dt * s.sp; if (y > DECK + 30) y = DECK; bp.setY(i, y); bp.setX(i, s.v[0] + Math.sin(t * 3 + s.ph) * 0.2); bp.setZ(i, s.v[1] + Math.cos(t * 2.5 + s.ph) * 0.2); }
      bp.needsUpdate = true;
      fishData.forEach((f, i) => {
        const a = t * f.sp + f.off;
        dummy.position.set(Math.cos(a) * f.rad, f.h + Math.sin(t + f.wob) * 0.6, Math.sin(a) * f.rad - 4);
        dummy.rotation.set(0, -a - Math.PI / 2, Math.sin(t * 8 + f.wob) * 0.12);
        dummy.updateMatrix(); fish.setMatrixAt(i, dummy.matrix);
      });
      fish.instanceMatrix.needsUpdate = true;
      for (const j of jellies) { const p = Math.sin(t * 1.6 + j.userData.ph); j.scale.set(1 + p * 0.12, 1 - p * 0.15, 1 + p * 0.12); j.position.y += Math.max(0, p) * dt * 0.6 - dt * 0.18; if (j.position.y < 4) j.position.y = 22; }
    },
  };
}
