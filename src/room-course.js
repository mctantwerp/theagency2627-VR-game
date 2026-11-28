import * as THREE from 'three';
import { defaultRoomCourseIndex, roomCourse, roomCourses } from './course-layout.js';
import { addCup } from './cup.js';
import { addLoopTrack } from './loop-track.js';
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
  if (layout.loop) addLoopTrack(parent, layout.loop, preview);
  const obstacleMaterial = preview
    ? new THREE.MeshBasicMaterial({ color: 0xeaba72, transparent: true, opacity: 0.72, depthWrite: false })
    : new THREE.MeshStandardMaterial({ color: 0xb47741, roughness: 0.8 });
  const bumperMaterial = preview
    ? obstacleMaterial
    : new THREE.MeshStandardMaterial({ color: 0x40897e, roughness: 0.7 });
  for (const obstacle of layout.obstacles) {
    const { x, z, radius, minX, maxX, minZ, maxZ, height } = obstacle;
    if (radius) {
      const bumper = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 32), bumperMaterial);
      bumper.position.set(x, height / 2, z);
      parent.add(bumper);
    } else {
      const block = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, height, maxZ - minZ), obstacleMaterial);
      block.position.set((minX + maxX) / 2, height / 2, (minZ + maxZ) / 2);
      parent.add(block);
    }
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

function stickAmount(value) {
  return Math.sign(value) * THREE.MathUtils.clamp((Math.abs(value) - 0.18) / 0.82, 0, 1);
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
  const savedOutlines = new THREE.Group();
  const savedMaterial = new THREE.LineBasicMaterial({ color: 0x81e1bc });
  const queue = [];
  const previews = roomCourses.map((layout) => {
    const variant = new THREE.Group();
    addRoomFeatures(variant, layout, true);
    guide.add(variant);
    return variant;
  });

  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 356;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const prompt = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  prompt.scale.set(0.76, 0.352, 1);
  prompt.renderOrder = 1;
  scene.add(guide, prompt, savedOutlines);

  const origin = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  const viewAngles = new THREE.Euler(0, 0, 0, 'YXZ');
  const direction = new THREE.Vector3();
  const viewerPosition = new THREE.Vector3();
  let yaw = 0;
  let hasPreview = false;
  let selected = defaultRoomCourseIndex;
  let aHeld = false;
  let bHeld = false;
  let activeIndex = -1;
  let stickHeld = false;
  let requested = false;
  let advanceRequested = false;
  let viewerTracked = false;
  let triggerReleased = false;
  let striking = false;
  let promptText;

  function select(index) {
    selected = (index + roomCourses.length) % roomCourses.length;
    previews.forEach((variant, position) => { variant.visible = position === selected; });
    onSelect(roomCourses[selected], selected);
  }

  function cycle(right) {
    const a = right?.buttons[4]?.pressed ?? false;
    const b = right?.buttons[5]?.pressed ?? false;
    const step = Number(b && !bHeld) - Number(a && !aHeld);
    aHeld = a;
    bHeld = b;
    if (step) select(selected + step);
  }

  function reset(immersive = false) {
    activeIndex = -1;
    queue.length = 0;
    savedOutlines.clear();
    requested = advanceRequested = viewerTracked = hasPreview = false;
    triggerReleased = striking = false;
    aHeld = bHeld = stickHeld = false;
    guide.visible = prompt.visible = false;
    course.visible = !immersive;
    rig.position.set(0, 0, 0);
    rig.rotation.set(0, 0, 0);
    rig.updateMatrixWorld(true);
  }

  function request() {
    if (activeIndex >= 0) return false;
    requested = hasPreview && viewerTracked;
    return true;
  }

  function savePreview() {
    const marker = new THREE.LineLoop(outline.geometry, savedMaterial);
    marker.position.copy(origin);
    marker.position.y += 0.003;
    marker.rotation.y = yaw;
    savedOutlines.add(marker);
    queue.push({ origin: origin.clone(), yaw, index: selected });
  }

  function activate(index, position) {
    activeIndex = index;
    const saved = queue[index];
    rig.rotation.y = -saved.yaw;
    rig.position.copy(saved.origin).negate().applyAxisAngle(up, -saved.yaw);
    rig.updateMatrixWorld(true);
    viewerPosition.copy(position).applyAxisAngle(up, -saved.yaw).add(rig.position);
    guide.visible = prompt.visible = savedOutlines.visible = false;
    course.visible = true;
    triggerReleased = striking = false;
    onSelect(roomCourses[saved.index], saved.index);
  }

  function update(xr, frame, delta = 0) {
    const space = xr.isPresenting && xr.getReferenceSpace();
    const pose = space && frame?.session?.visibilityState === 'visible' && frame.getViewerPose(space);
    viewerTracked = Boolean(pose);
    if (!pose) {
      guide.visible = prompt.visible = savedOutlines.visible = requested = advanceRequested = false;
      triggerReleased = striking = false;
      return false;
    }
    const { position, orientation: view } = pose.transform;
    const left = controllerGamepad(frame.session.inputSources, 'left');
    const right = controllerGamepad(frame.session.inputSources, 'right');
    const stickPressed = right?.buttons[3]?.pressed ?? false;
    const stickClicked = stickPressed && !stickHeld;
    stickHeld = stickPressed;
    viewerPosition.copy(position).applyAxisAngle(up, rig.rotation.y).add(rig.position);
    if (activeIndex >= 0) {
      if (advanceRequested && !stickClicked && activeIndex + 1 < queue.length) {
        advanceRequested = false;
        activate(activeIndex + 1, position);
        return true;
      }
      if (advanceRequested || stickClicked) {
        reset(true);
        stickHeld = stickPressed;
        return true;
      }
      const trigger = left?.buttons[0];
      striking = triggerReleased && trigger?.pressed === true;
      triggerReleased = Boolean(trigger) && (triggerReleased || !trigger.pressed);
      return false;
    }
    if (requested) {
      requested = false;
      savePreview();
    }
    if (stickClicked && queue.length > 0) {
      activate(0, position);
      return true;
    }
    orientation.set(view.x, view.y, view.z, view.w);
    const viewerYaw = viewAngles.setFromQuaternion(orientation).y;
    if (!hasPreview) {
      yaw = viewerYaw;
      direction.set(0, 0, -0.9).applyAxisAngle(up, yaw);
      origin.copy(position).add(direction).setY(0);
      hasPreview = true;
    }
    cycle(right);
    const dt = Math.min(delta, 0.05);
    direction.set(stickAmount(left?.axes[2] ?? 0), 0, stickAmount(left?.axes[3] ?? 0));
    direction.clampLength(0, 1).applyAxisAngle(up, viewerYaw);
    origin.addScaledVector(direction, dt);
    yaw -= stickAmount(right?.axes[2] ?? 0) * dt * 1.6;
    guide.visible = savedOutlines.visible = true;
    guide.position.copy(origin);
    guide.rotation.y = yaw;

    prompt.visible = true;
    direction.set(0, 0, -1).applyQuaternion(orientation);
    prompt.position.copy(position).addScaledVector(direction, 0.92);
    prompt.position.y += 0.25;
    const title = `${roomCourses[selected].name} (${selected + 1}/${roomCourses.length})`;
    const count = queue.length === 1 ? '1 baan klaar' : `${queue.length} banen klaar`;
    const text = title + count;
    if (promptText !== text) {
      promptText = text;
      context.fillStyle = '#18372f';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#fff1ce';
      context.font = '600 48px system-ui';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(title, canvas.width / 2, 52, canvas.width - 42);
      context.font = '30px system-ui';
      context.fillText('Linkerduimstick • Verplaatsen', canvas.width / 2, 113, canvas.width - 42);
      context.fillText('Rechterduimstick ←→ • Draaien', canvas.width / 2, 163, canvas.width - 42);
      context.fillText('A/B • Andere baan', canvas.width / 2, 213, canvas.width - 42);
      context.fillText('Trigger speelhand • Baan toevoegen   |   X vasthouden • Startscherm', canvas.width / 2, 263, canvas.width - 42);
      const start = queue.length ? `${count} · Klik rechterduimstick om te spelen` : 'Voeg een baan toe om te starten';
      context.fillText(start, canvas.width / 2, 315, canvas.width - 42);
      texture.needsUpdate = true;
    }
    return false;
  }

  select(selected);
  reset();
  return {
    reset, request, update,
    next: () => { advanceRequested = activeIndex >= 0 && viewerTracked; },
    getRound: () => activeIndex >= 0 ? { current: activeIndex + 1, total: queue.length } : null,
    canPutt: () => activeIndex >= 0 && viewerTracked,
    canStrike: () => striking,
    getViewerPosition: () => viewerTracked ? viewerPosition : null,
  };
}
