# MeteorSim

A real-time meteor shower and storm simulator, seen from the ground the way a dark-adapted eye would see it. It opens on **44 meteors per second**, a storm on the scale of the 1966 Leonids, and lets you compare that with ordinary nights, yearly showers and historic outbursts.

## Run it

The star map is loaded with WebGL, which browsers block for pages opened straight from disk, so serve the folder:

```
python -m http.server 8765
```

Then open <http://localhost:8765>. Opened from disk, it still works, but with a generated sky in place of the real star map.

**Controls:** drag to look around, scroll or pinch to zoom, shift-click the sky to move the radiant, Space to pause, H to hide the panel, C to toggle the comet, F for fullscreen.

## What's modelled

- **The sky:** a real all-sky star map, turned to the horizon of a site at 45° north at the time of night each shower is best seen. It turns slowly with the Earth. Toward the horizon, stars dim, redden and twinkle more. Faint light loses its colour, as it does for night vision.
- **Meteors:** each one burns up about 100 km high. Its speed and length on the sky come from the shower's speed, its distance from you and its angle from the radiant. Brightness follows the shower's population index, and fast, bright meteors leave drifting trains. Fireballs shed fragments and light up the landscape.
- **Light pollution:** the sky-darkness setting brightens the sky, adds a town's light dome and hides faint stars and meteors, which can bring a storm down to a trickle.
- **Invented:** the comet, the landscape and the tent.

## Files

- `index.html`, `style.css`: the page and the controls.
- `sim.js`: the simulation (meteors, landscape, comet, controls) and a generated-sky fallback.
- `skygl.js`: the WebGL2 renderer for the real sky.
- `assets/starmap_8k.jpg`, `assets/starmap_4k.jpg`: the star map. The 8K version loads on large screens.

## Credits

Star map: NASA/Goddard Space Flight Center Scientific Visualization Studio, [Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851/). Gaia DR2: ESA/Gaia/DPAC. Converted from the 8K OpenEXR original to sRGB JPEG.
