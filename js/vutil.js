// Shared helpers for building venues procedurally.
import * as THREE from 'three';

export function canvasTex(w, h, draw, { repeat = null, srgb = true, aniso = 8 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

export function rand(seed = 1) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const std = (color, roughness = 0.6, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
export const phys = (color, roughness = 0.4, metalness = 0, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness, metalness, ...extra });

export function mesh(geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true, receive = true, parent = null } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = cast; m.receiveShadow = receive;
  if (parent) parent.add(m);
  return m;
}

// Key light that shadows the board area nicely.
export function keyLight(color, intensity, pos, size = 9) {
  const l = new THREE.DirectionalLight(color, intensity);
  l.position.copy(pos);
  l.castShadow = true;
  Object.assign(l.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: pos.length() * 2 + 40 });
  l.shadow.bias = -0.0004;
  l.shadow.normalBias = 0.02;
  l.target.position.set(0, 0, 0);
  return l;
}

// Equirect gradient sky usable as scene.background (also lights the reflections).
export function gradientSky(stops) {
  const t = canvasTex(16, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    for (const [k, c] of stops) gr.addColorStop(k, c);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

export function softDot(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 64) {
  return canvasTex(size, size, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}

export function cloudTex(seed = 3) {
  const r = rand(seed);
  return canvasTex(256, 128, (g, w, h) => {
    for (let i = 0; i < 70; i++) {
      const x = w * (0.15 + r() * 0.7), y = h * (0.35 + r() * 0.4), rad = 12 + r() * 34;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  });
}

// Wood planks / grain texture.
export function woodTex(base, grain, { w = 512, h = 512, planks = 6, seed = 5, repeat = [1, 1], vertical = false } = {}) {
  const r = rand(seed);
  return canvasTex(w, h, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const ph = h / planks;
    for (let p = 0; p < planks; p++) {
      g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${0.03 + r() * 0.06})`;
      g.fillRect(0, p * ph, w, ph);
      for (let i = 0; i < 18; i++) {
        g.strokeStyle = grain; g.globalAlpha = 0.05 + r() * 0.15; g.lineWidth = 0.5 + r() * 2;
        const y0 = p * ph + r() * ph; g.beginPath();
        for (let x = 0; x <= w; x += 16) { const y = y0 + Math.sin(x / 50 + i) * 2; x ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      }
      g.globalAlpha = 0.5; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, p * ph, w, 2);
      g.fillRect(((p * 0.37) % 1) * w, p * ph, 2, ph);
      g.globalAlpha = 1;
    }
  }, { repeat });
}
