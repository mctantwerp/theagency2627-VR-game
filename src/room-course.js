import * as THREE from 'three';
import { roomCourse } from './course-layout.js';
import { createTurfMaterial } from './course-materials.js';
import { addCup, createPerforatedSurface } from './cup.js';

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

export function createRoomCourse(parent) {
  parent.add(new THREE.HemisphereLight(0xe8f6f2, 0x536659, 2.1));
  const light = new THREE.DirectionalLight(0xffe8bd, 1.6);
  light.position.set(-1, 3, 1);
  parent.add(light);

  const outline = new THREE.Shape(outlineCorners().map(({ x, z }) => new THREE.Vector2(x, -z)));
  const turf = createTurfMaterial();
  turf.map.repeat.set(3, 5);
  const green = new THREE.Mesh(createPerforatedSurface(outline, roomCourse.width, length, roomCourse.cup), turf);
  green.position.y = 0.002;
  parent.add(green);
  addCup(parent, roomCourse.cup);

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

  const { x, z, radius } = roomCourse.cup;
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(radius, radius + 0.016, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd47d }),
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(x, 0.004, z);
  parent.add(rim);
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

export function setupRoomPlacement(scene, course, rig) {
  const guide = new THREE.Group();
  const outline = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(outlineCorners(0.015)),
    new THREE.LineBasicMaterial({ color: 0xf8dd92 }),
  );
  const footprint = new THREE.Mesh(
    new THREE.PlaneGeometry(roomCourse.width, length),
    new THREE.MeshBasicMaterial({ color: 0x5be3a4, transparent: true, opacity: 0.24, depthWrite: false }),
  );
  footprint.rotation.x = -Math.PI / 2;
  footprint.position.set(0, 0.009, middle);
  const tee = new THREE.Mesh(new THREE.RingGeometry(0.078, 0.092, 28), new THREE.MeshBasicMaterial({ color: 0xf8dd92 }));
  tee.rotation.x = -Math.PI / 2;
  tee.position.set(0, 0.016, roomCourse.startZ);
  guide.add(outline, footprint, tee);

  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 144;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const prompt = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  prompt.scale.set(0.72, 0.135, 1);
  prompt.renderOrder = 1;
  scene.add(guide, prompt);

  const origin = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  const direction = new THREE.Vector3();
  const viewerPosition = new THREE.Vector3();
  let placed = false;
  let requested = false;
  let viewerTracked = false;
  let promptText;

  function reset(immersive = false) {
    placed = requested = viewerTracked = false;
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
      return false;
    }
    const { position, orientation: view } = pose.transform;
    viewerPosition.copy(position).applyAxisAngle(up, rig.rotation.y).add(rig.position);
    if (placed) return false;
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
    const text = valid ? 'Trigger • plaats de baan' : 'Kijk naar een vrije plek op de vloer';
    if (promptText !== text) {
      promptText = text;
      context.fillStyle = '#18372f';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#fff1ce';
      context.font = '600 43px system-ui';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 42);
      texture.needsUpdate = true;
    }
    return false;
  }

  reset();
  return {
    reset, request, update,
    canPutt: () => placed && viewerTracked,
    getViewerPosition: () => viewerTracked ? viewerPosition : null,
  };
}
