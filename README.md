# Game Dream

A surreal, high-speed rolling-marble game built with Three.js and Rapier.

[Play Game Dream](https://smithmw7.github.io/game-dream/)

## Features

- Rigid glossy marble with a texture-free volumetric PBR shader
- Splash screen with Free Mode and the timed `Sunset Velocity` Race Mode
- Original downhill half-pipe course with four distinct beats, three checkpoints, and a finish line
- 38 collectible coins, nine coin-clearing hazards, and two single-hit shield powerups
- Race HUD, countdown, speed meter, finish summary, and persistent best-time/coin records
- Procedural Web Audio feedback, speed-reactive wind, and supported-device haptics
- Physics-driven rolling and higher jumping
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

- Race Mode: automatic forward speed, arrows/`A`/`D` to steer, `Space` to jump at any height
- Free Mode: `WASD` or arrow keys to roll, `Space` to jump, drag to look around
- `R`: reset
- `F`: fullscreen

### Mobile

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
- [Rapier](https://rapier.rs/)
- [Vite](https://vite.dev/)
