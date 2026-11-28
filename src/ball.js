import * as THREE from 'three';
import { forestCourse, root, spring } from './course-layout.js';
import { loopAcceleration, loopLength, loopPoint } from './loop-track.js';

const radius = 0.075;
const forestBlockers = [{
  ...root,
  minZ: root.z - root.depth / 2,
  maxZ: root.z + root.depth / 2,
}];

export function createBall(scene, feedback = () => {}, practice = false, layout = forestCourse) {
  let { cup, cupEdge, teeEdge, loop } = layout;
  let sideLimit = layout.width / 2 - radius;
  let obstacles = layout.obstacles ?? (practice ? [] : forestBlockers);
  const start = new THREE.Vector3(0, radius, layout.startZ);
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
  const bumperNormal = new THREE.Vector2();
  let verticalSpeed = 0;
  let springUsed = false;
  let ridingLoop = false;
  let loopProgress = 0;
  let loopSpeed = 0;
  let holed = false;
  let dropping = false;
  let strokes = 0;

  function isAtRest() {
    return !holed && !dropping && !ridingLoop && velocity.lengthSq() === 0 && mesh.position.y === radius;
  }

  function resetToPreviousPosition() {
    mesh.position.copy(previousPosition);
    mesh.quaternion.identity();
    mesh.visible = true;
    velocity.set(0, 0);
    verticalSpeed = 0;
    springUsed = false;
    ridingLoop = false;
    holed = false;
    dropping = false;
  }

  function reset() {
    previousPosition.copy(start);
    strokes = 0;
    resetToPreviousPosition();
  }

  function setLayout(next) {
    ({ cup, cupEdge, teeEdge, loop } = next);
    sideLimit = next.width / 2 - radius;
    obstacles = next.obstacles ?? (practice ? [] : forestBlockers);
    start.z = next.startZ;
    reset();
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
    if (ridingLoop) {
      loopSpeed += loopAcceleration(loopProgress, loopSpeed) * dt;
      loopProgress += loopSpeed * dt / loopLength(loop, radius);
      const progress = THREE.MathUtils.clamp(loopProgress, 0, 1);
      loopPoint(loop, progress, radius, position);
      mesh.rotateOnWorldAxis(rollAxis.set(-1, 0, 0), loopSpeed * dt / radius);
      if (progress === 0 || progress === 1) {
        ridingLoop = false;
        position.y = radius;
        velocity.set(0, -0.85 * loopSpeed);
      }
      return;
    }
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
    for (const obstacle of obstacles) {
      if (position.y >= obstacle.height + radius) continue;
      if (obstacle.radius) {
        bumperNormal.set(position.x - obstacle.x, position.z - obstacle.z);
        const contactRadius = obstacle.radius + radius;
        if (bumperNormal.lengthSq() >= contactRadius ** 2) continue;

        if (bumperNormal.lengthSq() === 0) bumperNormal.copy(velocity).negate();
        bumperNormal.normalize();
        position.x = obstacle.x + bumperNormal.x * contactRadius;
        position.z = obstacle.z + bumperNormal.y * contactRadius;
        const approach = velocity.dot(bumperNormal);
        if (approach < 0) velocity.addScaledVector(bumperNormal, -1.65 * approach);
        continue;
      }
      const left = obstacle.minX - radius;
      const right = obstacle.maxX + radius;
      const back = obstacle.minZ - radius;
      const front = obstacle.maxZ + radius;
      if (position.x <= left || position.x >= right ||
          position.z <= back || position.z >= front) continue;

      if (oldZ >= front || oldZ <= back) {
        position.z = oldZ >= front ? front : back;
        velocity.y *= -0.65;
      } else {
        position.x = oldX < left ? left : right;
        velocity.x *= -0.65;
      }
    }

    if (loop && position.y === radius && oldZ >= loop.entryZ && position.z < loop.entryZ) {
      const fraction = (oldZ - loop.entryZ) / (oldZ - position.z);
      const entryX = THREE.MathUtils.lerp(oldX, position.x, fraction);
      if (Math.abs(entryX) <= loop.width / 2 - radius + 1e-8) {
        ridingLoop = true;
        loopProgress = 0;
        loopSpeed = (oldZ - position.z) / dt;
        loopPoint(loop, 0, radius, position);
        return;
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

  return { mesh, radius, strike, update, reset, resetToPreviousPosition, setLayout, isAtRest,
    isHoled: () => holed, getStrokes: () => strokes };
}
