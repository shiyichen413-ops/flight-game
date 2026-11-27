// Valley Rings — the game itself: boot, input, the fixed-step
// loop, the chase camera, ring scoring, and the screens.
//
// Screenshots: ?shot=start|play|end&seed=1 stages a real scene
// (the parked plane under the title, a mid-course chase frame,
// the far-strip celebration) and holds it, so the maker's
// screenshots are the game's own renders, seed-identical every
// time.

import * as THREE from "../vendor/three.module.min.js";
import { STEP, RING_RADIUS, SCORE, RUNWAY } from "./config.js";
import { buildWorld } from "./world.js";
import { createPlane } from "./plane.js";
import { createHud } from "./hud.js";

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 1) || 1;
const shot = params.get("shot");

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 9000);

const world = buildWorld(scene, seed);
const plane = createPlane(scene);
const hud = createHud();
const status = document.getElementById("status");

let screen = "title"; // title | play | over
let ringsDone = 0;
let score = 0;
let flightTime = 0;
let wasAirborne = false;

/* ---------- input: keyboard and mouse together ---------- */

const keys = new Set();
let mouseX = 0;
let mouseY = 0;
let mouseSeen = false;

window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if ((e.code === "Enter" || e.code === "Space") && screen !== "play") startFlight();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("pointermove", (e) => {
  mouseSeen = true;
  mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseY = (e.clientY / window.innerHeight) * 2 - 1;
});

function readInput() {
  const input = { pitch: 0, roll: 0, throttle: 0 };
  if (keys.has("ArrowLeft")) input.roll -= 1;
  if (keys.has("ArrowRight")) input.roll += 1;
  if (keys.has("ArrowUp")) input.pitch += 1;
  if (keys.has("ArrowDown")) input.pitch -= 1;
  if (keys.has("KeyW")) input.throttle += 1;
  if (keys.has("KeyS")) input.throttle -= 1;
  if (input.roll === 0 && input.pitch === 0 && mouseSeen && screen === "play") {
    input.roll = THREE.MathUtils.clamp(mouseX * 1.1, -1, 1);
    input.pitch = THREE.MathUtils.clamp(-mouseY * 0.85, -1, 1);
  }
  return input;
}

/* ---------- flow ---------- */

const titleScreen = document.getElementById("title-screen");
const endScreen = document.getElementById("end-screen");
document.getElementById("start-btn").addEventListener("click", startFlight);
document.getElementById("again-btn").addEventListener("click", startFlight);

function startFlight() {
  plane.reset();
  for (const ring of world.rings) {
    ring.passed = false;
    ring.mesh.material.color.set(0xffb52e);
    ring.mesh.material.emissive.set(0xa86a00);
  }
  ringsDone = 0;
  score = 0;
  flightTime = 0;
  wasAirborne = false;
  screen = "play";
  titleScreen.classList.add("hidden");
  endScreen.classList.add("hidden");
  hud.show();
  hud.announce("Throttle up — W — and ease her into the sky", 3.4);
  status.textContent = "Flight started. Throttle up with W, climb with the up arrow.";
}

function endFlight(won, story, bonusText) {
  screen = "over";
  document.getElementById("end-title").textContent = won ? "Delivered! ✈" : "Down in the valley";
  document.getElementById("end-story").textContent = story;
  document.getElementById("end-score").innerHTML =
    `Rings ${ringsDone} of 8 · ${Math.round(flightTime)} seconds aloft<br>Final score: ${score}${bonusText ?? ""}`;
  endScreen.classList.remove("hidden");
  status.textContent = story;
}

function onEvents(events, prevZ) {
  for (const ev of events) {
    if (ev.type === "landed" && ev.strip === "far") {
      score += SCORE.landingBonus + (ev.gentle ? SCORE.gentleBonus : 0);
      endFlight(
        true,
        ev.gentle
          ? "A feather of a touchdown on the far strip — the mail is delivered, and the valley is yours."
          : "Down safely on the far strip. The mail is delivered.",
        ev.gentle ? ` (including the ${SCORE.gentleBonus} gentle-touchdown bonus)` : "",
      );
    } else if (ev.type === "landed" && ev.strip === "home") {
      hud.announce("Back at the home strip — throttle up and go again when you're ready", 3.6);
    } else if (ev.type === "crashed") {
      endFlight(false, ev.why + " The postmaster sends his regards — and another plane.");
    }
  }
  // Ring crossings: the plane's z swept past a ring's z this step.
  for (const ring of world.rings) {
    if (ring.passed) continue;
    const rz = ring.mesh.position.z;
    const crossed = (prevZ - rz) * (plane.state.pos.z - rz) <= 0 && prevZ !== plane.state.pos.z;
    if (!crossed) continue;
    const dx = plane.state.pos.x - ring.mesh.position.x;
    const dy = plane.state.pos.y - ring.mesh.position.y;
    if (Math.hypot(dx, dy) <= RING_RADIUS) {
      world.markPassed(ring);
      ringsDone += 1;
      score += SCORE.perRing;
      hud.announce(ringsDone === 8 ? "That's all eight! Now land her at the far strip" : `Ring ${ringsDone} of 8 — ${SCORE.perRing} points`, 2.2);
      status.textContent = `Through ring ${ringsDone} of 8.`;
    }
  }
}

/* ---------- camera ---------- */

const camPos = new THREE.Vector3(14, 6, 348);
const lookTarget = new THREE.Vector3();
let titleCam = false;

/** Put the model where the state says it is (used by the staged scenes, which never step). */
function posePlane() {
  const s = plane.state;
  plane.group.position.copy(s.pos);
  plane.group.rotation.order = "YXZ";
  plane.group.rotation.y = -s.yaw;
  plane.group.rotation.x = s.pitch;
  plane.group.rotation.z = -s.roll;
}

function updateCamera(dt, cinematic) {
  const s = plane.state;
  const forward = new THREE.Vector3(
    Math.sin(s.yaw) * Math.cos(s.pitch),
    Math.sin(s.pitch),
    -Math.cos(s.yaw) * Math.cos(s.pitch),
  );
  let desired;
  if (titleCam) {
    // Over the parked plane's shoulder, looking down the valley.
    camera.position.set(s.pos.x + 9, s.pos.y + 4.4, s.pos.z + 21);
    camera.lookAt(s.pos.x - 4, s.pos.y + 0.5, s.pos.z - 80);
    return;
  }
  if (cinematic) {
    desired = new THREE.Vector3(s.pos.x + 13, s.pos.y + 3.2, s.pos.z - 15);
    lookTarget.copy(s.pos).add(new THREE.Vector3(0, 0.6, 0));
    camera.position.copy(desired);
    camera.lookAt(lookTarget);
    return;
  }
  desired = s.pos.clone().addScaledVector(forward, -13.5).add(new THREE.Vector3(0, 4.4, 0));
  const k = 1 - Math.exp(-dt * 3.6);
  camPos.lerp(desired, k);
  camera.position.copy(camPos);
  lookTarget.copy(s.pos).addScaledVector(forward, 34).add(new THREE.Vector3(0, 1.2, 0));
  camera.lookAt(lookTarget);
}

/* ---------- shot staging ---------- */

function stageShot(name) {
  if (name === "play") {
    hud.show();
    const s = plane.state;
    const target = world.rings[3];
    s.pos.set(target.mesh.position.x * 0.35, target.mesh.position.y + 6, target.mesh.position.z + 330);
    // Face the ring: the yaw whose forward vector points at it.
    const dx = target.mesh.position.x - s.pos.x;
    const dz = target.mesh.position.z - s.pos.z;
    s.yaw = Math.atan2(dx, -dz);
    s.pitch = -0.04;
    s.roll = 0.18;
    s.speed = 46;
    s.targetSpeed = 46;
    s.airborne = true;
    for (let i = 0; i < 3; i += 1) world.markPassed(world.rings[i]);
    ringsDone = 3;
    score = 300;
    titleScreen.classList.add("hidden");
    hud.announce("Ring 4 ahead — thread it!", 60);
    screen = "shot";
    // Start the chase camera already behind the plane.
    const fwd = new THREE.Vector3(Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    camPos.copy(s.pos).addScaledVector(fwd, -13.5).add(new THREE.Vector3(0, 4.4, 0));
  } else if (name === "end") {
    hud.show();
    const s = plane.state;
    s.pos.set(0, plane.GEAR_HEIGHT, RUNWAY.farZ - 150);
    s.landed = "far";
    for (const ring of world.rings) world.markPassed(ring);
    ringsDone = 8;
    score = 8 * SCORE.perRing + SCORE.landingBonus + SCORE.gentleBonus;
    flightTime = 212;
    titleScreen.classList.add("hidden");
    endFlight(true, "A feather of a touchdown on the far strip — the mail is delivered, and the valley is yours.");
    hud.update(s, ringsDone, score);
    screen = "shot";
  } else {
    // Title scene: no HUD — the panel, the parked plane, and
    // the whole valley waiting behind it.
    hud.hide();
    titleCam = true;
    screen = "shot";
  }
  posePlane();
}

/* ---------- the loop ---------- */

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

if (shot) stageShot(shot);
else posePlane();

let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (screen === "play") {
    acc += dt;
    const input = readInput();
    while (acc >= STEP) {
      const prevZ = plane.state.pos.z;
      const events = plane.step(STEP, input);
      if (plane.state.airborne) {
        flightTime += STEP;
        wasAirborne = true;
      }
      onEvents(events, prevZ);
      acc -= STEP;
      if (screen !== "play") break;
    }
    hud.update(plane.state, ringsDone, score);
  } else if (shot === "play") {
    hud.update(plane.state, ringsDone, score);
  }

  world.update(plane.state.pos);
  updateCamera(dt, screen !== "play" && shot !== "play");
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
