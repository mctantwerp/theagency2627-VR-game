import { MathUtils } from 'three';
import { cupEdge, isNearRoot, teeEdge } from './course-layout.js';

const deadZone = 0.18;
const walkingSpeed = 1.1;
const sideLimit = 2.55;
const endMargin = 0.75;

function boundedStep(position, step, min, max) {
  return MathUtils.clamp(position + step, Math.min(min, position), Math.max(max, position));
}

export function walkWithThumbstick(session, rig, viewer, right, delta, practice = false) {
  if (!viewer || session?.visibilityState !== 'visible' || delta <= 0 || delta > 0.1) return false;

  let x = 0;
  let z = 0;
  let magnitude = deadZone;
  for (const { gamepad } of session.inputSources) {
    if (gamepad?.mapping !== 'xr-standard' || gamepad.axes.length < 4) continue;
    if (gamepad.buttons[1]?.pressed) return false;
    const stickX = gamepad.axes[2];
    const stickY = gamepad.axes[3];
    const strength = Math.hypot(stickX, stickY);
    if (strength > magnitude) {
      x = stickX;
      z = stickY;
      magnitude = strength;
    }
  }
  if (magnitude === deadZone) return false;

  const speed = walkingSpeed * (Math.min(magnitude, 1) - deadZone) / (1 - deadZone);
  const distance = speed * Math.min(delta, 0.05) / magnitude;
  const targetX = boundedStep(viewer.x, (right.x * x - right.z * z) * distance, -sideLimit, sideLimit);
  const targetZ = boundedStep(viewer.z, (right.z * x + right.x * z) * distance, cupEdge - endMargin, teeEdge + endMargin);

  let nextX = targetX;
  let nextZ = targetZ;
  if (!practice && !isNearRoot(viewer.x, viewer.z) && isNearRoot(targetX, targetZ)) {
    if (!isNearRoot(targetX, viewer.z)) nextZ = viewer.z;
    else if (!isNearRoot(viewer.x, targetZ)) nextX = viewer.x;
    else return false;
  }
  if (nextX === viewer.x && nextZ === viewer.z) return false;

  rig.position.x += nextX - viewer.x;
  rig.position.z += nextZ - viewer.z;
  rig.updateMatrixWorld(true);
  viewer.x = nextX;
  viewer.z = nextZ;
  return true;
}
