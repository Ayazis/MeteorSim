#!/usr/bin/env python3
"""Cut a NASA Deep Star Maps 2020 OpenEXR original into JPEG tiles for the sky renderer.

    pip install OpenEXR numpy pillow
    python3 tools/slice_starmap.py starmap_2020_32k.exr assets/sky32k

Source: https://svs.gsfc.nasa.gov/4851/ (starmap_2020_32k.exr, or _64k for a 64K set).

Each tile covers TILE x TILE pixels of the map and is saved with a 1-pixel border taken from
its neighbours (wrapping around in right ascension, clamped at the poles), so the renderer can
filter right up to a tile's edge without seams. Tiles are named {row}_{col}.jpg, row 0 at the
north pole, col 0 at RA 12h (the left edge of the map, as in starmap_8k.jpg).

The conversion matches the existing 4K and 8K maps: linear values clipped to [0, 1] and
encoded to sRGB, JPEG quality 90 without chroma subsampling (star colours stay intact).
"""
import json
import os
import sys

import numpy as np
import OpenEXR
from PIL import Image

TILE = 1024
PAD = 1


def srgb8(x):
    x = np.clip(x.astype(np.float32), 0.0, 1.0)
    y = np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)
    return (y * 255 + 0.5).astype(np.uint8)


def main(src, out):
    os.makedirs(out, exist_ok=True)
    channels = OpenEXR.File(src).channels()
    rgb = channels['RGB'].pixels if 'RGB' in channels else np.dstack([channels[c].pixels for c in 'RGB'])
    h, w = rgb.shape[:2]
    assert w == 2 * h and h % TILE == 0, f'unexpected map size {w}x{h}'
    rows, cols = h // TILE, w // TILE
    for r in range(rows):
        y0, y1 = r * TILE - PAD, (r + 1) * TILE + PAD
        ys = np.clip(np.arange(y0, y1), 0, h - 1)
        band = srgb8(rgb[ys])                       # (TILE + 2 PAD) rows, the full width
        for c in range(cols):
            xs = np.arange(c * TILE - PAD, (c + 1) * TILE + PAD) % w
            Image.fromarray(band[:, xs]).save(os.path.join(out, f'{r}_{c}.jpg'),
                                              quality=90, subsampling=0, optimize=True)
        print(f'row {r + 1}/{rows}', flush=True)
    with open(os.path.join(out, 'tiles.json'), 'w') as f:
        json.dump({'width': w, 'height': h, 'tile': TILE, 'pad': PAD, 'cols': cols, 'rows': rows}, f)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
