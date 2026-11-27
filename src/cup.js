import * as THREE from 'three';
import { cup } from './course-layout.js';

export function createPerforatedSurface(outline, width, length) {
  const hole = new THREE.Path();
  hole.absarc(cup.x, -cup.z, cup.radius, 0, Math.PI * 2, true);
  outline.holes.push(hole);
  const geometry = new THREE.ShapeGeometry(outline, 24);
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let index = 0; index < positions.count; index++) {
    uv.setXY(index, positions.getX(index) / width + 0.5, positions.getY(index) / length);
  }
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function addCup(scene) {
  const liner = new THREE.Mesh(
    new THREE.CylinderGeometry(cup.radius, cup.radius, cup.depth, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xc3c8b3, side: THREE.BackSide, roughness: 0.9 }),
  );
  liner.position.set(cup.x, -cup.depth / 2, cup.z);
  const bottom = new THREE.Mesh(
    new THREE.CircleGeometry(cup.radius, 48),
    new THREE.MeshStandardMaterial({ color: 0x343c33, roughness: 1 }),
  );
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.set(cup.x, -cup.depth, cup.z);
  scene.add(liner, bottom);
}
