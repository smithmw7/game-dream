# Game Dream Prototype → Best-in-Class Neon Runner

## Product thesis

Game Dream should become an endless cyberpunk driving game where every run creates a short story worth retelling: the player reads a dangerous pattern, commits to a lane, escapes by centimeters, converts the risk into boost, and receives an audiovisual payoff that makes the moment feel impossible.

The north-star experience is:

> Every 20–30 seconds, anticipation becomes a meaningful choice, a narrow escape, and a spectacular payoff. Every two or three runs should produce at least one moment the player wants another person to see.

The low-poly geometry is not the problem. The gap is contrast, material detail, motion, consequence, authored pacing, audio, and a deeper decision system.

## Current prototype assessment

The prototype already proves the core premise:

- Three discrete lanes with keyboard and swipe input.
- Automatic acceleration, pooled hazards, collectibles, scoring, records, and restart flow.
- A third-person car, curved-world vertex shader, recycled city, and live `ImprovedNoise` terrain.
- Dark road surfacing with procedural neon streaks, a synthwave skyline, and responsive mobile framing.
- Separate Free, Race, and Drive modes with tested desktop and mobile flows.

Current overall polish is approximately **2 / 5: concept prototype**.

| Area | Current level | Best-in-class gap |
| --- | ---: | --- |
| Input readability | 3 / 5 | Strong anticipation cues, buffered input, accessibility settings, controller support, and richer vehicle response. |
| Core depth | 1.5 / 5 | Near misses, boost economy, combos, authored pattern grammar, branching risk, and run-changing modifiers. |
| Pacing/content | 1 / 5 | A deterministic director, difficulty waves, recovery beats, set pieces, biomes, and rare events. |
| Road/materials | 2 / 5 | Textured asphalt, macro/micro normals, wetness masks, puddles, decals, rain ripples, and tiered reflections. |
| Lighting/shadows | 1.5 / 5 | Vehicle contact shadow, headlights, selective dynamic shadows, baked city AO, and stable high-quality shadow tiers. |
| VFX/motion | 1 / 5 | Pooled particles, tire spray, sparks, boost trails, speed lines, impact debris, camera impulse, and selective bloom. |
| Audio/haptics | 1 / 5 | Engine layers, tire/wet-road sound, adaptive score, spatial city sound, impact hierarchy, and authored haptic language. |
| Progression | 0.5 / 5 | Missions, unlocks, cosmetics, mastery goals, daily seeds, and longer-term identity. |
| Social/viral | 0 / 5 | Highlight capture, replay camera, share cards, challenge links, friend ghosts, and referrals. |
| Production foundation | 2 / 5 | Modular simulation, content data, telemetry, experiments, performance budgets, save migration, and automated tests. |

## Five design pillars

1. **Readable at speed** — threats, safe lanes, pickups, and consequences remain understandable at maximum velocity.
2. **Commitment creates skill** — lane changes have timing, momentum, and opportunity cost; the best move is not always the nearest empty lane.
3. **Risk becomes power** — close calls, risky routes, and precision build boost and score multipliers.
4. **The city performs** — the environment is an active director of surprises, not a repeated backdrop.
5. **Every run can become a clip** — systems intentionally create, recognize, replay, and share spectacular moments.

## Missing gameplay depth

### 1. Near-miss and boost economy

Add a boost meter earned through skill rather than passive collection:

- Near-miss a barrier or traffic vehicle.
- Thread two hazards in a short window.
- Collect a complete shard line without breaking the route.
- Stay in a dangerous `overdrive` lane.
- Chain perfect lane changes on the musical beat.

Boost should change the game, not only the speed number:

- Temporary invulnerability or smash-through state.
- Wider collection magnet and higher score multiplier.
- Alternate obstacle patterns and destructible shortcuts.
- FOV kick, vehicle squat, trails, speed lines, denser rain streaks, engine pitch, and haptics.
- A meaningful decision between spending boost now or banking it for a difficult set piece.

### 2. Pattern grammar instead of random objects

Replace independent random obstacles with authored pattern cards that declare:

- Occupied and safe lanes over time.
- Minimum reaction window by speed tier.
- Pickup/risk route.
- Entry and exit lane.
- Follow-up compatibility.
- Difficulty, novelty, and recent-use cooldown.

Initial pattern families:

- Single teachable block.
- Sweeping left/right sequence.
- Alternating slalom.
- False-safe lane that closes late but fairly.
- Pickup lure through a narrow gate.
- Two-stage commitment where the first choice changes the second.
- Destructible boost route versus safe low-score route.
- Recovery pattern with generous shards after a hard beat.

### 3. Run director and dramatic pacing

Create a deterministic `RunDirector` that builds waves rather than increasing speed forever:

1. Teach/read.
2. Build pressure.
3. Test mastery.
4. Release with spectacle and rewards.
5. Introduce one new rule.

The director should control pattern category, reaction time, traffic density, reward route, surprise-event budget, weather, music intensity, and recovery duration. A seeded run must reproduce the same decisions for replay, ghosts, debugging, and challenge links.

### 4. Run-changing choices

- Forks: tunnel, elevated freeway, flooded underpass, maintenance lane.
- Temporary modifiers: double boost gain, fragile car, magnetized shards, police heat, blackout city.
- Vehicle archetypes with sidegrades: responsive, heavy/smashing, boost-specialist.
- One mid-run upgrade choice every few minutes.
- Optional high-risk contracts such as `survive 45 seconds without leaving lane 3`.

### 5. Fair failure and mastery

- Telegraph every lethal pattern early enough for the current speed and input device.
- Buffer a lane request briefly so a swipe just before availability still feels responsive.
- Add coyote-style overlap forgiveness for near-boundary collisions.
- Show a 1–1.5 second crash recap with threat, chosen lane, and the open route highlighted.
- Track first exposure separately from repeated exposure; novelty deaths and mastery deaths mean different things.

## Surprise and delight catalogue

The city needs rare authored moments with gameplay consequences. Start with eight reusable set pieces:

1. A maglev train crosses overhead and showers the road in sparks.
2. A holographic billboard glitches, collapses, and becomes a boost ramp.
3. Police drones acquire the car and sweep lanes with searchlights.
4. A tunnel blacks out except for vehicle lights and reflective road studs.
5. A giant delivery vehicle jackknifes across two lanes in slow, readable motion.
6. A flooded section produces deep reflections, wheel spray, and lightning flashes.
7. The road banks sideways onto a tower wall for a short gravity-defying sequence.
8. A boost impact punches through a construction barrier into a secret neon market route.

Rules for set pieces:

- First encounter is safe enough to understand but surprising enough to remember.
- Every event has at least one skillful interaction, not just a camera animation.
- Rare variants change the route or reward so novelty decays slowly.
- Set pieces expose deterministic IDs so their effect on retries, crashes, and shares can be measured.

## Viral moment system

### Moment recognition

Score events such as:

- Near miss under a distance threshold.
- Three perfect dodges in one boost.
- Collision avoided during a lane transition.
- Destruction of multiple obstacles.
- Rare-event survival.
- New personal best by a narrow margin.

When the moment score crosses a threshold, save the preceding and following few seconds as a highlight candidate.

### Capture and sharing

- Keep a lightweight rolling input/state replay buffer for deterministic re-rendering.
- Add a cinematic replay camera, short slow-motion beat, stunt title, score, seed, and challenge URL.
- Offer 9:16 and 16:9 layouts with safe HUD composition.
- For a first web implementation, capture the canvas with [`HTMLCanvasElement.captureStream()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream), encode with [`MediaRecorder`](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder), then hand the clip or challenge URL to the [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API) when supported.
- Every shared link contains an anonymous highlight ID, run seed, target score/distance, and campaign parameters.
- A recipient opens directly into `Beat this run`, not the main menu.

## Cyberpunk visual target

### Wet textured asphalt

Build the road as layers rather than one material color:

- Macro albedo variation: patches, repairs, aggregate, oil stains, tire wear, lane abrasion.
- Two normal scales: coarse aggregate plus fine grain.
- Roughness variation: dry grit, wet film, puddles, and oily rainbow patches.
- World-space wetness mask that gathers in depressions and near curbs.
- Animated rain ripples, wheel displacement, spray, and wake trails.
- Pooled decals for cracks, drains, arrows, utility covers, gum, trash, and construction paint.
- Reflective road studs and thin standing-water edges around puddles.

Use tiered reflections:

- **Mobile/low:** PMREM environment, procedural neon streaks, wetness-dependent roughness, and reflection probes.
- **Desktop/high:** a selective road-only [Three.js `SSRPass`](https://threejs.org/docs/pages/SSRPass.html) or a downsampled [planar `Reflector`](https://threejs.org/docs/pages/Reflector.html), with temporal stabilization and graceful fallback.
- Never render the full city twice at full resolution just to make puddles glossy.
- Replace the inherited daylight environment with a Drive-specific neon PMREM so the car and road reflect the city palette instead of pale studio light.

### Shadows and contact

- Add a stable soft contact shadow under the car before expensive global shadows.
- Cast shadows from the car, nearby barriers, signs, and the closest architecture only.
- Use baked/vertex AO and lightmaps for distant city massing.
- Add headlight cookies, taillight spill, and shadowed fog volumes near the camera.
- Evaluate Three.js [cascaded shadow maps](https://threejs.org/docs/pages/CSM.html) only for the high tier; shadow distance and cascade count must be budgeted.

### Stylized particle language

Create one event-driven, pooled particle system with GPU-friendly instancing:

- **Boost:** elongated speed lines, rear trails, road streaks, wheel spray, chromatic edge pulse.
- **Collect:** cyan shard fragments, expanding ring, short score ribbon.
- **Near miss:** directional sparks and a fast air-cut streak along the threat edge.
- **Crash:** hot sparks, glass-like polygons, smoke, rolling debris, shock ring, selective slow motion.
- **Environment:** rain, steam vents, dripping signs, airborne paper, transformer arcs, distant traffic haze.

Particles must inherit vehicle velocity, support deterministic seeds for replays, and enforce per-quality-tier budgets.

### Grit and city identity

- Break clean silhouettes with ducts, wires, fire escapes, vents, antennas, awnings, scaffolds, and rooftop machinery.
- Add layered signage with local iconography, imperfect flicker, grime masks, and partial occlusion.
- Introduce warm sodium work lights against cyan/magenta advertising.
- Use fog volumes, steam, rain, trash, worn curbs, roadworks, and occasional unlit dead zones.
- Author recognizable districts instead of one endless palette: financial canyon, market underpass, industrial floodway, corporate skybridge, blackout zone.

### Camera, audio, and feel

- Add acceleration squat, lane-change roll, suspension settle, impact impulse, and restrained camera shake.
- Use speed-reactive FOV with a short boost kick and slower recovery.
- Replace isolated tones with engine layers, wet tire noise, wind, transmission whine, boost charge/release, debris impacts, and spatial city beds.
- Build music in stems so pressure, boost, rare events, and near-death states can change intensity on-beat.
- Define a haptic vocabulary: lane commit, shard, perfect dodge, boost ignition, heavy hit.

## Production foundations needed first

The current `src/main.js` and `src/DriveMode.js` are effective prototype files, but best-in-class iteration needs separation of concerns.

Proposed modules:

```text
src/drive/
  DriveGame.js          lifecycle and mode orchestration
  DriveSimulation.js    deterministic lanes, speed, collision, score
  RunDirector.js        pacing waves, pattern selection, surprise budget
  PatternLibrary.js     data-driven obstacle and reward patterns
  DriveRenderer.js      scene roots, camera, bend uniforms, quality tiers
  RoadMaterial.js       asphalt, wetness, reflection strategy
  ParticleSystem.js     pooled event-driven VFX
  AudioDirector.js      engine, music stems, impacts, haptics
  ReplayBuffer.js       state/input capture and deterministic replay
  Telemetry.js          typed events and provider adapter
  SaveData.js           versioned persistence and migration
  driveContent.js       vehicles, districts, patterns, modifiers
```

Foundation requirements:

- Fixed-step, seedable simulation isolated from rendering.
- One shared bend module for color, depth, shadow, and distance materials, including corrected bent normals plus a CPU equivalent for FX/replay placement.
- Stable IDs for patterns, events, vehicles, districts, and experiments.
- Event bus connecting simulation outcomes to VFX, audio, haptics, telemetry, and replay markers.
- Object pools with zero steady-state allocations during a run.
- Instanced buildings, obstacles, decals, rain, and particles; Three.js documents `InstancedMesh` as the draw-call reduction path for repeated geometry.
- Quality tiers with explicit budgets for resolution, reflections, shadows, particles, fog, and post-processing.
- Mode-level code splitting so Drive does not download/initialize all Free/Race dependencies before play.
- Versioned save schema rather than unrelated raw `localStorage` keys.
- Automated deterministic tests for lane changes, pattern legality, collisions, boost, scoring, director pacing, replay equality, and save migration.
- Browser smoke tests for desktop, portrait mobile, reduced-motion mode, WebGL context recovery, and public Pages deployment.
- Performance telemetry: load-to-play, median/p95 frame time, long-frame ratio, input response, memory growth, and quality fallback.
- Pinned Three.js, Rapier, and Vite versions; shader chunk patches must never depend on moving `latest` packages.

## How fun will be measured

Fun is not one metric. Treat it as a triangle:

1. **Voluntary continuation** — the player chooses another run.
2. **Fair mastery** — the player understands failure and improves.
3. **Memorable moments** — the player recalls, previews, or shares an event.

Retention and session length are outcomes, not proof of fun by themselves. Unity's official analytics documentation defines retention, session length, sessions per user, and play time as separate measures; they should be read together rather than collapsed into one number.

### Minimum event contract

Every event includes `build_id`, anonymous player/session/run IDs, seed, device/input, quality tier, district, speed band, and experiment variant.

- `run_start`
- `pattern_exposure`
- `obstacle_exposure`
- `lane_change`
- `pickup_exposure` / `pickup_collect`
- `near_miss` / `perfect_dodge`
- `boost_start` / `boost_end`
- `combo_changed`
- `moment_triggered`
- `run_end`
- `highlight_eligible` / `highlight_preview`
- `share_open` / `share_handoff`
- `referral_landing` / `referred_run_start`
- `performance_summary`
- `survey_response`

Google Analytics for Firebase supports recommended gaming events such as `level_start`, `level_end`, `post_score`, and `share`, plus custom events and numeric values such as distance, time, and points. Its share event is specifically intended to identify viral content.

### Scorecard

| Question | Metric |
| --- | --- |
| Did the player experience the real loop? | Activation funnel and time to first meaningful dodge/boost. |
| Do they want one more run? | Retry within a fixed window, runs per session, and inter-run gap. |
| Was failure fair? | Retry/exit by crash cause plus `I understood why I crashed` playtest response. |
| Are they learning? | Personal-best improvement by run number and exposure-adjusted dodge success. |
| Is pacing healthy? | Survival curve and failure hazard by time/distance, pattern, and speed band. |
| Are mechanics expressive? | Boosts per opportunity, combo depth, risky-route choice, deliberate pickup skips. |
| Are surprises working? | Survival, retry, preview, and novelty decay by `moment_type`. |
| Is it shareable? | `eligible → preview → share handoff → referred landing → referred run`. |
| Does it bring players back? | Cohort D1/D7/D30 retention, sessions per active player, and active play time. |
| Is presentation helping? | Load-to-play, p95 frame time, long frames, input response, errors, and quality fallback. |

### Initial prototype hypotheses

These are starting hypotheses to test, **not genre benchmarks**:

- First meaningful choice within 5 seconds of taking control.
- Median visible input response under 100 ms on supported devices.
- At least 80% of moderated testers can explain why they crashed.
- At least half of crashers voluntarily retry within 10 seconds.
- Median five or more runs in an activated playtest session.
- One to three near-miss opportunities per minute after onboarding.
- A boost decision every 20–35 seconds.
- A major surprise beat every 45–75 seconds, with recovery afterward.
- At least one highlight-eligible moment every two or three runs.

Pair telemetry with recurring player-experience surveys. The validated [Player Experience Inventory](https://playerexperienceinventory.org/docs) provides constructs relevant here: ease of control, progress feedback, audiovisual appeal, clarity of goals, challenge, mastery, curiosity, and immersion.

The strongest north-star candidate is:

> **Voluntary runs per activated player**, guarded by fair-challenge scores, performance, and cohort retention; use **referred run starts per sharer** as the viral outcome.

## Delivery roadmap

### Phase 0 — Publish the prototype

Status: complete when the public repository, Pages build, roadmap, and repeatable deployment are live.

### Phase 1 — Deterministic foundation (1–2 weeks)

- Extract simulation, director, content data, rendering, audio, telemetry, save, and replay interfaces.
- Add seeded pattern generation and deterministic simulation tests.
- Add event bus and first telemetry adapter with a local debug sink.
- Add performance HUD for frame time, draw calls, triangles, memory trend, and quality tier.
- Code-split Drive from Free/Race initialization.

Exit: same seed and inputs produce the same run result; no steady-state object allocation; automated lane/collision/scoring tests pass.

### Phase 2 — Core-fun vertical slice (2–3 weeks)

- Near-miss detection, boost meter, boost state, combo multiplier, and perfect-dodge feedback.
- First 20 authored pattern cards and four pacing waves.
- Reaction-window legality checks across speed and mobile/desktop input.
- Crash recap and fast retry.
- Weekly moderated playtests plus the event contract above.

Exit: players understand failure, use boost intentionally, improve across attempts, and voluntarily retry.

### Phase 3 — Cyberpunk sensory pass (2–4 weeks)

- Layered asphalt normal/roughness/wetness material and pooled decals.
- High/medium/low reflection strategy.
- Contact shadows, nearby dynamic shadow casters, headlight/taillight spill, baked city AO.
- Pooled rain, spray, sparks, shards, smoke, boost trails, and speed lines.
- Engine/tire/wind mix, adaptive music stems, and authored haptics.
- Two visually distinct districts.

Exit: a still frame reads as wet cyberpunk, but motion makes it substantially better; stable target frame rate on agreed reference devices.

### Phase 4 — Surprise director (3–4 weeks)

- Ship the first eight city set pieces.
- Add rarity, cooldown, escalation, and novelty-decay tracking.
- Add destructible boost routes and district transitions.
- Add run modifiers and one mid-run choice system.

Exit: blind testers can recount different memorable events without prompting, and no event creates an unfair failure spike.

### Phase 5 — Viral loop (2–3 weeks)

- Deterministic replay buffer and cinematic highlight playback.
- Automatic moment scoring and preview after qualifying runs.
- 9:16/16:9 capture, title card, seed, score, and challenge URL.
- Web Share integration with download fallback.
- Daily seed, challenge links, and asynchronous friend ghost.
- Referral funnel instrumentation.

Exit: a shared link opens directly into a reproducible challenge; referral starts and retention are measurable.

### Phase 6 — Long-term depth (3–6 weeks)

- Vehicle sidegrades and cosmetic identity.
- Missions, mastery tracks, district unlocks, achievements, and collections.
- Daily/weekly contracts and leaderboards with anti-cheat-aware validation.
- More districts, patterns, set-piece variants, and music.
- Accessibility: remapping, motion reduction, color/contrast modes, haptic/audio controls.

Exit: players have short-, medium-, and long-term goals without weakening the instant retry loop.

### Phase 7 — Launch hardening (2–4 weeks)

- Device/browser matrix, memory/context-loss recovery, offline/error states, save migration, privacy/consent, and analytics QA.
- Automated public-deployment smoke test.
- Performance budgets enforced in CI.
- Funnel, retention, experiment, and content-health dashboards.

## Recommended immediate build order

1. Deterministic `RunDirector` and pattern cards.
2. Near-miss → boost → combo loop.
3. Event-driven particle/audio/haptic system.
4. Asphalt/wetness/decal material stack and car contact shadow.
5. First two set pieces.
6. Telemetry plus 20–30 structured playtests.
7. Replay/highlight capture only after the moment systems reliably create clips worth sharing.

Do not lead with expensive SSR across the entire scene. The fastest path to “more cyberpunk and gritty” is better asphalt normals/roughness, puddle masks, decals, contact shadow, rain/spray, localized light spill, fog/steam, and tightly timed effects. Reflection quality can then scale by device.

## Reference material

- [Firebase event logging for games](https://firebase.google.com/docs/analytics/web/events)
- [Unity Analytics dashboards and retention](https://docs.unity.com/en-us/analytics/dashboards/dashboards)
- [Unity Analytics funnels](https://docs.unity.com/en-us/analytics/funnels/funnels)
- [Player Experience Inventory](https://playerexperienceinventory.org/docs)
- [W3C Web Share specification](https://www.w3.org/TR/web-share/)
- [Three.js SSRPass](https://threejs.org/docs/pages/SSRPass.html)
- [Three.js Reflector](https://threejs.org/docs/pages/Reflector.html)
- [Three.js CSM](https://threejs.org/docs/pages/CSM.html)
- [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)
