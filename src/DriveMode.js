import * as THREE from 'three';
import { gsap } from 'gsap';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DriveVisualGains } from './DriveVisualGains.js';
import { DriveCoastalSection } from './DriveCoastalSection.js';
import { DriveDesertSection } from './DriveDesertSection.js';
import { DriveBridgeSection } from './DriveBridgeSection.js';
import { DriveRoadsideProps } from './DriveRoadsideProps.js';

const DRIVE_ORIGIN_X = -1000;
const ROAD_NEAR_Z = 18;
const ROAD_FAR_Z = -300;
const CAR_Z = 4;
const ROAD_SURFACE_Y = -0.04;
const LANE_X = [-3.25, 0, 3.25];
const RAMP_LENGTH = 15;
const RAMP_HALF_LENGTH = RAMP_LENGTH * 0.5;
const RAMP_TILT = 0.135;
const RAMP_CENTER_Y = 0.72;
const RAMP_LAUNCH_HEIGHT = (
  RAMP_CENTER_Y
  + RAMP_HALF_LENGTH * Math.sin(RAMP_TILT)
  + Math.cos(RAMP_TILT) * 0.25
  - ROAD_SURFACE_Y
);
const DRIVE_CYCLE_LENGTH = 2400;
const COAST_APPROACH_START = 250;
const COAST_ENTRY_START = 300;
const COAST_RUN_START = 345;
const COAST_EXIT_START = 820;
const COAST_RETURN_START = 865;
const DESERT_APPROACH_START = 1050;
const DESERT_RUN_START = 1120;
const BRIDGE_CLIMB_START = 1600;
const BRIDGE_SPAN_START = 1710;
const BRIDGE_DESCENT_START = 2040;
const BRIDGE_RETURN_START = 2150;
const CITY_RETURN_START = 2280;
const BRIDGE_PROFILE_WORLD_LENGTH = 300;
const COAST_PHASES = new Set([
  'coast-approach',
  'coast-entry',
  'coast',
  'coast-exit',
  'coast-departure',
]);
const COAST_SCENERY_PHASES = new Set([...COAST_PHASES, 'desert-approach']);
const DESERT_PHASES = new Set(['desert-approach', 'desert', 'desert-return']);
const BRIDGE_PHASES = new Set(['bridge-climb', 'bridge-span', 'bridge-descent']);
const ROAD_COLLISION_PHASES = new Set([
  'city',
  'coast-approach',
  'coast',
  'coast-departure',
  'desert-approach',
  'desert',
  'desert-return',
]);
const ROADSIDE_PHASES = new Set([
  'city',
  'coast-approach',
  'coast-entry',
  'coast',
  'coast-exit',
  'coast-departure',
  'desert-approach',
  'desert',
  'desert-return',
]);

function smootherStep01(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function createAsphaltNormalTexture(size) {
  const heights = new Float32Array(size * size);
  const pixels = new Uint8Array(size * size * 4);
  const sample = (x, y) => heights[
    ((y + size) % size) * size + ((x + size) % size)
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const aggregate = (
        Math.sin(u * Math.PI * 18 + Math.sin(v * Math.PI * 4) * 1.7)
        + Math.sin(v * Math.PI * 34 + u * Math.PI * 3)
        + Math.sin((u + v) * Math.PI * 58)
      ) / 3;
      const grain = (
        Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
      ) % 1;
      heights[y * size + x] = aggregate * 0.34 + Math.abs(grain) * 0.66;
    }
  }

  const strength = 2.35;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (sample(x - 1, y) - sample(x + 1, y)) * strength;
      const ny = (sample(x, y - 1) - sample(x, y + 1)) * strength;
      const length = Math.hypot(nx, ny, 1);
      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round((nx / length * 0.5 + 0.5) * 255);
      pixels[offset + 1] = Math.round((ny / length * 0.5 + 0.5) * 255);
      pixels[offset + 2] = Math.round((1 / length * 0.5 + 0.5) * 255);
      pixels[offset + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.name = 'Procedural rough asphalt normal';
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 64);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function desertBlendAtCycleDistance(cycleDistance) {
  if (cycleDistance < COAST_RETURN_START) return 0;
  if (cycleDistance < DESERT_RUN_START + 110) {
    return smootherStep01(
      (cycleDistance - COAST_RETURN_START)
      / (DESERT_RUN_START + 110 - COAST_RETURN_START),
    );
  }
  if (cycleDistance < BRIDGE_RETURN_START) return 1;
  if (cycleDistance < CITY_RETURN_START) {
    return 1 - smootherStep01(
      (cycleDistance - BRIDGE_RETURN_START)
      / (CITY_RETURN_START - BRIDGE_RETURN_START),
    );
  }
  return 0;
}

function rampElevationBeforeMarker(localDistance, marker) {
  const progress = THREE.MathUtils.clamp(
    (localDistance - (marker - RAMP_LENGTH)) / RAMP_LENGTH,
    0,
    1,
  );
  return RAMP_LAUNCH_HEIGHT * progress;
}

function bridgeElevationAtProgress(progress, variant = 'lake') {
  if (progress <= 0 || progress >= 1) return 0;
  const rise = smootherStep01(progress / 0.235);
  const descent = smootherStep01((1 - progress) / 0.235);
  const highSpan = Math.min(rise, descent);
  const crown = Math.pow(Math.sin(progress * Math.PI), 2);
  const baseHeight = variant === 'desert' ? 12.2 : 13.8;
  return highSpan * (baseHeight + crown * 1.65);
}

function bridgeGradeAtProgress(progress, variant = 'lake') {
  const epsilon = 0.0015;
  const slope = (
    bridgeElevationAtProgress(progress + epsilon, variant)
    - bridgeElevationAtProgress(progress - epsilon, variant)
  ) / (epsilon * BRIDGE_PROFILE_WORLD_LENGTH * 2);
  return Math.atan(slope);
}

function driveSectionAtDistance(distance) {
  const cycleIndex = Math.max(0, Math.floor(distance / DRIVE_CYCLE_LENGTH));
  const cycleDistance = ((distance % DRIVE_CYCLE_LENGTH) + DRIVE_CYCLE_LENGTH) % DRIVE_CYCLE_LENGTH;
  let phase = 'city';
  let label = 'ENDLESS CITY';
  let start = 0;
  let end = COAST_APPROACH_START;
  let vehicle = 'car';
  let surface = 'road';
  let biome = 'city';
  const bridgeVariant = ['lake', 'river', 'desert'][cycleIndex % 3];

  if (cycleDistance >= COAST_APPROACH_START && cycleDistance < COAST_ENTRY_START) {
    phase = 'coast-approach';
    label = 'OCEAN DRIVE LINK';
    start = COAST_APPROACH_START;
    end = COAST_ENTRY_START;
  } else if (cycleDistance >= COAST_ENTRY_START && cycleDistance < COAST_RUN_START) {
    phase = 'coast-entry';
    label = 'HOTEL STRIP JUMP';
    start = COAST_ENTRY_START;
    end = COAST_RUN_START;
    surface = 'air';
  } else if (cycleDistance >= COAST_RUN_START && cycleDistance < COAST_EXIT_START) {
    phase = 'coast';
    label = 'NEON HOTEL BOULEVARD';
    start = COAST_RUN_START;
    end = COAST_EXIT_START;
  } else if (cycleDistance >= COAST_EXIT_START && cycleDistance < COAST_RETURN_START) {
    phase = 'coast-exit';
    label = 'CAUSEWAY JUMP';
    start = COAST_EXIT_START;
    end = COAST_RETURN_START;
    surface = 'air';
  } else if (cycleDistance >= COAST_RETURN_START) {
    phase = 'coast-departure';
    label = 'SUNSET CAUSEWAY';
    start = COAST_RETURN_START;
    end = DESERT_APPROACH_START;
  }

  if (COAST_PHASES.has(phase)) {
    biome = 'coast';
  }

  if (cycleDistance >= DESERT_APPROACH_START && cycleDistance < DESERT_RUN_START) {
    phase = 'desert-approach';
    label = 'SONORAN LINK';
    start = DESERT_APPROACH_START;
    end = DESERT_RUN_START;
    biome = 'desert';
  } else if (cycleDistance >= DESERT_RUN_START && cycleDistance < BRIDGE_CLIMB_START) {
    phase = 'desert';
    label = 'MAGENTA BADLANDS';
    start = DESERT_RUN_START;
    end = BRIDGE_CLIMB_START;
    biome = 'desert';
  } else if (cycleDistance >= BRIDGE_CLIMB_START && cycleDistance < BRIDGE_SPAN_START) {
    phase = 'bridge-climb';
    label = 'SKYBRIDGE ASCENT';
    start = BRIDGE_CLIMB_START;
    end = BRIDGE_SPAN_START;
    biome = 'bridge';
  } else if (cycleDistance >= BRIDGE_SPAN_START && cycleDistance < BRIDGE_DESCENT_START) {
    phase = 'bridge-span';
    label = bridgeVariant === 'desert'
      ? 'FLOATING BADLAND SPAN'
      : (bridgeVariant === 'river' ? 'NEON RIVER SPAN' : 'MIRROR LAKE SPAN');
    start = BRIDGE_SPAN_START;
    end = BRIDGE_DESCENT_START;
    biome = 'bridge';
  } else if (cycleDistance >= BRIDGE_DESCENT_START && cycleDistance < BRIDGE_RETURN_START) {
    phase = 'bridge-descent';
    label = 'SKYBRIDGE DESCENT';
    start = BRIDGE_DESCENT_START;
    end = BRIDGE_RETURN_START;
    biome = 'bridge';
  } else if (cycleDistance >= BRIDGE_RETURN_START && cycleDistance < CITY_RETURN_START) {
    phase = 'desert-return';
    label = 'DESERT CAUSEWAY';
    start = BRIDGE_RETURN_START;
    end = CITY_RETURN_START;
    biome = 'desert';
  } else if (cycleDistance >= CITY_RETURN_START) {
    phase = 'city';
    label = 'MIDNIGHT CITY RETURN';
    start = CITY_RETURN_START;
    end = DRIVE_CYCLE_LENGTH;
    biome = 'city';
  }

  const progress = THREE.MathUtils.clamp((cycleDistance - start) / Math.max(1, end - start), 0, 1);
  const bridgeProgress = BRIDGE_PHASES.has(phase)
    ? THREE.MathUtils.clamp(
      (cycleDistance - BRIDGE_CLIMB_START) / (BRIDGE_RETURN_START - BRIDGE_CLIMB_START),
      0,
      1,
    )
    : (cycleDistance >= BRIDGE_RETURN_START ? 1 : 0);
  const climbingJumpRamp = (
    phase === 'coast-approach'
    && cycleDistance >= COAST_ENTRY_START - RAMP_LENGTH
  ) || (
    phase === 'coast'
    && cycleDistance >= COAST_EXIT_START - RAMP_LENGTH
  );
  const collisionProfile = surface === 'road'
    && ROAD_COLLISION_PHASES.has(phase)
    && !climbingJumpRamp
    ? 'road'
    : 'none';
  return {
    phase,
    label,
    vehicle,
    surface,
    biome,
    bridgeVariant,
    bridgeProgress,
    roadElevation: BRIDGE_PHASES.has(phase)
      ? bridgeElevationAtProgress(bridgeProgress, bridgeVariant)
      : 0,
    roadGrade: BRIDGE_PHASES.has(phase)
      ? bridgeGradeAtProgress(bridgeProgress, bridgeVariant)
      : 0,
    collisionProfile,
    cycleIndex,
    cycleDistance,
    progress,
    start,
    end,
  };
}

function smoothDamp(current, target, rate, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-rate * dt));
}

export class DriveMode {
  constructor(scene, {
    isMobile = false,
    onCollect = () => {},
    onCrash = () => {},
    onSectionChange = () => {},
    prefersReducedMotion = () => false,
  } = {}) {
    this.scene = scene;
    this.isMobile = isMobile;
    this.viewportAspect = innerWidth / Math.max(1, innerHeight);
    this.onCollect = onCollect;
    this.onCrash = onCrash;
    this.onSectionChange = onSectionChange;
    this.prefersReducedMotion = prefersReducedMotion;
    this.noise = new ImprovedNoise();
    this.randomState = 0x5f3759df;
    this.terrainAccumulator = 0;
    this.cameraTarget = new THREE.Vector3();
    this.cameraPosition = new THREE.Vector3();
    this.worldCarPosition = new THREE.Vector3();
    this.state = {
      laneIndex: 1,
      targetLane: 1,
      lateralX: 0,
      distance: 0,
      speed: 0,
      shards: 0,
      score: 0,
      elapsed: 0,
      crashed: false,
      laneChanges: 0,
      phase: 'city',
      sectionLabel: 'ENDLESS CITY',
      cycleIndex: 0,
      cycleDistance: 0,
      sectionProgress: 0,
      vehicle: 'car',
      surface: 'road',
      airborne: false,
      biome: 'city',
      roadElevation: 0,
      roadGrade: 0,
      bridgeVariant: 'lake',
      bridgeProgress: 0,
      collisionProfile: 'road',
      transitionElevation: 0,
      sunset: 0,
      starVisibility: 0,
      desertBlend: 0,
      coastBlend: 0,
      fogNear: 38,
      fogFar: 210,
    };
    this.bendUniforms = {
      uDriveTime: { value: 0 },
      uDriveTravel: { value: 0 },
      uBendStart: { value: 15 },
      uBendMaxDepth: { value: 285 },
      uBendX: { value: 0.00018 },
      uBendY: { value: 0.00128 },
      uDriveOriginX: { value: DRIVE_ORIGIN_X },
      uDesertMix: { value: 0 },
      uSunset: { value: 0 },
    };
    this.motionPhase = { shard: 0 };
    this.shardPhaseTween = gsap.to(this.motionPhase, {
      shard: Math.PI * 2,
      duration: 1.65,
      ease: 'none',
      repeat: -1,
    });

    this.root = new THREE.Group();
    this.root.name = 'Drive Mode · Neon City';
    this.root.position.x = DRIVE_ORIGIN_X;
    this.root.visible = false;
    scene.add(this.root);

    this.createSky();
    this.createRoad();
    this.createTerrain();
    this.createCity();
    this.createRunnerObjects();
    this.createCar();
    this.coastalSection = new DriveCoastalSection(this.root, {
      isMobile: this.isMobile,
      patchMaterial: (material, key, style) => this.patchBend(material, key, style),
      prefersReducedMotion: this.prefersReducedMotion,
    });
    this.desertSection = new DriveDesertSection(this.root, {
      isMobile: this.isMobile,
      patchMaterial: (material, key, style) => this.patchBend(material, key, style),
      prefersReducedMotion: this.prefersReducedMotion,
    });
    this.bridgeSection = new DriveBridgeSection(this.root, {
      isMobile: this.isMobile,
      patchMaterial: (material, key, style) => this.patchBend(material, key, style),
      prefersReducedMotion: this.prefersReducedMotion,
    });
    this.roadsideProps = new DriveRoadsideProps(this.root, {
      isMobile: this.isMobile,
      patchMaterial: (material, key, style) => this.patchBend(material, key, style),
      prefersReducedMotion: this.prefersReducedMotion,
    });
    this.createJumpEffects();
    this.createJumpTimelines();
    this.createTransitionRamps();
    this.createLights();
    this.visualGains = new DriveVisualGains(this.root, this.car, {
      isMobile: this.isMobile,
      prefersReducedMotion: this.prefersReducedMotion,
      patchMaterial: (material, key) => this.patchBend(material, key),
    });
    this.reset();
  }

  random() {
    this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  patchBend(material, key, style = 'plain') {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.bendUniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uBendStart;
          uniform float uBendMaxDepth;
          uniform float uBendX;
          uniform float uBendY;
          varying vec3 vDriveWorldPosition;
          varying vec2 vDriveUv;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vDriveUv = uv;
          vDriveWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;`,
        )
        .replace(
          '#include <project_vertex>',
          `vec4 mvPosition = vec4(transformed, 1.0);
          #ifdef USE_BATCHING
            mvPosition = batchingMatrix * mvPosition;
          #endif
          #ifdef USE_INSTANCING
            mvPosition = instanceMatrix * mvPosition;
          #endif
          mvPosition = modelViewMatrix * mvPosition;
          float driveBendDistance = clamp(-mvPosition.z - uBendStart, 0.0, uBendMaxDepth);
          float driveBendSquared = driveBendDistance * driveBendDistance;
          mvPosition.x += uBendX * driveBendSquared;
          mvPosition.y -= uBendY * driveBendSquared;
          gl_Position = projectionMatrix * mvPosition;`,
        );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        uniform float uDriveTime;
        uniform float uDriveTravel;
        uniform float uDriveOriginX;
        uniform float uDesertMix;
        varying vec3 vDriveWorldPosition;
        varying vec2 vDriveUv;
        float driveHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        float driveValueNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(driveHash(i), driveHash(i + vec2(1.0, 0.0)), u.x),
            mix(driveHash(i + vec2(0.0, 1.0)), driveHash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }`,
      );

      if (style === 'road') {
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            float driveRoadX = vDriveWorldPosition.x - uDriveOriginX;
            float driveRoadZ = -vDriveWorldPosition.z + uDriveTravel;
            float laneA = 1.0 - smoothstep(0.035, 0.11, abs(abs(driveRoadX) - 1.63));
            float edgeBand = 1.0 - smoothstep(0.12, 0.25, abs(abs(driveRoadX) - 5.55));
            float edgeDashPhase = fract((driveRoadZ + 1.5) / 14.0);
            float edgeDash = smoothstep(0.07, 0.13, edgeDashPhase)
              * (1.0 - smoothstep(0.72, 0.79, edgeDashPhase));
            float edgeLine = edgeBand * edgeDash;
            vec3 edgeLineColor = mix(
              vec3(0.01, 0.78, 1.0),
              vec3(1.0, 0.02, 0.47),
              step(0.0, driveRoadX)
            );
            float dash = step(0.48, fract(driveRoadZ / 8.0));
            float marker = laneA * dash;
            vec2 puddleUv = vec2(driveRoadX * 0.42, driveRoadZ * 0.052);
            float puddleNoise = driveValueNoise(puddleUv)
              * 0.68 + driveValueNoise(puddleUv * 2.07 + 17.3) * 0.32;
            float puddleEdge = puddleNoise
              + sin(puddleUv.x * 2.2 + puddleUv.y * 0.72) * 0.075;
            float puddle = smoothstep(0.58, 0.73, puddleEdge)
              * (0.42 + 0.58 * (1.0 - smoothstep(1.1, 5.5, abs(driveRoadX))));
            vec2 gritCell = floor(vec2(driveRoadX * 21.0, driveRoadZ * 3.2));
            float microGrit = fract(sin(dot(gritCell, vec2(18.9898, 63.7264))) * 31758.5453);
            float tireWear = exp(-abs(abs(driveRoadX) - 1.62) * 0.7);
            float rainRill = pow(0.5 + 0.5 * sin(driveRoadZ * 0.36 + driveRoadX * 8.0), 26.0);
            float neonStreak = pow(max(0.0, sin(driveRoadZ * 0.11 + driveRoadX * 0.7)), 18.0) * 0.2;
            float wetPulse = 0.15 + 0.85 * pow(0.5 + 0.5 * sin(driveRoadZ * 0.075), 8.0);
            float cyanReflection = exp(-abs(driveRoadX + 4.75) * 1.12) * wetPulse;
            float pinkReflection = exp(-abs(driveRoadX - 4.75) * 1.12) * wetPulse;
            float cyanFacade = exp(-abs(driveRoadX + 3.95) * 0.68) + exp(-abs(driveRoadX + 1.3) * 1.32) * 0.42;
            float pinkFacade = exp(-abs(driveRoadX - 3.95) * 0.68) + exp(-abs(driveRoadX - 1.3) * 1.32) * 0.42;
            float skylineSmear = 0.12 + 0.88 * pow(0.5 + 0.5 * sin(driveRoadZ * 0.034 + floor(abs(driveRoadX) * 0.74) * 1.9), 9.0);
            float windowGlint = pow(0.5 + 0.5 * sin(driveRoadZ * 0.43 + driveRoadX * 3.7), 24.0);
            float cityWetness = (0.2 + puddle * 0.92) * (1.0 - uDesertMix);
            float cityReflectionCyan = clamp(cyanFacade * (skylineSmear + windowGlint * 0.44), 0.0, 1.0) * cityWetness;
            float cityReflectionPink = clamp(pinkFacade * (skylineSmear + windowGlint * 0.44), 0.0, 1.0) * cityWetness;
            float lampCadence = pow(0.5 + 0.5 * cos(driveRoadZ * 0.145), 38.0);
            float lampReflection = lampCadence * exp(-abs(abs(driveRoadX) - 4.6) * 0.72) * (0.36 + puddle * 0.8);
            vec3 asphalt = mix(vec3(0.004, 0.006, 0.013), vec3(0.018, 0.03, 0.052), puddle);
            asphalt *= 0.86 + microGrit * 0.12;
            asphalt += tireWear * vec3(0.005, 0.008, 0.014) + rainRill * vec3(0.002, 0.008, 0.014);
            diffuseColor.rgb = asphalt;
            diffuseColor.rgb += marker * vec3(0.08, 0.82, 1.0) * 0.52;
            diffuseColor.rgb += edgeLine * edgeLineColor * 0.62;
            diffuseColor.rgb += cyanReflection * vec3(0.0, 0.34, 0.48) * (0.18 + puddle * 0.5);
            diffuseColor.rgb += pinkReflection * vec3(0.48, 0.0, 0.22) * (0.18 + puddle * 0.5);
            diffuseColor.rgb += cityReflectionCyan * vec3(0.01, 0.3, 0.48) + cityReflectionPink * vec3(0.52, 0.01, 0.28);
            diffuseColor.rgb += lampReflection * vec3(0.46, 0.34, 0.16);
            diffuseColor.rgb += neonStreak * mix(vec3(0.0, 0.72, 1.0), vec3(1.0, 0.0, 0.48), step(0.0, driveRoadX));`,
          )
          .replace(
            '#include <roughnessmap_fragment>',
            `#include <roughnessmap_fragment>
            roughnessFactor = clamp(mix(0.78, 0.07, puddle) + (microGrit - 0.5) * 0.06 - rainRill * 0.05, 0.055, 0.9);`,
          )
          .replace(
            '#include <normal_fragment_maps>',
            `#include <normal_fragment_maps>
            normal = normalize(mix(normal, nonPerturbedNormal, puddle * 0.82));`,
          )
          .replace(
            '#include <lights_physical_fragment>',
            `#include <lights_physical_fragment>
            #ifdef USE_CLEARCOAT
              material.clearcoat = mix(0.06, 0.95, puddle);
              material.clearcoatRoughness = mix(0.38, 0.055, puddle);
            #endif`,
          )
          .replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
            totalEmissiveRadiance += marker * vec3(0.02, 0.32, 0.58) + edgeLine * edgeLineColor * 0.72 + neonStreak * vec3(0.14, 0.015, 0.25);
            totalEmissiveRadiance += cyanReflection * vec3(0.0, 0.18, 0.28) + pinkReflection * vec3(0.25, 0.0, 0.12);
            totalEmissiveRadiance += cityReflectionCyan * vec3(0.0, 0.22, 0.36) + cityReflectionPink * vec3(0.4, 0.0, 0.2);
            totalEmissiveRadiance += lampReflection * vec3(0.34, 0.22, 0.06);`,
          )
          .replace(
            '#include <opaque_fragment>',
            `outgoingLight += marker * vec3(0.03, 0.42, 0.72) + edgeLine * edgeLineColor * 0.82;
            outgoingLight += cyanReflection * vec3(0.0, 0.17, 0.28) + pinkReflection * vec3(0.24, 0.0, 0.12);
            outgoingLight += cityReflectionCyan * vec3(0.0, 0.2, 0.34) + cityReflectionPink * vec3(0.38, 0.0, 0.19);
            outgoingLight += lampReflection * vec3(0.38, 0.25, 0.07);
            #include <opaque_fragment>`,
          );
      } else if (style === 'road-edge-dash') {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float driveEdgeZ = -vDriveWorldPosition.z + uDriveTravel;
          float driveEdgePhase = fract((driveEdgeZ + 1.5) / 14.0);
          float driveEdgeDash = smoothstep(0.07, 0.13, driveEdgePhase)
            * (1.0 - smoothstep(0.72, 0.79, driveEdgePhase));
          if (driveEdgeDash < 0.01) discard;
          diffuseColor.rgb *= 0.72 + driveEdgeDash * 0.42;`,
        );
      } else if (style === 'building') {
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            vec2 driveWindowCell = fract(vDriveUv * vec2(6.0, 17.0));
            float driveWindowX = step(0.18, driveWindowCell.x) * step(driveWindowCell.x, 0.74);
            float driveWindowY = step(0.2, driveWindowCell.y) * step(driveWindowCell.y, 0.68);
            vec2 driveWindowId = floor(vDriveUv * vec2(6.0, 17.0));
            float driveWindowSeed = fract(sin(dot(driveWindowId + floor(vDriveWorldPosition.xz * 0.12), vec2(19.19, 73.31))) * 43758.5453);
            float driveWindows = driveWindowX * driveWindowY * step(1.0, vDriveWorldPosition.y) * step(0.57, driveWindowSeed);
            diffuseColor.rgb *= mix(0.32, 0.46, driveWindows);`,
          )
          .replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
            vec3 windowColor = mix(vec3(0.0, 0.48, 0.82), vec3(0.9, 0.012, 0.34), step(0.5, fract(vDriveWorldPosition.y * 0.071)));
            totalEmissiveRadiance += driveWindows * windowColor * 0.62;`,
          );
      } else if (style === 'terrain') {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float ridgeGlow = pow(1.0 - abs(normal.y), 3.0);
          totalEmissiveRadiance += ridgeGlow * vec3(0.08, 0.0, 0.18);`,
        );
      }
    };
    material.customProgramCacheKey = () => `game-dream-drive-${key}-v9`;
    return material;
  }

  createSky() {
    this.skyDesertMix = this.bendUniforms.uDesertMix;
    this.skySunset = this.bendUniforms.uSunset;
    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        time: this.bendUniforms.uDriveTime,
        desertMix: this.skyDesertMix,
        sunset: this.skySunset,
      },
      vertexShader: `varying vec3 vSkyDirection; void main(){ vSkyDirection=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vSkyDirection;
        uniform float time;
        uniform float desertMix;
        uniform float sunset;
        float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
        void main(){
          vec3 d=normalize(vSkyDirection);
          float horizon=pow(clamp(1.0-abs(d.y+0.08),0.0,1.0),5.0);
          float night=smoothstep(0.12,0.94,sunset);
          float starSeed=hash(floor(d*520.0));
          float stars=step(mix(1.0,0.9915,night),starSeed)*smoothstep(-0.05,0.25,d.y);
          vec3 twilight=mix(vec3(0.018,0.003,0.055),vec3(0.19,0.018,0.31),max(d.y,0.0));
          vec3 midnight=mix(vec3(0.001,0.002,0.012),vec3(0.018,0.012,0.085),max(d.y,0.0));
          vec3 color=mix(twilight,midnight,night);
          color+=horizon*mix(vec3(0.64,0.025,0.45),vec3(0.09,0.04,0.22),night);
          color+=stars*mix(vec3(0.1,0.8,1.0),vec3(1.0,0.1,0.5),hash(floor(d*311.0)))*2.4*night;
          float desertHeight=clamp(d.y*0.72+0.38,0.0,1.0);
          vec3 desertDusk=mix(vec3(0.62,0.045,0.28),vec3(0.22,0.085,0.38),desertHeight);
          vec3 desertNight=mix(vec3(0.025,0.006,0.052),vec3(0.065,0.022,0.16),desertHeight);
          vec3 desertColor=mix(desertDusk,desertNight,night);
          desertColor+=horizon*mix(vec3(0.9,0.12,0.32),vec3(0.16,0.035,0.2),night);
          float cloudNoise=sin(d.x*18.0+d.z*9.0+sin(d.z*13.0)*1.7);
          float cloudBand=smoothstep(0.44,0.9,cloudNoise)*smoothstep(0.06,0.34,d.y)*(1.0-smoothstep(0.58,0.82,d.y));
          desertColor+=cloudBand*mix(vec3(0.75,0.16,0.42),vec3(0.12,0.04,0.2),night)*0.48;
          desertColor+=stars*mix(vec3(0.12,0.74,1.0),vec3(1.0,0.16,0.46),starSeed)*2.15*night;
          color=mix(color,desertColor,desertMix);
          gl_FragColor=vec4(color,1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(235, 28, 18), skyMaterial);
    this.sky.renderOrder = -20;
    this.root.add(this.sky);

    this.sunGroup = new THREE.Group();
    this.sunGroup.name = 'Drive setting sun';
    this.sunGroup.position.set(0, 30, 0);
    this.root.add(this.sunGroup);

    const haloMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: {
        opacity: { value: 1 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `
        varying vec2 vUv;
        uniform float opacity;
        void main() {
          float radius = length((vUv - 0.5) * 2.0);
          float core = 1.0 - smoothstep(0.04, 0.98, radius);
          float halo = pow(core, 2.2) * 0.58;
          vec3 color = mix(vec3(0.28, 0.025, 0.48), vec3(0.9, 0.025, 0.42), core);
          gl_FragColor = vec4(color * halo * 0.58 * opacity, halo * 0.58 * opacity);
        }
      `,
    });
    this.sunHalo = new THREE.Mesh(new THREE.PlaneGeometry(92, 92), haloMaterial);
    this.sunHalo.position.set(0, 0, -205.3);
    this.sunGroup.add(this.sunHalo);

    const sunMaterial = new THREE.MeshBasicMaterial({
      color: '#ffd06e',
      fog: false,
      transparent: true,
    });
    this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(23, 64), sunMaterial);
    this.sunDisc.position.set(0, 0, -205);
    this.sunGroup.add(this.sunDisc);
    this.skyBiomeTo = gsap.quickTo(this.skyDesertMix, 'value', {
      duration: this.prefersReducedMotion() ? 0.08 : 1.4,
      ease: 'power2.inOut',
    });
    this.skySunsetTo = gsap.quickTo(this.skySunset, 'value', {
      duration: this.prefersReducedMotion() ? 0.08 : 1.4,
      ease: 'power2.out',
    });
    this.sunXTo = gsap.quickTo(this.sunGroup.position, 'x', {
      duration: this.prefersReducedMotion() ? 0.08 : 1.5,
      ease: 'power2.out',
    });
    this.sunYTo = gsap.quickTo(this.sunGroup.position, 'y', {
      duration: this.prefersReducedMotion() ? 0.08 : 1.5,
      ease: 'power2.out',
    });
    this.sunOpacityTo = gsap.quickTo(sunMaterial, 'opacity', {
      duration: this.prefersReducedMotion() ? 0.08 : 1.25,
      ease: 'power2.out',
    });
    this.haloOpacityTo = gsap.quickTo(haloMaterial.uniforms.opacity, 'value', {
      duration: this.prefersReducedMotion() ? 0.08 : 1.25,
      ease: 'power2.out',
    });
    const barMaterial = new THREE.MeshBasicMaterial({
      color: '#18051f',
      fog: false,
      transparent: true,
    });
    this.sunBarMaterial = barMaterial;
    for (let i = 0; i < 6; i++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(49, 1.05 + i * 0.11), barMaterial);
      bar.position.set(0, -10 + i * 3.2, -204.8);
      this.sunGroup.add(bar);
    }
    this.sunBarsOpacityTo = gsap.quickTo(barMaterial, 'opacity', {
      duration: this.prefersReducedMotion() ? 0.08 : 1.25,
      ease: 'power2.out',
    });

    this.fogColors = {
      twilight: new THREE.Color('#3b123f'),
      night: new THREE.Color('#080b1c'),
      desertTwilight: new THREE.Color('#6a203f'),
      desertNight: new THREE.Color('#190a25'),
      target: new THREE.Color(),
      city: new THREE.Color(),
      desert: new THREE.Color(),
    };
    if (this.scene.fog?.isFog) {
      const duration = this.prefersReducedMotion() ? 0.08 : 1.5;
      this.fogNearTo = gsap.quickTo(this.scene.fog, 'near', { duration, ease: 'power2.out' });
      this.fogFarTo = gsap.quickTo(this.scene.fog, 'far', { duration, ease: 'power2.out' });
      this.fogRTo = gsap.quickTo(this.scene.fog.color, 'r', { duration, ease: 'power2.out' });
      this.fogGTo = gsap.quickTo(this.scene.fog.color, 'g', { duration, ease: 'power2.out' });
      this.fogBTo = gsap.quickTo(this.scene.fog.color, 'b', { duration, ease: 'power2.out' });
    }
  }

  updateAtmosphere(section, { immediate = false } = {}) {
    const dayProgress = THREE.MathUtils.clamp(
      this.state.distance / (DRIVE_CYCLE_LENGTH * 1.08),
      0,
      1,
    );
    const sunset = smootherStep01(dayProgress);
    const stars = smootherStep01((sunset - 0.12) / 0.88);
    const desertBlend = desertBlendAtCycleDistance(section.cycleDistance);
    const coastArrival = smootherStep01(
      (section.cycleDistance - (COAST_APPROACH_START - 80))
      / (COAST_RUN_START + 65 - (COAST_APPROACH_START - 80)),
    );
    const coastDeparture = 1 - smootherStep01(
      (section.cycleDistance - COAST_RETURN_START)
      / (DESERT_RUN_START - COAST_RETURN_START),
    );
    const coastBlend = THREE.MathUtils.clamp(coastArrival * coastDeparture, 0, 1);
    const sunY = THREE.MathUtils.lerp(30, -15, sunset);
    const sunX = THREE.MathUtils.lerp(-5, 12, sunset);
    const sunOpacity = 1 - smootherStep01((sunset - 0.73) / 0.27);
    const fogNear = THREE.MathUtils.lerp(36, 24, stars) - coastBlend * 3;
    const fogFar = THREE.MathUtils.lerp(205, 158, stars)
      + desertBlend * 28
      - coastBlend * 12;

    Object.assign(this.state, {
      sunset,
      starVisibility: stars,
      desertBlend,
      coastBlend,
      fogNear,
      fogFar,
    });

    this.fogColors.city.lerpColors(
      this.fogColors.twilight,
      this.fogColors.night,
      sunset,
    );
    this.fogColors.desert.lerpColors(
      this.fogColors.desertTwilight,
      this.fogColors.desertNight,
      sunset,
    );
    this.fogColors.target.copy(this.fogColors.city).lerp(
      this.fogColors.desert,
      desertBlend,
    );

    if (immediate) {
      this.skyDesertMix.value = desertBlend;
      this.skySunset.value = sunset;
      this.sunGroup.position.x = sunX;
      this.sunGroup.position.y = sunY;
      this.sunDisc.material.opacity = sunOpacity;
      this.sunHalo.material.uniforms.opacity.value = sunOpacity;
      this.sunBarMaterial.opacity = sunOpacity;
      if (this.root.visible && this.scene.fog?.isFog) {
        this.scene.fog.near = fogNear;
        this.scene.fog.far = fogFar;
        this.scene.fog.color.copy(this.fogColors.target);
      }
      return;
    }

    this.skyBiomeTo?.(desertBlend);
    this.skySunsetTo?.(sunset);
    this.sunXTo?.(sunX);
    this.sunYTo?.(sunY);
    this.sunOpacityTo?.(sunOpacity);
    this.haloOpacityTo?.(sunOpacity);
    this.sunBarsOpacityTo?.(sunOpacity);
    if (this.root.visible && this.scene.fog?.isFog) {
      this.fogNearTo?.(fogNear);
      this.fogFarTo?.(fogFar);
      this.fogRTo?.(this.fogColors.target.r);
      this.fogGTo?.(this.fogColors.target.g);
      this.fogBTo?.(this.fogColors.target.b);
    }
  }

  createRoad() {
    this.roadEnvironment = new THREE.Group();
    this.roadEnvironment.name = 'Drive road deck and neon edges';
    this.root.add(this.roadEnvironment);
    this.asphaltNormalMap = createAsphaltNormalTexture(this.isMobile ? 64 : 128);
    const roadMaterial = this.patchBend(new THREE.MeshPhysicalMaterial({
      color: '#010207', roughness: 0.72, metalness: 0.08,
      clearcoat: 0.24, clearcoatRoughness: 0.3, envMapIntensity: 0.9,
      specularIntensity: 1, ior: 1.46,
      normalMap: this.asphaltNormalMap,
      normalScale: new THREE.Vector2(0.24, 0.24),
    }), 'wet-road', 'road');
    this.roadMaterial = roadMaterial;
    const roadGeometry = new THREE.BoxGeometry(12, 0.24, 320, 1, 1, this.isMobile ? 80 : 144);
    this.road = new THREE.Mesh(roadGeometry, roadMaterial);
    this.road.position.set(0, ROAD_SURFACE_Y - 0.12, -141);
    this.road.frustumCulled = false;
    this.road.receiveShadow = true;
    this.roadEnvironment.add(this.road);

    const curbMaterial = this.patchBend(new THREE.MeshStandardMaterial({
      color: '#030611', roughness: 0.72, metalness: 0.12, emissive: '#020713', emissiveIntensity: 0.18,
    }), 'curb');
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 320, 1, 1, this.isMobile ? 64 : 128), curbMaterial);
      curb.position.set(side * 6.8, -0.04, -141);
      curb.frustumCulled = false;
      curb.receiveShadow = true;
      this.roadEnvironment.add(curb);

      const railMaterial = this.patchBend(new THREE.MeshBasicMaterial({
        color: side < 0 ? '#14dcff' : '#ff1b8d', toneMapped: false,
      }), `road-edge-${side}`, 'road-edge-dash');
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.045, 320, 1, 1, this.isMobile ? 64 : 128), railMaterial);
      rail.position.set(side * 5.55, -0.005, -141);
      rail.frustumCulled = false;
      this.roadEnvironment.add(rail);
    }
  }

  createTerrainGeometry(side) {
    const xSegments = this.isMobile ? 6 : 10;
    const zSegments = this.isMobile ? 36 : 56;
    const positions = [];
    const indices = [];
    const baseX = [];
    const baseZ = [];
    for (let zIndex = 0; zIndex <= zSegments; zIndex++) {
      const z = THREE.MathUtils.lerp(ROAD_NEAR_Z, ROAD_FAR_Z, zIndex / zSegments);
      for (let xIndex = 0; xIndex <= xSegments; xIndex++) {
        const magnitude = THREE.MathUtils.lerp(7.6, 76, xIndex / xSegments);
        const x = magnitude * side;
        positions.push(x, -0.45, z);
        baseX.push(x);
        baseZ.push(z);
      }
    }
    const row = xSegments + 1;
    for (let zIndex = 0; zIndex < zSegments; zIndex++) {
      for (let xIndex = 0; xIndex < xSegments; xIndex++) {
        const a = zIndex * row + xIndex;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.userData.baseX = baseX;
    geometry.userData.baseZ = baseZ;
    return geometry;
  }

  createTerrain() {
    this.terrainGroup = new THREE.Group();
    this.terrainGroup.name = 'Drive procedural terrain';
    this.root.add(this.terrainGroup);
    const terrainMaterial = this.patchBend(new THREE.MeshStandardMaterial({
      color: '#090919', roughness: 0.78, metalness: 0.2, emissive: '#100018', emissiveIntensity: 0.3,
      flatShading: true, side: THREE.DoubleSide,
    }), 'dynamic-terrain', 'terrain');
    const wireMaterial = this.patchBend(new THREE.MeshBasicMaterial({
      color: '#5b1dff', wireframe: true, transparent: true, opacity: 0.24, toneMapped: false,
    }), 'terrain-wire');
    this.terrainMeshes = [];
    for (const side of [-1, 1]) {
      const geometry = this.createTerrainGeometry(side);
      const surface = new THREE.Mesh(geometry, terrainMaterial);
      const wire = new THREE.Mesh(geometry, wireMaterial);
      surface.frustumCulled = false;
      surface.receiveShadow = true;
      wire.frustumCulled = false;
      wire.renderOrder = 1;
      this.terrainGroup.add(surface, wire);
      this.terrainMeshes.push({ geometry, surface, wire });
    }
    this.updateTerrain(true);
  }

  updateTerrain(force = false) {
    const updateInterval = this.isMobile ? 0.1 : 0.05;
    if (!force && this.terrainAccumulator < updateInterval) return;
    this.terrainAccumulator %= updateInterval;
    for (const { geometry } of this.terrainMeshes) {
      const position = geometry.attributes.position;
      const { baseX, baseZ } = geometry.userData;
      for (let index = 0; index < position.count; index++) {
        const x = baseX[index];
        const z = baseZ[index];
        const worldZ = this.state.distance + Math.max(0, -z);
        const falloff = THREE.MathUtils.smoothstep(Math.abs(x), 7.5, 55);
        const broad = Math.abs(this.noise.noise(x * 0.018, worldZ * 0.009, 2.1));
        const ridge = Math.abs(this.noise.noise(x * 0.052 + 8.0, worldZ * 0.024, 5.3));
        const detail = this.noise.noise(x * 0.11, worldZ * 0.055, 9.7) * 0.5 + 0.5;
        const height = -0.42 + falloff * (2.2 + broad * 18 + ridge * 7 + detail * 2.4);
        position.setY(index, height);
      }
      position.needsUpdate = true;
    }
  }

  createCity() {
    this.cityGroup = new THREE.Group();
    this.cityGroup.name = 'Drive recycled cyber city';
    this.root.add(this.cityGroup);
    this.buildingMaterials = [
      this.patchBend(new THREE.MeshStandardMaterial({ color: '#080d1d', roughness: 0.7, metalness: 0.25, emissive: '#02040c', emissiveIntensity: 0.2 }), 'building-a', 'building'),
      this.patchBend(new THREE.MeshStandardMaterial({ color: '#111126', roughness: 0.62, metalness: 0.32, emissive: '#080314', emissiveIntensity: 0.25 }), 'building-b', 'building'),
      this.patchBend(new THREE.MeshStandardMaterial({ color: '#07151f', roughness: 0.68, metalness: 0.22, emissive: '#001018', emissiveIntensity: 0.22 }), 'building-c', 'building'),
    ];
    this.neonMaterials = [
      this.patchBend(new THREE.MeshBasicMaterial({ color: '#ff168d', toneMapped: false }), 'sign-magenta'),
      this.patchBend(new THREE.MeshBasicMaterial({ color: '#1ee9ff', toneMapped: false }), 'sign-cyan'),
      this.patchBend(new THREE.MeshBasicMaterial({ color: '#8154ff', toneMapped: false }), 'sign-violet'),
    ];
    const bodyGeometry = new THREE.BoxGeometry(1, 1, 1, 1, 7, 3);
    const signGeometry = new THREE.BoxGeometry(0.18, 1, 1);
    this.buildings = [];
    const count = this.isMobile ? 28 : 44;
    for (let index = 0; index < count; index++) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(bodyGeometry, this.buildingMaterials[index % this.buildingMaterials.length]);
      const sign = new THREE.Mesh(signGeometry, this.neonMaterials[index % this.neonMaterials.length]);
      body.frustumCulled = false;
      sign.frustumCulled = false;
      group.add(body, sign);
      this.cityGroup.add(group);
      const building = { group, body, sign, side: index % 2 ? 1 : -1, speedFactor: 1 };
      this.buildings.push(building);
      this.recycleBuilding(building, -18 - index * (this.isMobile ? 10 : 7.2));
    }
  }

  recycleBuilding(building, z) {
    const width = 4.2 + this.random() * 4.8;
    const depth = 4 + this.random() * 8;
    const height = 9 + Math.pow(this.random(), 0.62) * 29;
    const setback = 12.5 + this.random() * 10.5;
    building.group.position.set(building.side * setback, 0, z);
    building.body.scale.set(width, height, depth);
    building.body.position.y = height / 2 - 0.1;
    building.sign.scale.set(1, Math.max(3, height * (0.25 + this.random() * 0.25)), 0.65 + this.random() * 0.9);
    building.sign.position.set(-building.side * (width / 2 + 0.1), height * (0.38 + this.random() * 0.34), depth * (this.random() - 0.5) * 0.55);
    building.speedFactor = 0.94 + this.random() * 0.1;
  }

  createRunnerObjects() {
    this.runnerGroup = new THREE.Group();
    this.runnerGroup.name = 'Drive road pickups and barriers';
    this.root.add(this.runnerGroup);
    const barrierMaterial = this.patchBend(new THREE.MeshPhysicalMaterial({
      color: '#5b0a2d', emissive: '#ff056f', emissiveIntensity: 2.4,
      roughness: 0.18, metalness: 0.65, clearcoat: 1, clearcoatRoughness: 0.08,
    }), 'barrier');
    const shardMaterial = this.patchBend(new THREE.MeshPhysicalMaterial({
      color: '#5bf6ff', emissive: '#00b8ff', emissiveIntensity: 3.3,
      roughness: 0.12, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.06,
    }), 'shard');
    const barrierGeometry = new RoundedBoxGeometry(2.15, 1.2, 0.75, 4, 0.16);
    const shardGeometry = new THREE.OctahedronGeometry(0.52, 0);
    this.runnerObjects = [];
    const count = this.isMobile ? 11 : 15;
    for (let index = 0; index < count; index++) {
      const barrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
      const shard = new THREE.Mesh(shardGeometry, shardMaterial);
      barrier.frustumCulled = false;
      shard.frustumCulled = false;
      barrier.castShadow = true;
      barrier.receiveShadow = true;
      this.runnerGroup.add(barrier, shard);
      const object = { barrier, shard, kind: 'shard', lane: 1, z: -30, resolved: false };
      this.runnerObjects.push(object);
      this.recycleRunnerObject(object, -34 - index * 19);
    }
  }

  recycleRunnerObject(object, z) {
    gsap.killTweensOf(object.shard.scale);
    object.kind = this.random() < 0.46 ? 'barrier' : 'shard';
    object.lane = Math.floor(this.random() * 3);
    object.z = z;
    object.resolved = false;
    object.barrier.visible = object.kind === 'barrier';
    object.shard.visible = object.kind === 'shard';
    object.shard.scale.setScalar(1);
    object.barrier.position.set(LANE_X[object.lane], 0.62, z);
    object.shard.position.set(LANE_X[object.lane], 1.05, z);
  }

  createCar() {
    this.car = new THREE.Group();
    this.car.name = 'Neon Cyber Runner';
    this.car.position.set(0, 0.06, CAR_Z);
    this.root.add(this.car);

    this.vehicleLiftRig = new THREE.Group();
    this.vehicleLiftRig.name = 'GSAP car jump presentation';
    this.carMotionRig = new THREE.Group();
    this.carMotionRig.name = 'GSAP lane and hover presentation';
    this.carImpactRig = new THREE.Group();
    this.carImpactRig.name = 'GSAP impact presentation';
    this.carVisualRig = new THREE.Group();
    this.carVisualRig.name = 'Cyber coupe visual';
    this.car.add(this.vehicleLiftRig);
    this.vehicleLiftRig.add(this.carMotionRig);
    this.carMotionRig.add(this.carImpactRig);
    this.carImpactRig.add(this.carVisualRig);

    const paint = new THREE.MeshPhysicalMaterial({
      color: '#010104', metalness: 0.52, roughness: 0.29,
      clearcoat: 0.64, clearcoatRoughness: 0.14, envMapIntensity: 0.025,
      specularIntensity: 0.28, ior: 1.28,
      iridescence: 0.24, iridescenceIOR: 1.72,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#000103', metalness: 0.04, roughness: 0.24,
      clearcoat: 0.32, clearcoatRoughness: 0.18, envMapIntensity: 0.008,
      specularIntensity: 0.06, ior: 1.16,
    });
    const tire = new THREE.MeshStandardMaterial({ color: '#030307', roughness: 0.72, metalness: 0.15 });
    const cyan = new THREE.MeshBasicMaterial({ color: '#20e8ff', toneMapped: false });
    const magenta = new THREE.MeshBasicMaterial({ color: '#ff167f', toneMapped: false });
    const red = new THREE.MeshBasicMaterial({ color: '#ff203f', toneMapped: false });

    const lower = new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.68, 5.1, 5, 0.22), paint);
    lower.position.y = 0.45;
    const hood = new THREE.Mesh(new RoundedBoxGeometry(3.15, 0.42, 2.15, 4, 0.14), paint);
    hood.position.set(0, 0.83, -1.35);
    const cabin = new THREE.Mesh(new RoundedBoxGeometry(2.62, 0.84, 2.15, 5, 0.2), glass);
    cabin.position.set(0, 1.23, 0.2);
    cabin.scale.set(0.92, 1, 0.95);
    this.carVisualRig.add(lower, hood, cabin);

    for (const side of [-1, 1]) {
      for (const z of [-1.45, 1.45]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.34, 18), tire);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * 1.72, 0.38, z);
        this.carVisualRig.add(wheel);
      }
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.22, 0.08), red);
      tail.position.set(side * 0.95, 0.72, 2.57);
      this.carVisualRig.add(tail);
      const sideStrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 3.9), side < 0 ? cyan : magenta);
      sideStrip.position.set(side * 1.72, 0.55, 0.1);
      this.carVisualRig.add(sideStrip);
    }
    const rearStrip = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.07, 0.08), magenta);
    rearStrip.position.set(0, 0.92, 2.59);
    this.carVisualRig.add(rearStrip);
    const underglow = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 4.5), new THREE.MeshBasicMaterial({
      color: '#ff0e8d', transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false,
    }));
    underglow.rotation.x = -Math.PI / 2;
    underglow.position.y = 0.01;
    this.carVisualRig.add(underglow);
    this.underglow = underglow;
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.12, 0.36), paint);
    spoiler.position.set(0, 1.25, 2.15);
    this.carVisualRig.add(spoiler);

    this.carVisualRig.traverse((child) => {
      if (!child.isMesh || child.material?.transparent) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });

    const hoverAmount = this.prefersReducedMotion() ? 0 : 0.022;
    this.carIdleTimeline = gsap.timeline({ repeat: -1, yoyo: true });
    this.carIdleTimeline.to(this.carMotionRig.position, {
      y: hoverAmount,
      duration: 0.28,
      ease: 'sine.inOut',
    }).to(this.underglow.material, {
      opacity: this.prefersReducedMotion() ? 0.26 : 0.38,
      duration: 0.28,
      ease: 'sine.inOut',
    }, 0);
  }

  createTransitionRamps() {
    this.transitionGroup = new THREE.Group();
    this.transitionGroup.name = 'Coastal road jump ramps';
    this.root.add(this.transitionGroup);

    const deckMaterial = this.patchBend(new THREE.MeshPhysicalMaterial({
      color: '#080918',
      emissive: '#07132a',
      emissiveIntensity: 0.75,
      roughness: 0.2,
      metalness: 0.58,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    }), 'coast-ramp-deck');
    const cyan = this.patchBend(new THREE.MeshBasicMaterial({
      color: '#28f6ff', toneMapped: false,
    }), 'coast-ramp-cyan');
    const magenta = this.patchBend(new THREE.MeshBasicMaterial({
      color: '#ff1c93', toneMapped: false,
    }), 'coast-ramp-magenta');

    const makeRamp = (name, accentMaterial) => {
      const group = new THREE.Group();
      group.name = name;
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(11.8, 0.5, RAMP_LENGTH, 1, 1, this.isMobile ? 12 : 24),
        deckMaterial,
      );
      deck.position.y = RAMP_CENTER_Y;
      deck.rotation.x = RAMP_TILT;
      deck.castShadow = true;
      deck.receiveShadow = true;
      group.add(deck);

      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.18, RAMP_LENGTH),
          side < 0 ? cyan : magenta,
        );
        rail.position.set(side * 5.78, 1.06, 0);
        rail.rotation.x = RAMP_TILT;
        group.add(rail);
      }
      for (let index = 0; index < 5; index++) {
        const chevronZ = 4.7 - index * 2.35;
        const rampSurfaceY = RAMP_CENTER_Y
          - chevronZ * Math.sin(RAMP_TILT)
          + Math.cos(RAMP_TILT) * 0.25;
        const chevron = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.045, 0.18), accentMaterial);
        chevron.position.set(0, rampSurfaceY + 0.035, chevronZ);
        chevron.rotation.x = RAMP_TILT;
        group.add(chevron);
      }
      const portal = new THREE.Group();
      const portalZ = -5.4;
      const portalSurfaceY = RAMP_CENTER_Y
        - portalZ * Math.sin(RAMP_TILT)
        + Math.cos(RAMP_TILT) * 0.25;
      const portalHeight = 4.1;
      const portalPostGeometry = new THREE.BoxGeometry(0.22, portalHeight, 0.24);
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(portalPostGeometry, side < 0 ? cyan : magenta);
        post.position.set(side * 6.05, portalSurfaceY + portalHeight * 0.5, portalZ);
        portal.add(post);
      }
      const header = new THREE.Mesh(new THREE.BoxGeometry(12.3, 0.24, 0.24), accentMaterial);
      header.position.set(0, portalSurfaceY + portalHeight, portalZ);
      portal.add(header);
      group.add(portal);
      this.transitionGroup.add(group);
      return group;
    };

    this.entryRamp = makeRamp('City to coastal hotel jump ramp', cyan);
    this.exitRamp = makeRamp('Coastal causeway jump ramp', magenta);
  }

  createJumpEffects() {
    this.jumpFxGroup = new THREE.Group();
    this.jumpFxGroup.name = 'GSAP ramp jump boost energy';
    this.jumpFxGroup.position.y = 0.85;
    this.jumpFxGroup.visible = false;
    this.carImpactRig.add(this.jumpFxGroup);

    this.jumpCoreMaterial = new THREE.MeshBasicMaterial({
      color: '#f3ffff',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.72, 18, 12), this.jumpCoreMaterial);
    core.scale.set(1.1, 0.62, 1.45);
    this.jumpFxGroup.add(core);

    this.jumpRingMaterials = ['#25efff', '#ff2d9b'].map((color) => new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    }));
    this.jumpRingMaterials.forEach((material, index) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.05 + index * 0.32, 0.045, 8, 42), material);
      ring.rotation.set(index ? 0.45 : -0.32, index ? 0.25 : -0.22, index * Math.PI / 2);
      this.jumpFxGroup.add(ring);
    });
  }

  createJumpTimelines() {
    this.vehiclePose = {
      lift: 0,
      pitch: 0,
      roll: 0,
      jumpEnergy: 0,
    };
    this.entryJumpTimeline = gsap.timeline({ paused: true });
    this.entryJumpTimeline
      .fromTo(this.vehiclePose, {
        lift: RAMP_LAUNCH_HEIGHT, pitch: RAMP_TILT, roll: 0,
        jumpEnergy: 0,
      }, {
        lift: this.prefersReducedMotion() ? 1.4 : 3.4,
        pitch: this.prefersReducedMotion() ? -0.06 : -0.18,
        roll: this.prefersReducedMotion() ? 0 : 0.055,
        jumpEnergy: 1,
        duration: 0.48,
        ease: 'power2.out',
        immediateRender: false,
      })
      .to(this.vehiclePose, {
        lift: 0,
        pitch: 0,
        roll: 0,
        jumpEnergy: 0,
        duration: 0.52,
        ease: 'power2.in',
      });

    this.exitJumpTimeline = gsap.timeline({ paused: true });
    this.exitJumpTimeline
      .fromTo(this.vehiclePose, {
        lift: RAMP_LAUNCH_HEIGHT, pitch: RAMP_TILT, roll: 0,
        jumpEnergy: 0,
      }, {
        lift: this.prefersReducedMotion() ? 1.4 : 3.25,
        pitch: this.prefersReducedMotion() ? -0.05 : -0.16,
        roll: this.prefersReducedMotion() ? 0 : -0.055,
        jumpEnergy: 1,
        duration: 0.48,
        ease: 'power2.out',
        immediateRender: false,
      })
      .to(this.vehiclePose, {
        lift: 0,
        pitch: 0,
        roll: 0,
        jumpEnergy: 0,
        duration: 0.52,
        ease: 'power2.in',
      });
    this.syncJumpPose(driveSectionAtDistance(0));
  }

  applyJumpPose() {
    const pose = this.vehiclePose;
    this.vehicleLiftRig.position.y = pose.lift;
    this.vehicleLiftRig.rotation.set(pose.pitch, 0, pose.roll);
    this.carVisualRig.visible = true;
    this.carVisualRig.scale.setScalar(1);
    this.carVisualRig.rotation.y = 0;
    if (this.jumpFxGroup) {
      const energy = THREE.MathUtils.clamp(pose.jumpEnergy, 0, 1);
      this.jumpFxGroup.visible = energy > 0.01;
      this.jumpFxGroup.scale.setScalar(0.62 + energy * 0.5);
      this.jumpFxGroup.rotation.z = energy * 0.72;
      this.jumpCoreMaterial.opacity = energy * (this.prefersReducedMotion() ? 0.07 : 0.14);
      this.jumpRingMaterials[0].opacity = energy * 0.58;
      this.jumpRingMaterials[1].opacity = energy * 0.38;
    }
  }

  syncJumpPose(section) {
    if (!this.vehiclePose) return;
    const entryRampElevation = rampElevationBeforeMarker(
      section.cycleDistance,
      COAST_ENTRY_START,
    );
    const exitRampElevation = rampElevationBeforeMarker(
      section.cycleDistance,
      COAST_EXIT_START,
    );
    this.state.transitionElevation = 0;
    if (section.phase === 'coast-entry') {
      this.state.transitionElevation = RAMP_LAUNCH_HEIGHT
        * (1 - smootherStep01(section.progress / 0.22));
      this.entryJumpTimeline.progress(section.progress, true);
    } else if (section.phase === 'coast-approach') {
      this.state.transitionElevation = entryRampElevation;
      Object.assign(this.vehiclePose, {
        lift: entryRampElevation,
        pitch: entryRampElevation > 0.001 ? RAMP_TILT : 0,
        roll: 0,
        jumpEnergy: 0,
      });
    } else if (section.phase === 'coast') {
      this.state.transitionElevation = exitRampElevation;
      Object.assign(this.vehiclePose, {
        lift: exitRampElevation,
        pitch: exitRampElevation > 0.001 ? RAMP_TILT : 0,
        roll: 0,
        jumpEnergy: 0,
      });
    } else if (section.phase === 'coast-exit') {
      this.state.transitionElevation = RAMP_LAUNCH_HEIGHT
        * (1 - smootherStep01(section.progress / 0.22));
      this.exitJumpTimeline.progress(section.progress, true);
    } else {
      Object.assign(this.vehiclePose, {
        lift: 0, pitch: 0, roll: 0,
        jumpEnergy: 0,
      });
    }
    this.applyJumpPose();
  }

  updateTransitionRamps(section) {
    const localDistance = section.cycleDistance;
    const entryDelta = COAST_ENTRY_START - localDistance;
    const exitDelta = COAST_EXIT_START - localDistance;
    // At each marker the high/front edge (local -Z) reaches the fixed car.
    // This makes the deck climb in the travel direction and launch cleanly.
    this.entryRamp.position.z = CAR_Z + RAMP_HALF_LENGTH - entryDelta;
    this.exitRamp.position.z = CAR_Z + RAMP_HALF_LENGTH - exitDelta;
    this.entryRamp.visible = localDistance > COAST_ENTRY_START - 72
      && localDistance < COAST_ENTRY_START + 0.65;
    this.exitRamp.visible = localDistance > COAST_EXIT_START - 96
      && localDistance < COAST_EXIT_START + 0.65;
    this.transitionGroup.visible = this.entryRamp.visible
      || this.exitRamp.visible;
  }

  createLights() {
    this.root.add(new THREE.HemisphereLight('#2a2358', '#010105', 0.15));
    const cyanLight = new THREE.PointLight('#19dfff', 2.35, 16, 2);
    cyanLight.position.set(-5, 3.5, 7);
    const magentaLight = new THREE.PointLight('#ff127f', 2.9, 18, 2);
    magentaLight.position.set(5, 3.2, 4);
    this.root.add(cyanLight, magentaLight);
  }

  applySectionState(section, { emit = false } = {}) {
    const previousPhase = this.state.phase;
    const previousBridgeVariant = this.state.bridgeVariant;
    Object.assign(this.state, {
      phase: section.phase,
      sectionLabel: section.label,
      cycleIndex: section.cycleIndex,
      cycleDistance: section.cycleDistance,
      sectionProgress: section.progress,
      vehicle: section.vehicle,
      surface: section.surface,
      airborne: section.surface === 'air',
      biome: section.biome,
      roadElevation: section.roadElevation,
      roadGrade: section.roadGrade,
      bridgeVariant: section.bridgeVariant,
      bridgeProgress: section.bridgeProgress,
      collisionProfile: section.collisionProfile,
    });
    this.car.position.y = 0.06 + section.roadElevation;
    // The coupe faces local -Z, so a positive X rotation raises its nose to
    // match a positive forward bridge grade.
    this.car.rotation.x = section.roadGrade;

    const coastalVisible = COAST_SCENERY_PHASES.has(section.phase);
    const desertVisible = DESERT_PHASES.has(section.phase)
      || (
        section.phase === 'coast-departure'
        && section.cycleDistance >= 970
      );
    const bridgeVisible = BRIDGE_PHASES.has(section.phase);
    const roadVisible = !bridgeVisible;
    const cityVisible = section.phase === 'city'
      || section.phase === 'coast-approach'
      || section.phase === 'coast-entry';
    if (coastalVisible && !COAST_SCENERY_PHASES.has(previousPhase)) {
      this.coastalSection.reset();
    }
    if (
      (previousPhase === 'coast-entry' && section.phase === 'coast')
      || (previousPhase === 'coast-exit' && section.phase === 'coast-departure')
    ) {
      this.runnerObjects.forEach((object, index) => {
        this.recycleRunnerObject(object, -42 - index * 19);
      });
    }
    if (desertVisible && !this.desertSection.active) {
      this.desertSection.reset();
    }
    if (bridgeVisible && (!BRIDGE_PHASES.has(previousPhase)
      || previousBridgeVariant !== section.bridgeVariant)) {
      this.bridgeSection.reset({ variant: section.bridgeVariant });
    }
    if (previousPhase === 'bridge-descent' && section.phase === 'desert-return') {
      this.runnerObjects.forEach((object, index) => {
        this.recycleRunnerObject(object, -42 - index * 19);
      });
    }
    this.roadEnvironment.visible = roadVisible;
    this.terrainGroup.visible = cityVisible;
    this.cityGroup.visible = cityVisible;
    this.runnerGroup.visible = section.collisionProfile === 'road';
    this.coastalSection.setActive(coastalVisible);
    this.desertSection.setActive(desertVisible);
    this.bridgeSection.setActive(bridgeVisible);
    this.roadsideProps.setActive(ROADSIDE_PHASES.has(section.phase));
    if (bridgeVisible && !emit) {
      this.bridgeSection.update(0, {
        active: false,
        sectionProgress: section.bridgeProgress,
        phase: section.phase,
        cycleIndex: section.cycleIndex,
      });
    }
    this.updateTransitionRamps(section);
    this.syncJumpPose(section);
    this.visualGains?.setSurface?.(section.surface);
    this.updateAtmosphere(section, { immediate: !emit });

    if (emit && previousPhase !== section.phase) {
      const eventByPhase = {
        'coast-approach': 'coast-ahead',
        'coast-entry': 'entry-jump',
        coast: 'coast-entered',
        'coast-exit': 'exit-jump',
        'coast-departure': 'coast-returned',
        'desert-approach': 'desert-ahead',
        desert: 'desert-entered',
        'bridge-climb': 'bridge-climb',
        'bridge-span': 'bridge-span',
        'bridge-descent': 'bridge-descent',
        'desert-return': 'desert-returned',
        city: previousPhase === 'desert-return' ? 'city-returned' : 'city-loop',
      };
      this.onSectionChange({
        event: eventByPhase[section.phase],
        previousPhase,
        ...section,
      });
    }
  }

  reset(startDistance = 0) {
    this.randomState = 0x5f3759df;
    const safeStartDistance = Math.max(0, Number.isFinite(startDistance) ? startDistance : 0);
    const startSection = driveSectionAtDistance(safeStartDistance);
    Object.assign(this.state, {
      laneIndex: 1, targetLane: 1, lateralX: 0, distance: safeStartDistance, speed: 0,
      shards: 0, score: Math.floor(safeStartDistance * 2),
      elapsed: 0, crashed: false, laneChanges: 0,
      phase: startSection.phase,
      sectionLabel: startSection.label,
      cycleIndex: startSection.cycleIndex,
      cycleDistance: startSection.cycleDistance,
      sectionProgress: startSection.progress,
      vehicle: startSection.vehicle,
      surface: startSection.surface,
      airborne: startSection.surface === 'air',
      biome: startSection.biome,
      roadElevation: startSection.roadElevation,
      roadGrade: startSection.roadGrade,
      bridgeVariant: startSection.bridgeVariant,
      bridgeProgress: startSection.bridgeProgress,
      collisionProfile: startSection.collisionProfile,
      transitionElevation: 0,
    });
    this.car.position.set(0, 0.06 + startSection.roadElevation, CAR_Z);
    this.car.rotation.set(0, 0, 0);
    this.laneTimeline?.kill();
    this.impactTimeline?.kill();
    this.carIdleTimeline.pause(0);
    gsap.killTweensOf([
      this.carMotionRig.rotation,
      this.vehicleLiftRig.position,
      this.vehicleLiftRig.rotation,
      this.carImpactRig.position,
      this.carImpactRig.rotation,
      this.carImpactRig.scale,
    ]);
    this.carMotionRig.position.set(0, 0, 0);
    this.carMotionRig.rotation.set(0, 0, 0);
    this.vehicleLiftRig.position.set(0, 0, 0);
    this.vehicleLiftRig.rotation.set(0, 0, 0);
    this.carImpactRig.position.set(0, 0, 0);
    this.carImpactRig.rotation.set(0, 0, 0);
    this.carImpactRig.scale.setScalar(1);
    this.underglow.material.opacity = 0.26;
    this.visualGains?.reset();
    this.coastalSection.reset();
    this.desertSection.reset();
    this.bridgeSection.reset({ variant: startSection.bridgeVariant });
    this.roadsideProps.reset({ biome: startSection.biome });
    this.carIdleTimeline.restart();
    this.carIdleTimeline.paused(!this.root.visible);
    this.buildings.forEach((building, index) => this.recycleBuilding(building, -18 - index * (this.isMobile ? 10 : 7.2)));
    this.runnerObjects.forEach((object, index) => this.recycleRunnerObject(object, -34 - index * 19));
    this.bendUniforms.uDriveTravel.value = safeStartDistance;
    this.bendUniforms.uBendX.value = 0.00018;
    this.asphaltNormalMap.offset.y = THREE.MathUtils.euclideanModulo(
      -safeStartDistance / 4,
      1,
    );
    this.updateTerrain(true);
    this.applySectionState(startSection);
    if (DESERT_PHASES.has(startSection.phase)) {
      const desertSegmentStart = startSection.phase === 'desert-return'
        ? BRIDGE_RETURN_START
        : DESERT_APPROACH_START;
      this.desertSection.update(0, {
        advance: Math.max(0, startSection.cycleDistance - desertSegmentStart),
        active: true,
      });
    }
  }

  setVisible(visible) {
    this.root.visible = visible;
    this.carIdleTimeline?.paused(!visible);
    this.coastalSection?.setActive(Boolean(visible && COAST_SCENERY_PHASES.has(this.state.phase)));
    this.desertSection?.setActive(Boolean(visible && DESERT_PHASES.has(this.state.phase)));
    this.bridgeSection?.setActive(Boolean(visible && BRIDGE_PHASES.has(this.state.phase)));
    this.roadsideProps?.setActive(Boolean(visible && ROADSIDE_PHASES.has(this.state.phase)));
  }

  shiftLane(direction) {
    if (this.state.crashed) return false;
    const next = THREE.MathUtils.clamp(this.state.targetLane + Math.sign(direction), 0, 2);
    if (next === this.state.targetLane) return false;
    this.state.targetLane = next;
    this.state.laneChanges += 1;
    this.animateLaneChange(Math.sign(direction));
    return true;
  }

  animateLaneChange(direction) {
    this.laneTimeline?.kill();
    gsap.killTweensOf(this.carMotionRig.rotation);
    const tilt = this.prefersReducedMotion() ? 0 : direction;
    this.laneTimeline = gsap.timeline({ defaults: { overwrite: 'auto' } });
    this.laneTimeline.to(this.carMotionRig.rotation, {
      z: -tilt * 0.12,
      y: -tilt * 0.065,
      duration: 0.1,
      ease: 'power2.out',
    }).to(this.carMotionRig.rotation, {
      z: 0,
      y: 0,
      duration: 0.27,
      ease: 'back.out(1.8)',
    });
  }

  animateShardCollect(object) {
    const shard = object.shard;
    this.visualGains?.collect(shard.position);
    gsap.killTweensOf(shard.scale);
    gsap.timeline()
      .to(shard.scale, {
        x: this.prefersReducedMotion() ? 1 : 1.7,
        y: this.prefersReducedMotion() ? 1 : 1.7,
        z: this.prefersReducedMotion() ? 1 : 1.7,
        duration: 0.1,
        ease: 'power3.out',
      })
      .to(shard.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.16,
        ease: 'power2.in',
        onComplete: () => {
          if (object.resolved && object.kind === 'shard') shard.visible = false;
        },
      });
  }

  animateCrash() {
    this.laneTimeline?.kill();
    this.impactTimeline?.kill();
    this.carIdleTimeline.pause();
    this.visualGains?.crash(new THREE.Vector3(this.state.lateralX, 0.82, CAR_Z - 0.9));
    gsap.killTweensOf([this.carMotionRig.rotation, this.carImpactRig.position, this.carImpactRig.rotation, this.carImpactRig.scale]);
    const amount = this.prefersReducedMotion() ? 0.2 : 1;
    this.impactTimeline = gsap.timeline({ defaults: { overwrite: 'auto' } });
    this.impactTimeline
      .to(this.carImpactRig.position, { z: 0.45 * amount, y: -0.08 * amount, duration: 0.08, ease: 'power3.out' }, 0)
      .to(this.carImpactRig.rotation, { y: -0.2 * amount, z: 0.13 * amount, x: 0.04 * amount, duration: 0.09, ease: 'power3.out' }, 0)
      .to(this.carImpactRig.scale, { x: 1.08, y: 0.82, z: 1.05, duration: 0.09, ease: 'power3.out' }, 0)
      .to(this.carImpactRig.position, { z: 0, y: 0, duration: 0.34, ease: 'elastic.out(1, 0.42)' })
      .to(this.carImpactRig.rotation, { x: 0, y: 0, z: 0, duration: 0.38, ease: 'elastic.out(1, 0.42)' }, '<')
      .to(this.carImpactRig.scale, { x: 1, y: 1, z: 1, duration: 0.34, ease: 'elastic.out(1, 0.42)' }, '<');
  }

  start(startDistance = 0) {
    this.reset(startDistance);
    this.state.speed = 34;
  }

  update(dt, active) {
    this.bendUniforms.uDriveTime.value += dt;
    this.terrainAccumulator += dt;
    if (!active || this.state.crashed) {
      this.coastalSection.update(dt, { active: false });
      this.desertSection.update(dt, { active: false });
      this.bridgeSection.update(dt, {
        active: false,
        sectionProgress: this.state.bridgeProgress,
        phase: this.state.phase,
        cycleIndex: this.state.cycleIndex,
      });
      this.roadsideProps.update(dt, {
        active: false,
        biome: this.state.biome,
        roadElevation: this.state.roadElevation,
        roadGrade: this.state.roadGrade,
        onBridge: false,
      });
      this.visualGains?.update(this.state, false);
      return;
    }

    this.state.elapsed += dt;
    this.state.speed = Math.min(62, this.state.speed + dt * 0.72);
    const advance = this.state.speed * dt;
    this.state.distance += advance;
    const section = driveSectionAtDistance(this.state.distance);
    this.applySectionState(section, { emit: true });
    const roadGameplayActive = section.collisionProfile === 'road';
    const desertSceneryActive = DESERT_PHASES.has(section.phase)
      || (
        section.phase === 'coast-departure'
        && section.cycleDistance >= 970
      );
    const targetX = LANE_X[this.state.targetLane];
    this.state.lateralX = smoothDamp(this.state.lateralX, targetX, 11.5, dt);
    this.car.position.x = this.state.lateralX;
    if (Math.abs(this.state.lateralX - targetX) < 0.08) this.state.laneIndex = this.state.targetLane;

    this.bendUniforms.uDriveTravel.value = this.state.distance;
    this.asphaltNormalMap.offset.y = THREE.MathUtils.euclideanModulo(
      -this.state.distance / 4,
      1,
    );
    this.bendUniforms.uBendX.value = Math.sin(this.state.distance * 0.0042) * 0.00031 + Math.sin(this.state.distance * 0.0013 + 1.4) * 0.00011;
    this.bendUniforms.uBendY.value = 0.00122 + Math.sin(this.state.distance * 0.0018) * 0.00013;

    let farthestBuildingZ = Infinity;
    for (const building of this.buildings) farthestBuildingZ = Math.min(farthestBuildingZ, building.group.position.z);
    for (const building of this.buildings) {
      building.group.position.z += advance * building.speedFactor;
      if (building.group.position.z > 24) {
        farthestBuildingZ -= 7 + this.random() * 7;
        this.recycleBuilding(building, farthestBuildingZ);
      }
    }

    let farthestObjectZ = Infinity;
    for (const object of this.runnerObjects) farthestObjectZ = Math.min(farthestObjectZ, object.z);
    for (const object of this.runnerObjects) {
      object.z += advance;
      object.barrier.position.z = object.z;
      object.shard.position.z = object.z;
      if (object.kind === 'shard') {
        const phase = this.motionPhase.shard + object.z * 0.07;
        object.shard.rotation.y = phase;
        object.shard.rotation.x = phase * 0.37;
        object.shard.position.y = 1.05 + Math.sin(phase * 1.3) * (this.prefersReducedMotion() ? 0 : 0.12);
      }
      if (!object.resolved && roadGameplayActive) {
        const longitudinalDistance = Math.abs(object.z - CAR_Z);
        const lateralDistance = Math.abs(this.state.lateralX - LANE_X[object.lane]);
        if (object.kind === 'shard' && longitudinalDistance < 1.8 && lateralDistance < 1.85) {
          object.resolved = true;
          this.state.shards += 1;
          this.animateShardCollect(object);
          this.onCollect(this.state, 'shard');
        } else if (object.kind === 'barrier' && longitudinalDistance < 2.9 && lateralDistance < 2.66) {
          object.resolved = true;
          this.state.crashed = true;
          this.state.speed = 0;
          this.animateCrash();
          this.onCrash(this.state);
        } else if (object.z > CAR_Z + 3.1) {
          object.resolved = true;
        }
      }
      if (object.z > 18) {
        farthestObjectZ -= 16 + this.random() * 9;
        this.recycleRunnerObject(object, farthestObjectZ);
      }
    }

    this.coastalSection.update(dt, {
      advance,
      active: COAST_SCENERY_PHASES.has(section.phase),
    });
    this.desertSection.update(dt, {
      advance,
      active: desertSceneryActive,
    });
    this.bridgeSection.update(dt, {
      advance,
      active: BRIDGE_PHASES.has(section.phase),
      phase: section.phase,
      sectionProgress: section.bridgeProgress,
      cycleIndex: section.cycleIndex,
      variant: section.bridgeVariant,
      roadElevation: section.roadElevation,
      roadGrade: section.roadGrade,
    });
    this.roadsideProps.update(dt, {
      advance,
      active: ROADSIDE_PHASES.has(section.phase),
      biome: section.biome,
      roadElevation: section.roadElevation,
      roadGrade: section.roadGrade,
      // The bridge already owns profile-sampled road lights and suspension
      // towers. Roadside furniture stays on the bent common-road biomes so
      // distant gantries cannot detach from a curved climb.
      onBridge: false,
    });
    this.state.score = Math.floor(this.state.distance * 2 + this.state.shards * 125);
    if (this.terrainGroup.visible) this.updateTerrain();
    this.visualGains?.update(this.state, !this.state.crashed);
  }

  getCameraPose(target, position) {
    const portrait = this.viewportAspect < 0.78;
    const targetFollow = this.isMobile ? 0.88 : 0.38;
    const cameraFollow = this.isMobile ? 0.98 : 0.82;
    const elevation = (this.state.roadElevation || 0)
      + (this.state.transitionElevation || 0);
    target.set(
      DRIVE_ORIGIN_X + this.state.lateralX * targetFollow,
      (portrait ? 1.65 : 1.3) + elevation,
      portrait ? -10.7 : -9.5,
    );
    position.set(
      DRIVE_ORIGIN_X + this.state.lateralX * cameraFollow,
      (portrait ? 7.25 : 6.4) + elevation,
      portrait ? 20.8 : 18.2,
    );
    return { target, position };
  }

  setViewport(width, height) {
    this.viewportAspect = Math.max(1, width) / Math.max(1, height);
  }

  getCarWorldPosition(target = this.worldCarPosition) {
    return target.set(
      DRIVE_ORIGIN_X + this.state.lateralX,
      this.car.position.y + this.vehicleLiftRig.position.y,
      CAR_Z,
    );
  }

  nearbyObjects() {
    if (this.state.collisionProfile !== 'road') return [];
    return this.runnerObjects
      .filter((object) => object.z > -70 && object.z < 16)
      .sort((a, b) => b.z - a.z)
      .slice(0, 6)
      .map((object) => ({
        kind: object.kind,
        lane: object.lane,
        z: +object.z.toFixed(1),
        resolved: object.resolved,
        surface: 'road',
      }));
  }

  snapshot() {
    return {
      laneIndex: this.state.laneIndex,
      targetLane: this.state.targetLane,
      laneX: +this.state.lateralX.toFixed(2),
      laneCenters: LANE_X,
      speed: +this.state.speed.toFixed(2),
      distance: +this.state.distance.toFixed(1),
      score: this.state.score,
      shards: this.state.shards,
      pickups: this.state.shards,
      crashed: this.state.crashed,
      laneChanges: this.state.laneChanges,
      phase: this.state.phase,
      sectionLabel: this.state.sectionLabel,
      sectionProgress: +this.state.sectionProgress.toFixed(3),
      cycleIndex: this.state.cycleIndex,
      cycleDistance: +this.state.cycleDistance.toFixed(1),
      cycleLength: DRIVE_CYCLE_LENGTH,
      vehicle: this.state.vehicle,
      surface: this.state.surface,
      airborne: this.state.airborne,
      biome: this.state.biome,
      roadElevation: +this.state.roadElevation.toFixed(2),
      roadGrade: +this.state.roadGrade.toFixed(4),
      transitionElevation: +this.state.transitionElevation.toFixed(2),
      sunset: +this.state.sunset.toFixed(3),
      starVisibility: +this.state.starVisibility.toFixed(3),
      desertBlend: +this.state.desertBlend.toFixed(3),
      coastBlend: +this.state.coastBlend.toFixed(3),
      fogNear: +this.state.fogNear.toFixed(1),
      fogFar: +this.state.fogFar.toFixed(1),
      bridgeVariant: this.state.bridgeVariant,
      bridgeProgress: +this.state.bridgeProgress.toFixed(3),
      collisionProfile: this.state.collisionProfile,
      transitionMarkers: {
        coastApproach: COAST_APPROACH_START,
        entryRamp: COAST_ENTRY_START,
        coastRun: COAST_RUN_START,
        exitRamp: COAST_EXIT_START,
        coastDeparture: COAST_RETURN_START,
        desertApproach: DESERT_APPROACH_START,
        desertRun: DESERT_RUN_START,
        bridgeClimb: BRIDGE_CLIMB_START,
        bridgeSpan: BRIDGE_SPAN_START,
        bridgeDescent: BRIDGE_DESCENT_START,
        bridgeReturn: BRIDGE_RETURN_START,
        cityReturn: CITY_RETURN_START,
      },
      bendX: +this.bendUniforms.uBendX.value.toFixed(6),
      bendY: +this.bendUniforms.uBendY.value.toFixed(6),
      terrain: 'camera-centered ImprovedNoise FBM mesh resampled during travel',
      roadSurface: {
        normalMap: `${this.asphaltNormalMap.image.width}x${this.asphaltNormalMap.image.height} procedural tangent-space asphalt`,
        normalRepeat: [this.asphaltNormalMap.repeat.x, this.asphaltNormalMap.repeat.y],
        puddles: 'organic shader mask with low roughness and flattened micro-normal',
        sideMarkings: 'wide cyan and magenta 14-meter scrolling dashes with long painted strokes',
      },
      visualGains: this.visualGains?.snapshot(),
      coast: this.coastalSection.snapshot(),
      desert: this.desertSection.snapshot(),
      bridge: this.bridgeSection.snapshot(),
      roadside: this.roadsideProps.snapshot(),
      nearbyObjects: this.nearbyObjects(),
    };
  }
}
