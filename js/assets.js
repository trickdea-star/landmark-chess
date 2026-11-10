// Loads the real (Poly Haven, CC0) textures and piece models built by tools/build_assets.py.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const texLoader = new THREE.TextureLoader();
const cache = new Map();
let maxAniso = 8;
export const setMaxAnisotropy = (n) => { maxAniso = n; };

// Promise of a texture; one download per file, shared by every material that uses it.
export function loadTex(path, srgb = true) {
  if (!cache.has(path)) {
    cache.set(path, texLoader.loadAsync(path).then((t) => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = maxAniso;
      return t;
    }).catch((e) => { console.warn('texture failed', path, e); return null; }));
  }
  return cache.get(path);
}

const withRepeat = (t, repeat) => {
  if (!t) return null;
  const c = t.clone();
  c.repeat.set(repeat[0], repeat[1]);
  c.needsUpdate = true;
  return c;
};

// A full set of PBR maps for a Poly Haven texture id (see TEXTURES in tools/build_assets.py).
export async function pbrMaps(id, { repeat = [1, 1], arm = true } = {}) {
  const [map, normalMap, armMap] = await Promise.all([
    loadTex(`assets/tex/${id}_diff.webp`, true),
    loadTex(`assets/tex/${id}_nor.webp`, false),
    arm ? loadTex(`assets/tex/${id}_arm.webp`, false) : Promise.resolve(null),
  ]);
  const out = { map: withRepeat(map, repeat), normalMap: withRepeat(normalMap, repeat) };
  if (armMap) { out.roughnessMap = withRepeat(armMap, repeat); out.aoMap = out.roughnessMap; }
  return out;
}

// MeshStandardMaterial/MeshPhysicalMaterial from a texture id. `color` tints the photo.
export async function pbrMat(id, { repeat, arm = true, physical = false, normalScale = 1, ...params } = {}) {
  const maps = await pbrMaps(id, { repeat, arm });
  const M = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const m = new M({ ...maps, ...params });
  m.normalScale.set(normalScale, normalScale);
  return m;
}

// Raw image element of a texture (for composing the board in a canvas).
export async function image(id, kind) {
  const t = await loadTex(`assets/tex/${id}_${kind}.webp`, kind === 'diff');
  return t ? t.image : null;
}

// ---------- scanned chess pieces ----------
let piecePromise = null;
export function loadPieces() {
  if (!piecePromise) {
    piecePromise = (async () => {
      const gltf = await new GLTFLoader().loadAsync('assets/pieces/pieces.glb');
      const geos = {};
      const S = 1 / 0.058; // the scan's squares are 5.8 cm; ours are 1 unit
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry.clone();
        g.scale(S, S, S);
        // knights face +x (the board code turns them); everything else faces -z (toward Black)
        g.rotateY(o.name === 'n' ? Math.PI / 2 : Math.PI);
        g.computeBoundingBox();
        geos[o.name] = g;
      });
      const [white, black, nor, arm] = await Promise.all([
        loadTex('assets/pieces/white_diff.webp', true), loadTex('assets/pieces/black_diff.webp', true),
        loadTex('assets/pieces/nor.webp', false), loadTex('assets/pieces/arm.webp', false),
      ]);
      for (const t of [white, black, nor, arm]) if (t) t.flipY = false; // glTF UV convention
      return { geos, tex: { white, black, nor, arm } };
    })().catch((e) => { console.warn('scanned pieces unavailable, using built-in shapes', e); return null; });
  }
  return piecePromise;
}
