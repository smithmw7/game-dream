# Game Dream Prototype

A Three.js arcade prototype combining an endless neon driving runner, a 6.5 km looping marble race, and a surreal physics playground.

[Play the prototype](https://smithmw7.github.io/game-dream-prototype/)

See the [best-in-class product and technical roadmap](./ROADMAP.md).

## Features

- Rigid glossy marble with a texture-free volumetric PBR shader
- Splash screen with Drive, Race, and Free modes
- `Neon Nightshift` endless Drive Mode with a cyber coupe, three fixed swipe lanes, pooled obstacles and shards, persistent records, and a responsive chase camera
- Curved-world vertex shader shared by wet asphalt, procedural terrain, recycled city buildings, hazards, and pickups while collision remains deterministic in straight lane space
- Live `ImprovedNoise` terrain, endless neon skyline, synthetic sunset, clearcoated textured asphalt, rain rills, puddle masks, and cyan/magenta wet-road reflections
- Mobile-budgeted speed streaks, tail-light reflection trails, shard particle blooms, crash sparks, shockwaves, contact shadows, and GSAP road-speed pulses
- Desktop arrow/A/D controls and one-swipe/one-lane mobile input
- Portrait-first mobile composition with iPhone safe areas, 44pt controls, compact HUDs, a swipe rail, cancellation-safe gestures, and aspect-aware chase-camera framing
- Literal 6.5 km downhill half-pipe: 50x the original course length, descending from the cloudline
- Thirteen authored pacing sections, twelve checkpoints, strong S-turns, changing banks, rollers, two complete vertical loops, and a finish line
- 452 collectible coins, 71 coin-clearing hazards, and six single-hit shield powerups
- Race HUD, countdown, speed meter, finish summary, and persistent best-time/coin records
- GSAP-authored panel, HUD, countdown, toast, touch, pickup, lane-change, and impact motion with reduced-motion support
- Procedural Web Audio feedback, speed-reactive wind, and native iOS haptics for selections, pickups, impacts, warnings, crashes, and finishes
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
- Debug-only live FPS display
- Capacitor 8 iOS shell with portrait-only full-screen presentation and Wi-Fi device deployment scripts

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
- Lane changes, pickups, jumps, impacts, and finishes use semantic haptics in the native iOS build

## Development

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

### Native iOS

The checked-in Capacitor shell uses bundle ID `com.hightopgames.gamedream`, a relative-asset native build, Swift Package Manager, and the Capacitor Haptics plugin.

```bash
# Rebuild the web bundle and synchronize it into Xcode
npm run ios:sync

# Open the native project
npm run ios:open

# Build, install, and launch on the paired iPhone 15 Pro Max
npm run ios:run:iphone
```

For Wi-Fi deployment, pair the phone with Xcode once over USB, enable Developer Mode, keep the Mac and iPhone on the same local network, and enable **Show this iPhone when on Wi-Fi** in Xcode.

## Technology

- [Three.js](https://threejs.org/)
- [GSAP](https://gsap.com/)
- [Rapier](https://rapier.rs/)
- [Vite](https://vite.dev/)
- [Capacitor](https://capacitorjs.com/)
