// Valley Rings — the mail plane: a low-poly model built from
// primitives, and the arcade flight model that flies it.
//
// The model is simple on purpose: speed chases the throttle
// setting, pitch and roll chase the stick, banking turns the
// nose. Two honest touches keep it flight-like — below the
// stall speed the nose drops and she sinks, and a landing is
// judged on where, how flat, and how gently she touches.

import * as THREE from "../vendor/three.module.min.js";
import { PLANE, SCORE } from "./config.js";
import { heightAt, runwayAt } from "./world.js";

const GEAR_HEIGHT = 1.6; // fuselage centre above the ground while rolling
const MAX_PITCH = 0.42;
const MAX_ROLL = 0.95;

function buildModel() {
  const group = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf2b13c, roughness: 0.5, metalness: 0.15 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc8402a, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22282e, roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1d3a52, roughness: 0.12, metalness: 0.5 });

  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(1.05, 5.4, 6, 12), yellow);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.92, 14, 10), glass);
  canopy.scale.set(0.85, 0.62, 1.5);
  canopy.position.set(0, 0.78, 0.4);
  group.add(canopy);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.26, 1.9), red);
  wing.position.set(0, -0.15, -0.4);
  group.add(wing);

  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.2, 1.15), red);
  tailWing.position.set(0, 0.25, 3.6);
  group.add(tailWing);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.9, 1.25), red);
  fin.position.set(0, 0.95, 3.6);
  group.add(fin);

  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), dark);
  prop.add(hub);
  for (const angle of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 4.6, 0.08), dark);
    blade.rotation.z = angle;
    prop.add(blade);
  }
  // A faint disc so the spinning prop reads as a blur, not a cross.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(2.35, 24),
    new THREE.MeshBasicMaterial({ color: 0x1a1e24, transparent: true, opacity: 0.15, depthWrite: false }),
  );
  disc.position.z = -0.06;
  prop.add(disc);
  prop.position.set(0, 0, -4.15);
  group.add(prop);

  const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.38, 12);
  for (const side of [-1, 1]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.25, -GEAR_HEIGHT + 0.55, -0.9);
    group.add(wheel);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), dark);
    strut.position.set(side * 1.1, -GEAR_HEIGHT + 1.05, -0.9);
    strut.rotation.z = side * 0.25;
    group.add(strut);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.24, 10), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -GEAR_HEIGHT + 0.3, 3.7);
  group.add(tailWheel);

  return { group, prop };
}

/**
 * The plane and its flight state. `step(dt, input)` advances
 * the fixed-step simulation; input is {pitch, roll, throttle},
 * each -1..1. It returns a list of events for the game to
 * react to: {type:'ring', index} is added by main (it owns the
 * course), {type:'landed', strip, gentle}, {type:'crashed', why}.
 */
export function createPlane(scene) {
  const { group, prop } = buildModel();
  scene.add(group);

  const state = {
    pos: new THREE.Vector3(0, GEAR_HEIGHT, PLANE.startZ),
    yaw: 0, // 0 faces -Z, down the valley; grows turning right
    pitch: 0,
    roll: 0,
    speed: 0,
    targetSpeed: 0,
    airborne: false,
    landed: null, // 'home' | 'far' once parked after a flight
    crashed: null,
    sinkRate: 0, // m/s downward, for judging touchdowns
  };

  function reset() {
    state.pos.set(0, GEAR_HEIGHT, PLANE.startZ);
    state.yaw = 0;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.targetSpeed = 0;
    state.airborne = false;
    state.landed = null;
    state.crashed = null;
    state.sinkRate = 0;
  }

  function step(dt, input) {
    const events = [];
    if (state.crashed || state.landed === "far") return events;

    state.targetSpeed = THREE.MathUtils.clamp(
      state.targetSpeed + input.throttle * 26 * dt,
      PLANE.minSpeed,
      PLANE.maxSpeed,
    );
    const accel = state.airborne ? 7 : 5.2;
    state.speed += THREE.MathUtils.clamp(state.targetSpeed - state.speed, -accel * dt, accel * dt);

    // Roll and pitch chase the stick.
    const rollTarget = input.roll * MAX_ROLL;
    state.roll += THREE.MathUtils.clamp(rollTarget - state.roll, -2.4 * dt, 2.4 * dt);
    let pitchTarget = input.pitch * MAX_PITCH;
    if (!state.airborne) pitchTarget = Math.max(0, pitchTarget); // no digging the nose in on the ground
    if (state.airborne && state.speed < PLANE.stallSpeed) {
      pitchTarget = -0.3; // stalled: the nose drops whether you like it or not
    }
    state.pitch += THREE.MathUtils.clamp(pitchTarget - state.pitch, -1.9 * dt, 1.9 * dt);

    // Banking turns the nose; the turn is wider the faster she goes.
    if (state.airborne) {
      state.yaw += Math.sin(state.roll) * (34 / Math.max(state.speed, 14)) * dt;
    } else if (state.speed > 4) {
      state.yaw += input.roll * 0.35 * dt; // taxi steering
    }

    const cosP = Math.cos(state.pitch);
    const vel = new THREE.Vector3(
      Math.sin(state.yaw) * cosP,
      Math.sin(state.pitch),
      -Math.cos(state.yaw) * cosP,
    ).multiplyScalar(state.speed);
    if (state.airborne && state.speed < PLANE.stallSpeed) vel.y -= 4.5; // the stall sink
    state.sinkRate = -vel.y;

    const prevZ = state.pos.z;
    state.pos.addScaledVector(vel, dt);
    void prevZ;

    const ground = heightAt(state.pos.x, state.pos.z);
    const floorY = ground + GEAR_HEIGHT;

    if (!state.airborne) {
      state.pos.y = floorY;
      if (state.speed >= PLANE.takeOffSpeed && state.pitch > 0.12) {
        state.airborne = true;
        state.landed = null;
      } else if (state.speed < 0.4 && state.targetSpeed === 0 && state.landed !== "home") {
        state.landed = state.landed ?? null;
      }
    } else if (state.pos.y <= floorY) {
      // Touchdown: judge it.
      const strip = runwayAt(state.pos.x, state.pos.z);
      const flat = Math.abs(state.roll) < 0.3 && state.pitch > -0.12;
      if (strip && flat && state.sinkRate <= 6.5 && ground < 1) {
        state.pos.y = floorY;
        state.airborne = false;
        state.pitch = 0;
        state.roll = 0;
        events.push({ type: "landed", strip, gentle: state.sinkRate <= SCORE.gentleSink });
        if (strip === "far") state.landed = "far";
      } else {
        state.crashed = !strip
          ? "She came down off the strip, in the rough."
          : !flat
            ? "She touched down tipped over — a landing has to be flat."
            : "She hit the ground too hard. Ease her down next time.";
        events.push({ type: "crashed", why: state.crashed });
      }
    }

    // Model follows the state.
    group.position.copy(state.pos);
    group.rotation.order = "YXZ";
    group.rotation.y = -state.yaw;
    group.rotation.x = state.pitch;
    group.rotation.z = -state.roll;
    prop.rotation.z += dt * (4 + state.speed * 1.4);

    return events;
  }

  return { group, state, reset, step, GEAR_HEIGHT };
}
