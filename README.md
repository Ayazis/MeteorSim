# MeteorSim

A real-time meteor shower and storm simulator, seen from the ground the way a dark-adapted eye would see it. It opens on **44 meteors per second**, a storm on the scale of the 1966 Leonids, and lets you compare that with ordinary nights, yearly showers and historic outbursts.

## Live site

Every push to `main` is published to the `gh-pages` branch by `.github/workflows/gh-pages.yml` and served at <https://ayazis.github.io/MeteorSim/>. One-time setup: in the repository's Settings → Pages, set the source to **Deploy from a branch**, branch `gh-pages`, folder `/ (root)`.

Each pull request is also built by `.github/workflows/pr-preview.yml` and served at `https://ayazis.github.io/MeteorSim/pr-preview/pr-<number>/`; a bot comment on the PR links to it, and the preview is removed when the PR closes.

## Run it

The star map is loaded with WebGL, which browsers block for pages opened straight from disk, so serve the folder:

```
python -m http.server 8765
```

Then open <http://localhost:8765>. Opened from disk, it still works, but with a generated sky in place of the real star map.

**Controls:** pick a place on Earth (presets, latitude/longitude or your own location), a date and time of day, and a speed from pause to 3600×. Drag to look around, scroll or pinch to zoom, shift-click the sky to move the radiant, Space to pause, H to hide the panel, C to toggle the comet, F for fullscreen.

## What's modelled

- **The sky:** a real all-sky star map, turned to the horizon of the chosen site using the local sidereal time from the real UTC date and the longitude. It turns with the Earth, faster when you fast-forward. A compass shows where you are looking.
- **Sun, Moon and twilight:** low-precision ephemerides place the Sun and Moon. The sky brightens through astronomical, nautical and civil twilight into a blue day, and moonlight washes it out; stars and meteors fade with the brighter sky. The Moon is drawn with its phase.
- **Radiants:** each shower's radiant is at its real RA/Dec, so where it stands depends on place and time. The rate scales with the sine of its altitude, as the ZHR does. Scenarios jump to the shower's peak date at the best pre-dawn (or evening) hour for your site. Toward the horizon, stars dim, redden and twinkle more. Faint light loses its colour, as it does for night vision.
- **Meteors:** each one burns up about 100 km high. Its speed and length on the sky come from the shower's speed, its distance from you and its angle from the radiant. Brightness follows the shower's population index, and fast, bright meteors leave drifting trains. Fireballs shed fragments and light up the landscape.
- **Light pollution:** a Bortle-class slider (1–9, with an SQM readout) brightens the sky, adds a town's light dome and hides faint stars and meteors, which can bring a storm down to a trickle.
- **Invented:** the comet and the landscape.

## Add-on API

`sim.js` exposes `window.MeteorSim` for other modules: `getObserver()` (lat, lon, date, local sidereal time, Sun and Moon positions), `getPollution()` (Bortle, SQM, limiting magnitude now), `getView()`, `eqToHor`/`horToEq`, `dir`, `azAlt`, `project`/`projectAzAlt`/`unproject`, `terrainAlt`, `setLocation`, `setTime` and `addLayer(fn)`, which draws `fn(ctx, dt, MeteorSim)` every frame over the sky and behind the meteors and landscape. See the comment above `const API` in `sim.js`. A `meteorsim-ready` event fires when it exists.

## Files

- `index.html`, `style.css`: the page and the controls.
- `sim.js`: the simulation (meteors, landscape, comet, controls) and a generated-sky fallback.
- `skygl.js`: the WebGL2 renderer for the real sky.
- `assets/starmap_8k.jpg`, `assets/starmap_4k.jpg`: the star map. The 8K version loads on large screens.
- `assets/sky32k/`: the 32K star map cut into 512 tiles ("Supermax" in View and playback). Only the tiles in view load, once zoomed in past what the 8K map can show. Made with `tools/slice_starmap.py` from NASA's `starmap_2020_32k.exr`; the same script makes a 64K set from `starmap_2020_64k.exr`.

## Credits

Star map: NASA/Goddard Space Flight Center Scientific Visualization Studio, [Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851/). Gaia DR2: ESA/Gaia/DPAC. Converted from the 8K and 32K OpenEXR originals to sRGB JPEG.
