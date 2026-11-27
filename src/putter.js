import * as THREE from 'three';
import { cup as forestCup } from './course-layout.js';

const bladeWidth = 0.16;
const bladeHeight = 0.044;
const bladeDepth = 0.038;
const gripLength = 0.21;
const gripAboveHand = 0.05;
const floorAssist = 0.045;
const turfTolerance = 0.001;
const maxFaceTilt = Math.sin(THREE.MathUtils.degToRad(35));
const minClubLength = 0.45;
const maxClubLength = 1.22;
const vrCalibrationKey = 'lichtvallei.putter.v6';
const fixedShaftLean = Math.tan(THREE.MathUtils.degToRad(28));
const maxShaftLean = Math.tan(THREE.MathUtils.degToRad(20));
const maxAddressShift = 0.46;
const up = new THREE.Vector3(0, 1, 0);
const front = new THREE.Vector3(0, 0, -1);
const readyHint = 'Tik de bal aan. Trigger brengt je naar de bal.';
const setupHint = 'Houd grip vast om de putter af te stellen.';

function validStance(stance) {
  return Array.isArray(stance) && stance.length === 2 &&
    stance.every(Number.isFinite) && Math.hypot(...stance) <= 1.15;
}

function createPutter() {
  const club = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xd3ddda, metalness: 0.23, roughness: 0.38 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x293c34, roughness: 0.9 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, 1, 12), metal);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, gripLength, 12), rubber);
  const profile = new THREE.Shape();
  const radius = bladeDepth / 2;
  const halfStraight = bladeWidth / 2 - radius;
  profile.absarc(halfStraight, 0, radius, -Math.PI / 2, Math.PI / 2, false);
  profile.absarc(-halfStraight, 0, radius, Math.PI / 2, 3 * Math.PI / 2, false);
  profile.closePath();
  const geometry = new THREE.ExtrudeGeometry(profile, { depth: bladeHeight, bevelEnabled: false, curveSegments: 12 });
  geometry.translate(0, 0, -bladeHeight / 2);
  geometry.rotateX(-Math.PI / 2);
  const head = new THREE.Mesh(geometry, metal);
  club.add(shaft, handle, head);
  club.visible = false;
  return { club, shaft, handle, head };
}

function readProfiles(calibrationKey) {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(calibrationKey) ?? '{}');
    return Object.fromEntries(['left', 'right'].flatMap((hand) => {
      const profile = saved?.[hand];
      const valid = Array.isArray(profile?.offset) && profile.offset.length === 3 &&
        Array.isArray(profile.rotation) && profile.rotation.length === 4 &&
        [...profile.offset, ...profile.rotation].every(Number.isFinite);
      if (!valid) return [];
      const length = Math.hypot(...profile.offset);
      const rotationLength = Math.hypot(...profile.rotation);
      return length >= minClubLength && length <= maxClubLength && Math.abs(rotationLength - 1) < 0.001
        ? [[hand, { ...profile, stance: validStance(profile.stance) ? profile.stance : undefined }]] : [];
    }));
  } catch {
    return {};
  }
}

function faceDistanceSquared(point, side) {
  const dx = Math.max(0, Math.abs(point.x) - (bladeWidth - bladeDepth) / 2);
  const dy = Math.max(0, Math.abs(point.y) - bladeHeight / 2);
  const dz = point.z - side * bladeDepth / 2;
  return dx * dx + dy * dy + dz * dz;
}

export function setupPutter(renderer, scene, rig, ball, controls) {
  const calibrationKey = controls.calibrationKey ?? vrCalibrationKey;
  const puttHint = controls.puttHint ?? readyHint;
  const profiles = readProfiles(calibrationKey);
  const controllers = [];
  let active;
  let hasPrevious = false;
  let canStrike = false;
  let hasHandPose = false;
  let waitingForBackswing = false;
  let farthestFollowThrough = 0;
  const lastStrokeDirection = new THREE.Vector3();
  const previousPosition = new THREE.Vector3();
  const previousRotation = new THREE.Quaternion();
  const bladePosition = new THREE.Vector3();
  const bladeRotation = new THREE.Quaternion();
  const handPosition = new THREE.Vector3();
  const trackedPosition = new THREE.Vector3();
  const trackedRotation = new THREE.Quaternion();
  const bladeUp = new THREE.Vector3();
  const eyeToHand = new THREE.Vector3();
  const eyeToBlade = new THREE.Vector3();
  const address = new THREE.Vector3();
  const previewBlade = new THREE.Vector3();
  const addressForward = new THREE.Vector3();
  const addressRotation = new THREE.Quaternion();
  const handRotation = new THREE.Quaternion();
  const inverse = new THREE.Quaternion();
  const direction = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  const averagedVelocity = new THREE.Vector3();
  const previousBall = new THREE.Vector3();
  const currentBall = new THREE.Vector3();
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();

  function select(controller) {
    if (active === controller) return;
    if (active) active.club.visible = false;
    active = controller;
    hasPrevious = false;
    canStrike = false;
    hasHandPose = false;
    waitingForBackswing = false;
    averagedVelocity.set(0, 0, 0);
    controls.message?.(controller?.profile ? puttHint : setupHint);
  }

  function playerStance(controller) {
    if (!controller.profile) return null;
    return controller.profile.stance ?? [controller.hand === 'left' ? 0.30 : -0.30, 0.65];
  }

  for (let index = 0; index < 2; index++) {
    const target = renderer.xr.getController(index);
    const grip = renderer.xr.getControllerGrip(index);
    const controller = { ...createPutter(), grip, connected: false, practice: false, calibrating: false };
    controllers.push(controller);
    rig.add(target, grip);
    scene.add(controller.club);
    target.addEventListener('connected', ({ data }) => {
      controller.hand = data.handedness;
      controller.connected = data.targetRayMode === 'tracked-pointer' && !data.hand;
      controller.profile = profiles[controller.hand];
      controller.practice = false;
      controller.calibrating = false;
      controller.preview = null;
      if (controller.connected && (!active || controller.hand === 'right')) {
        select(controller);
        controls.teleport?.(controller.hand, playerStance(controller));
      }
    });
    target.addEventListener('disconnected', () => {
      controller.connected = controller.practice = controller.calibrating = false;
      controller.club.visible = false;
      if (active === controller) select(controllers.find(candidate => candidate.connected));
    });
    target.addEventListener('squeezestart', () => {
      if (!controller.connected || controls.canPutt?.() === false) return;
      if (controller !== active) {
        controls.mute();
        return;
      }
      controller.practice = true;
      if (!controller.profile) controller.calibrating = true;
      else controls.message?.('Oefenslag. Laat grip los om de bal te raken.');
    });
    target.addEventListener('squeezeend', () => {
      controller.practice = false;
      if (!controller.calibrating) {
        if (controller === active && controller.profile) controls.message?.(puttHint);
        return;
      }
      controller.calibrating = false;
      if (controller === active && controller.preview && controller.grip.visible && ball.isAtRest()) {
        saveCalibration(controller);
      } else if (controller === active) {
        controls.message?.('Ga naast de bal en houd grip vast om af te stellen.');
      }
      controller.preview = null;
      hasPrevious = canStrike = waitingForBackswing = false;
      averagedVelocity.set(0, 0, 0);
    });
    target.addEventListener('selectstart', () => {
      if (!controller.connected) return;
      if (controls.requestPlacement) {
        if (controls.requestPlacement()) select(controller);
        else if (controller.hand === 'right' && controls.canPutt()) {
          if (ball.isHoled()) controls.reset();
          else if (active?.practice) active.calibrating = true;
        }
        return;
      }
      if (controller !== active) {
        select(controller);
        controls.teleport?.(controller.hand, playerStance(controller));
      } else if (ball.isHoled()) controls.reset(controller.hand, playerStance(controller));
      else if (controller.practice) controller.calibrating = true;
      else controls.teleport?.(controller.hand, playerStance(controller));
    });
  }

  function previewCalibration() {
    const cup = controls.getCup?.() ?? forestCup;
    const { x, z } = ball.mesh.position;
    addressForward.set(cup.x - x, 0, cup.z - z);
    if (addressForward.lengthSq() < 0.01) addressForward.copy(front);
    addressForward.normalize();
    address.set(x, bladeHeight / 2 + 0.003, z)
      .addScaledVector(addressForward, -(ball.radius + bladeDepth / 2 + 0.035));
    direction.subVectors(address, handPosition);
    const horizontalReach = Math.hypot(direction.x, direction.z);
    const comfortableReach = Math.max(0, -direction.y * maxShaftLean);
    const fixedAddress = !controls.alignAddress;
    if (fixedAddress && horizontalReach > Math.max(0, -direction.y * fixedShaftLean)) return null;
    const scale = !fixedAddress && horizontalReach > comfortableReach ? comfortableReach / horizontalReach : 1;
    const shiftX = direction.x * (1 - scale);
    const shiftZ = direction.z * (1 - scale);
    direction.x *= scale;
    direction.z *= scale;
    const reach = direction.length();
    if (!ball.isAtRest() || reach < minClubLength || reach > maxClubLength || handPosition.y < 0.45 ||
        Math.hypot(shiftX, shiftZ) > maxAddressShift) {
      return null;
    }
    previewBlade.copy(handPosition).add(direction);
    addressRotation.setFromAxisAngle(up, Math.atan2(-addressForward.x, -addressForward.z));
    inverse.copy(handRotation).invert();
    return {
      offset: direction.applyQuaternion(inverse).toArray(),
      adjustment: [shiftX, shiftZ],
      rotation: addressRotation.premultiply(inverse).toArray(),
    };
  }

  function saveCalibration(controller) {
    const { offset, rotation, adjustment } = controller.preview;
    if (Math.hypot(...adjustment) > 0.001 && !controls.alignAddress?.(...adjustment)) {
      controls.message?.('Zet een klein stapje naar de bal om hier af te stellen.');
      return;
    }
    hasHandPose = false;
    const viewer = controls.getViewerPosition?.();
    const stance = viewer && [viewer.x - ball.mesh.position.x, viewer.z - ball.mesh.position.z];
    controller.profile = { offset, rotation, stance: validStance(stance) ? stance : undefined };
    profiles[controller.hand] = controller.profile;
    try {
      globalThis.localStorage?.setItem(calibrationKey, JSON.stringify(profiles));
    } catch {
      // The current session can use the calibration without persistent storage.
    }
    controls.message?.(puttHint);
  }

  function detectStrike(position, rotation, delta) {
    if (waitingForBackswing) {
      const progress = position.dot(lastStrokeDirection);
      farthestFollowThrough = Math.max(progress, farthestFollowThrough);
      if (farthestFollowThrough - progress < 0.025) return;
      waitingForBackswing = false;
      averagedVelocity.set(0, 0, 0);
    }
    velocity.subVectors(position, previousPosition).divideScalar(delta);
    if (velocity.lengthSq() > 100) {
      averagedVelocity.set(0, 0, 0);
      return;
    }
    velocity.y = 0;
    averagedVelocity.lerp(velocity, 1 - Math.exp(-delta / 0.035));
    if (!ball.isAtRest()) return;

    inverse.copy(previousRotation).invert();
    previousBall.subVectors(ball.mesh.position, previousPosition).applyQuaternion(inverse);
    inverse.copy(rotation).invert();
    currentBall.subVectors(ball.mesh.position, position).applyQuaternion(inverse);
    const side = previousBall.z > 0 ? 1 : -1;
    const radiusSquared = ball.radius * ball.radius;
    if (side * previousBall.z < bladeDepth / 2 ||
        side * (previousBall.z - currentBall.z) <= 0) return;

    normal.copy(front).multiplyScalar(-side).applyQuaternion(rotation);
    if (Math.abs(normal.y) > maxFaceTilt) return;
    normal.y = 0;
    normal.normalize();
    const approachSpeed = velocity.dot(normal);
    if (approachSpeed < 0.022) return;

    const steps = Math.max(1, Math.ceil(previousBall.distanceTo(currentBall) / (ball.radius * 0.16)));
    for (let index = 1; index <= steps; index++) {
      point.lerpVectors(previousBall, currentBall, index / steps);
      if (side * point.z < bladeDepth / 2 || faceDistanceSquared(point, side) > radiusSquared) continue;

      direction.copy(averagedVelocity);
      direction.y = 0;
      direction.normalize().lerp(normal, 0.68).normalize();
      const speed = Math.min(approachSpeed * 1.58, 4);
      if (ball.strike(direction.x * speed, direction.z * speed)) {
        lastStrokeDirection.copy(direction);
        farthestFollowThrough = position.dot(lastStrokeDirection);
        waitingForBackswing = true;
      }
      return;
    }
  }

  function bladeClearance(rotation) {
    inverse.copy(rotation).invert();
    bladeUp.copy(up).applyQuaternion(inverse);
    return (Math.abs(bladeUp.x) * bladeWidth + Math.abs(bladeUp.y) * bladeHeight +
      Math.abs(bladeUp.z) * bladeDepth) / 2;
  }

  return function updatePutter(delta, trackingJump = false) {
    const grip = active?.grip;
    const validFrame = delta > 0 && delta <= 0.1;
    if (trackingJump) waitingForBackswing = false;
    if (!grip?.visible || controls.canPutt?.() === false) {
      if (active) {
        active.club.visible = false;
        active.practice = false;
        active.calibrating = false;
        active.preview = null;
      }
      hasPrevious = hasHandPose = canStrike = false;
      return;
    }

    grip.getWorldPosition(trackedPosition);
    grip.getWorldQuaternion(trackedRotation);
    const discontinuity = trackingJump || !validFrame || !hasHandPose ||
      handPosition.distanceToSquared(trackedPosition) > 0.23 ** 2;
    if (discontinuity) {
      handPosition.copy(trackedPosition);
      handRotation.copy(trackedRotation);
      hasPrevious = canStrike = false;
      averagedVelocity.set(0, 0, 0);
    } else {
      const handSpeed = handPosition.distanceTo(trackedPosition) / delta;
      const follow = 1 - Math.exp(-delta / (handSpeed < 0.35 ? 0.013 : 0.006));
      handPosition.lerp(trackedPosition, follow);
      handRotation.slerp(trackedRotation, follow);
    }
    hasHandPose = true;

    const { club, shaft, handle, head, practice, calibrating } = active;
    if (calibrating) {
      active.preview = previewCalibration();
      const viewer = controls.getViewerPosition?.();
      const endOn = viewer && active.preview &&
        eyeToHand.subVectors(handPosition, viewer).angleTo(eyeToBlade.subVectors(previewBlade, viewer)) <
          THREE.MathUtils.degToRad(5);
      if (!active.preview) controls.message?.('Houd grip vast en breng je hand dichter bij de bal.');
      else if (endOn) controls.message?.('Kijk je recht langs de steel? Zet een klein stapje achteruit.');
      else controls.message?.('Houd je hand ontspannen en laat grip los om uit te lijnen.');
    }
    const profile = calibrating ? active.preview : active.profile;
    club.visible = !!profile;
    if (!profile) {
      hasPrevious = canStrike = false;
      return;
    }

    club.position.copy(handPosition);
    club.quaternion.copy(handRotation);
    head.position.fromArray(profile.offset);
    head.quaternion.fromArray(profile.rotation);

    // A small vertical correction keeps the blade on the turf without moving it into the ball.
    bladePosition.copy(head.position).applyQuaternion(handRotation).add(handPosition);
    bladeRotation.multiplyQuaternions(handRotation, head.quaternion);
    const clearance = bladeClearance(bladeRotation);
    const lift = THREE.MathUtils.clamp(clearance - bladePosition.y, 0, floorAssist);
    club.position.y += lift;
    bladePosition.y += lift;

    direction.copy(head.position).normalize();
    shaft.position.copy(head.position).multiplyScalar(0.5);
    shaft.quaternion.setFromUnitVectors(up, direction.negate());
    shaft.scale.y = head.position.length();
    handle.quaternion.copy(shaft.quaternion);
    handle.position.copy(direction).multiplyScalar(gripAboveHand - gripLength / 2);
    const enabled = controls.strikeEnabled?.() ?? true;
    if (!enabled) averagedVelocity.set(0, 0, 0);
    const playableFace = enabled && bladePosition.y >= clearance - turfTolerance && !practice && !calibrating;
    if (calibrating) head.material.color.setHex(0xecc785);
    else if (practice || !enabled) head.material.color.setHex(0x9baea4);
    else head.material.color.setHex(controls.strikeEnabled ? 0xffd47d : 0xd3ddda);
    if (hasPrevious && canStrike && playableFace && validFrame) detectStrike(bladePosition, bladeRotation, delta);
    previousPosition.copy(bladePosition);
    previousRotation.copy(bladeRotation);
    hasPrevious = true;
    canStrike = playableFace;
  };
}
