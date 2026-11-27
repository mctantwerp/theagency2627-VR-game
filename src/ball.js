import * as THREE from 'three';
import { cup, cupEdge, root, spring, teeEdge } from './course-layout.js';

const radius = 0.075;
const sideLimit = 1.6 - radius;
const start = new THREE.Vector3(0, radius, -0.65);
const rootFront = root.z + root.depth / 2 + radius;
const rootBack = root.z - root.depth / 2 - radius;
const rootLeft = root.minX - radius;
const rootRight = root.maxX + radius;

export function createBall(scene, feedback = () => {}, practice = false) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xfff4d8 }),
  );
  const seam = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.001, 16, 3, 0, Math.PI * 2, 1.53, 0.07),
    new THREE.MeshStandardMaterial({ color: 0xb98a47 }),
  );
  mesh.add(seam);
  mesh.position.copy(start);
  scene.add(mesh);

  const velocity = new THREE.Vector2();
  const previousPosition = start.clone();
  const rollAxis = new THREE.Vector3();
  let verticalSpeed = 0;
  let springUsed = false;
  let holed = false;
  let dropping = false;
  let strokes = 0;

  function isAtRest() {
    return !holed && !dropping && velocity.lengthSq() === 0 && mesh.position.y === radius;
  }

  function resetToPreviousPosition() {
    mesh.position.copy(previousPosition);
    mesh.quaternion.identity();
    mesh.visible = true;
    velocity.set(0, 0);
    verticalSpeed = 0;
    springUsed = false;
    holed = false;
    dropping = false;
  }

  function reset() {
    previousPosition.copy(start);
    strokes = 0;
    resetToPreviousPosition();
  }

  function strike(x, z) {
    if (!isAtRest() || !Number.isFinite(x) || !Number.isFinite(z) || Math.hypot(x, z) === 0) return false;
    previousPosition.copy(mesh.position);
    velocity.set(x, z);
    springUsed = false;
    strokes++;
    feedback('putt');
    return true;
  }

  function advance(dt) {
    const { position } = mesh;
    if (dropping) {
      verticalSpeed -= 9.8 * dt;
      position.y = Math.max(radius - cup.depth, position.y + verticalSpeed * dt);
      if (position.y === radius - cup.depth) {
        dropping = false;
        holed = true;
        feedback('cup');
      }
      return;
    }
    const oldX = position.x;
    const oldZ = position.z;
    position.x += velocity.x * dt;
    position.z += velocity.y * dt;
    if (position.y > radius || verticalSpeed > 0) {
      position.y = Math.max(radius, position.y + verticalSpeed * dt);
      verticalSpeed = position.y > radius ? verticalSpeed - 9.8 * dt : 0;
    }

    if (Math.abs(position.x) > sideLimit) {
      position.x = THREE.MathUtils.clamp(position.x, -sideLimit, sideLimit);
      velocity.x *= -0.7;
    }
    if (position.z < cupEdge + radius || position.z > teeEdge - radius) {
      position.z = THREE.MathUtils.clamp(position.z, cupEdge + radius, teeEdge - radius);
      velocity.y *= -0.7;
    }
    if (!practice && position.y < root.height + radius && position.x > rootLeft && position.x < rootRight &&
        position.z > rootBack && position.z < rootFront) {
      if (oldZ >= rootFront || oldZ <= rootBack) {
        position.z = oldZ >= rootFront ? rootFront : rootBack;
        velocity.y *= -0.65;
      } else {
        position.x = oldX < rootLeft ? rootLeft : rootRight;
        velocity.x *= -0.65;
      }
    }

    if (!practice && !springUsed && position.y === radius && velocity.y < -0.12 &&
        Math.hypot(position.x - spring.x, position.z - spring.z) < spring.radius) {
      springUsed = true;
      verticalSpeed = 4.15;
      velocity.x *= 0.45;
      velocity.y = Math.min(-2.45, velocity.y);
      feedback('spring');
    }

    if (position.y === radius && verticalSpeed === 0) {
      const dx = position.x - oldX;
      const dz = position.z - oldZ;
      const travelSquared = dx * dx + dz * dz;
      const crossing = travelSquared > 0
        ? THREE.MathUtils.clamp(((cup.x - oldX) * dx + (cup.z - oldZ) * dz) / travelSquared, 0, 1)
        : 0;
      const cupX = oldX + crossing * dx;
      const cupZ = oldZ + crossing * dz;
      if (Math.hypot(cupX - cup.x, cupZ - cup.z) < cup.radius - radius) {
        position.x = cupX;
        position.z = cupZ;
        dropping = true;
        velocity.set(0, 0);
        return;
      }
      rollAxis.set(dz, 0, -dx);
      mesh.rotateOnWorldAxis(rollAxis.normalize(), Math.hypot(dx, dz) / radius);
      const speed = velocity.length();
      if (speed > 0) velocity.multiplyScalar(Math.max(0, speed - 0.8 * dt) / speed);
    }
  }

  function update(delta) {
    const { x, y, z } = mesh.position;
    if (!dropping && !holed && (Math.abs(x) > sideLimit + radius || z < cupEdge || z > teeEdge || y < 0)) {
      resetToPreviousPosition();
      return;
    }
    let remaining = Math.min(delta, 0.05);
    while (remaining > 0 && !isAtRest() && !holed) {
      const step = Math.min(remaining, 1 / 120);
      advance(step);
      remaining -= step;
    }
  }

  return { mesh, radius, strike, update, reset, resetToPreviousPosition, isAtRest,
    isHoled: () => holed, getStrokes: () => strokes };
}
