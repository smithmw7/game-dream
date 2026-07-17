import * as THREE from 'three';
import { gsap } from 'gsap';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const COAST_NEAR_Z = 22;
const COAST_FAR_Z = -312;
const COAST_CENTER_Z = (COAST_NEAR_Z + COAST_FAR_Z) * 0.5;
const COAST_LENGTH = COAST_NEAR_Z - COAST_FAR_Z;
const RECYCLE_Z = 34;

function setMaterialShadow(mesh, cast = false, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.frustumCulled = true;
  return mesh;
}

function createWindowTexture(primary, secondary) {
  const width = 48;
  const height = 112;
  const data = new Uint8Array(width * height * 4);
  const colorA = new THREE.Color(primary);
  const colorB = new THREE.Color(secondary);
  const dark = new THREE.Color('#020713');
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const column = Math.floor(x / 8);
      const row = Math.floor(y / 8);
      const frame = x % 8 < 2 || y % 8 < 2;
      const lit = ((column * 13 + row * 7 + column * row) % 9) > 2;
      const glow = (column + row) % 3 === 0 ? colorB : colorA;
      const color = frame || !lit ? dark : glow;
      const offset = (y * width + x) * 4;
      data[offset] = Math.round(color.r * 255);
      data[offset + 1] = Math.round(color.g * 255);
      data[offset + 2] = Math.round(color.b * 255);
      data[offset + 3] = frame ? 232 : (lit ? 255 : 220);
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.name = `Coastal hotel window grid ${primary}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createBillboardTexture(label, primary, secondary) {
  if (typeof document === 'undefined') {
    const color = new THREE.Color(primary);
    const bytes = new Uint8Array([
      Math.round(color.r * 255),
      Math.round(color.g * 255),
      Math.round(color.b * 255),
      255,
    ]);
    const texture = new THREE.DataTexture(bytes, 1, 1, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, '#050318');
  gradient.addColorStop(0.44, primary);
  gradient.addColorStop(1, secondary);
  context.fillStyle = '#02020d';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = primary;
  context.lineWidth = 8;
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.shadowBlur = 28;
  context.shadowColor = secondary;
  context.fillStyle = gradient;
  context.font = '900 74px Arial Black, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `Coastal boulevard billboard ${label}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

/**
 * Pooled car-only coastal boulevard used between the cyber city and desert.
 * The common Drive road remains the playable surface; this module owns the
 * Art Deco hotels, promenades, palms, bushes, and neon waterfront furniture.
 */
export class DriveCoastalSection {
  constructor(parent, {
    isMobile = false,
    patchMaterial = (material) => material,
    prefersReducedMotion = () => false,
    random = null,
  } = {}) {
    this.parent = parent;
    this.isMobile = Boolean(isMobile);
    this.patchMaterial = patchMaterial;
    this.prefersReducedMotion = prefersReducedMotion;
    this.randomSource = random;
    this.randomState = 0xc0a57a12;
    this.active = false;
    this.simulationActive = false;
    this.distance = 0;
    this.elapsed = 0;
    this.motionPhase = { breeze: 0 };
    this.stats = { recycledBuildings: 0, recycledPalms: 0 };

    this.environment = new THREE.Group();
    this.environment.name = 'Drive coast · rain-slick Art Deco hotel boulevard';
    this.environment.visible = false;
    parent.add(this.environment);

    this.createSharedMaterials();
    this.createBoulevardFoundation();
    this.createArtDecoScenery();
    this.createPalmsAndBushes();

    this.breezeTween = gsap.to(this.motionPhase, {
      breeze: Math.PI * 2,
      duration: 4.8,
      ease: 'none',
      repeat: -1,
      paused: true,
    });
    this.reset();
    this.setActive(false);
  }

  random() {
    if (this.randomSource) return this.randomSource();
    this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  material(material, key, style = 'plain') {
    return this.patchMaterial(material, `coast-${key}`, style);
  }

  createSharedMaterials() {
    this.concreteMaterial = this.material(new THREE.MeshPhysicalMaterial({
      color: '#080d18',
      roughness: 0.62,
      metalness: 0.22,
      clearcoat: 0.48,
      clearcoatRoughness: 0.2,
      emissive: '#03101a',
      emissiveIntensity: 0.24,
    }), 'rain-dark-concrete');
    this.promenadeMaterial = this.material(new THREE.MeshPhysicalMaterial({
      color: '#151624',
      roughness: 0.48,
      metalness: 0.36,
      clearcoat: 0.78,
      clearcoatRoughness: 0.14,
      emissive: '#080418',
      emissiveIntensity: 0.24,
    }), 'promenade');
    this.cyanMaterial = this.material(new THREE.MeshBasicMaterial({
      color: '#25f4ef',
      toneMapped: false,
    }), 'cyan-neon');
    this.magentaMaterial = this.material(new THREE.MeshBasicMaterial({
      color: '#ff2a91',
      toneMapped: false,
    }), 'magenta-neon');
    this.warmMaterial = this.material(new THREE.MeshBasicMaterial({
      color: '#ffc26a',
      toneMapped: false,
    }), 'warm-neon');
    this.buildingMaterials = [
      this.material(new THREE.MeshPhysicalMaterial({
        color: '#071324',
        roughness: 0.5,
        metalness: 0.28,
        clearcoat: 0.62,
        clearcoatRoughness: 0.2,
        emissive: '#021021',
        emissiveIntensity: 0.3,
      }), 'hotel-navy', 'building'),
      this.material(new THREE.MeshPhysicalMaterial({
        color: '#13213b',
        roughness: 0.43,
        metalness: 0.32,
        clearcoat: 0.72,
        clearcoatRoughness: 0.15,
        emissive: '#0b0820',
        emissiveIntensity: 0.36,
      }), 'hotel-blue', 'building'),
      this.material(new THREE.MeshPhysicalMaterial({
        color: '#21102f',
        roughness: 0.46,
        metalness: 0.26,
        clearcoat: 0.64,
        clearcoatRoughness: 0.18,
        emissive: '#17051f',
        emissiveIntensity: 0.36,
      }), 'hotel-violet', 'building'),
    ];
    this.windowTextures = [
      createWindowTexture('#20e7ff', '#ff2495'),
      createWindowTexture('#ff2b99', '#ffbd61'),
      createWindowTexture('#5bf8e8', '#8058ff'),
    ];
    this.windowMaterials = this.windowTextures.map((map, index) => this.material(
      new THREE.MeshBasicMaterial({
        map,
        color: '#ffffff',
        toneMapped: false,
      }),
      `window-grid-${index}`,
    ));
    this.billboardTextures = [
      createBillboardTexture('OCEAN', '#22f3ee', '#845cff'),
      createBillboardTexture('NITE', '#ff248f', '#ffad54'),
      createBillboardTexture('VICE', '#26e9ff', '#ff2a96'),
      createBillboardTexture('DECO', '#8e5aff', '#22f1e8'),
    ];
    this.billboardMaterials = this.billboardTextures.map((map, index) => this.material(
      new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        alphaTest: 0.05,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
      `billboard-${index}`,
    ));
    this.trunkMaterial = this.material(new THREE.MeshStandardMaterial({
      color: '#211221',
      roughness: 0.9,
      metalness: 0.04,
      emissive: '#19081a',
      emissiveIntensity: 0.28,
    }), 'palm-trunk');
    this.leafMaterial = this.material(new THREE.MeshStandardMaterial({
      color: '#062824',
      roughness: 0.74,
      metalness: 0.04,
      emissive: '#003f3f',
      emissiveIntensity: 0.5,
      side: THREE.DoubleSide,
    }), 'palm-leaf');
    this.bushMaterial = this.material(new THREE.MeshStandardMaterial({
      color: '#13243a',
      roughness: 0.72,
      emissive: '#4c0737',
      emissiveIntensity: 0.66,
      flatShading: true,
    }), 'coastal-bush');
  }

  createBoulevardFoundation() {
    const segments = this.isMobile ? 48 : 80;
    this.foundation = [];
    for (const side of [-1, 1]) {
      const ground = setMaterialShadow(new THREE.Mesh(
        new THREE.BoxGeometry(17, 0.42, COAST_LENGTH, 1, 1, segments),
        this.concreteMaterial,
      ));
      ground.name = `${side < 0 ? 'Left' : 'Right'} hotel district ground`;
      ground.position.set(side * 15.1, -0.27, COAST_CENTER_Z);

      const curb = setMaterialShadow(new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 0.38, COAST_LENGTH, 1, 1, segments),
        this.concreteMaterial,
      ));
      curb.name = `${side < 0 ? 'Left' : 'Right'} boulevard curb`;
      curb.position.set(side * 6.82, -0.03, COAST_CENTER_Z);

      const promenade = setMaterialShadow(new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.13, COAST_LENGTH, 1, 1, segments),
        this.promenadeMaterial,
      ));
      promenade.position.set(side * 8.25, 0.22, COAST_CENTER_Z);

      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, COAST_LENGTH, 1, 1, segments),
        side < 0 ? this.cyanMaterial : this.magentaMaterial,
      );
      edge.position.set(side * 6.03, 0.055, COAST_CENTER_Z);
      edge.frustumCulled = true;

      this.environment.add(ground, curb, promenade, edge);
      this.foundation.push({ ground, curb, promenade, edge });
    }
  }

  createArtDecoBuilding(index) {
    const group = new THREE.Group();
    const kind = index % 3 === 0 ? 'nightclub' : (index % 2 ? 'condo' : 'hotel');
    group.name = `Pooled coastal Art Deco ${kind}`;
    const body = setMaterialShadow(new THREE.Mesh(
      new RoundedBoxGeometry(1, 1, 1, 3, 0.08),
      this.buildingMaterials[index % this.buildingMaterials.length],
    ), !this.isMobile && index % 2 === 0, true);
    const facade = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      this.windowMaterials[index % this.windowMaterials.length],
    );
    facade.frustumCulled = true;
    const roof = setMaterialShadow(new THREE.Mesh(
      new RoundedBoxGeometry(1, 1, 1, 2, 0.08),
      this.concreteMaterial,
    ));
    const billboard = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1),
      this.billboardMaterials[index % this.billboardMaterials.length],
    );
    billboard.frustumCulled = true;
    const canopy = new THREE.Mesh(
      new RoundedBoxGeometry(1, 1, 1, 2, 0.08),
      index % 2 ? this.cyanMaterial : this.magentaMaterial,
    );
    const trimCount = this.isMobile ? 2 : (kind === 'nightclub' ? 4 : 3);
    const trims = Array.from({ length: trimCount }, (_, trimIndex) => {
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.045, 1),
        (index + trimIndex) % 2 ? this.magentaMaterial : this.cyanMaterial,
      );
      trim.frustumCulled = true;
      group.add(trim);
      return trim;
    });
    group.add(body, facade, roof, billboard, canopy);
    return {
      group,
      body,
      facade,
      roof,
      billboard,
      canopy,
      trims,
      side: index % 2 ? 1 : -1,
      speedFactor: 1,
      kind,
    };
  }

  createArtDecoScenery() {
    this.buildings = [];
    const count = this.isMobile ? 8 : 20;
    for (let index = 0; index < count; index++) {
      const building = this.createArtDecoBuilding(index);
      this.buildings.push(building);
      this.environment.add(building.group);
      this.recycleBuilding(building, -12 - index * (this.isMobile ? 31 : 13), false);
    }
  }

  recycleBuilding(building, z, countRecycle = true) {
    const width = 5.4 + this.random() * 4.2;
    const depth = 5.2 + this.random() * 5.8;
    const heightBase = building.kind === 'nightclub' ? 6.5 : 10.5;
    const heightRange = building.kind === 'nightclub' ? 7.5 : 20;
    const height = heightBase + Math.pow(this.random(), 0.65) * heightRange;
    const setback = 11.2 + this.random() * 6.8;
    building.group.position.set(building.side * setback, 0.12, z);
    building.group.rotation.y = (this.random() - 0.5) * 0.035;
    building.body.scale.set(width, height, depth);
    building.body.position.y = height * 0.5;
    building.facade.scale.set(width * 0.78, height * 0.76, 1);
    building.facade.position.set(0, height * 0.52, depth * 0.501);
    building.roof.scale.set(width * 1.05, 0.42, depth * 1.05);
    building.roof.position.set(0, height + 0.19, 0);
    building.billboard.scale.setScalar(building.kind === 'nightclub' ? 1.35 : 0.92);
    building.billboard.position.set(
      (this.random() - 0.5) * width * 0.28,
      height * (building.kind === 'nightclub' ? 0.72 : 0.86),
      depth * 0.516,
    );
    building.canopy.scale.set(width * 0.76, 0.16, 1.8);
    building.canopy.position.set(0, 1.55, depth * 0.58);
    building.trims.forEach((trim, trimIndex) => {
      trim.scale.set(width * 1.035, 1, depth * 1.025);
      trim.position.set(0, height * ((trimIndex + 1) / (building.trims.length + 1)), 0);
    });
    building.speedFactor = 0.96 + this.random() * 0.07;
    if (countRecycle) this.stats.recycledBuildings += 1;
  }

  createPalm(index) {
    const group = new THREE.Group();
    group.name = `Pooled coastal boulevard palm ${index + 1}`;
    const trunkHeight = this.isMobile ? 7.2 : 2.6;
    const trunkGeometry = new THREE.CylinderGeometry(
      0.18,
      0.28,
      trunkHeight,
      this.isMobile ? 7 : 9,
    );
    const leafGeometry = new THREE.ConeGeometry(0.28, 3.8, 5, 1, true);
    const crown = new THREE.Group();
    const trunkSegments = this.isMobile ? 1 : 3;
    for (let segment = 0; segment < trunkSegments; segment++) {
      const trunk = setMaterialShadow(new THREE.Mesh(trunkGeometry, this.trunkMaterial), false, true);
      trunk.position.set(
        this.isMobile ? 0.2 : segment * 0.14,
        this.isMobile ? 3.55 : 1.25 + segment * 2.42,
        0,
      );
      trunk.rotation.z = -0.055;
      group.add(trunk);
    }
    crown.position.set(this.isMobile ? 0.4 : 0.48, this.isMobile ? 7.25 : 7.65, 0);
    const leafCount = this.isMobile ? 4 : 7;
    for (let leafIndex = 0; leafIndex < leafCount; leafIndex++) {
      const leaf = new THREE.Mesh(leafGeometry, this.leafMaterial);
      const angle = (leafIndex / leafCount) * Math.PI * 2;
      leaf.rotation.order = 'YXZ';
      leaf.rotation.y = angle;
      leaf.rotation.z = Math.PI / 2.7;
      leaf.position.set(Math.cos(angle) * 1.05, -0.3, Math.sin(angle) * 1.05);
      leaf.frustumCulled = true;
      crown.add(leaf);
    }
    group.add(crown);

    const bushGeometry = new THREE.IcosahedronGeometry(0.68, 1);
    const bushCount = this.isMobile ? 2 : 3;
    for (let bushIndex = 0; bushIndex < bushCount; bushIndex++) {
      const bush = setMaterialShadow(new THREE.Mesh(bushGeometry, this.bushMaterial));
      bush.position.set(
        (bushIndex - (bushCount - 1) * 0.5) * 0.78,
        0.45,
        (bushIndex % 2) * 0.42,
      );
      bush.scale.set(1.2, 0.82 + bushIndex * 0.07, 1);
      group.add(bush);
    }
    return {
      group,
      side: index % 2 ? 1 : -1,
      speedFactor: 1,
      baseLean: 0,
      swaySeed: index * 1.731,
    };
  }

  createPalmsAndBushes() {
    this.palms = [];
    const count = this.isMobile ? 6 : 14;
    for (let index = 0; index < count; index++) {
      const palm = this.createPalm(index);
      this.palms.push(palm);
      this.environment.add(palm.group);
      this.recyclePalm(palm, -20 - index * (this.isMobile ? 45 : 19), false);
    }
  }

  recyclePalm(palm, z, countRecycle = true) {
    const scale = 0.72 + this.random() * 0.42;
    palm.group.position.set(palm.side * (7.72 + this.random() * 2.2), 0.28, z);
    palm.group.scale.setScalar(scale);
    palm.group.rotation.y = (this.random() - 0.5) * 0.45;
    palm.baseLean = palm.side * (0.12 + this.random() * 0.08);
    palm.group.rotation.z = palm.baseLean;
    palm.speedFactor = 0.97 + this.random() * 0.06;
    palm.swaySeed = this.random() * Math.PI * 2;
    if (countRecycle) this.stats.recycledPalms += 1;
  }

  setActive(active) {
    this.active = Boolean(active);
    this.environment.visible = this.active;
    const runMotion = this.active && this.simulationActive;
    this.breezeTween?.paused(!runMotion);
  }

  reset() {
    this.randomState = 0xc0a57a12;
    this.distance = 0;
    this.elapsed = 0;
    this.motionPhase.breeze = 0;
    Object.assign(this.stats, { recycledBuildings: 0, recycledPalms: 0 });
    this.buildings.forEach((building, index) => {
      this.recycleBuilding(building, -12 - index * (this.isMobile ? 31 : 13), false);
    });
    this.palms.forEach((palm, index) => {
      this.recyclePalm(palm, -20 - index * (this.isMobile ? 45 : 19), false);
    });
    this.breezeTween?.restart();
    this.breezeTween?.paused(!(this.active && this.simulationActive));
  }

  update(dt, {
    advance = 0,
    active = true,
  } = {}) {
    if (!this.active) return;
    const safeDt = THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    this.elapsed += safeDt;
    this.simulationActive = Boolean(active);
    this.breezeTween?.paused(!(this.active && this.simulationActive));
    if (!this.simulationActive) return;

    const safeAdvance = Math.max(0, Number.isFinite(advance) ? advance : 0);
    this.distance += safeAdvance;

    let farthestBuildingZ = Infinity;
    this.buildings.forEach((building) => {
      farthestBuildingZ = Math.min(farthestBuildingZ, building.group.position.z);
    });
    this.buildings.forEach((building) => {
      building.group.position.z += safeAdvance * building.speedFactor;
      if (building.group.position.z > RECYCLE_Z) {
        farthestBuildingZ -= 9.5 + this.random() * 7.5;
        this.recycleBuilding(building, farthestBuildingZ);
      }
    });

    let farthestPalmZ = Infinity;
    this.palms.forEach((palm) => {
      farthestPalmZ = Math.min(farthestPalmZ, palm.group.position.z);
    });
    this.palms.forEach((palm) => {
      palm.group.position.z += safeAdvance * palm.speedFactor;
      const sway = this.prefersReducedMotion()
        ? 0
        : Math.sin(this.motionPhase.breeze + palm.swaySeed) * 0.018;
      palm.group.rotation.z = palm.baseLean + sway;
      if (palm.group.position.z > RECYCLE_Z) {
        farthestPalmZ -= 13 + this.random() * 11;
        this.recyclePalm(palm, farthestPalmZ);
      }
    });
  }

  nearbyScenery() {
    return [
      ...this.buildings.map((building) => ({
        kind: `art-deco-${building.kind}`,
        z: building.group.position.z,
      })),
      ...this.palms.map((palm) => ({
        kind: 'leaning-palm',
        z: palm.group.position.z,
      })),
    ]
      .filter((item) => item.z > -105 && item.z < 30)
      .sort((a, b) => b.z - a.z)
      .slice(0, 7)
      .map((item) => ({ kind: item.kind, z: +item.z.toFixed(1) }));
  }

  snapshot() {
    return {
      active: this.active,
      simulationActive: this.simulationActive,
      style: 'car-only rain-slick Art Deco hotel and nightclub boulevard',
      surface: 'shared three-lane wet asphalt road',
      scenery: {
        artDecoBuildings: this.buildings.length,
        leaningPalms: this.palms.length,
        promenadeSides: this.foundation.length,
      },
      traveled: +this.distance.toFixed(1),
      ...this.stats,
      nearbyScenery: this.nearbyScenery(),
    };
  }

  dispose() {
    this.breezeTween?.kill();
    this.environment.removeFromParent();
    const geometries = new Set();
    const materials = new Set();
    this.environment.traverse((child) => {
      if (child.isMesh && child.geometry) geometries.add(child.geometry);
      if (!child.material) return;
      const entries = Array.isArray(child.material) ? child.material : [child.material];
      entries.filter(Boolean).forEach((material) => materials.add(material));
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    [...this.windowTextures, ...this.billboardTextures].forEach((texture) => texture.dispose());
  }
}
