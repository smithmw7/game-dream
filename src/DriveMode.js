import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const DRIVE_ORIGIN_X = -1000;
const ROAD_NEAR_Z = 18;
const ROAD_FAR_Z = -300;
const CAR_Z = 4;
const LANE_X = [-3.25, 0, 3.25];

function smoothDamp(current, target, rate, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-rate * dt));
}

export class DriveMode {
  constructor(scene, { isMobile = false, onCollect = () => {}, onCrash = () => {} } = {}) {
    this.scene = scene;
    this.isMobile = isMobile;
    this.onCollect = onCollect;
    this.onCrash = onCrash;
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
    };
    this.bendUniforms = {
      uDriveTime: { value: 0 },
      uDriveTravel: { value: 0 },
      uBendStart: { value: 15 },
      uBendMaxDepth: { value: 285 },
      uBendX: { value: 0.00018 },
      uBendY: { value: 0.00128 },
      uDriveOriginX: { value: DRIVE_ORIGIN_X },
    };

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
    this.createLights();
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
        varying vec3 vDriveWorldPosition;
        varying vec2 vDriveUv;`,
      );

      if (style === 'road') {
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            float driveRoadX = vDriveWorldPosition.x - uDriveOriginX;
            float driveRoadZ = -vDriveWorldPosition.z + uDriveTravel;
            float laneA = 1.0 - smoothstep(0.035, 0.11, abs(abs(driveRoadX) - 1.63));
            float edgeLine = 1.0 - smoothstep(0.04, 0.13, abs(abs(driveRoadX) - 5.55));
            float dash = step(0.48, fract(driveRoadZ / 8.0));
            float marker = laneA * dash;
            vec2 puddleCell = floor(vec2(driveRoadX * 1.7, driveRoadZ * 0.18));
            float puddleNoise = fract(sin(dot(puddleCell, vec2(12.9898, 78.233))) * 43758.5453);
            float puddle = smoothstep(0.68, 0.94, puddleNoise) * (1.0 - smoothstep(1.2, 5.4, abs(driveRoadX)));
            float neonStreak = pow(max(0.0, sin(driveRoadZ * 0.11 + driveRoadX * 0.7)), 18.0) * 0.2;
            float wetPulse = 0.15 + 0.85 * pow(0.5 + 0.5 * sin(driveRoadZ * 0.075), 8.0);
            float cyanReflection = exp(-abs(driveRoadX + 4.75) * 1.12) * wetPulse;
            float pinkReflection = exp(-abs(driveRoadX - 4.75) * 1.12) * wetPulse;
            vec3 asphalt = mix(vec3(0.006, 0.009, 0.018), vec3(0.018, 0.027, 0.045), puddle);
            diffuseColor.rgb = asphalt;
            diffuseColor.rgb += marker * vec3(0.08, 0.82, 1.0) * 0.44;
            diffuseColor.rgb += edgeLine * vec3(1.0, 0.02, 0.47) * 0.52;
            diffuseColor.rgb += cyanReflection * vec3(0.0, 0.34, 0.48) * (0.12 + puddle * 0.34);
            diffuseColor.rgb += pinkReflection * vec3(0.48, 0.0, 0.22) * (0.12 + puddle * 0.34);
            diffuseColor.rgb += neonStreak * mix(vec3(0.0, 0.72, 1.0), vec3(1.0, 0.0, 0.48), step(0.0, driveRoadX));`,
          )
          .replace(
            '#include <roughnessmap_fragment>',
            `#include <roughnessmap_fragment>
            roughnessFactor = mix(0.34, 0.095, puddle);`,
          )
          .replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
            totalEmissiveRadiance += marker * vec3(0.02, 0.32, 0.58) + edgeLine * vec3(0.72, 0.0, 0.2) + neonStreak * vec3(0.14, 0.015, 0.25);
            totalEmissiveRadiance += cyanReflection * vec3(0.0, 0.18, 0.28) + pinkReflection * vec3(0.25, 0.0, 0.12);`,
          )
          .replace(
            '#include <opaque_fragment>',
            `outgoingLight *= 0.22;
            outgoingLight += marker * vec3(0.03, 0.42, 0.72) + edgeLine * vec3(0.82, 0.0, 0.24);
            outgoingLight += cyanReflection * vec3(0.0, 0.11, 0.18) + pinkReflection * vec3(0.16, 0.0, 0.08);
            #include <opaque_fragment>`,
          );
      } else if (style === 'building') {
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            vec2 driveWindowCell = fract(vDriveUv * vec2(6.0, 17.0));
            float driveWindowX = step(0.18, driveWindowCell.x) * step(driveWindowCell.x, 0.74);
            float driveWindowY = step(0.2, driveWindowCell.y) * step(driveWindowCell.y, 0.68);
            float driveWindows = driveWindowX * driveWindowY * step(1.0, vDriveWorldPosition.y);`,
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
    material.customProgramCacheKey = () => `game-dream-drive-${key}-v3`;
    return material;
  }

  createSky() {
    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { time: this.bendUniforms.uDriveTime },
      vertexShader: `varying vec3 vSkyDirection; void main(){ vSkyDirection=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vSkyDirection;
        uniform float time;
        float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
        void main(){
          vec3 d=normalize(vSkyDirection);
          float horizon=pow(clamp(1.0-abs(d.y+0.08),0.0,1.0),5.0);
          float stars=step(0.994,hash(floor(d*520.0)))*smoothstep(-0.05,0.25,d.y);
          vec3 color=mix(vec3(0.002,0.004,0.018),vec3(0.025,0.012,0.09),max(d.y,0.0));
          color+=horizon*vec3(0.22,0.0,0.19);
          color+=stars*mix(vec3(0.1,0.8,1.0),vec3(1.0,0.1,0.5),hash(floor(d*311.0)))*2.4;
          gl_FragColor=vec4(color,1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(235, 28, 18), skyMaterial);
    this.sky.renderOrder = -20;
    this.root.add(this.sky);

    const sunMaterial = new THREE.MeshBasicMaterial({ color: '#ff287f', fog: false });
    this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(23, 64), sunMaterial);
    this.sunDisc.position.set(0, 28, -205);
    this.root.add(this.sunDisc);
    const barMaterial = new THREE.MeshBasicMaterial({ color: '#18051f', fog: false });
    for (let i = 0; i < 6; i++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(49, 1.05 + i * 0.11), barMaterial);
      bar.position.set(0, 18 + i * 3.2, -204.8);
      this.root.add(bar);
    }
  }

  createRoad() {
    const roadMaterial = this.patchBend(new THREE.MeshPhysicalMaterial({
      color: '#02040a', roughness: 0.34, metalness: 0.04,
      clearcoat: 0.72, clearcoatRoughness: 0.16, envMapIntensity: 0.2,
    }), 'wet-road', 'road');
    const roadGeometry = new THREE.BoxGeometry(12, 0.24, 320, 1, 1, this.isMobile ? 80 : 144);
    this.road = new THREE.Mesh(roadGeometry, roadMaterial);
    this.road.position.set(0, -0.16, -141);
    this.road.frustumCulled = false;
    this.root.add(this.road);

    const curbMaterial = this.patchBend(new THREE.MeshStandardMaterial({
      color: '#030611', roughness: 0.72, metalness: 0.12, emissive: '#020713', emissiveIntensity: 0.18,
    }), 'curb');
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 320, 1, 1, this.isMobile ? 64 : 128), curbMaterial);
      curb.position.set(side * 6.8, -0.04, -141);
      curb.frustumCulled = false;
      this.root.add(curb);

      const railMaterial = this.patchBend(new THREE.MeshBasicMaterial({
        color: side < 0 ? '#14dcff' : '#ff1b8d', toneMapped: false,
      }), `road-edge-${side}`);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 320, 1, 1, this.isMobile ? 64 : 128), railMaterial);
      rail.position.set(side * 6.03, 0.05, -141);
      rail.frustumCulled = false;
      this.root.add(rail);
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
      wire.frustumCulled = false;
      wire.renderOrder = 1;
      this.root.add(surface, wire);
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
      this.root.add(group);
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
      this.root.add(barrier, shard);
      const object = { barrier, shard, kind: 'shard', lane: 1, z: -30, resolved: false };
      this.runnerObjects.push(object);
      this.recycleRunnerObject(object, -34 - index * 19);
    }
  }

  recycleRunnerObject(object, z) {
    object.kind = this.random() < 0.46 ? 'barrier' : 'shard';
    object.lane = Math.floor(this.random() * 3);
    object.z = z;
    object.resolved = false;
    object.barrier.visible = object.kind === 'barrier';
    object.shard.visible = object.kind === 'shard';
    object.barrier.position.set(LANE_X[object.lane], 0.62, z);
    object.shard.position.set(LANE_X[object.lane], 1.05, z);
  }

  createCar() {
    this.car = new THREE.Group();
    this.car.name = 'Neon Cyber Runner';
    this.car.position.set(0, 0.06, CAR_Z);
    this.root.add(this.car);

    const paint = new THREE.MeshPhysicalMaterial({
      color: '#09071d', metalness: 0.46, roughness: 0.24,
      clearcoat: 0.82, clearcoatRoughness: 0.1, envMapIntensity: 0.09,
      iridescence: 0.42, iridescenceIOR: 1.8,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#061724', metalness: 0.2, roughness: 0.08,
      clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.28,
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
    this.car.add(lower, hood, cabin);

    for (const side of [-1, 1]) {
      for (const z of [-1.45, 1.45]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.34, 18), tire);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * 1.72, 0.38, z);
        this.car.add(wheel);
      }
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.22, 0.08), red);
      tail.position.set(side * 0.95, 0.72, 2.57);
      this.car.add(tail);
      const sideStrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 3.9), side < 0 ? cyan : magenta);
      sideStrip.position.set(side * 1.72, 0.55, 0.1);
      this.car.add(sideStrip);
    }
    const rearStrip = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.07, 0.08), magenta);
    rearStrip.position.set(0, 0.92, 2.59);
    this.car.add(rearStrip);
    const underglow = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 4.5), new THREE.MeshBasicMaterial({
      color: '#ff0e8d', transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false,
    }));
    underglow.rotation.x = -Math.PI / 2;
    underglow.position.y = 0.01;
    this.car.add(underglow);
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.12, 0.36), paint);
    spoiler.position.set(0, 1.25, 2.15);
    this.car.add(spoiler);
  }

  createLights() {
    this.root.add(new THREE.HemisphereLight('#242c62', '#07020d', 0.72));
    const cyanLight = new THREE.PointLight('#19dfff', 18, 22, 2);
    cyanLight.position.set(-5, 3.5, 7);
    const magentaLight = new THREE.PointLight('#ff127f', 24, 26, 2);
    magentaLight.position.set(5, 3.2, 4);
    this.root.add(cyanLight, magentaLight);
  }

  reset() {
    this.randomState = 0x5f3759df;
    Object.assign(this.state, {
      laneIndex: 1, targetLane: 1, lateralX: 0, distance: 0, speed: 0,
      shards: 0, score: 0, elapsed: 0, crashed: false, laneChanges: 0,
    });
    this.car.position.set(0, 0.06, CAR_Z);
    this.car.rotation.set(0, 0, 0);
    this.buildings.forEach((building, index) => this.recycleBuilding(building, -18 - index * (this.isMobile ? 10 : 7.2)));
    this.runnerObjects.forEach((object, index) => this.recycleRunnerObject(object, -34 - index * 19));
    this.bendUniforms.uDriveTravel.value = 0;
    this.bendUniforms.uBendX.value = 0.00018;
    this.updateTerrain(true);
  }

  setVisible(visible) {
    this.root.visible = visible;
  }

  shiftLane(direction) {
    if (this.state.crashed) return false;
    const next = THREE.MathUtils.clamp(this.state.targetLane + Math.sign(direction), 0, 2);
    if (next === this.state.targetLane) return false;
    this.state.targetLane = next;
    this.state.laneChanges += 1;
    return true;
  }

  start() {
    this.reset();
    this.state.speed = 34;
  }

  update(dt, active) {
    this.bendUniforms.uDriveTime.value += dt;
    this.terrainAccumulator += dt;
    if (!active || this.state.crashed) {
      this.car.position.y = 0.06 + Math.sin(this.bendUniforms.uDriveTime.value * 2.2) * 0.012;
      return;
    }

    this.state.elapsed += dt;
    this.state.speed = Math.min(62, this.state.speed + dt * 0.72);
    const advance = this.state.speed * dt;
    this.state.distance += advance;
    this.state.score = Math.floor(this.state.distance * 2 + this.state.shards * 125);
    const targetX = LANE_X[this.state.targetLane];
    const previousX = this.state.lateralX;
    this.state.lateralX = smoothDamp(this.state.lateralX, targetX, 11.5, dt);
    const lateralVelocity = (this.state.lateralX - previousX) / Math.max(dt, 0.0001);
    this.car.position.x = this.state.lateralX;
    if (Math.abs(this.state.lateralX - targetX) < 0.08) this.state.laneIndex = this.state.targetLane;
    this.car.position.y = 0.06 + Math.sin(this.state.elapsed * 7.5) * 0.012;
    this.car.rotation.z = smoothDamp(this.car.rotation.z, -lateralVelocity * 0.012, 9, dt);
    this.car.rotation.y = smoothDamp(this.car.rotation.y, -lateralVelocity * 0.006, 8, dt);

    this.bendUniforms.uDriveTravel.value = this.state.distance;
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
        object.shard.rotation.y += dt * 3.8;
        object.shard.rotation.x += dt * 1.4;
        object.shard.position.y = 1.05 + Math.sin(this.state.elapsed * 4 + object.z) * 0.12;
      }
      if (!object.resolved) {
        const longitudinalDistance = Math.abs(object.z - CAR_Z);
        const lateralDistance = Math.abs(this.state.lateralX - LANE_X[object.lane]);
        if (object.kind === 'shard' && longitudinalDistance < 1.8 && lateralDistance < 1.85) {
          object.resolved = true;
          this.state.shards += 1;
          object.shard.visible = false;
          this.onCollect(this.state);
        } else if (object.kind === 'barrier' && longitudinalDistance < 2.9 && lateralDistance < 2.66) {
          object.resolved = true;
          this.state.crashed = true;
          this.state.speed = 0;
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

    this.updateTerrain();
  }

  getCameraPose(target, position) {
    const targetFollow = this.isMobile ? 0.88 : 0.38;
    const cameraFollow = this.isMobile ? 0.98 : 0.82;
    target.set(DRIVE_ORIGIN_X + this.state.lateralX * targetFollow, 1.3, -9.5);
    position.set(DRIVE_ORIGIN_X + this.state.lateralX * cameraFollow, 6.4, 18.2);
    return { target, position };
  }

  getCarWorldPosition(target = this.worldCarPosition) {
    return target.set(DRIVE_ORIGIN_X + this.state.lateralX, this.car.position.y, CAR_Z);
  }

  nearbyObjects() {
    return this.runnerObjects
      .filter((object) => object.z > -70 && object.z < 16)
      .sort((a, b) => b.z - a.z)
      .slice(0, 6)
      .map((object) => ({ kind: object.kind, lane: object.lane, z: +object.z.toFixed(1), resolved: object.resolved }));
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
      crashed: this.state.crashed,
      laneChanges: this.state.laneChanges,
      bendX: +this.bendUniforms.uBendX.value.toFixed(6),
      bendY: +this.bendUniforms.uBendY.value.toFixed(6),
      terrain: 'camera-centered ImprovedNoise FBM mesh resampled during travel',
      nearbyObjects: this.nearbyObjects(),
    };
  }
}
