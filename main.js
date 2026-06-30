import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ---------------------------------------------------------------------------
// Scene setup
// ---------------------------------------------------------------------------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(5, 5, 7);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 5;
controls.maxDistance = 20;
controls.enablePan = false;

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.85));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
keyLight.position.set(6, 10, 8);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-8, -4, -6);
scene.add(fillLight);

// ---------------------------------------------------------------------------
// Cube construction
// ---------------------------------------------------------------------------
// Standard Rubik's colors. Order of BoxGeometry faces: +X, -X, +Y, -Y, +Z, -Z
const COLORS = {
  right: 0xb71234, // +X  red
  left: 0xff5800, //  -X  orange
  up: 0xffffff, //    +Y  white
  down: 0xffd500, //  -Y  yellow
  front: 0x009b48, // +Z  green
  back: 0x0046ad, //  -Z  blue
  inner: 0x111417, // hidden faces
};

const cubeGroup = new THREE.Group();
scene.add(cubeGroup);

const pivot = new THREE.Group();
cubeGroup.add(pivot);

const SIZE = 0.96; // cubie size
const GAP = 1.0; // spacing between cubie centers
const cubies = [];

function makeMaterials(x, y, z) {
  const m = (hex) =>
    new THREE.MeshStandardMaterial({
      color: hex,
      roughness: 0.35,
      metalness: 0.05,
    });
  return [
    m(x === 1 ? COLORS.right : COLORS.inner), // +X
    m(x === -1 ? COLORS.left : COLORS.inner), // -X
    m(y === 1 ? COLORS.up : COLORS.inner), //  +Y
    m(y === -1 ? COLORS.down : COLORS.inner), // -Y
    m(z === 1 ? COLORS.front : COLORS.inner), // +Z
    m(z === -1 ? COLORS.back : COLORS.inner), // -Z
  ];
}

const geometry = new THREE.BoxGeometry(SIZE, SIZE, SIZE);

function buildCube() {
  for (const cubie of cubies) {
    cubeGroup.remove(cubie);
    cubie.geometry.dispose();
    cubie.material.forEach((mat) => mat.dispose());
  }
  cubies.length = 0;

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const cubie = new THREE.Mesh(geometry.clone(), makeMaterials(x, y, z));
        cubie.position.set(x * GAP, y * GAP, z * GAP);

        // Subtle dark edge frame around every cubie.
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(cubie.geometry),
          new THREE.LineBasicMaterial({ color: 0x000000 })
        );
        cubie.add(edges);

        cubeGroup.add(cubie);
        cubies.push(cubie);
      }
    }
  }
}

buildCube();

// ---------------------------------------------------------------------------
// Move engine
// ---------------------------------------------------------------------------
// Each move = which axis, which slice layer, and the rotation direction.
const AXIS = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

// move -> { axis, layer (the coordinate value of the slice), dir (sign) }
// dir is chosen so that the named face turns clockwise when viewed from outside.
const MOVES = {
  U: { axis: "y", layer: 1, dir: -1 },
  D: { axis: "y", layer: -1, dir: 1 },
  R: { axis: "x", layer: 1, dir: -1 },
  L: { axis: "x", layer: -1, dir: 1 },
  F: { axis: "z", layer: 1, dir: -1 },
  B: { axis: "z", layer: -1, dir: 1 },
};

const queue = [];
let active = null;
const TURN_DURATION = 0.22; // seconds per quarter turn

function enqueue(move) {
  queue.push(move);
}

function coord(cubie, axis) {
  return Math.round(cubie.position[axis] / GAP);
}

function startMove(move) {
  const prime = move.endsWith("'");
  const base = prime ? move[0] : move;
  const def = MOVES[base];
  if (!def) return;

  const axisName = def.axis;
  const dir = def.dir * (prime ? -1 : 1);
  const targetAngle = (Math.PI / 2) * dir;

  // Reset pivot and gather the cubies that belong to this slice.
  pivot.rotation.set(0, 0, 0);
  pivot.updateMatrixWorld(true);

  const members = cubies.filter((c) => coord(c, axisName) === def.layer);
  members.forEach((c) => pivot.attach(c));

  active = {
    axisName,
    targetAngle,
    members,
    elapsed: 0,
    duration: TURN_DURATION,
  };
}

function finishMove() {
  // Snap to exact target, then bake transforms back onto cubeGroup.
  pivot.rotation[active.axisName] = active.targetAngle;
  pivot.updateMatrixWorld(true);

  active.members.forEach((c) => {
    cubeGroup.attach(c);
    // Re-grid the position to avoid floating point drift over many moves.
    c.position.set(
      Math.round(c.position.x / GAP) * GAP,
      Math.round(c.position.y / GAP) * GAP,
      Math.round(c.position.z / GAP) * GAP
    );
  });

  pivot.rotation.set(0, 0, 0);
  active = null;
}

function updateMove(dt) {
  if (!active) {
    if (queue.length) startMove(queue.shift());
    return;
  }
  active.elapsed += dt;
  const t = Math.min(active.elapsed / active.duration, 1);
  // ease-in-out
  const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  pivot.rotation[active.axisName] = active.targetAngle * eased;
  if (t >= 1) finishMove();
}

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------
document.querySelectorAll("[data-move]").forEach((btn) => {
  btn.addEventListener("click", () => enqueue(btn.dataset.move));
});

const FACE_MOVES = ["U", "D", "L", "R", "F", "B"];

document.getElementById("scramble").addEventListener("click", () => {
  for (let i = 0; i < 25; i++) {
    const face = FACE_MOVES[Math.floor(Math.random() * FACE_MOVES.length)];
    const prime = Math.random() < 0.5 ? "'" : "";
    enqueue(face + prime);
  }
});

document.getElementById("reset").addEventListener("click", () => {
  queue.length = 0;
  active = null;
  pivot.rotation.set(0, 0, 0);
  buildCube();
});

// Keyboard shortcuts (hold Shift for prime moves).
window.addEventListener("keydown", (e) => {
  const key = e.key.toUpperCase();
  if (FACE_MOVES.includes(key)) {
    enqueue(key + (e.shiftKey ? "'" : ""));
  }
});

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  updateMove(dt);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
