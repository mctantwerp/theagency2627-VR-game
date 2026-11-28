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

export function addLoopTrack(parent, loop, preview) {
  const segments = 64;
  const leftRail = [];
  const rightRail = [];
  const vertices = [];
  const indices = [];

  for (let index = 0; index <= segments; index++) {
    const progress = index / segments;
    const surface = loopPoint(loop, progress, 0, new THREE.Vector3());
    const rail = loopPoint(loop, progress, 0.026, new THREE.Vector3());
    const halfWidth = loop.width / 2;
    vertices.push(surface.x - halfWidth, surface.y, surface.z, surface.x + halfWidth, surface.y, surface.z);
    leftRail.push(rail.clone().setX(rail.x - halfWidth));
    rightRail.push(rail.setX(rail.x + halfWidth));
    if (index > 0) {
      const next = index * 2;
      indices.push(next - 2, next, next - 1, next - 1, next, next + 1);
    }
  }

  const surface = new THREE.BufferGeometry();
  surface.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  surface.setIndex(indices);
  surface.computeVertexNormals();
  const paint = preview
    ? new THREE.MeshBasicMaterial({ color: 0xc3a5ff, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({ color: 0x6044a0, roughness: 0.52, side: THREE.DoubleSide });
  parent.add(new THREE.Mesh(surface, paint));

  const trim = preview
    ? new THREE.MeshBasicMaterial({ color: 0xffe6aa })
    : new THREE.MeshStandardMaterial({ color: 0xe5ad69, roughness: 0.42 });
  for (const points of [leftRail, rightRail]) {
    const rail = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, 0.012, 6);
    parent.add(new THREE.Mesh(rail, trim));
  }
}
