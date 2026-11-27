import * as THREE from 'three';
import { defaultRoomCourseIndex, roomCourse, roomCourses } from './course-layout.js';
import { addCup } from './cup.js';
import { controllerGamepad } from './xr-controls.js';

const up = new THREE.Vector3(0, 1, 0);
const halfWidth = roomCourse.width / 2;
const length = roomCourse.teeEdge - roomCourse.cupEdge;
const middle = (roomCourse.teeEdge + roomCourse.cupEdge) / 2;

function outlineCorners(y = 0) {
  return [
    new THREE.Vector3(-halfWidth, y, roomCourse.teeEdge),
    new THREE.Vector3(halfWidth, y, roomCourse.teeEdge),
    new THREE.Vector3(halfWidth, y, roomCourse.cupEdge),
    new THREE.Vector3(-halfWidth, y, roomCourse.cupEdge),
  ];
}

function addRoomFeatures(parent, layout, preview = false) {
  const obstacleMaterial = preview
    ? new THREE.MeshBasicMaterial({ color: 0xeaba72, transparent: true, opacity: 0.72, depthWrite: false })
    : new THREE.MeshStandardMaterial({ color: 0xb47741, roughness: 0.8 });
  for (const obstacle of layout.obstacles) {
    const { minX, maxX, minZ, maxZ, height } = obstacle;
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, height, maxZ - minZ), obstacleMaterial);
    bumper.position.set((minX + maxX) / 2, height / 2, (minZ + maxZ) / 2);
    parent.add(bumper);
  }

  const { x, z, radius } = layout.cup;
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(radius, radius + 0.016, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd47d }),
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(x, preview ? 0.016 : 0.004, z);
  parent.add(rim);
}

export function createRoomCourse(parent) {
  parent.add(new THREE.HemisphereLight(0xe8f6f2, 0x536659, 2.1));
  const light = new THREE.DirectionalLight(0xffe8bd, 1.6);
  light.position.set(-1, 3, 1);
  parent.add(light);

  const variants = roomCourses.map((layout) => {
    const variant = new THREE.Group();
    addCup(variant, layout.cup);
    addRoomFeatures(variant, layout);
    parent.add(variant);
    return variant;
  });

  const rail = new THREE.MeshStandardMaterial({ color: 0x234938, roughness: 0.75 });
  const longRail = new THREE.BoxGeometry(0.036, 0.065, length + 0.036);
  for (const side of [-1, 1]) {
    const mesh = new THREE.Mesh(longRail, rail);
    mesh.position.set(side * (halfWidth + 0.018), 0.033, middle);
    parent.add(mesh);
  }
  const endRail = new THREE.BoxGeometry(roomCourse.width + 0.072, 0.065, 0.036);
  for (const z of [roomCourse.cupEdge - 0.018, roomCourse.teeEdge + 0.018]) {
    const mesh = new THREE.Mesh(endRail, rail);
    mesh.position.set(0, 0.033, z);
    parent.add(mesh);
  }
  return (index) => variants.forEach((variant, position) => { variant.visible = position === index; });
}

export function getRoomPlacement(pose, point, orientation, direction) {
  const { position, orientation: view } = pose.transform;
  orientation.set(view.x, view.y, view.z, view.w);
  direction.set(0, 0, -1).applyQuaternion(orientation);
  if (direction.y > -0.18 || position.y <= 0) return null;
  const distance = -position.y / direction.y;
  if (distance > 3 || Math.hypot(direction.x, direction.z) * distance < 0.25) return null;
  point.set(position.x, position.y, position.z).addScaledVector(direction, distance);
  point.y = 0;
  return Math.atan2(-direction.x, -direction.z);
}

export function setupRoomPlacement(scene, course, rig, onSelect = () => {}) {
  const guide = new THREE.Group();
  const outline = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(outlineCorners(0.015)),
    new THREE.LineBasicMaterial({ color: 0xf8dd92 }),
  );
  const tee = new THREE.Mesh(new THREE.RingGeometry(0.078, 0.092, 28), new THREE.MeshBasicMaterial({ color: 0xf8dd92 }));
  tee.rotation.x = -Math.PI / 2;
  tee.position.set(0, 0.016, roomCourse.startZ);
  guide.add(outline, tee);
  const previews = roomCourses.map((layout) => {
    const variant = new THREE.Group();
    addRoomFeatures(variant, layout, true);
    guide.add(variant);
    return variant;
  });

  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 260;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const prompt = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  prompt.scale.set(0.72, 0.244, 1);
  prompt.renderOrder = 1;
  scene.add(guide, prompt);

  const origin = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  const direction = new THREE.Vector3();
  const viewerPosition = new THREE.Vector3();
  let selected = defaultRoomCourseIndex;
  let stickHeld = false;
  let aHeld = false;
  let bHeld = false;
  let placed = false;
  let requested = false;
  let viewerTracked = false;
  let triggerReleased = false;
  let striking = false;
  let promptText;

  function select(index) {
    selected = (index + roomCourses.length) % roomCourses.length;
    previews.forEach((variant, position) => { variant.visible = position === selected; });
    onSelect(roomCourses[selected], selected);
  }

  function cycle(inputSources) {
    let axis = 0;
    let a = false;
    let b = false;
    for (const { handedness, gamepad } of inputSources) {
      if (gamepad?.mapping !== 'xr-standard') continue;
      const horizontal = gamepad.axes[2] ?? 0;
      if (Math.abs(horizontal) > Math.abs(axis)) axis = horizontal;
      if (handedness === 'right') {
        a ||= gamepad.buttons[4]?.pressed ?? false;
        b ||= gamepad.buttons[5]?.pressed ?? false;
      }
    }
    const stickStep = !stickHeld && Math.abs(axis) >= 0.55 ? Math.sign(axis) : 0;
    const buttonStep = Number(b && !bHeld) - Number(a && !aHeld);
    stickHeld = Math.abs(axis) >= (stickHeld ? 0.3 : 0.55);
    aHeld = a;
    bHeld = b;
    const step = buttonStep || stickStep;
    if (step) select(selected + step);
  }

  function reset(immersive = false) {
    placed = requested = viewerTracked = false;
    triggerReleased = striking = false;
    stickHeld = aHeld = bHeld = false;
    guide.visible = prompt.visible = false;
    course.visible = !immersive;
    rig.position.set(0, 0, 0);
    rig.rotation.set(0, 0, 0);
    rig.updateMatrixWorld(true);
  }

  function request() {
    if (placed) return false;
    requested = true;
    return true;
  }

  function update(xr, frame) {
    const space = xr.isPresenting && xr.getReferenceSpace();
    const pose = space && frame?.session?.visibilityState === 'visible' && frame.getViewerPose(space);
    viewerTracked = Boolean(pose);
    if (!pose) {
      guide.visible = prompt.visible = requested = false;
      triggerReleased = striking = false;
      return false;
    }
    const { position, orientation: view } = pose.transform;
    viewerPosition.copy(position).applyAxisAngle(up, rig.rotation.y).add(rig.position);
    if (placed) {
      const trigger = controllerGamepad(frame.session.inputSources, 'left')?.buttons[0];
      striking = triggerReleased && trigger?.pressed === true;
      triggerReleased = Boolean(trigger) && (triggerReleased || !trigger.pressed);
      return false;
    }
    const yaw = getRoomPlacement(pose, origin, orientation, direction);
    const valid = yaw !== null;
    if (requested && valid) {
      requested = false;
      rig.rotation.y = -yaw;
      rig.position.copy(origin).negate().applyAxisAngle(up, -yaw);
      rig.updateMatrixWorld(true);
      viewerPosition.copy(position).applyAxisAngle(up, -yaw).add(rig.position);
      guide.visible = prompt.visible = false;
      course.visible = placed = true;
      return true;
    }
    requested = false;
    cycle(frame.session.inputSources ?? []);
    guide.visible = valid;
    if (valid) {
      guide.position.copy(origin);
      guide.rotation.y = yaw;
    }

    prompt.visible = true;
    orientation.set(view.x, view.y, view.z, view.w);
    direction.set(0, 0, -1).applyQuaternion(orientation);
    prompt.position.copy(position).addScaledVector(direction, 0.92);
    prompt.position.y += 0.13;
    const instruction = valid ? 'Trigger van je speelhand • Plaatsen' : 'Kijk naar een vrije plek op de vloer';
    const title = roomCourses[selected].name;
    const text = title + instruction;
    if (promptText !== text) {
      promptText = text;
      context.fillStyle = '#18372f';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#fff1ce';
      context.font = '600 48px system-ui';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(title, canvas.width / 2, 52, canvas.width - 42);
      context.font = '35px system-ui';
      context.fillText(instruction, canvas.width / 2, 111, canvas.width - 42);
      context.font = '30px system-ui';
      context.fillText('Duimstick links/rechts of A/B • Kies baan', canvas.width / 2, 166, canvas.width - 42);
      context.fillText('Houd X vast • Startscherm', canvas.width / 2, 216, canvas.width - 42);
      texture.needsUpdate = true;
    }
    return false;
  }

  select(selected);
  reset();
  return {
    reset, request, update,
    canPutt: () => placed && viewerTracked,
    canStrike: () => striking,
    getViewerPosition: () => viewerTracked ? viewerPosition : null,
  };
}
