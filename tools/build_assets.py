"""Download the free (CC0) Poly Haven assets the game uses and shrink them for the web.

Usage:  python tools/build_assets.py <staging_dir>

- Downloads go to <staging_dir> (kept out of the repo).
- Web-ready files are written to ./assets (committed): WebP textures, one small GLB of
  chess-piece shapes, and a tone-mapped sunset sky.
Re-running is safe; downloads that already exist are reused.
"""
import json, struct, sys, urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets"
STAGE = Path(sys.argv[1]).resolve()
API = "https://api.polyhaven.com/files/"
UA = {"User-Agent": "landmark-chess-asset-builder"}

# texture id -> (maps wanted, grayscale diffuse so the game can tint it)
TEXTURES = {
    # boards
    "white_maple_veneer": ("diff nor", False),
    "black_walnut_veneer_01": ("diff nor", False),
    "rosewood_veneer1": ("diff nor arm", False),
    "marble_01": ("diff nor", True),
    # oval office
    "herringbone_parquet": ("diff nor arm", False),
    "painted_plaster_wall": ("diff nor", True),
    "quatrefoil_jacquard_fabric": ("diff nor arm", True),
    "brown_leather": ("diff nor arm", False),
    # titanic
    "brown_planks_04": ("diff nor arm", False),
    "rusty_metal_02": ("diff nor arm", False),
    "coast_sand_01": ("diff nor arm", False),
    "wood_table_worn": ("diff nor arm", False),
    # liberty
    "green_metal_rust": ("diff nor arm", True),
    "granite_tile": ("diff nor arm", False),
}
MAPKEY = {"diff": "Diffuse", "nor": "nor_gl", "arm": "arm"}
SIZE = {"diff": 1024, "nor": 1024, "arm": 512}
QUALITY = {"diff": 80, "nor": 88, "arm": 80}
SKY = "belfast_sunset_puresky"
SKY_SUN_AZIMUTH_DEG = -58  # where the sun should sit (three.js equirect azimuth; -90 = straight down -z)
SKY_EXPOSURE = 0.16
SKY_SATURATION = 1.5


def get(url, dest):
    dest = Path(dest)
    if dest.exists() and dest.stat().st_size > 1000:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req) as r, open(dest, "wb") as f:
        f.write(r.read())
    return dest


def api(asset):
    req = urllib.request.Request(API + asset, headers=UA)
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def webp(src, dst, size, quality, gray=False):
    im = Image.open(src)
    im = im.convert("L").convert("RGB") if gray else im.convert("RGB")
    if im.width > size:
        im = im.resize((size, size * im.height // im.width), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=quality, method=6)
    return dst.stat().st_size


def build_textures():
    total = 0
    for tid, (maps, gray) in TEXTURES.items():
        files = api(tid)
        for m in maps.split():
            url = files[MAPKEY[m]]["1k"]["jpg"]["url"]
            src = get(url, STAGE / "tex" / Path(url).name)
            total += webp(src, OUT / "tex" / f"{tid}_{m}.webp", SIZE[m], QUALITY[m], gray and m == "diff")
    print(f"textures: {len(TEXTURES)} sets, {total/1e6:.2f} MB")


# ---------- chess pieces: keep one white mesh per piece type ----------
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
WANT = {"p": "piece_pawn_white_01", "n": "piece_knight_white_01", "b": "piece_bishop_white_01",
        "r": "piece_rook_white_01", "q": "piece_queen_white", "k": "piece_king_white"}


def read_accessor(g, binbuf, idx):
    a = g["accessors"][idx]
    bv = g["bufferViews"][a["bufferView"]]
    dt, n = CT[a["componentType"]], NC[a["type"]]
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride", 0)
    item = np.dtype(dt).itemsize * n
    if stride and stride != item:
        raw = np.frombuffer(binbuf, dtype=np.uint8, count=stride * (a["count"] - 1) + item, offset=off)
        rows = np.lib.stride_tricks.as_strided(raw, shape=(a["count"], item), strides=(stride, 1))
        return np.frombuffer(rows.copy().tobytes(), dtype=dt).reshape(a["count"], n)
    return np.frombuffer(binbuf, dtype=dt, count=a["count"] * n, offset=off).reshape(a["count"], n)


def build_pieces():
    files = api("chess_set")
    inc = files["gltf"]["1k"]["gltf"]
    gpath = get(inc["url"], STAGE / "chess" / "chess_set_1k.gltf")
    for rel, v in inc["include"].items():
        if rel.endswith(".bin") or "pieces" in rel:
            get(v["url"], STAGE / "chess" / rel)
    g = json.loads(gpath.read_text(encoding="utf-8"))
    binbuf = (STAGE / "chess" / g["buffers"][0]["uri"]).read_bytes()

    out = {"asset": {"version": "2.0", "generator": "landmark-chess build_assets.py"}, "scene": 0,
           "scenes": [{"nodes": []}], "nodes": [], "meshes": [], "accessors": [], "bufferViews": [], "buffers": []}
    blob = bytearray()

    def add(arr, target, kind, minmax=False):
        arr = np.ascontiguousarray(arr)
        while len(blob) % 4:
            blob.append(0)
        out["bufferViews"].append({"buffer": 0, "byteOffset": len(blob), "byteLength": arr.nbytes, "target": target})
        blob.extend(arr.tobytes())
        acc = {"bufferView": len(out["bufferViews"]) - 1, "componentType": {np.float32: 5126, np.uint16: 5123, np.uint32: 5125}[arr.dtype.type],
               "count": arr.shape[0], "type": kind}
        if minmax:
            acc["min"] = arr.min(0).tolist(); acc["max"] = arr.max(0).tolist()
        out["accessors"].append(acc)
        return len(out["accessors"]) - 1

    names = {n["name"]: n for n in g["nodes"]}
    for key, nodename in WANT.items():
        prim = g["meshes"][names[nodename]["mesh"]]["primitives"][0]
        attrs = {}
        attrs["POSITION"] = add(read_accessor(g, binbuf, prim["attributes"]["POSITION"]).astype(np.float32), 34962, "VEC3", True)
        attrs["NORMAL"] = add(read_accessor(g, binbuf, prim["attributes"]["NORMAL"]).astype(np.float32), 34962, "VEC3")
        attrs["TEXCOORD_0"] = add(read_accessor(g, binbuf, prim["attributes"]["TEXCOORD_0"]).astype(np.float32), 34962, "VEC2")
        ind = read_accessor(g, binbuf, prim["indices"]).reshape(-1)
        ind = ind.astype(np.uint16 if ind.max() < 65535 else np.uint32)
        out["meshes"].append({"name": key, "primitives": [{"attributes": attrs, "indices": add(ind.reshape(-1, 1), 34963, "SCALAR")}]})
        out["nodes"].append({"name": key, "mesh": len(out["meshes"]) - 1})
        out["scenes"][0]["nodes"].append(len(out["nodes"]) - 1)
    while len(blob) % 4:
        blob.append(0)
    out["buffers"].append({"byteLength": len(blob)})
    js = json.dumps(out, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    glb = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob))
    glb += struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(blob), 0x004E4942) + bytes(blob)
    (OUT / "pieces").mkdir(parents=True, exist_ok=True)
    (OUT / "pieces" / "pieces.glb").write_bytes(glb)
    size = len(glb)
    tex = STAGE / "chess" / "textures"
    size += webp(tex / "chess_set_pieces_white_diff_1k.jpg", OUT / "pieces" / "white_diff.webp", 1024, 82)
    size += webp(tex / "chess_set_pieces_black_diff_1k.jpg", OUT / "pieces" / "black_diff.webp", 1024, 82)
    size += webp(tex / "chess_set_pieces_white_nor_gl_1k.jpg", OUT / "pieces" / "nor.webp", 1024, 88)
    size += webp(tex / "chess_set_pieces_white_arm_1k.jpg", OUT / "pieces" / "arm.webp", 512, 80)
    print(f"pieces: glb {len(glb)/1e3:.0f} KB, total {size/1e6:.2f} MB")


# ---------- sky: decode Radiance .hdr, rotate so the sun sits where we want, tone-map ----------
def read_hdr(path):
    data = path.read_bytes()
    pos = 0
    while True:  # header ends with an empty line
        end = data.index(b"\n", pos)
        line = data[pos:end]; pos = end + 1
        if line.strip() == b"":
            break
    end = data.index(b"\n", pos)
    parts = data[pos:end].split(); pos = end + 1
    H, W = int(parts[1]), int(parts[3])
    img = np.zeros((H, W, 4), dtype=np.uint8)
    for y in range(H):
        if data[pos] != 2 or data[pos + 1] != 2:
            raise ValueError("only RLE .hdr supported")
        pos += 4
        for c in range(4):
            row = bytearray();
            while len(row) < W:
                n = data[pos]; pos += 1
                if n > 128:
                    row += bytes([data[pos]]) * (n - 128); pos += 1
                else:
                    row += data[pos:pos + n]; pos += n
            img[y, :, c] = np.frombuffer(bytes(row), dtype=np.uint8)
    e = img[..., 3].astype(np.int32)
    f = np.where(e > 0, np.ldexp(1.0, e - 136), 0.0)
    return img[..., :3].astype(np.float32) * f[..., None]


def build_sky():
    url = api(SKY)["hdri"]["4k"]["hdr"]["url"]
    hdr = read_hdr(get(url, STAGE / "sky" / Path(url).name))
    H, W, _ = hdr.shape
    lum = hdr @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    sy, sx = np.unravel_index(np.argmax(lum), lum.shape)
    target_u = 0.5 + SKY_SUN_AZIMUTH_DEG / 360.0
    shift = int(round(target_u * W - (sx + 0.5)))
    hdr = np.roll(hdr, shift, axis=1)
    sun_v = 1 - (sy + 0.5) / H
    lat = (sun_v - 0.5) * np.pi
    az = np.radians(SKY_SUN_AZIMUTH_DEG)
    sun = [float(np.cos(az) * np.cos(lat)), float(np.sin(lat)), float(np.sin(az) * np.cos(lat))]
    # tone-map (exposure + ACES filmic + a little saturation) to an sRGB image for the background
    x = hdr * SKY_EXPOSURE
    x = np.clip((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1)
    grey = (x @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32))[..., None]
    x = np.clip(grey + (x - grey) * SKY_SATURATION, 0, 1)
    srgb = np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(np.clip(x, 0, 1), 1 / 2.4) - 0.055)
    im = Image.fromarray((np.clip(srgb, 0, 1) * 255).astype(np.uint8))
    (OUT / "sky").mkdir(parents=True, exist_ok=True)
    im.save(OUT / "sky" / "sunset.webp", "WEBP", quality=82, method=6)
    horizon = np.asarray(im)[H // 2 - 4:H // 2 + 4].reshape(-1, 3).mean(0)
    meta = {"sun": sun, "horizon": "#%02x%02x%02x" % tuple(int(v) for v in horizon), "source": SKY}
    (OUT / "sky" / "sunset.json").write_text(json.dumps(meta, indent=1))
    print(f"sky: {W}x{H}, sun at row {sy} (elev {np.degrees(lat):.1f} deg), {(OUT/'sky'/'sunset.webp').stat().st_size/1e6:.2f} MB", meta)


if __name__ == "__main__":
    build_pieces()
    build_textures()
    build_sky()
