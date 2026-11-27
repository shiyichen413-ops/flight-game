// Valley Rings — the valley itself, built with three.js.
//
// One seeded build grows everything the screenshots and the
// player see: a flat meadow floor with a river, ridges rising
// on both sides, two runway strips, eight golden rings strung
// down the course, low-poly pines, and clouds. The terrain's
// height is an analytic function, so the mesh the player sees
// and the height the collision check asks for always agree.

import * as THREE from "../vendor/three.module.min.js";
import { WORLD, RUNWAY, RING_COUNT, RING_RADIUS } from "./config.js";
import { rng } from "./random.js";

/** Ground height at a point: flat floor, then ridges climbing away on both sides. */
export function heightAt(x, z) {
  const beyond = Math.abs(x) - WORLD.valleyHalfWidth;
  if (beyond <= 0) return WORLD.floorY;
  const t = Math.min(1, beyond / 340);
  const swell = 0.8 + 0.2 * Math.sin(z * 0.01 + x * 0.013) * Math.cos(z * 0.006 - x * 0.004);
  return WORLD.ridgeHeight * Math.pow(t, 1.5) * swell;
}

/** Which runway strip a point is over, if any ('home' | 'far' | null). */
export function runwayAt(x, z) {
  if (Math.abs(x) > RUNWAY.width / 2) return null;
  if (z <= RUNWAY.homeZ && z >= RUNWAY.homeZ - RUNWAY.homeLength) return "home";
  if (z <= RUNWAY.farZ && z >= RUNWAY.farZ - RUNWAY.farLength) return "far";
  return null;
}

function buildTerrain(scene) {
  const geo = new THREE.PlaneGeometry(2800, 7000, 110, 190);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const meadow = new THREE.Color(0x69a24e);
  const dry = new THREE.Color(0x9aa356);
  const rock = new THREE.Color(0x8d8378);
  const snow = new THREE.Color(0xf4f6f2);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i) - 3000;
    pos.setZ(i, z);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const variation = 0.92 + 0.08 * Math.sin(x * 0.05) * Math.cos(z * 0.043);
    if (h < 4) c.copy(meadow).lerp(dry, Math.abs(Math.sin(z * 0.002 + x * 0.001)) * 0.5);
    else if (h < 120) c.copy(dry).lerp(rock, (h - 4) / 116);
    else c.copy(rock).lerp(snow, Math.min(1, (h - 120) / 90));
    colors[i * 3] = c.r * variation;
    colors[i * 3 + 1] = c.g * variation;
    colors[i * 3 + 2] = c.b * variation;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  scene.add(mesh);
}

function buildRiver(scene) {
  const points = [];
  for (let z = 500; z >= -6300; z -= 100) {
    points.push(new THREE.Vector3(95 * Math.sin(z * 0.0016) + 55, 0.25, z));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 120, 7, 6, false);
  // Flatten the tube into a ribbon lying on the meadow.
  geo.scale(1, 0.12, 1);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x3f7fbf, roughness: 0.25, metalness: 0.1 }));
  scene.add(mesh);
}

function buildRunway(scene, zNear, length) {
  const group = new THREE.Group();
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(RUNWAY.width, 0.3, length),
    new THREE.MeshStandardMaterial({ color: 0x3c4147, roughness: 0.95 }),
  );
  strip.position.set(0, 0.15, zNear - length / 2);
  group.add(strip);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f2e6 });
  for (let z = zNear - 18; z > zNear - length + 10; z -= 24) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 9), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.32, z);
    group.add(dash);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffd97a });
  for (let z = zNear - 6; z > zNear - length; z -= 30) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lightMat);
      lamp.position.set(side * (RUNWAY.width / 2 + 1.6), 0.6, z);
      group.add(lamp);
    }
  }
  scene.add(group);
}

function buildHangarAndWindsock(scene) {
  const hangar = new THREE.Group();
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(26, 9, 20),
    new THREE.MeshStandardMaterial({ color: 0xb0563a, roughness: 0.9 }),
  );
  walls.position.y = 4.5;
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(13.5, 13.5, 20, 12, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x6b4a35, roughness: 0.9 }),
  );
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 9;
  hangar.add(walls, roof);
  hangar.position.set(52, 0, RUNWAY.homeZ - 60);
  scene.add(hangar);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 9, 6),
    new THREE.MeshStandardMaterial({ color: 0xd8d8d8 }),
  );
  pole.position.set(-(RUNWAY.width / 2 + 7), 4.5, RUNWAY.homeZ - 30);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 4.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xe86a2d }),
  );
  sock.rotation.z = Math.PI / 2.4;
  sock.position.set(-(RUNWAY.width / 2 + 9), 8.6, RUNWAY.homeZ - 30);
  scene.add(pole, sock);
}

function buildTrees(scene, rand) {
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 2.6, 6);
  const crownGeo = new THREE.ConeGeometry(2.6, 8.5, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a35, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2f6b33, roughness: 1 });
  const count = 420;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let placed = 0;
  while (placed < count) {
    const x = rand.range(-WORLD.valleyHalfWidth - 60, WORLD.valleyHalfWidth + 60);
    const z = rand.range(420, -6100);
    if (Math.abs(x) < 46) continue; // keep the strip and the course line clear
    if (runwayAt(x, z)) continue;
    const riverX = 95 * Math.sin(z * 0.0016) + 55;
    if (Math.abs(x - riverX) < 13) continue;
    const s = rand.range(0.8, 1.5);
    const ground = heightAt(x, z);
    m.compose(new THREE.Vector3(x, ground + 1.3 * s, z), q, new THREE.Vector3(s, s, s));
    trunks.setMatrixAt(placed, m);
    m.compose(new THREE.Vector3(x, ground + (2.6 + 4.2) * s, z), q, new THREE.Vector3(s, s, s));
    crowns.setMatrixAt(placed, m);
    placed += 1;
  }
  scene.add(trunks, crowns);
}

function buildClouds(scene, rand) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xf6faff, transparent: true, opacity: 0.88 });
  for (let i = 0; i < 16; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 2 + Math.floor(rand.next() * 3);
    for (let p = 0; p < puffs; p += 1) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(rand.range(14, 30), 10, 8), mat);
      s.position.set(p * rand.range(12, 20) - puffs * 7, rand.range(-2, 2), rand.range(-6, 6));
      s.scale.y = 0.42;
      cloud.add(s);
    }
    cloud.position.set(rand.range(-700, 700), rand.range(250, 380), rand.range(300, -6000));
    scene.add(cloud);
  }
}

/**
 * Build the whole valley into `scene`. Returns the course:
 * the rings (with a `passed` flag and a way to mark them), and
 * a soft blob shadow that follows the plane along the ground.
 */
export function buildWorld(scene, seed) {
  const rand = rng(seed);

  scene.background = new THREE.Color(0x9ec9ec);
  scene.fog = new THREE.Fog(0xa9cbe8, 500, 4600);

  const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x53663f, 0.95);
  const sun = new THREE.DirectionalLight(0xffe7bd, 1.9);
  sun.position.set(400, 520, 300);
  scene.add(hemi, sun);

  buildTerrain(scene);
  buildRiver(scene);
  buildRunway(scene, RUNWAY.homeZ, RUNWAY.homeLength);
  buildRunway(scene, RUNWAY.farZ, RUNWAY.farLength);
  buildHangarAndWindsock(scene);
  buildTrees(scene, rand);
  buildClouds(scene, rand);

  const rings = [];
  const ringGeo = new THREE.TorusGeometry(RING_RADIUS, 1.15, 10, 30);
  for (let i = 0; i < RING_COUNT; i += 1) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffb52e, emissive: 0xa86a00, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.4,
    });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.position.set(rand.range(-115, 115), rand.range(48, 128), -700 - i * 560);
    scene.add(mesh);
    rings.push({ mesh, passed: false, index: i });
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(7, 20),
    new THREE.MeshBasicMaterial({ color: 0x10240f, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  return {
    rings,
    /** Mark a ring flown: gold turns to green. */
    markPassed(ring) {
      ring.passed = true;
      ring.mesh.material.color.set(0x53d769);
      ring.mesh.material.emissive.set(0x1d7a33);
    },
    /** Keep the blob shadow under the plane, fading as it climbs. */
    update(planePos) {
      const ground = heightAt(planePos.x, planePos.z);
      shadow.position.set(planePos.x, ground + 0.3, planePos.z);
      const alt = Math.max(0, planePos.y - ground);
      shadow.material.opacity = Math.max(0.05, 0.32 - alt * 0.0022);
      const s = 1 + alt * 0.01;
      shadow.scale.set(s, s, s);
    },
  };
}
