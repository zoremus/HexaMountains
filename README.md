# Hex Grid Playground

Minimal first-step app for testing a procedural cube-coordinate hex grid in 3D.

## Controls

- `Hexes Per Side`
- `Grid Size`
- `Hexagon Grid Radius`
- `Height Multiplier`
- `Hiking Trails`
- `Roads`

## Defaults

- hexes per side: `50`
- grid size: `1`
- hexagon grid radius: `10 km`

## Coordinate model

Uses cube coordinates with center hex at `(0, 0, 0)` and constraint:

```text
q + r + s = 0
```

This follows the cube-coordinate idea described here:
https://backdrifting.net/post/064_hex_grids

## Run

```bash
cd hexgrid-playground
npm install
npm run dev
```

## Current parameter meaning

- the grid layout defines the maximum available hex footprint
- `Hexes Per Side` is an independent control
- `Grid Size` only affects placement of the hex centers
- rendered grid size is scaled to `1/10` of the control value
- `Grid Size` ranges from `0` to `2` with default `1`
- `Hexagon Grid Radius` is the center-to-center distance in kilometers from the middle hex to the outermost ring hexes
- from that, the app derives a small-hex radius in kilometers
- this sampling scale does not affect current rendered geometry
- hold `Shift + right mouse drag` to move the sampling center in kilometers relative to the center hex
- elevation is sampled from a `25.6 km x 25.6 km` 16-bit PNG
- the file is always loaded from `public/elevation/elevation_mosaic.png`
- landcover color is sampled from a `25.6 km x 25.6 km` PNG
- the file is always loaded from `public/landcover/landcover_mosaic.png`
- the image center corresponds to `(0 km, 0 km)`, which is the center cube
- hex height comes directly from the sampled elevation image
- `Height Multiplier` ranges from `1` to `50`
- the default `Height Multiplier` is recalculated as `((hexes_per_side / hexagon_grid_radius) / 10 * 2)`
- moving the `Height Multiplier` slider overrides that value directly
- changing `Hexes Per Side` or `Hexagon Grid Radius` recalculates the slider from the formula
- it keeps the minimum sampled elevation unchanged and scales every height difference above that minimum
- hiking trails are loaded from `public/hiking/hiking_trails_raw.json`
- roads are loaded from `public/roads/roads_raw.json`

## Source Layout

- `main.js`: application wiring, source loading, and event handling
- `app-config.js`: shared render and interaction constants
- `controls.js`: DOM control queries, readouts, and UI-derived values
- `terrain-mesh.js`: instanced hex terrain construction
- `polyline-overlay.js`: shared screen-space line rendering for hiking trails and roads
- `interaction.js`: pointer-to-ground and hover picking helpers
- `source-cache.js`: cached async loading for image and vector data sources
