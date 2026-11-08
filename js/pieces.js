// Procedural Staunton-style chess pieces (no model files needed).
// One square = 1 world unit. Every piece stands on y = 0; knights face +x.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x, y) => new THREE.Vector2(x, y);

function arc(pts, cx, cy, rx, ry, a0, a1, n = 14) {
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

const BASE = [[0, 0], [0.36, 0], [0.375, 0.015], [0.375, 0.07], [0.355, 0.09], [0.31, 0.1], [0.31, 0.125], [0.285, 0.14]];

function lathe(pts, segs = 48) {
  const g = new THREE.LatheGeometry(pts.map(([x, y]) => V(Math.max(0, x), y)), segs);
  return g;
}

function box(w, h, d, x, y, z, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

function sphere(r, x, y, z) {
  const g = new THREE.SphereGeometry(r, 20, 14);
  g.translate(x, y, z);
  return g;
}

function merge(list) {
  const geos = list.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    // keep only the attributes every geometry shares
    for (const k of Object.keys(ng.attributes)) if (!['position', 'normal', 'uv'].includes(k)) ng.deleteAttribute(k);
    return ng;
  });
  const m = mergeGeometries(geos, false);
  m.computeBoundingBox();
  return m;
}

function pawn() {
  const p = [...BASE, [0.25, 0.17], [0.2, 0.22], [0.16, 0.3], [0.13, 0.4], [0.115, 0.47], [0.18, 0.49], [0.19, 0.51], [0.18, 0.53], [0.12, 0.545]];
  arc(p, 0, 0.66, 0.135, 0.135, -1.0, Math.PI / 2, 16);
  const g = merge([lathe(p)]);
  g.scale(0.92, 0.92, 0.92);
  return g;
}

function rook() {
  const p = [...BASE, [0.26, 0.18], [0.23, 0.24], [0.21, 0.4], [0.2, 0.58], [0.21, 0.64], [0.27, 0.68], [0.28, 0.7], [0.25, 0.72], [0.25, 0.86], [0.27, 0.87], [0.27, 0.92], [0.2, 0.92], [0.2, 0.86], [0, 0.86]];
  const parts = [lathe(p)];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    parts.push(box(0.13, 0.09, 0.07, Math.cos(a) * 0.235, 0.96, Math.sin(a) * 0.235, -a + Math.PI / 2));
  }
  return merge(parts);
}

function knight() {
  const p = [...BASE, [0.27, 0.17], [0.25, 0.2], [0.25, 0.24], [0, 0.24]];
  const s = new THREE.Shape();
  s.moveTo(-0.22, 0);
  s.lineTo(0.2, 0);
  s.splineThru([V(0.17, 0.12), V(0.12, 0.26), V(0.16, 0.36), V(0.3, 0.44), V(0.37, 0.5), V(0.36, 0.58), V(0.27, 0.64), V(0.16, 0.72), V(0.13, 0.8), V(0.1, 0.86)]);
  s.lineTo(0.05, 0.79);
  s.splineThru([V(-0.04, 0.76), V(-0.14, 0.66), V(-0.21, 0.5), V(-0.25, 0.32), V(-0.25, 0.14), V(-0.22, 0)]);
  const head = new THREE.ExtrudeGeometry(s, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 5, curveSegments: 24 });
  head.translate(0, 0.22, -0.12);
  // eyes + nostrils as small bumps on both sides
  const extra = [];
  for (const zs of [-1, 1]) {
    extra.push(sphere(0.035, 0.2, 0.83, zs * 0.17));
    extra.push(sphere(0.025, 0.36, 0.73, zs * 0.12));
  }
  // mane ridge
  const mane = new THREE.CapsuleGeometry(0.035, 0.42, 4, 10);
  mane.rotateZ(-0.55);
  mane.translate(-0.13, 0.68, 0);
  return merge([lathe(p), head, mane, ...extra]);
}

function bishop() {
  const p = [...BASE, [0.24, 0.18], [0.19, 0.24], [0.14, 0.36], [0.11, 0.5], [0.1, 0.6], [0.19, 0.62], [0.2, 0.645], [0.18, 0.67], [0.12, 0.69]];
  arc(p, 0, 0.86, 0.155, 0.17, -0.9, 1.2, 16);
  p.push([0.03, 1.04], [0, 1.05]);
  return merge([lathe(p), sphere(0.055, 0, 1.09, 0)]);
}

function queen() {
  const p = [...BASE, [0.25, 0.18], [0.2, 0.25], [0.15, 0.4], [0.12, 0.58], [0.11, 0.72], [0.2, 0.75], [0.21, 0.775], [0.17, 0.8], [0.14, 0.82], [0.16, 0.9], [0.2, 0.98], [0.235, 1.04], [0.22, 1.06], [0.15, 1.04], [0.12, 1.05]];
  arc(p, 0, 1.05, 0.12, 0.12, 0, Math.PI / 2, 10);
  const parts = [lathe(p), sphere(0.065, 0, 1.22, 0)];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    parts.push(sphere(0.035, Math.cos(a) * 0.225, 1.075, Math.sin(a) * 0.225));
  }
  return merge(parts);
}

function king() {
  const p = [...BASE, [0.26, 0.18], [0.21, 0.25], [0.16, 0.42], [0.13, 0.62], [0.12, 0.78], [0.21, 0.81], [0.22, 0.835], [0.18, 0.86], [0.15, 0.88], [0.17, 0.96], [0.21, 1.06], [0.23, 1.12], [0.21, 1.14], [0.14, 1.14]];
  arc(p, 0, 1.14, 0.14, 0.14, 0, Math.PI / 2, 10);
  return merge([lathe(p), box(0.075, 0.28, 0.075, 0, 1.39, 0), box(0.21, 0.07, 0.075, 0, 1.43, 0)]);
}

let cache = null;
export function pieceGeometries() {
  if (!cache) cache = { p: pawn(), r: rook(), n: knight(), b: bishop(), q: queen(), k: king() };
  return cache;
}
