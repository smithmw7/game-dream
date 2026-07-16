import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import './style.css';

await RAPIER.init({});

const canvas = document.querySelector('#game');
const splash = document.querySelector('#splash');
const freeModeButton = document.querySelector('#free-mode-button');
const raceModeButton = document.querySelector('#race-mode-button');
const raceBriefing = document.querySelector('#race-briefing');
const raceStartButton = document.querySelector('#race-start-button');
const raceBackButton = document.querySelector('#race-back-button');
const finishPanel = document.querySelector('#finish-panel');
const raceReplayButton = document.querySelector('#race-replay-button');
const finishFreeButton = document.querySelector('#finish-free-button');
const countdown = document.querySelector('#countdown');
const countdownValue = document.querySelector('#countdown-value');
const raceHud = document.querySelector('#race-hud');
const hudTime = document.querySelector('#hud-time');
const hudCoins = document.querySelector('#hud-coins');
const hudCheckpoint = document.querySelector('#hud-checkpoint');
const hudShield = document.querySelector('#hud-shield');
const speedFill = document.querySelector('#speed-fill');
const raceToast = document.querySelector('#race-toast');
const briefBestTime = document.querySelector('#brief-best-time');
const briefBestCoins = document.querySelector('#brief-best-coins');
const finishTitle = document.querySelector('#finish-title');
const finishTime = document.querySelector('#finish-time');
const finishCoins = document.querySelector('#finish-coins');
const finishBest = document.querySelector('#finish-best');
const finishRecord = document.querySelector('#finish-record');
const resetButton = document.querySelector('#reset-button');
const fpsValue = document.querySelector('#fps-value');
const touchJoystick = document.querySelector('#touch-joystick');
const touchStick = document.querySelector('#touch-stick');
const mobileQuery = new URLSearchParams(location.search).has('mobile');
const isMobileDevice = mobileQuery || Boolean(
  navigator.userAgentData?.mobile ||
  matchMedia('(pointer: coarse)').matches ||
  navigator.maxTouchPoints > 0 ||
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent),
);
document.body.classList.toggle('is-mobile', isMobileDevice);
if (isMobileDevice) {
  document.querySelector('#touch-hint').textContent = 'AUTO FORWARD · DRAG TO STEER · TAP TO JUMP';
}

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#9fc4ca', 38, 92);

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.08, 100);
camera.position.set(6, 5, 11);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
const qualityRatio = Math.min(devicePixelRatio, isMobileDevice ? 1 : 1.75);
renderer.setPixelRatio(qualityRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.72;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const sunDirection = new THREE.Vector3();
const skySettings = {
  turbidity: 1.15,
  rayleigh: 4.0,
  mieCoefficient: 0.0012,
  mieDirectionalG: 0.7,
  elevation: 27,
  azimuth: 195,
};

function configureSky(sky, showSunDisc = true) {
  const uniforms = sky.material.uniforms;
  uniforms.turbidity.value = skySettings.turbidity;
  uniforms.rayleigh.value = skySettings.rayleigh;
  uniforms.mieCoefficient.value = skySettings.mieCoefficient;
  uniforms.mieDirectionalG.value = skySettings.mieDirectionalG;
  uniforms.showSunDisc.value = showSunDisc;

  const phi = THREE.MathUtils.degToRad(90 - skySettings.elevation);
  const theta = THREE.MathUtils.degToRad(skySettings.azimuth);
  sunDirection.setFromSphericalCoords(1, phi, theta).normalize();
  uniforms.sunPosition.value.copy(sunDirection);
}

function styleVisibleSky(sky) {
  sky.material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec3 texColor = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );',
      'vec3 texColor = ( Lin + L0 ) * 0.012 + vec3( 0.002, 0.018, 0.075 ); texColor *= vec3( 0.34, 0.62, 1.22 );',
    );
  };
  sky.material.customProgramCacheKey = () => 'game-dream-visible-sky-v1';
  sky.material.needsUpdate = true;
}

const sky = new Sky();
sky.scale.setScalar(1000);
configureSky(sky, true);
styleVisibleSky(sky);
scene.add(sky);

// Generate image-based PBR lighting from the same procedural sky without its hard sun disc.
const environmentScene = new THREE.Scene();
const environmentSky = new Sky();
environmentSky.scale.setScalar(1000);
configureSky(environmentSky, false);
environmentScene.add(environmentSky);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(environmentScene, 0.015, 0.1, 1000).texture;
scene.environmentIntensity = 0.58;
pmrem.dispose();
environmentSky.geometry.dispose();
environmentSky.material.dispose();

const sun = new THREE.DirectionalLight('#ffd2a0', 3.8);
sun.position.copy(sunDirection).multiplyScalar(28);
sun.castShadow = true;
sun.shadow.mapSize.set(isMobileDevice ? 1024 : 2048, isMobileDevice ? 1024 : 2048);
sun.shadow.radius = 4;
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.035;
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 42 });
scene.add(sun);
scene.add(sun.target);
scene.add(new THREE.HemisphereLight('#b9e3ef', '#d89770', 0.24));

const world = new RAPIER.World({ x: 0, y: -19.5, z: 0 });
world.timestep = 1 / 60;

const materials = {
  sand: new THREE.MeshStandardMaterial({ color: '#e5b47d', roughness: 0.91, metalness: 0, envMapIntensity: 0.34 }),
  gold: new THREE.MeshStandardMaterial({ color: '#efaa28', roughness: 0.58, metalness: 0, envMapIntensity: 0.68 }),
  coral: new THREE.MeshStandardMaterial({ color: '#e37873', roughness: 0.72, metalness: 0, envMapIntensity: 0.48 }),
  rose: new THREE.MeshStandardMaterial({ color: '#d98bab', roughness: 0.75, metalness: 0, envMapIntensity: 0.45 }),
  poolTile: new THREE.MeshStandardMaterial({ color: '#c8edf0', roughness: 0.32, metalness: 0, envMapIntensity: 0.78, side: THREE.DoubleSide }),
  poolEdge: new THREE.MeshStandardMaterial({ color: '#fff0d1', roughness: 0.52, metalness: 0, envMapIntensity: 0.58 }),
};

const PLAYER_RADIUS = 0.72;

const RECT_POOL = { x: -7.2, z: 4.6, width: 6.4, depth: 3.7, waterY: -0.17 };
const ROUND_POOL = { x: 7.1, z: 0.6, radius: 2.72, waterY: -0.17 };

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addFixedBox({ size, position, material = materials.sand, rotationY = 0, bevel = false }) {
  let geometry;
  if (bevel) {
    geometry = new THREE.BoxGeometry(size.x, size.y, size.z, 2, 2, 2);
  } else {
    geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  }
  const mesh = shadowed(new THREE.Mesh(geometry, material));
  mesh.position.copy(position);
  mesh.rotation.y = rotationY;
  scene.add(mesh);

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z).setRotation({
      x: 0,
      y: Math.sin(rotationY / 2),
      z: 0,
      w: Math.cos(rotationY / 2),
    })
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2).setFriction(1.25), body);
  return mesh;
}

function addGroundWithPoolCutouts() {
  const half = 35;
  const shape = new THREE.Shape();
  shape.moveTo(-half, -half);
  shape.lineTo(half, -half);
  shape.lineTo(half, half);
  shape.lineTo(-half, half);
  shape.closePath();

  // Shape-space Y maps to negative world Z after the geometry is laid flat.
  const rectHole = new THREE.Path();
  const rx0 = RECT_POOL.x - RECT_POOL.width / 2;
  const rx1 = RECT_POOL.x + RECT_POOL.width / 2;
  const rz0 = -RECT_POOL.z - RECT_POOL.depth / 2;
  const rz1 = -RECT_POOL.z + RECT_POOL.depth / 2;
  rectHole.moveTo(rx0, rz0);
  rectHole.lineTo(rx0, rz1);
  rectHole.lineTo(rx1, rz1);
  rectHole.lineTo(rx1, rz0);
  rectHole.closePath();
  shape.holes.push(rectHole);

  const roundHole = new THREE.Path();
  roundHole.absarc(ROUND_POOL.x, -ROUND_POOL.z, ROUND_POOL.radius, 0, Math.PI * 2, true);
  shape.holes.push(roundHole);

  const geometry = new THREE.ShapeGeometry(shape, 48);
  geometry.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(geometry, materials.sand);
  ground.position.y = 0.015;
  ground.receiveShadow = true;
  scene.add(ground);

  const positions = new Float32Array(geometry.attributes.position.array);
  let indices;
  if (geometry.index) {
    indices = new Uint32Array(geometry.index.array);
  } else {
    indices = new Uint32Array(geometry.attributes.position.count);
    for (let i = 0; i < indices.length; i++) indices[i] = i;
  }
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0.015, 0));
  world.createCollider(RAPIER.ColliderDesc.trimesh(positions, indices).setFriction(1.25), body);
}

function addFixedCylinder({ radius, height, position, material }) {
  const mesh = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 64), material));
  mesh.position.copy(position);
  scene.add(mesh);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z));
  world.createCollider(RAPIER.ColliderDesc.cylinder(height / 2, radius).setFriction(0.85), body);
  return mesh;
}

function addPools() {
  // Rectangle liner, bottom, walls, and a narrow raised coping.
  addFixedBox({
    size: new THREE.Vector3(RECT_POOL.width, 0.16, RECT_POOL.depth),
    position: new THREE.Vector3(RECT_POOL.x, -1.28, RECT_POOL.z),
    material: materials.poolTile,
  });
  const rectWallHeight = 1.24;
  const rectWallY = -0.62;
  addFixedBox({ size: new THREE.Vector3(0.2, rectWallHeight, RECT_POOL.depth), position: new THREE.Vector3(RECT_POOL.x - RECT_POOL.width / 2 + 0.1, rectWallY, RECT_POOL.z), material: materials.poolTile });
  addFixedBox({ size: new THREE.Vector3(0.2, rectWallHeight, RECT_POOL.depth), position: new THREE.Vector3(RECT_POOL.x + RECT_POOL.width / 2 - 0.1, rectWallY, RECT_POOL.z), material: materials.poolTile });
  addFixedBox({ size: new THREE.Vector3(RECT_POOL.width, rectWallHeight, 0.2), position: new THREE.Vector3(RECT_POOL.x, rectWallY, RECT_POOL.z - RECT_POOL.depth / 2 + 0.1), material: materials.poolTile });
  addFixedBox({ size: new THREE.Vector3(RECT_POOL.width, rectWallHeight, 0.2), position: new THREE.Vector3(RECT_POOL.x, rectWallY, RECT_POOL.z + RECT_POOL.depth / 2 - 0.1), material: materials.poolTile });

  const coping = 0.28;
  addFixedBox({ size: new THREE.Vector3(coping, 0.14, RECT_POOL.depth + coping * 2), position: new THREE.Vector3(RECT_POOL.x - RECT_POOL.width / 2 - coping / 2, 0.07, RECT_POOL.z), material: materials.poolEdge });
  addFixedBox({ size: new THREE.Vector3(coping, 0.14, RECT_POOL.depth + coping * 2), position: new THREE.Vector3(RECT_POOL.x + RECT_POOL.width / 2 + coping / 2, 0.07, RECT_POOL.z), material: materials.poolEdge });
  addFixedBox({ size: new THREE.Vector3(RECT_POOL.width, 0.14, coping), position: new THREE.Vector3(RECT_POOL.x, 0.07, RECT_POOL.z - RECT_POOL.depth / 2 - coping / 2), material: materials.poolEdge });
  addFixedBox({ size: new THREE.Vector3(RECT_POOL.width, 0.14, coping), position: new THREE.Vector3(RECT_POOL.x, 0.07, RECT_POOL.z + RECT_POOL.depth / 2 + coping / 2), material: materials.poolEdge });

  // Round pool uses a true circular visual liner with segmented tangent colliders.
  addFixedCylinder({ radius: ROUND_POOL.radius, height: 0.16, position: new THREE.Vector3(ROUND_POOL.x, -1.28, ROUND_POOL.z), material: materials.poolTile });
  const roundWall = new THREE.Mesh(
    new THREE.CylinderGeometry(ROUND_POOL.radius, ROUND_POOL.radius, 1.25, 96, 1, true),
    materials.poolTile,
  );
  roundWall.position.set(ROUND_POOL.x, -0.63, ROUND_POOL.z);
  roundWall.receiveShadow = true;
  scene.add(roundWall);

  const segments = 24;
  const wallLength = 2 * ROUND_POOL.radius * Math.tan(Math.PI / segments) + 0.04;
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = ROUND_POOL.x + Math.cos(angle) * (ROUND_POOL.radius - 0.09);
    const z = ROUND_POOL.z + Math.sin(angle) * (ROUND_POOL.radius - 0.09);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(x, -0.62, z)
        .setRotation({ x: 0, y: Math.sin(-angle / 2), z: 0, w: Math.cos(-angle / 2) })
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.11, 0.62, wallLength / 2).setFriction(0.85), body);
  }

  const ring = shadowed(new THREE.Mesh(
    new THREE.RingGeometry(ROUND_POOL.radius, ROUND_POOL.radius + 0.32, 96),
    materials.poolEdge,
  ));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(ROUND_POOL.x, 0.075, ROUND_POOL.z);
  scene.add(ring);
}

function makeProceduralWaterNormals(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const height = (u, v) => (
    Math.sin((u * 3 + v * 2) * Math.PI * 2) * 0.52 +
    Math.sin((u * 7 - v * 5) * Math.PI * 2) * 0.25 +
    Math.sin((u * 13 + v * 11) * Math.PI * 2) * 0.08
  );
  const step = 1 / size;
  const normal = new THREE.Vector3();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const dx = height((u + step) % 1, v) - height((u - step + 1) % 1, v);
      const dy = height(u, (v + step) % 1) - height(u, (v - step + 1) % 1);
      normal.set(-dx * 3.6, 1, -dy * 3.6).normalize();
      const offset = (y * size + x) * 4;
      data[offset] = Math.round((normal.x * 0.5 + 0.5) * 255);
      data[offset + 1] = Math.round((normal.y * 0.5 + 0.5) * 255);
      data[offset + 2] = Math.round((normal.z * 0.5 + 0.5) * 255);
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeSubdividedDisc(radius, radialSegments = 18, angularSegments = 96) {
  const positions = [0, 0, 0];
  const normals = [0, 0, 1];
  const uvs = [0.5, 0.5];
  const indices = [];

  for (let ring = 1; ring <= radialSegments; ring++) {
    const ringRadius = radius * (ring / radialSegments);
    for (let segment = 0; segment < angularSegments; segment++) {
      const angle = (segment / angularSegments) * Math.PI * 2;
      const x = Math.cos(angle) * ringRadius;
      const y = Math.sin(angle) * ringRadius;
      positions.push(x, y, 0);
      normals.push(0, 0, 1);
      uvs.push(x / (radius * 2) + 0.5, y / (radius * 2) + 0.5);
    }
  }

  for (let segment = 0; segment < angularSegments; segment++) {
    indices.push(0, 1 + segment, 1 + ((segment + 1) % angularSegments));
  }
  for (let ring = 2; ring <= radialSegments; ring++) {
    const innerStart = 1 + (ring - 2) * angularSegments;
    const outerStart = 1 + (ring - 1) * angularSegments;
    for (let segment = 0; segment < angularSegments; segment++) {
      const next = (segment + 1) % angularSegments;
      indices.push(
        innerStart + segment, outerStart + segment, outerStart + next,
        innerStart + segment, outerStart + next, innerStart + next,
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function addReflectivePoolWater() {
  const rectangle = new THREE.PlaneGeometry(RECT_POOL.width - 0.36, RECT_POOL.depth - 0.36, 24, 16);
  rectangle.translate(RECT_POOL.x, -RECT_POOL.z, 0);
  const circle = makeSubdividedDisc(ROUND_POOL.radius - 0.2);
  circle.translate(ROUND_POOL.x, -ROUND_POOL.z, 0);
  const geometry = mergeGeometries([rectangle, circle], false);
  const water = new Water(geometry, {
    textureWidth: isMobileDevice ? 384 : 768,
    textureHeight: isMobileDevice ? 384 : 768,
    waterNormals: makeProceduralWaterNormals(),
    sunDirection,
    sunColor: '#ffd7aa',
    waterColor: '#2f98a6',
    distortionScale: 2.4,
    alpha: 0.94,
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = RECT_POOL.waterY;
  water.material.transparent = true;
  water.material.uniforms.size.value = 1.05;
  water.material.vertexShader = water.material.vertexShader
    .replace(
      'mirrorCoord = modelMatrix * vec4( position, 1.0 );',
      `vec3 wavePosition = position;
      wavePosition.z += sin( wavePosition.x * 2.15 + time * 1.15 ) * 0.022;
      wavePosition.z += sin( wavePosition.y * 2.65 - time * 0.95 ) * 0.016;
      wavePosition.z += sin( ( wavePosition.x + wavePosition.y ) * 3.8 + time * 0.72 ) * 0.008;
      mirrorCoord = modelMatrix * vec4( wavePosition, 1.0 );`,
    )
    .replace(
      'vec4 mvPosition =  modelViewMatrix * vec4( position, 1.0 );',
      'vec4 mvPosition = modelViewMatrix * vec4( wavePosition, 1.0 );',
    );
  water.material.needsUpdate = true;
  water.renderOrder = 1;
  scene.add(water);
  return water;
}

// Recessed pool openings replace the old unbroken ground collider.
addGroundWithPoolCutouts();
addPools();
const poolWater = addReflectivePoolWater();

// A gently stepped composition beyond the pools.

for (let i = 0; i < 7; i++) {
  addFixedBox({
    size: new THREE.Vector3(5.4, 0.34 + i * 0.02, 1.15),
    position: new THREE.Vector3(-6.8, 0.17 + i * 0.18, -2.3 - i * 1.08),
    material: i % 2 ? materials.rose : materials.coral,
  });
}

function addArch({ x, z, radius, pillarHeight, depth, material, rotationY = 0 }) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotationY;
  scene.add(group);

  const tube = radius * 0.25;
  const arch = shadowed(new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 28, 96, Math.PI), material));
  arch.position.y = pillarHeight;
  arch.rotation.x = 0;
  group.add(arch);

  const pillarSize = new THREE.Vector3(tube * 2, pillarHeight, depth);
  for (const side of [-1, 1]) {
    const pillar = shadowed(new THREE.Mesh(new THREE.BoxGeometry(pillarSize.x, pillarSize.y, pillarSize.z), material));
    pillar.position.set(side * radius, pillarHeight / 2, 0);
    group.add(pillar);

    const local = new THREE.Vector3(side * radius, pillarHeight / 2, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    addFixedBox({
      size: pillarSize,
      position: new THREE.Vector3(x + local.x, local.y, z + local.z),
      material,
      rotationY,
    }).visible = false;
  }

  // Three compact collision blocks approximate the curved crown while leaving the opening clear.
  const crownY = pillarHeight + radius * 0.78;
  for (const side of [-1, 0, 1]) {
    const local = new THREE.Vector3(side * radius * 0.58, crownY + (side === 0 ? radius * 0.2 : 0), 0)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    addFixedBox({
      size: new THREE.Vector3(radius * 0.75, tube * 1.8, depth),
      position: new THREE.Vector3(x + local.x, local.y, z + local.z),
      material,
      rotationY,
    }).visible = false;
  }
}

addArch({ x: 0, z: -5, radius: 3.1, pillarHeight: 5.1, depth: 1.5, material: materials.gold });
addArch({ x: 7.2, z: -12, radius: 2.0, pillarHeight: 2.8, depth: 1.35, material: materials.coral, rotationY: -0.3 });
addArch({ x: -8.4, z: -15, radius: 2.3, pillarHeight: 3.7, depth: 1.5, material: materials.rose, rotationY: 0.42 });

function makeProceduralWoodMaterial({ name, light, mid, dark, roughness, clearcoat }) {
  const lightColor = new THREE.Color(light);
  const midColor = new THREE.Color(mid);
  const darkColor = new THREE.Color(dark);
  const glslColor = (color) => `vec3(${color.r.toFixed(5)}, ${color.g.toFixed(5)}, ${color.b.toFixed(5)})`;
  const material = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness,
    metalness: 0,
    clearcoat,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.92,
  });
  material.name = `${name} procedural wood`;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWoodPosition;
        varying vec3 vWoodNormal;
      `)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vWoodPosition = position;
        vWoodNormal = normal;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWoodPosition;
        varying vec3 vWoodNormal;

        float woodPattern(vec3 p, vec3 n) {
          float slowWarp = sin(p.x * 1.8 + sin(p.z * 4.2)) * 0.22;
          float fineWarp = sin(p.x * 5.4 - p.y * 7.0 + p.z * 3.1) * 0.075;
          vec2 heart = p.yz + vec2(sin(p.x * 1.25), cos(p.x * 1.05)) * 0.055;
          float ringCoord = length(heart) * 35.0 + slowWarp * 5.0 + fineWarp * 2.0;
          float endRings = 0.5 + 0.5 * sin(ringCoord);
          float sideCoord = (p.y * 28.0 + p.z * 17.0) + slowWarp * 8.0 + sin(p.x * 3.0) * 1.2;
          float sideGrain = 0.5 + 0.5 * sin(sideCoord);
          sideGrain = mix(sideGrain, 0.5 + 0.5 * sin(sideCoord * 0.47 + 1.7), 0.34);
          float endFace = smoothstep(0.58, 0.88, abs(normalize(n).x));
          float grain = mix(sideGrain, endRings, endFace);
          float pore = 0.5 + 0.5 * sin(p.x * 31.0 + p.y * 83.0 - p.z * 57.0);
          return clamp(grain * 0.83 + pow(pore, 12.0) * 0.24, 0.0, 1.0);
        }
      `)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float woodGrain = woodPattern(vWoodPosition, vWoodNormal);
        vec3 woodLight = ${glslColor(lightColor)};
        vec3 woodMid = ${glslColor(midColor)};
        vec3 woodDark = ${glslColor(darkColor)};
        vec3 woodColor = mix(woodLight, woodMid, smoothstep(0.18, 0.72, woodGrain));
        woodColor = mix(woodColor, woodDark, smoothstep(0.78, 0.98, woodGrain));
        diffuseColor.rgb *= woodColor;
      `);
  };
  material.customProgramCacheKey = () => `game-dream-wood-${name}-v1`;
  return material;
}

const woodMaterials = {
  oak: makeProceduralWoodMaterial({
    name: 'white-oak', light: '#d8b77c', mid: '#9a6838', dark: '#4a2a16', roughness: 0.48, clearcoat: 0.34,
  }),
  walnut: makeProceduralWoodMaterial({
    name: 'black-walnut', light: '#8b5b3f', mid: '#47291f', dark: '#170d0b', roughness: 0.4, clearcoat: 0.52,
  }),
  cherry: makeProceduralWoodMaterial({
    name: 'cherry', light: '#d79069', mid: '#97472f', dark: '#4d1c1c', roughness: 0.43, clearcoat: 0.46,
  }),
};

const WOOD_BLOCK_SIZE = new THREE.Vector3(2.5, 0.54, 0.86);
const woodBlockGeometry = new RoundedBoxGeometry(
  WOOD_BLOCK_SIZE.x,
  WOOD_BLOCK_SIZE.y,
  WOOD_BLOCK_SIZE.z,
  isMobileDevice ? 3 : 5,
  0.065,
);
const floatingWoodBlocks = [];

function addFloatingWoodBlock({ x, y, z, rotationY, material, phase, tower }) {
  const mesh = shadowed(new THREE.Mesh(woodBlockGeometry, material));
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotationY;
  scene.add(mesh);

  const rotation = { x: 0, y: Math.sin(rotationY / 2), z: 0, w: Math.cos(rotationY / 2) };
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(x, y, z)
      .setRotation(rotation),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(WOOD_BLOCK_SIZE.x / 2, WOOD_BLOCK_SIZE.y / 2, WOOD_BLOCK_SIZE.z / 2)
      .setFriction(1.2)
      .setRestitution(0.02),
    body,
  );
  floatingWoodBlocks.push({ mesh, body, base: new THREE.Vector3(x, y, z), phase, tower });
}

const woodTowerDefinitions = [
  { name: 'Oak Steps', species: 'white oak', x: -4.7, z: 1.1, baseY: 1.12, count: 3, phase: 0.1, material: woodMaterials.oak },
  { name: 'Walnut Stack', species: 'black walnut', x: 4.35, z: -1.35, baseY: 1.38, count: 4, phase: 2.15, material: woodMaterials.walnut },
  { name: 'Cherry Pair', species: 'cherry', x: -0.85, z: -9.2, baseY: 1.28, count: 2, phase: 4.3, material: woodMaterials.cherry },
];

for (const tower of woodTowerDefinitions) {
  for (let level = 0; level < tower.count; level++) {
    const crossed = level % 2 === 1;
    addFloatingWoodBlock({
      x: tower.x + (crossed ? 0.08 : -0.05),
      y: tower.baseY + level * 0.59,
      z: tower.z + (crossed ? -0.04 : 0.06),
      rotationY: crossed ? Math.PI / 2 + 0.035 : -0.035,
      material: tower.material,
      phase: tower.phase,
      tower: tower.name,
    });
  }
}

function updateFloatingWoodPhysics(time) {
  for (const block of floatingWoodBlocks) {
    const y = block.base.y + Math.sin(time * 0.82 + block.phase) * 0.14;
    block.body.setNextKinematicTranslation({ x: block.base.x, y, z: block.base.z });
  }
}

const RACE_ORIGIN_X = 80;
const RACE_START_Z = 26;
const RACE_FINISH_Z = -104;
const RACE_HALF_WIDTH = 5.4;
const RACE_CHECKPOINT_Z = [-7, -40, -73];
const raceGroup = new THREE.Group();
raceGroup.visible = false;
scene.add(raceGroup);

function raceProgressAt(z) {
  return THREE.MathUtils.clamp((RACE_START_Z - z) / (RACE_START_Z - RACE_FINISH_Z), 0, 1);
}

function raceCenterHeight(z) {
  const progress = raceProgressAt(z);
  return 12.5 - progress * 25.5 + Math.sin(progress * Math.PI * 5.0) * 0.34;
}

function raceSurfaceHeight(worldX, z) {
  const progress = raceProgressAt(z);
  const localX = worldX - RACE_ORIGIN_X;
  const normalizedX = localX / RACE_HALF_WIDTH;
  const trough = normalizedX * normalizedX * 4.15;
  const bank = Math.sin(progress * Math.PI * 5.5) * localX * 0.13;
  const ripple = Math.sin(progress * Math.PI * 14.0) * 0.12 * (1 - Math.min(1, Math.abs(normalizedX)));
  return raceCenterHeight(z) + trough + bank + ripple;
}

function createRaceTrackGeometry() {
  const xSegments = isMobileDevice ? 18 : 28;
  const zSegments = isMobileDevice ? 130 : 190;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let zi = 0; zi <= zSegments; zi++) {
    const zT = zi / zSegments;
    const z = THREE.MathUtils.lerp(RACE_START_Z + 5, RACE_FINISH_Z - 7, zT);
    for (let xi = 0; xi <= xSegments; xi++) {
      const xT = xi / xSegments;
      const worldX = RACE_ORIGIN_X + THREE.MathUtils.lerp(-RACE_HALF_WIDTH, RACE_HALF_WIDTH, xT);
      positions.push(worldX, raceSurfaceHeight(worldX, z), z);
      uvs.push(xT, zT * 10);
    }
  }
  const row = xSegments + 1;
  for (let zi = 0; zi < zSegments; zi++) {
    for (let xi = 0; xi < xSegments; xi++) {
      const a = zi * row + xi;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const raceTrackGeometry = createRaceTrackGeometry();
const raceTrackMaterial = new THREE.MeshPhysicalMaterial({
  color: '#db765f',
  roughness: 0.56,
  metalness: 0,
  clearcoat: 0.36,
  clearcoatRoughness: 0.3,
  envMapIntensity: 0.7,
  side: THREE.DoubleSide,
});
raceTrackMaterial.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vRaceUv;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRaceUv = uv;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vRaceUv;')
    .replace(
    '#include <color_fragment>',
    `#include <color_fragment>
      float raceStripe = smoothstep(0.06, 0.02, abs(vRaceUv.x - 0.5));
      float raceBands = smoothstep(0.48, 0.5, sin(vRaceUv.y * 3.14159) * 0.5 + 0.5) * 0.09;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.72, 0.38), raceStripe * 0.7);
      diffuseColor.rgb += raceBands;
    `,
  );
};
raceTrackMaterial.customProgramCacheKey = () => 'game-dream-race-track-v1';
const raceTrack = new THREE.Mesh(raceTrackGeometry, raceTrackMaterial);
raceTrack.receiveShadow = true;
raceGroup.add(raceTrack);

const raceTrackBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
world.createCollider(
  RAPIER.ColliderDesc.trimesh(
    new Float32Array(raceTrackGeometry.attributes.position.array),
    new Uint32Array(raceTrackGeometry.index.array),
  ).setFriction(1.55),
  raceTrackBody,
);

const raceGateMaterial = new THREE.MeshPhysicalMaterial({ color: '#ffdc85', roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.16, envMapIntensity: 1.15 });
const finishDarkMaterial = new THREE.MeshStandardMaterial({ color: '#443448', roughness: 0.48 });
const finishLightMaterial = new THREE.MeshStandardMaterial({ color: '#fff1d4', roughness: 0.42 });

function addRaceGate(z, finish = false) {
  const group = new THREE.Group();
  const postHeight = 3.0;
  for (const side of [-1, 1]) {
    const x = RACE_ORIGIN_X + side * (RACE_HALF_WIDTH - 0.2);
    const post = new THREE.Mesh(new RoundedBoxGeometry(0.26, postHeight, 0.34, 3, 0.06), finish ? finishDarkMaterial : raceGateMaterial);
    post.position.set(x, raceSurfaceHeight(x, z) + postHeight / 2, z);
    post.castShadow = true;
    group.add(post);
  }
  const beamY = raceCenterHeight(z) + 6.35;
  const beam = new THREE.Mesh(new RoundedBoxGeometry(RACE_HALF_WIDTH * 2, 0.34, 0.42, 3, 0.07), finish ? finishLightMaterial : raceGateMaterial);
  beam.position.set(RACE_ORIGIN_X, beamY, z);
  beam.castShadow = true;
  group.add(beam);
  if (finish) {
    for (let i = 0; i < 12; i++) {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.17, 0.44), i % 2 ? finishDarkMaterial : finishLightMaterial);
      tile.position.set(RACE_ORIGIN_X - 4.05 + i * 0.74, beamY, z - 0.02);
      group.add(tile);
    }
  }
  raceGroup.add(group);
  return group;
}

addRaceGate(RACE_START_Z - 2);
RACE_CHECKPOINT_Z.forEach((z) => addRaceGate(z));
addRaceGate(RACE_FINISH_Z, true);

const raceCoins = [];
const coinGeometry = new THREE.TorusGeometry(0.32, 0.105, 10, 24);
const coinMaterial = new THREE.MeshPhysicalMaterial({ color: '#ffd659', emissive: '#b95d12', emissiveIntensity: 0.42, roughness: 0.22, metalness: 0.46, clearcoat: 0.8, clearcoatRoughness: 0.12 });

function addRaceCoin(localX, z, lift = 0.9) {
  const x = RACE_ORIGIN_X + localX;
  const mesh = new THREE.Mesh(coinGeometry, coinMaterial);
  mesh.position.set(x, raceSurfaceHeight(x, z) + lift, z);
  mesh.castShadow = true;
  raceGroup.add(mesh);
  raceCoins.push({ mesh, collected: false, localX, z });
}

// Section 1: a readable opening slalom that teaches lateral steering.
for (let i = 0; i < 8; i++) addRaceCoin(i % 2 ? 2.25 : -2.25, 18 - i * 3.1);
// Section 2: two high wall lines make the banked pipe worth using.
for (let i = 0; i < 7; i++) {
  addRaceCoin(-3.5, -10 - i * 3.5, 0.8);
  if (i > 2) addRaceCoin(3.5, -10 - i * 3.5, 0.8);
}
// Section 3: an airborne center arc over the densest hazard cluster.
for (let i = 0; i < 9; i++) addRaceCoin(0, -41 - i * 2.7, 0.9 + Math.sin((i / 8) * Math.PI) * 2.4);
// Section 4: fast alternating lane choices into the finish.
for (let i = 0; i < 10; i++) addRaceCoin([0, -2.8, 2.8, 0][i % 4], -70 - i * 3.1, 0.9);

const obstacleMaterial = new THREE.MeshPhysicalMaterial({ color: '#a8324f', emissive: '#5e102c', emissiveIntensity: 0.28, roughness: 0.38, clearcoat: 0.58, clearcoatRoughness: 0.2 });
const raceObstacles = [];
const obstacleLayout = [
  { x: 0, z: 9 }, { x: -2.4, z: -14 }, { x: 2.5, z: -28 },
  { x: -2.1, z: -46 }, { x: 2.1, z: -51 }, { x: 0, z: -60 },
  { x: -2.8, z: -79 }, { x: 2.7, z: -88 }, { x: 0, z: -97 },
];
for (const obstacle of obstacleLayout) {
  const x = RACE_ORIGIN_X + obstacle.x;
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(1.6, 1.45, 0.82, 4, 0.14), obstacleMaterial);
  mesh.position.set(x, raceSurfaceHeight(x, obstacle.z) + 0.72, obstacle.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  raceGroup.add(mesh);
  raceObstacles.push({ ...obstacle, mesh });
}

const shieldMaterial = new THREE.MeshPhysicalMaterial({ color: '#7feaf5', emissive: '#147a9b', emissiveIntensity: 0.8, roughness: 0.12, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08, transmission: 0.15, thickness: 0.5 });
const raceShields = [];
for (const shield of [{ x: 0, z: -34 }, { x: -3.2, z: -72 }]) {
  const x = RACE_ORIGIN_X + shield.x;
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.58, 2), shieldMaterial);
  mesh.position.set(x, raceSurfaceHeight(x, shield.z) + 1.05, shield.z);
  mesh.castShadow = true;
  raceGroup.add(mesh);
  raceShields.push({ ...shield, mesh, collected: false });
}

// Repeating hoops give speed parallax and clearly divide the four course beats.
const hoopMaterial = new THREE.MeshStandardMaterial({ color: '#e9a0b9', roughness: 0.5, envMapIntensity: 0.7 });
for (const z of [4, -24, -56, -87]) {
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(6.0, 0.16, 10, 48, Math.PI), hoopMaterial);
  hoop.position.set(RACE_ORIGIN_X, raceCenterHeight(z) + 1.0, z);
  hoop.castShadow = true;
  raceGroup.add(hoop);
}

// Distant graphic forms keep the horizon composed without adding gameplay noise.
for (const [x, z, h, color] of [[-15, -21, 7, materials.coral], [14, -24, 10, materials.rose], [1, -30, 5, materials.gold]]) {
  const tower = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3.2, h, 3.2), color));
  tower.position.set(x, h / 2, z);
  scene.add(tower);
}

const playerBody = world.createRigidBody(
  RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(0, 1.4, 5.5)
    .setLinearDamping(0.28)
    .setAngularDamping(0.16)
    .setCcdEnabled(true)
);
const playerCollider = world.createCollider(
  RAPIER.ColliderDesc.ball(PLAYER_RADIUS).setDensity(1.15).setFriction(1.65).setRestitution(0.08),
  playerBody
);

const ballMaterial = new THREE.MeshPhysicalMaterial({
  color: '#fff8ed',
  roughness: 0.14,
  metalness: 0,
  ior: 1.48,
  reflectivity: 0.72,
  clearcoat: 1,
  clearcoatRoughness: 0.035,
  sheen: 0.08,
  sheenColor: new THREE.Color('#ffd5ca'),
  envMapIntensity: 1.7,
});

ballMaterial.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
      varying vec3 vMarblePosition;
      varying vec3 vMarbleRayDirection;
    `)
    .replace('#include <begin_vertex>', `
      vec3 transformed = vec3(position);
      vMarblePosition = position / ${PLAYER_RADIUS.toFixed(2)};
      vec3 marbleCameraOffset = cameraPosition - vec3(modelMatrix[3]);
      vec3 marbleCameraObject = transpose(mat3(modelMatrix)) * marbleCameraOffset / ${PLAYER_RADIUS.toFixed(2)};
      vMarbleRayDirection = normalize(vMarblePosition - marbleCameraObject);
    `);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec3 vMarblePosition;
      varying vec3 vMarbleRayDirection;

      float marbleSlice(vec3 p) {
        float broadWarp = sin(p.x * 3.1 + p.z * 1.8) + 0.52 * sin(p.y * 5.7 - p.x * 2.2);
        float fineWarp = 0.24 * sin(dot(p, vec3(7.3, -5.1, 6.4)) + sin(p.z * 4.0));
        float sweep = p.y * 3.15 + p.x * 1.35 - p.z * 0.75 + broadWarp * 1.55 + fineWarp;
        float aa = fwidth(sweep);
        float primary = 1.0 - smoothstep(0.07 + aa, 0.34 + aa, abs(sin(sweep)));
        float hairline = 1.0 - smoothstep(0.018 + aa, 0.11 + aa, abs(sin(sweep * 2.11 + 1.35)));
        return clamp(primary * 0.88 + hairline * 0.42, 0.0, 1.0);
      }

      vec3 marchMarble(vec3 rayOrigin, vec3 rayDirection) {
        vec3 p = normalize(rayOrigin);
        float volume = 0.0;
        float weight = 0.0;
        for (int i = 0; i < 4; i++) {
          float fade = 1.0 - float(i) / 5.0;
          volume += marbleSlice(p) * fade;
          weight += fade;
          p += rayDirection * 0.18;
        }
        volume /= weight;
        float surface = marbleSlice(normalize(rayOrigin) * 1.15);
        vec3 ivory = vec3(0.98, 0.91, 0.80);
        vec3 blush = vec3(0.90, 0.40, 0.42);
        vec3 wine = vec3(0.24, 0.035, 0.075);
        vec3 color = mix(ivory, blush, smoothstep(0.08, 0.48, volume) * 0.58);
        color = mix(color, wine, smoothstep(0.20, 0.78, surface) * 0.86);
        return color;
      }
    `)
    .replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= marchMarble(vMarblePosition, normalize(vMarbleRayDirection));
    `);
};
ballMaterial.customProgramCacheKey = () => 'game-dream-hard-marble-v1';

const ballSegments = isMobileDevice ? 64 : 128;
const ballGeometry = new THREE.SphereGeometry(PLAYER_RADIUS, ballSegments, ballSegments / 2);
const ball = shadowed(new THREE.Mesh(ballGeometry, ballMaterial));
ball.renderOrder = 2;
scene.add(ball);

const input = { forward: false, back: false, left: false, right: false, touchX: 0, jumpBuffer: 0 };
const state = {
  mode: 'splash', started: false, grounded: false, coyoteTime: 0, jumpCount: 0,
  airJumpCount: 0, lastKey: '', elapsed: 0, yaw: 0, pitch: 0.18,
  dragging: false, fps: 0, touchJumpCooldown: 0,
};
const keyMap = {
  KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};

function readRecord(key) {
  try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; }
}

const race = {
  elapsed: 0,
  countdown: 0,
  coins: 0,
  shield: false,
  checkpointIndex: 0,
  lastCheckpointZ: RACE_START_Z - 4,
  hitCooldown: 0,
  toastTimer: 0,
  bestTime: readRecord('game-dream-best-time'),
  bestCoins: readRecord('game-dream-best-coins'),
  shieldPickups: 0,
  shieldPops: 0,
  coinCrashes: 0,
};

function formatTime(seconds) {
  if (!seconds) return '--:--.---';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${remainder.toFixed(3).padStart(6, '0')}`;
}

function writeRecords() {
  try {
    localStorage.setItem('game-dream-best-time', String(race.bestTime));
    localStorage.setItem('game-dream-best-coins', String(race.bestCoins));
  } catch {
    // Records still live for this session if storage is unavailable.
  }
}

function refreshRecordUI() {
  briefBestTime.textContent = formatTime(race.bestTime);
  briefBestCoins.textContent = String(race.bestCoins);
  finishBest.textContent = formatTime(race.bestTime);
}

function setPanel(panel) {
  for (const item of [splash, raceBriefing, finishPanel]) item.classList.toggle('is-hidden', item !== panel);
}

function showToast(message, duration = 1.25) {
  raceToast.textContent = message;
  raceToast.classList.add('is-visible');
  race.toastTimer = duration;
}

let audioContext;
let audioMaster;
let windGain;
let windFilter;

function ensureAudio() {
  if (!audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioContext = new AudioContext();
    audioMaster = audioContext.createGain();
    audioMaster.gain.value = 0.32;
    audioMaster.connect(audioContext.destination);

    const length = audioContext.sampleRate * 2;
    const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const noise = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) noise[i] = Math.random() * 2 - 1;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    windFilter = audioContext.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 480;
    windFilter.Q.value = 0.7;
    windGain = audioContext.createGain();
    windGain.gain.value = 0;
    source.connect(windFilter).connect(windGain).connect(audioMaster);
    source.start();
  }
  if (audioContext.state === 'suspended') audioContext.resume();
}

function playTone(frequency, duration = 0.1, type = 'sine', volume = 0.14, delay = 0) {
  ensureAudio();
  if (!audioContext) return;
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audioMaster);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function haptic(pattern) {
  navigator.vibrate?.(pattern);
}

function teleportPlayer(x, z) {
  const y = state.mode.startsWith('race') ? raceSurfaceHeight(x, z) + PLAYER_RADIUS + 0.18 : 1.4;
  playerBody.setTranslation({ x, y, z }, true);
  playerBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  playerBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  playerBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  state.touchJumpCooldown = 0;
}

function showSplash() {
  state.mode = 'splash';
  state.started = false;
  raceGroup.visible = false;
  raceHud.classList.add('is-hidden');
  countdown.classList.add('is-hidden');
  setPanel(splash);
}

function startFreeMode() {
  ensureAudio();
  state.mode = 'free';
  state.started = true;
  state.yaw = 0;
  state.pitch = 0.18;
  raceGroup.visible = false;
  raceHud.classList.add('is-hidden');
  countdown.classList.add('is-hidden');
  setPanel(null);
  teleportPlayer(0, 5.5);
  canvas.focus();
}

function showRaceBriefing() {
  ensureAudio();
  state.mode = 'race-briefing';
  state.started = false;
  raceGroup.visible = true;
  raceHud.classList.add('is-hidden');
  countdown.classList.add('is-hidden');
  refreshRecordUI();
  setPanel(raceBriefing);
  teleportPlayer(RACE_ORIGIN_X, RACE_START_Z - 4);
}

function resetRaceObjects() {
  for (const coin of raceCoins) {
    coin.collected = false;
    coin.mesh.visible = true;
  }
  for (const shield of raceShields) {
    shield.collected = false;
    shield.mesh.visible = true;
  }
}

function startRace() {
  ensureAudio();
  resetRaceObjects();
  Object.assign(race, {
    elapsed: 0, countdown: 3.25, coins: 0, shield: false,
    checkpointIndex: 0, lastCheckpointZ: RACE_START_Z - 4,
    hitCooldown: 0, toastTimer: 0, shieldPickups: 0, shieldPops: 0, coinCrashes: 0,
  });
  state.mode = 'race-countdown';
  state.started = true;
  state.yaw = 0;
  state.pitch = 0.16;
  raceGroup.visible = true;
  setPanel(null);
  raceHud.classList.remove('is-hidden');
  countdown.classList.remove('is-hidden');
  countdownValue.textContent = '3';
  teleportPlayer(RACE_ORIGIN_X, race.lastCheckpointZ);
  updateRaceHud();
  playTone(420, 0.08, 'sine', 0.1);
  canvas.focus();
}

function finishRace() {
  if (state.mode !== 'race-active') return;
  state.mode = 'race-finished';
  state.started = false;
  playerBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  playerBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  playerBody.sleep();
  const newBestTime = !race.bestTime || race.elapsed < race.bestTime;
  const newBestCoins = race.coins > race.bestCoins;
  if (newBestTime) race.bestTime = race.elapsed;
  if (newBestCoins) race.bestCoins = race.coins;
  writeRecords();
  refreshRecordUI();
  finishTitle.textContent = newBestTime ? 'New fastest run.' : 'Run complete.';
  finishTime.textContent = formatTime(race.elapsed);
  finishCoins.textContent = `${race.coins} / ${raceCoins.length}`;
  finishRecord.textContent = newBestTime ? 'NEW PERSONAL BEST' : (newBestCoins ? 'NEW COIN RECORD' : 'RUN SAVED');
  raceHud.classList.add('is-hidden');
  countdown.classList.add('is-hidden');
  setPanel(finishPanel);
  showToast('FINISH!');
  playTone(523, 0.32, 'triangle', 0.16);
  playTone(659, 0.34, 'triangle', 0.14, 0.12);
  playTone(784, 0.5, 'triangle', 0.13, 0.25);
  haptic([30, 35, 30, 35, 90]);
}

addEventListener('keydown', (event) => {
  state.lastKey = `${event.code}:${event.key}`;
  if (event.code === 'Enter' && state.mode === 'race-briefing') {
    startRace();
    event.preventDefault();
    return;
  }
  if (event.code === 'Enter' && state.mode === 'race-finished') {
    startRace();
    event.preventDefault();
    return;
  }
  if (keyMap[event.code]) {
    input[keyMap[event.code]] = true;
    event.preventDefault();
  }
  if ((event.code === 'Space' || event.code === 'Spacebar' || event.key === ' ' || event.key === 'Space') && !event.repeat) {
    requestJump();
    event.preventDefault();
  }
  if (event.code === 'KeyR') resetPlayer();
  if (event.code === 'KeyF') toggleFullscreen();
});

addEventListener('keyup', (event) => {
  if (keyMap[event.code]) input[keyMap[event.code]] = false;
});

const touchControl = {
  id: null,
  originX: 0,
  originY: 0,
  lastX: 0,
  lastY: 0,
  startedAt: 0,
  maxDistance: 0,
  jumpTriggered: false,
};

function maybeTriggerTouchJump(clientX, clientY) {
  if (touchControl.jumpTriggered || state.touchJumpCooldown > 0) return;
  const swipeX = clientX - touchControl.originX;
  const swipeY = clientY - touchControl.originY;
  if (swipeY > -48 || Math.abs(swipeY) < Math.abs(swipeX) * 0.72) return;
  touchControl.jumpTriggered = true;
  performTouchJump();
  touchJoystick.classList.add('did-jump');
}

function endTouchPointer(event) {
  if (event.pointerId !== touchControl.id) return;
  maybeTriggerTouchJump(event.clientX, event.clientY);
  const distance = Math.hypot(event.clientX - touchControl.originX, event.clientY - touchControl.originY);
  if (!touchControl.jumpTriggered && performance.now() - touchControl.startedAt < 280 && Math.max(distance, touchControl.maxDistance) < 22) {
    performTouchJump();
    touchControl.jumpTriggered = true;
  }
  touchControl.id = null;
  input.touchX = 0;
  touchStick.style.transform = 'translateX(0px)';
  touchJoystick.classList.remove('is-active', 'did-jump');
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

canvas.addEventListener('pointerdown', (event) => {
  if (state.mode === 'splash' || state.mode === 'race-briefing' || state.mode === 'race-finished') return;
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    // Synthetic tests and a few embedded browsers can reject pointer capture;
    // the gesture still works because events remain bound to the canvas.
  }
  if (isMobileDevice || state.mode.startsWith('race')) {
    event.preventDefault();
    if (touchControl.id !== null) return;
    touchControl.id = event.pointerId;
    touchControl.originX = touchControl.lastX = event.clientX;
    touchControl.originY = touchControl.lastY = event.clientY;
    touchControl.startedAt = performance.now();
    touchControl.maxDistance = 0;
    touchControl.jumpTriggered = false;
    touchJoystick.style.left = `${THREE.MathUtils.clamp(event.clientX, 88, innerWidth - 88)}px`;
    touchJoystick.style.top = `${THREE.MathUtils.clamp(event.clientY, 46, innerHeight - 46)}px`;
    touchJoystick.classList.add('is-active');
    return;
  }
  state.dragging = true;
});

canvas.addEventListener('pointerup', (event) => {
  if (isMobileDevice || state.mode.startsWith('race')) endTouchPointer(event);
  else {
    state.dragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
});
canvas.addEventListener('pointercancel', endTouchPointer);

canvas.addEventListener('pointermove', (event) => {
  if ((isMobileDevice || state.mode.startsWith('race')) && event.pointerId === touchControl.id) {
    touchControl.lastX = event.clientX;
    touchControl.lastY = event.clientY;
    const dx = THREE.MathUtils.clamp(event.clientX - touchControl.originX, -64, 64);
    touchControl.maxDistance = Math.max(touchControl.maxDistance, Math.hypot(event.clientX - touchControl.originX, event.clientY - touchControl.originY));
    input.touchX = dx / 64;
    touchStick.style.transform = `translateX(${dx}px)`;
    maybeTriggerTouchJump(event.clientX, event.clientY);
    return;
  }
  if (!state.dragging || state.mode !== 'free') return;
  state.yaw -= event.movementX * 0.005;
  state.pitch = THREE.MathUtils.clamp(state.pitch - event.movementY * 0.004, 0.06, 0.7);
});

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.querySelector('#game-shell').requestFullscreen();
}

function resetPlayer() {
  if (state.mode.startsWith('race')) teleportPlayer(RACE_ORIGIN_X, race.lastCheckpointZ);
  else teleportPlayer(0, 5.5);
}

function performJump() {
  playerBody.applyImpulse({ x: 0, y: playerBody.mass() * 9.2, z: 0 }, true);
  state.jumpCount += 1;
  state.coyoteTime = 0;
  input.jumpBuffer = 0;
  playTone(240, 0.11, 'triangle', 0.08);
  haptic(12);
}

function performTouchJump() {
  if (state.mode !== 'free' && state.mode !== 'race-active') return;
  const velocity = playerBody.linvel();
  const wasAirborne = !state.grounded;
  playerBody.setLinvel({ x: velocity.x, y: state.mode === 'race-active' ? 11.4 : 9.2, z: velocity.z }, true);
  state.jumpCount += 1;
  if (wasAirborne) state.airJumpCount += 1;
  state.coyoteTime = 0;
  state.touchJumpCooldown = 0.12;
  input.jumpBuffer = 0;
  playTone(wasAirborne ? 330 : 260, 0.1, 'triangle', 0.08);
  haptic(12);
}

function requestJump() {
  if (state.mode === 'race-active') {
    performTouchJump();
    return;
  }
  if (state.mode !== 'free') return;
  if (state.grounded || state.coyoteTime > 0) performJump();
  else input.jumpBuffer = 0.25;
}

freeModeButton.addEventListener('click', startFreeMode);
raceModeButton.addEventListener('click', showRaceBriefing);
raceStartButton.addEventListener('click', startRace);
raceBackButton.addEventListener('click', showSplash);
raceReplayButton.addEventListener('click', startRace);
finishFreeButton.addEventListener('click', startFreeMode);
resetButton.addEventListener('click', resetPlayer);

function updateRaceHud() {
  const velocity = playerBody.linvel();
  hudTime.textContent = formatTime(Math.max(race.elapsed, 0.0001));
  hudCoins.textContent = String(race.coins);
  hudCheckpoint.textContent = `${race.checkpointIndex} / ${RACE_CHECKPOINT_Z.length}`;
  hudShield.classList.toggle('is-active', race.shield);
  speedFill.style.width = `${THREE.MathUtils.clamp(Math.hypot(velocity.x, velocity.z) / 31, 0, 1) * 100}%`;
}

function collectCoin(coin) {
  coin.collected = true;
  coin.mesh.visible = false;
  race.coins += 1;
  const pitch = 720 + (race.coins % 6) * 55;
  playTone(pitch, 0.07, 'sine', 0.07);
  haptic(7);
}

function hitObstacle() {
  if (race.hitCooldown > 0) return;
  race.hitCooldown = 0.85;
  const velocity = playerBody.linvel();
  playerBody.setLinvel({ x: velocity.x * -0.42, y: 7.2, z: Math.min(-5, velocity.z * 0.44) }, true);
  if (race.shield) {
    race.shield = false;
    race.shieldPops += 1;
    showToast('SHIELD POP! · COINS SAFE');
    playTone(190, 0.22, 'sawtooth', 0.11);
    playTone(580, 0.12, 'square', 0.07, 0.06);
    haptic([35, 18, 55]);
  } else {
    race.coinCrashes += 1;
    race.coins = 0;
    showToast('CRASH! · COINS LOST');
    playTone(120, 0.34, 'sawtooth', 0.14);
    haptic([75, 30, 80]);
  }
}

function updateRaceGameplay(dt, position) {
  race.hitCooldown = Math.max(0, race.hitCooldown - dt);
  for (const coin of raceCoins) {
    const dx = position.x - coin.mesh.position.x;
    const dy = position.y - coin.mesh.position.y;
    const dz = position.z - coin.mesh.position.z;
    if (!coin.collected && dx * dx + dy * dy + dz * dz < 1.5) collectCoin(coin);
  }
  for (const shield of raceShields) {
    const dx = position.x - shield.mesh.position.x;
    const dy = position.y - shield.mesh.position.y;
    const dz = position.z - shield.mesh.position.z;
    if (shield.collected || dx * dx + dy * dy + dz * dz >= 2.05) continue;
    shield.collected = true;
    shield.mesh.visible = false;
    race.shield = true;
    race.shieldPickups += 1;
    showToast('SHIELD READY');
    playTone(520, 0.14, 'triangle', 0.11);
    playTone(880, 0.2, 'sine', 0.08, 0.07);
    haptic([16, 18, 16]);
  }
  if (race.hitCooldown <= 0) {
    for (const obstacle of raceObstacles) {
      if (Math.abs(position.x - obstacle.mesh.position.x) < 1.22 && Math.abs(position.z - obstacle.z) < 0.92 && Math.abs(position.y - obstacle.mesh.position.y) < 1.55) {
        hitObstacle();
        break;
      }
    }
  }

  const nextCheckpoint = RACE_CHECKPOINT_Z[race.checkpointIndex];
  if (nextCheckpoint !== undefined && position.z <= nextCheckpoint) {
    race.checkpointIndex += 1;
    race.lastCheckpointZ = nextCheckpoint - 2.5;
    showToast(`CHECKPOINT ${race.checkpointIndex} / ${RACE_CHECKPOINT_Z.length}`);
    playTone(440, 0.12, 'triangle', 0.1);
    playTone(660, 0.2, 'triangle', 0.09, 0.08);
    haptic(26);
  }
  if (position.z <= RACE_FINISH_Z) finishRace();
  updateRaceHud();
}

const moveDirection = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();

function fixedUpdate(dt) {
  state.elapsed += dt;
  const position = playerBody.translation();
  const velocity = playerBody.linvel();

  const groundRay = new RAPIER.Ray({ x: position.x, y: position.y, z: position.z }, { x: 0, y: -1, z: 0 });
  const groundHit = world.castRay(groundRay, PLAYER_RADIUS + 0.16, true, undefined, undefined, playerCollider, playerBody);
  state.grounded = Boolean(groundHit) && velocity.y < 1.2;
  state.coyoteTime = state.grounded ? 0.1 : Math.max(0, state.coyoteTime - dt);

  if (state.mode === 'race-countdown') {
    race.countdown -= dt;
    const number = Math.max(1, Math.ceil(race.countdown));
    countdownValue.textContent = String(number);
    const held = playerBody.translation();
    playerBody.setLinvel({ x: 0, y: playerBody.linvel().y, z: 0 }, true);
    if (Math.abs(held.x - RACE_ORIGIN_X) > 0.2 || Math.abs(held.z - race.lastCheckpointZ) > 0.4) teleportPlayer(RACE_ORIGIN_X, race.lastCheckpointZ);
    if (race.countdown <= 0) {
      state.mode = 'race-active';
      countdown.classList.add('is-hidden');
      playerBody.setLinvel({ x: 0, y: 0, z: -9 }, true);
      showToast('GO!', 0.8);
      playTone(720, 0.18, 'triangle', 0.14);
      haptic(24);
    }
  }

  if (state.mode === 'free' || state.mode === 'race-active') {
    const racing = state.mode === 'race-active';
    forward.set(racing ? 0 : -Math.sin(state.yaw), 0, racing ? -1 : -Math.cos(state.yaw));
    right.set(-forward.z, 0, forward.x);
    moveDirection.set(0, 0, 0);
    if (racing) {
      race.elapsed += dt;
      moveDirection.add(forward);
      const steer = THREE.MathUtils.clamp(input.touchX + (input.right ? 1 : 0) - (input.left ? 1 : 0), -1, 1);
      const desiredLateralSpeed = steer * 12.5;
      const lateralImpulse = (desiredLateralSpeed - velocity.x) * playerBody.mass() * (state.grounded ? 0.105 : 0.068);
      playerBody.applyImpulse({ x: lateralImpulse, y: 0, z: 0 }, true);
      const forwardSpeed = Math.max(0, -velocity.z);
      const speedRoom = THREE.MathUtils.clamp(1 - forwardSpeed / 31, 0.08, 1);
      playerBody.applyImpulse({ x: 0, y: 0, z: -0.34 * speedRoom }, true);
      playerBody.applyTorqueImpulse({ x: -0.2 * speedRoom, y: 0, z: -steer * 0.12 }, true);
    } else if (isMobileDevice) {
      moveDirection.add(forward);
      moveDirection.addScaledVector(right, input.touchX);
    } else {
      if (input.forward) moveDirection.add(forward);
      if (input.back) moveDirection.sub(forward);
      if (input.right) moveDirection.add(right);
      if (input.left) moveDirection.sub(right);
    }

    if (!racing && moveDirection.lengthSq() > 0) {
      const moveStrength = Math.min(1, moveDirection.length());
      moveDirection.normalize();
      const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
      const control = state.grounded ? 1 : 0.22;
      const speedRoom = THREE.MathUtils.clamp(1 - horizontalSpeed / 10.5, 0.08, 1);
      playerBody.applyImpulse({ x: moveDirection.x * 0.115 * control * speedRoom * moveStrength, y: 0, z: moveDirection.z * 0.115 * control * speedRoom * moveStrength }, true);
      playerBody.applyTorqueImpulse({ x: moveDirection.z * 0.082 * control * moveStrength, y: 0, z: -moveDirection.x * 0.082 * control * moveStrength }, true);
    }

    if (input.jumpBuffer > 0 && state.coyoteTime > 0) {
      performJump();
    }
  }
  input.jumpBuffer = Math.max(0, input.jumpBuffer - dt);
  state.touchJumpCooldown = Math.max(0, state.touchJumpCooldown - dt);
  if (race.toastTimer > 0) {
    race.toastTimer = Math.max(0, race.toastTimer - dt);
    if (race.toastTimer === 0) raceToast.classList.remove('is-visible');
  }

  updateFloatingWoodPhysics(state.elapsed);
  world.step();

  const next = playerBody.translation();
  if (state.mode === 'race-active') updateRaceGameplay(dt, next);
  if (state.mode.startsWith('race')) {
    if (next.y < raceCenterHeight(next.z) - 9 || Math.abs(next.x - RACE_ORIGIN_X) > 11 || next.z > RACE_START_Z + 10) resetPlayer();
  } else if (next.y < -8 || Math.abs(next.x) > 50 || Math.abs(next.z) > 50) resetPlayer();
}

const cameraTarget = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();
const smoothTarget = new THREE.Vector3(0, 1.3, 5.5);

function updateVisuals(dt) {
  const position = playerBody.translation();
  const rotation = playerBody.rotation();
  ball.position.set(position.x, position.y, position.z);
  ball.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  for (const block of floatingWoodBlocks) {
    const blockPosition = block.body.translation();
    block.mesh.position.set(blockPosition.x, blockPosition.y, blockPosition.z);
  }

  const raceVisible = raceGroup.visible;
  if (raceVisible) {
    for (let i = 0; i < raceCoins.length; i++) {
      const coin = raceCoins[i];
      coin.mesh.rotation.y += dt * 5.8;
      coin.mesh.rotation.x = Math.sin(state.elapsed * 2.2 + i) * 0.12;
    }
    for (let i = 0; i < raceShields.length; i++) {
      const shield = raceShields[i];
      shield.mesh.rotation.y += dt * 2.8;
      if (!shield.collected) shield.mesh.position.y = raceSurfaceHeight(RACE_ORIGIN_X + shield.x, shield.z) + 1.05 + Math.sin(state.elapsed * 2.4 + i) * 0.16;
    }
    for (let i = 0; i < raceObstacles.length; i++) {
      raceObstacles[i].mesh.rotation.y = Math.sin(state.elapsed * 1.8 + i * 0.7) * 0.06;
    }
  }

  sun.position.set(position.x, position.y, position.z).addScaledVector(sunDirection, 28);
  sun.target.position.set(position.x, position.y, position.z);
  sun.target.updateMatrixWorld();

  if (state.mode.startsWith('race')) {
    cameraTarget.set(position.x, position.y + 1.35, position.z - 3.6);
    smoothTarget.lerp(cameraTarget, 1 - Math.exp(-dt * 15));
    desiredCamera.set(smoothTarget.x, smoothTarget.y + 2.65, smoothTarget.z + 8.7);
  } else {
    // Aim above the ball so it lives in the lower third and tall architecture remains visible.
    cameraTarget.set(position.x, position.y + 2.1, position.z);
    smoothTarget.lerp(cameraTarget, 1 - Math.exp(-dt * 11));
    const distance = 11.5;
    const horizontal = Math.cos(state.pitch) * distance;
    desiredCamera.set(
      smoothTarget.x + Math.sin(state.yaw) * horizontal,
      smoothTarget.y + Math.sin(state.pitch) * distance + 0.35,
      smoothTarget.z + Math.cos(state.yaw) * horizontal,
    );
  }

  cameraDirection.copy(desiredCamera).sub(smoothTarget);
  const desiredDistance = cameraDirection.length();
  cameraDirection.normalize();
  const cameraRay = new RAPIER.Ray(smoothTarget, cameraDirection);
  const cameraHit = world.castRay(cameraRay, desiredDistance, true, undefined, undefined, playerCollider, playerBody);
  if (cameraHit) desiredCamera.copy(smoothTarget).addScaledVector(cameraDirection, Math.max(1.4, cameraHit.timeOfImpact - 0.28));

  camera.position.lerp(desiredCamera, 1 - Math.exp(-dt * 10));
  camera.lookAt(smoothTarget);

  if (windGain && windFilter) {
    const speed = Math.hypot(playerBody.linvel().x, playerBody.linvel().z);
    const active = state.mode === 'race-active';
    windGain.gain.setTargetAtTime(active ? THREE.MathUtils.clamp(speed / 31, 0.03, 0.22) : 0, audioContext.currentTime, 0.08);
    windFilter.frequency.setTargetAtTime(380 + speed * 38, audioContext.currentTime, 0.1);
  }
}

const gradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.022 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float grain;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))+time*0.013)*43758.5453); }
    void main(){
      vec4 tex=texture2D(tDiffuse,vUv);
      vec3 c=tex.rgb*0.975+0.009;
      float l=dot(c,vec3(.2126,.7152,.0722));
      c=(c-.18)*1.025+.18;
      c=mix(vec3(l),c,.96);
      c*=mix(vec3(.985,1.0,1.02),vec3(1.025,1.005,.98),smoothstep(.18,.78,l));
      float n=hash(gl_FragCoord.xy)-.5;
      c+=n*grain;
      gl_FragColor=vec4(c,tex.a);
    }
  `,
};

const composerTarget = new THREE.WebGLRenderTarget(1, 1, {
  type: THREE.HalfFloatType,
  depthBuffer: true,
  stencilBuffer: false,
  samples: isMobileDevice ? 0 : 4,
});
const composer = new EffectComposer(renderer, composerTarget);
composer.setPixelRatio(qualityRatio);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
const gtaoSamples = isMobileDevice ? 4 : 8;
gtao.enabled = !isMobileDevice;
gtao.blendIntensity = isMobileDevice ? 0.38 : 0.48;
gtao.updateGtaoMaterial({ radius: 0.22, distanceExponent: 1.8, thickness: 1.0, scale: 0.85, samples: gtaoSamples });
gtao.updatePdMaterial({ radius: isMobileDevice ? 2 : 3, rings: isMobileDevice ? 1 : 2, samples: gtaoSamples, lumaPhi: 10, depthPhi: 2, normalPhi: 3 });
composer.addPass(gtao);
const gradePass = new ShaderPass(gradeShader);
composer.addPass(gradePass);
composer.addPass(new OutputPass());

function render(dt = 1 / 60) {
  updateVisuals(dt);
  poolWater.material.uniforms.time.value += dt * 0.42;
  gradePass.uniforms.time.value = performance.now();
  if (isMobileDevice) renderer.render(scene, camera);
  else composer.render(dt);
}

let accumulator = 0;
let previousTime = performance.now();
let fpsFrames = 0;
let fpsElapsed = 0;
function frame(now) {
  const rawDelta = Math.max(0.0001, (now - previousTime) / 1000);
  const delta = Math.min(rawDelta, 0.05);
  previousTime = now;
  fpsFrames += 1;
  fpsElapsed += rawDelta;
  if (fpsElapsed >= 0.5) {
    state.fps = Math.round(fpsFrames / fpsElapsed);
    fpsValue.textContent = String(state.fps);
    fpsFrames = 0;
    fpsElapsed = 0;
  }
  accumulator += delta;
  while (accumulator >= 1 / 60) {
    fixedUpdate(1 / 60);
    accumulator -= 1 / 60;
  }
  render(delta);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i++) fixedUpdate(1 / 60);
  render(steps / 60);
};

window.render_game_to_text = () => {
  const p = playerBody.translation();
  const v = playerBody.linvel();
  return JSON.stringify({
    coordinateSystem: 'Y up; Free Mode uses camera-relative movement; Race Mode runs downhill along negative Z at world X 80',
    mode: state.mode,
    lastKey: state.lastKey,
    player: {
      position: { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) },
      velocity: { x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(2) },
      grounded: state.grounded,
      coyoteTime: +state.coyoteTime.toFixed(3),
      jumpBuffer: +input.jumpBuffer.toFixed(3),
      jumpCount: state.jumpCount,
      airJumpCount: state.airJumpCount,
      horizontalSpeed: +Math.hypot(v.x, v.z).toFixed(2),
    },
    camera: {
      yaw: +state.yaw.toFixed(2),
      pitch: +state.pitch.toFixed(2),
      position: { x: +camera.position.x.toFixed(2), y: +camera.position.y.toFixed(2), z: +camera.position.z.toFixed(2) },
      target: { x: +smoothTarget.x.toFixed(2), y: +smoothTarget.y.toFixed(2), z: +smoothTarget.z.toFixed(2) },
    },
    race: {
      course: 'Sunset Velocity',
      elapsed: +race.elapsed.toFixed(3),
      formattedTime: formatTime(Math.max(race.elapsed, 0.0001)),
      countdown: +Math.max(0, race.countdown).toFixed(2),
      coins: race.coins,
      totalCoins: raceCoins.length,
      remainingCoins: raceCoins.filter((coin) => !coin.collected).length,
      shield: race.shield,
      checkpoint: race.checkpointIndex,
      checkpointCount: RACE_CHECKPOINT_Z.length,
      progress: +raceProgressAt(p.z).toFixed(3),
      bestTime: +race.bestTime.toFixed(3),
      bestCoins: race.bestCoins,
      obstacleCount: raceObstacles.length,
      powerupCount: raceShields.length,
      shieldPickups: race.shieldPickups,
      shieldPops: race.shieldPops,
      coinCrashes: race.coinCrashes,
    },
    performance: { fps: state.fps, mobileMode: isMobileDevice, pixelRatio: qualityRatio, antialiasSamples: isMobileDevice ? 0 : 4, shadowMap: isMobileDevice ? 1024 : 2048, reflectionMap: isMobileDevice ? 384 : 768, postProcessing: !isMobileDevice, gtaoEnabled: gtao.enabled, gtaoSamples: gtao.enabled ? gtaoSamples : 0 },
    controls: state.mode.startsWith('race')
      ? 'automatic high-speed forward roll, drag horizontally to steer, tap or Space to jump including in air, fixed chase camera, R reset to last checkpoint'
      : (isMobileDevice ? 'automatic forward roll, one-finger horizontal slide steering, tap or upward swipe jump with repeatable air jumps, automatic camera, Reset button' : 'WASD/arrows roll, Space jump, drag look, R reset, F fullscreen'),
    pools: [
      { shape: 'rectangle', x: RECT_POOL.x, z: RECT_POOL.z, waterY: RECT_POOL.waterY },
      { shape: 'round', x: ROUND_POOL.x, z: ROUND_POOL.z, waterY: ROUND_POOL.waterY },
    ],
    floatingWoodTowers: woodTowerDefinitions.map(({ name, species, x, z, count }) => {
      const baseBlock = floatingWoodBlocks.find((block) => block.tower === name);
      return { name, species, x, z, blocks: count, currentBaseY: +baseBlock.body.translation().y.toFixed(2) };
    }),
    environment: { playerMaterial: 'rigid texture-free procedural PBR marble', sky: 'procedural Preetham', sunElevation: skySettings.elevation, water: 'planar reflective', waves: 'three small geometric wave bands, max amplitude 0.046' },
    landmarks: state.mode.startsWith('race')
      ? ['start gate at (80, 24)', 'checkpoints at z -7, -40, -73', 'finish line at (80, -104)', 'banked half-pipe spans x 74.6 to 85.4']
      : ['gold arch at (0, -5)', 'rose/coral stairs near (-7, -5)', 'coral arch at (7, -12)'],
  });
};

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
document.addEventListener('fullscreenchange', resize);
