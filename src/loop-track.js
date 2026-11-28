import * as THREE from 'three';

const turn = 2 * Math.PI;

export function loopPoint(loop, progress, inset, target) {
  const angle = progress * turn;
  // The sideways shift separates the entry and exit while keeping both tangents straight.
  const shift = progress * progress * (3 - 2 * progress);
  const radius = loop.radius - inset;
  return target.set(
    loop.exitX * shift,
    loop.radius - radius * Math.cos(angle),
    THREE.MathUtils.lerp(loop.entryZ, loop.exitZ, shift) - radius * Math.sin(angle),
  );
}

export function loopLength(loop, inset) {
  return turn * (loop.radius - inset);
}

export function loopAcceleration(progress, speed) {
  return -9.8 * Math.sin(progress * turn) - 0.22 * speed;
}

export function addLoopTrack(parent, loop, materials, preview) {
  const segments = 64;
  const leftRail = [];
  const rightRail = [];
  const vertices = [];
  const indices = [];
  const shell = [];

  for (let index = 0; index <= segments; index++) {
    const progress = index / segments;
    const surface = loopPoint(loop, progress, 0, new THREE.Vector3());
    const rail = loopPoint(loop, progress, 0.026, new THREE.Vector3());
    const underside = loopPoint(loop, progress, -0.022 * Math.sin(Math.PI * progress) ** 0.5, new THREE.Vector3());
    const halfWidth = loop.width / 2;
    vertices.push(surface.x - halfWidth, surface.y, surface.z, surface.x + halfWidth, surface.y, surface.z);
    vertices.push(underside.x - halfWidth, underside.y, underside.z, underside.x + halfWidth, underside.y, underside.z);
    leftRail.push(rail.clone().setX(rail.x - halfWidth));
    rightRail.push(rail.setX(rail.x + halfWidth));
    if (index > 0) {
      const next = index * 4;
      indices.push(next - 4, next, next - 3, next - 3, next, next + 1);
      shell.push(
        next - 2, next - 1, next + 2, next - 1, next + 3, next + 2,
        next - 4, next - 2, next, next - 2, next + 2, next,
        next - 3, next + 1, next - 1, next - 1, next + 1, next + 3,
      );
    }
  }

  const surface = new THREE.BufferGeometry();
  surface.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  surface.setIndex(preview ? indices : indices.concat(shell));
  if (!preview) {
    surface.addGroup(0, indices.length, 0);
    surface.addGroup(indices.length, shell.length, 1);
  }
  surface.computeVertexNormals();
  parent.add(new THREE.Mesh(surface, preview ? materials.track : [materials.track, materials.foot]));

  for (const points of [leftRail, rightRail]) {
    const rail = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, 0.012, 6);
    parent.add(new THREE.Mesh(rail, preview ? materials.accent : materials.trim));
  }
  if (preview) return;

  const upright = new THREE.Vector3(0, 1, 0);
  const geometry = new THREE.CylinderGeometry(0.014, 0.017, 1, 8);
  const foot = new THREE.CylinderGeometry(0.035, 0.035, 0.015, 16);
  for (const [progress, side] of [[0.34, -1], [0.66, 1]]) {
    const top = loopPoint(loop, progress, 0, new THREE.Vector3());
    top.x += side * loop.width / 2;
    const bottom = new THREE.Vector3(side * 0.65, 0.012, top.z);
    const direction = top.clone().sub(bottom);
    const strut = new THREE.Mesh(geometry, materials.trim);
    strut.scale.y = direction.length();
    strut.position.copy(bottom).lerp(top, 0.5);
    strut.quaternion.setFromUnitVectors(upright, direction.normalize());
    const mount = new THREE.Mesh(foot, materials.body);
    mount.position.copy(bottom);
    parent.add(strut, mount);
  }
}
