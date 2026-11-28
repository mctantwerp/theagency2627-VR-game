import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { defaultRoomCourseIndex, roomCourse, roomCourses } from './course-layout.js';
import { addCup } from './cup.js';
import { addLoopTrack } from './loop-track.js';
import { createRoomAppearance } from './room-appearance.js';
import { drawRoomAction, drawRoomHeading, drawRoomNote, drawRoomPanel, loadRoomTypeface } from './room-ui.js';
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

function addRoomFeatures(parent, layout, materials, preview = false) {
  if (layout.loop) addLoopTrack(parent, layout.loop, materials, preview);
  for (const obstacle of layout.obstacles) {
    const { x, z, radius, minX, maxX, minZ, maxZ, height } = obstacle;
    if (radius) {
      const bumper = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 32), materials.bumper ?? materials.body);
      bumper.position.set(x, height / 2, z);
      parent.add(bumper);
      if (!preview) {
        const cap = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.73, 32), materials.trim);
        cap.rotation.x = -Math.PI / 2;
        cap.position.set(x, height + 0.001, z);
        const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.76, radius * 0.87, 32), materials.accent);
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(cap.position);
        parent.add(cap, ring);
      }
    } else {
      const width = maxX - minX;
      const depth = maxZ - minZ;
      const shape = new RoundedBoxGeometry(width, height, depth, 2, 0.014);
      const block = new THREE.Mesh(shape, materials.body);
      block.position.set((minX + maxX) / 2, height / 2, (minZ + maxZ) / 2);
      parent.add(block);
      if (!preview) {
        const inlay = new THREE.Mesh(new RoundedBoxGeometry(width - 0.05, 0.004, 0.018, 1, 0.002), materials.trim);
        inlay.position.copy(block.position).setY(height);
        parent.add(inlay);
      }
    }
  }

  const { x, z, radius } = layout.cup;
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(radius, radius + 0.016, 40),
    preview ? materials.accent : materials.trim,
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(x, preview ? 0.016 : 0.004, z);
  parent.add(rim);
}

function addRoomRails(parent, materials) {
  const segments = [
    { x: -halfWidth - 0.018, z: middle, size: length + 0.036, pieces: 3, turn: Math.PI / 2 },
    { x: halfWidth + 0.018, z: middle, size: length + 0.036, pieces: 3, turn: Math.PI / 2 },
    { x: 0, z: roomCourse.teeEdge + 0.018, size: roomCourse.width + 0.072, pieces: 1, turn: 0 },
    { x: 0, z: roomCourse.cupEdge - 0.018, size: roomCourse.width + 0.072, pieces: 1, turn: 0 },
  ];
  const boltGeometry = new THREE.CylinderGeometry(0.004, 0.004, 0.002, 8);
  const boltMatrix = new THREE.Matrix4();
  const boltCount = segments.reduce((count, rail) => count + rail.pieces * 2, 0);
  const bolts = new THREE.InstancedMesh(boltGeometry, materials.trim, boltCount);
  let boltIndex = 0;

  for (const { x, z, size, pieces, turn } of segments) {
    const rail = new THREE.Group();
    rail.position.set(x, 0, z);
    rail.rotation.y = turn;
    parent.add(rail);
    rail.updateMatrix();
    const foot = new THREE.Mesh(new RoundedBoxGeometry(size, 0.014, 0.036, 1, 0.004), materials.foot);
    foot.position.y = 0.007;
    rail.add(foot);
    const sectionLength = size / pieces;
    const sectionShape = new RoundedBoxGeometry(sectionLength - 0.004, 0.051, 0.036, 2, 0.006);
    for (let section = 0; section < pieces; section++) {
      const center = -size / 2 + sectionLength * (section + 0.5);
      const profile = new THREE.Mesh(sectionShape, materials.body);
      profile.position.set(center, 0.0395, 0);
      rail.add(profile);
      for (const offset of [-sectionLength / 2 + 0.026, sectionLength / 2 - 0.026]) {
        boltMatrix.makeTranslation(center + offset, 0.065, 0).premultiply(rail.matrix);
        bolts.setMatrixAt(boltIndex++, boltMatrix);
      }
    }
  }
  parent.add(bolts);
}

export function createRoomCourse(parent, materials = createRoomAppearance().play) {
  parent.add(new THREE.HemisphereLight(0xe8f6f2, 0x536659, 2.1));
  const light = new THREE.DirectionalLight(0xffe8bd, 1.6);
  light.position.set(-1, 3, 1);
  parent.add(light);

  const variants = roomCourses.map((layout) => {
    const variant = new THREE.Group();
    addCup(variant, layout.cup);
    addRoomFeatures(variant, layout, materials);
    parent.add(variant);
    return variant;
  });

  addRoomRails(parent, materials);
  const teeDash = new THREE.PlaneGeometry(0.042, 0.015);
  for (const x of [-0.12, 0.12]) {
    const mark = new THREE.Mesh(teeDash, materials.accent);
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(x, 0.005, roomCourse.startZ);
    parent.add(mark);
  }
  return (index) => variants.forEach((variant, position) => { variant.visible = position === index; });
}

function stickAmount(value) {
  return Math.sign(value) * THREE.MathUtils.clamp((Math.abs(value) - 0.18) / 0.82, 0, 1);
}

export function setupRoomPlacement(scene, course, rig, onSelect = () => {}, appearance = createRoomAppearance()) {
  const guide = new THREE.Group();
  const outline = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(outlineCorners(0.015)),
    new THREE.LineBasicMaterial({ color: appearance.preview.accent.color }),
  );
  const tee = new THREE.Mesh(new THREE.RingGeometry(0.078, 0.092, 28), appearance.preview.accent);
  tee.rotation.x = -Math.PI / 2;
  tee.position.set(0, 0.016, roomCourse.startZ);
  guide.add(outline, tee);
  const savedOutlines = new THREE.Group();
  const savedMaterial = new THREE.LineBasicMaterial({ color: 0x81e1bc });
  const queue = [];
  const previews = roomCourses.map((layout) => {
    const variant = new THREE.Group();
    addRoomFeatures(variant, layout, appearance.preview, true);
    guide.add(variant);
    return variant;
  });

  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 306;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const prompt = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true }));
  prompt.scale.set(0.68, 0.271, 1);
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
  let addHeld = false;
  let yHeld = false;
  let advanceRequested = false;
  let viewerTracked = false;
  let triggerReleased = false;
  let striking = false;
  let promptText;
  loadRoomTypeface(() => { promptText = undefined; });

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
    advanceRequested = viewerTracked = hasPreview = false;
    triggerReleased = striking = false;
    aHeld = bHeld = stickHeld = addHeld = yHeld = false;
    guide.visible = prompt.visible = false;
    course.visible = !immersive;
    rig.position.set(0, 0, 0);
    rig.rotation.set(0, 0, 0);
    rig.updateMatrixWorld(true);
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
      guide.visible = prompt.visible = savedOutlines.visible = advanceRequested = false;
      triggerReleased = striking = false;
      return false;
    }
    const { position, orientation: view } = pose.transform;
    const left = controllerGamepad(frame.session.inputSources, 'left');
    const right = controllerGamepad(frame.session.inputSources, 'right');
    const addPressed = left?.buttons[3]?.pressed ?? false;
    const addClicked = addPressed && !addHeld;
    addHeld = addPressed;
    const yPressed = left?.buttons[5]?.pressed ?? false;
    const styleRequested = yPressed && !yHeld;
    yHeld = yPressed;
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
        addHeld = addPressed;
        return true;
      }
      const trigger = left?.buttons[0];
      striking = triggerReleased && trigger?.pressed === true;
      triggerReleased = Boolean(trigger) && (triggerReleased || !trigger.pressed);
      return false;
    }
    if (addClicked && hasPreview) savePreview();
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
    if (styleRequested) {
      appearance.next();
      outline.material.color.copy(appearance.preview.accent.color);
    }
    const dt = Math.min(delta, 0.05);
    direction.set(stickAmount(left?.axes[2] ?? 0), 0, stickAmount(left?.axes[3] ?? 0));
    direction.clampLength(0, 1).applyAxisAngle(up, viewerYaw);
    origin.addScaledVector(direction, dt);
    yaw -= stickAmount(right?.axes[2] ?? 0) * dt * 1.6;
    guide.visible = savedOutlines.visible = true;
    guide.position.copy(origin);
    guide.rotation.y = yaw;

    prompt.visible = true;
    // Offset in headset space, so nodding does not move the prompt above the viewer's gaze.
    direction.set(0.21, -0.16, -1.02).applyQuaternion(orientation);
    prompt.position.copy(position).add(direction);
    const title = roomCourses[selected].name;
    const count = queue.length === 1 ? '1 baan klaar' : `${queue.length} banen klaar`;
    const style = appearance.name();
    const text = title + count + style;
    if (promptText !== text) {
      promptText = text;
      drawRoomPanel(context, canvas.width, canvas.height);
      drawRoomHeading(context, title, 'A/B · Baan kiezen', count);
      if (queue.length) {
        drawRoomAction(context, 'Ronde spelen', 'Rechterstick indrukken', 142, true);
        drawRoomAction(context, 'Baan toevoegen', 'Linkerstick indrukken', 190);
      } else {
        drawRoomAction(context, 'Baan toevoegen', 'Linkerstick indrukken', 142, true);
      }
      const controlsY = queue.length ? 233 : 195;
      drawRoomNote(context, 'Linkerstick · Schuiven', 32, controlsY, 332);
      drawRoomNote(context, 'Rechterstick ↔ · Draaien', 403, controlsY, 333);
      drawRoomNote(context, `Y · ${style}`, 32, controlsY + 39, 332);
      drawRoomNote(context, 'X vasthouden · Stoppen', 403, controlsY + 39, 333);
      texture.needsUpdate = true;
    }
    return false;
  }

  select(selected);
  reset();
  return {
    reset, update,
    isPlacing: () => activeIndex < 0,
    next: () => { advanceRequested = activeIndex >= 0 && viewerTracked; },
    getRound: () => activeIndex >= 0 ? { current: activeIndex + 1, total: queue.length } : null,
    canPutt: () => activeIndex >= 0 && viewerTracked,
    canStrike: () => striking,
    getViewerPosition: () => viewerTracked ? viewerPosition : null,
  };
}
