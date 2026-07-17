# Game Dream Prototype

A Three.js arcade prototype combining an endless neon driving runner, a 6.5 km looping marble race, and a surreal physics playground.

[Play the prototype](https://smithmw7.github.io/game-dream-prototype/)

See the [best-in-class product and technical roadmap](./ROADMAP.md).

## Features

- Rigid glossy marble with a texture-free volumetric PBR shader
- Splash screen with Drive, Race, and Free modes
- `Neon Nightshift` endless Drive Mode with a cyber coupe, three fixed swipe lanes, pooled obstacles and shards, persistent records, and a responsive chase camera
- Curved-world vertex shader shared by wet asphalt, procedural terrain, recycled city buildings, hazards, and pickups while collision remains deterministic in straight lane space
- Live `ImprovedNoise` terrain, endless neon skyline, synthetic sunset, clearcoated pavement, and procedural cyan/magenta wet-road reflections
- Desktop arrow/A/D controls and one-swipe/one-lane mobile input
- Literal 6.5 km downhill half-pipe: 50x the original course length, descending from the cloudline
- Thirteen authored pacing sections, twelve checkpoints, strong S-turns, changing banks, rollers, two complete vertical loops, and a finish line
- 452 collectible coins, 71 coin-clearing hazards, and six single-hit shield powerups
- Race HUD, countdown, speed meter, finish summary, and persistent best-time/coin records
- GSAP-authored panel, HUD, countdown, toast, touch, pickup, lane-change, and impact motion with reduced-motion support
- Procedural Web Audio feedback, speed-reactive wind, and supported-device haptics
- Deterministic arcade handling with section-specific speed targets, crisp lane steering, strong jump gravity, stable zero-bounce landings, and rapid recovery
- High-contrast procedural PBR track surfacing with navy road grit, cyan edge ribbons, magenta hazards, and texture-free cloud shelves
- Noise-built canyon terrain, colossal concrete and glossy-metal monuments, emissive arch inlays, a procedural star field, magenta nebula clouds, and a synthetic cyan moon
- Physics-driven Free Mode plus a track-constrained Race Mode motor that stays pristine through banks and loops
- Spring-arm third-person camera with obstruction handling
- Procedural atmospheric sky and synchronized sunlight
- Reflective animated swimming pools with small geometric waves
- Floating short towers of rounded white oak, walnut, and cherry blocks with procedural PBR grain
- Pastel PBR architecture, soft shadows, GTAO, ACES grading, and film grain
- Adaptive mobile rendering quality
- One-finger race controls: automatic forward motion, drag steering, and repeatable tap air jumps
- Live FPS display

## Controls

### Desktop

- Drive Mode: automatic acceleration; `A`/`D` or Left/Right changes one fixed lane
- Race Mode: automatic forward speed, arrows/`A`/`D` to steer, `Space` to jump at any height
- Free Mode: `WASD` or arrow keys to roll, `Space` to jump, drag to look around
- `R`: reset
- `F`: fullscreen

### Mobile

- Drive Mode: swipe left or right to move one fixed lane
- Forward movement and camera follow are automatic in Race Mode
- Slide one finger left or right: steer
- Tap or swipe upward: jump again at any height

## Development

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

## Technology

- [Three.js](https://threejs.org/)
- [GSAP](https://gsap.com/)
- [Rapier](https://rapier.rs/)
- [Vite](https://vite.dev/)
