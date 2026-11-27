import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cup, cupEdge, teeEdge } from './course-layout.js';
import { addCup, createPerforatedSurface } from './cup.js';
import { addCreek, addHoleDetails } from './hole-details.js';
import { addForest } from './forest.js';
import { createForestFloorMaterial, createTurfMaterial, createWoodMaterial } from './course-materials.js';

export function createWorld(scene, practice = false) {
  scene.background = new THREE.Color('#8299aa');
  scene.fog = new THREE.FogExp2('#8299aa', 0.038);
  scene.add(new THREE.HemisphereLight(0xaacde6, 0x182d20, 2.1));
  const sunlight = new THREE.DirectionalLight(0xffd3a1, 2);
  sunlight.position.set(-8, 12, 3);
  scene.add(sunlight);

  const clearing = new THREE.Shape();
  clearing.absarc(0, 0, 50, 0, Math.PI * 2, false);
  const ground = new THREE.Mesh(createPerforatedSurface(clearing, 100, 100), createForestFloorMaterial());
  ground.position.y = -0.018;
  scene.add(ground);

  const outline = new THREE.Shape();
  outline.moveTo(-1.6, -teeEdge);
  outline.lineTo(1.6, -teeEdge);
  outline.lineTo(1.6, -cupEdge);
  outline.lineTo(-1.6, -cupEdge);
  outline.closePath();
  const course = new THREE.Mesh(createPerforatedSurface(outline, 3.2, 8), createTurfMaterial());
  scene.add(course);
  addCup(scene);

  const railMaterial = createWoodMaterial();
  const railGeometry = new RoundedBoxGeometry(1.99, 0.16, 0.16, 2, 0.025);
  const boltGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.014, 6);
  const boltMaterial = new THREE.MeshStandardMaterial({ color: 0x59493c, roughness: 0.54 });
  for (const x of [-1.67, 1.67]) {
    for (const z of [-5, -3, -1, 1]) {
      const rail = new THREE.Mesh(railGeometry, railMaterial);
      rail.rotation.y = Math.PI / 2;
      rail.position.set(x, 0.06, z);
      scene.add(rail);
      for (const offset of [-0.82, 0.82]) {
        const bolt = new THREE.Mesh(boltGeometry, boltMaterial);
        bolt.position.set(x, 0.142, z + offset);
        scene.add(bolt);
      }
    }
  }

  const endRailGeometry = new RoundedBoxGeometry(3.5, 0.2, 0.18, 2, 0.026);
  for (const z of [cupEdge - 0.09, teeEdge + 0.09]) {
    const endRail = new THREE.Mesh(endRailGeometry, railMaterial);
    endRail.position.set(0, 0.085, z);
    scene.add(endRail);
    for (const x of [-1.45, 0, 1.45]) {
      const bolt = new THREE.Mesh(boltGeometry, boltMaterial);
      bolt.position.set(x, 0.188, z);
      scene.add(bolt);
    }
  }

  const flagpole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.95, 10),
    new THREE.MeshStandardMaterial({ color: 0xf1dfb3 }),
  );
  flagpole.position.set(cup.x, 0.475, cup.z - 0.32);
  const flagShape = new THREE.Shape();
  flagShape.moveTo(0, 0);
  flagShape.lineTo(0.33, 0.11);
  flagShape.lineTo(0, 0.23);
  flagShape.closePath();
  const flag = new THREE.Mesh(
    new THREE.ShapeGeometry(flagShape),
    new THREE.MeshStandardMaterial({ color: 0xd8583f, side: THREE.DoubleSide }),
  );
  flag.position.set(cup.x, 0.69, cup.z - 0.32);
  scene.add(flagpole, flag);

  if (practice) return { bounce() {}, update() {} };

  addForest(scene, railMaterial);
  const holeDetails = addHoleDetails(scene, railMaterial);
  const updateCreek = addCreek(scene);

  const stars = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 0; i < 100; i++) {
    const angle = i * 2.4;
    const radius = 4 + (i % 17) * 0.75;
    positions.push(Math.cos(angle) * radius, 0.5 + (i % 9) * 0.48, Math.sin(angle) * radius - 2);
  }
  stars.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 32;
  const context = sprite.getContext('2d');
  const glow = context.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, '#fff');
  glow.addColorStop(0.24, '#fff9');
  glow.addColorStop(1, '#fff0');
  context.fillStyle = glow;
  context.fillRect(0, 0, 32, 32);
  const fireflies = new THREE.Points(stars, new THREE.PointsMaterial({
    color: 0xe7f6a3, map: new THREE.CanvasTexture(sprite), size: 0.15,
    transparent: true, opacity: 0.8, depthWrite: false,
  }));
  scene.add(fireflies);
  return {
    bounce: holeDetails.bounce,
    update(time) {
      fireflies.material.opacity = 0.65 + Math.sin(time * 0.001) * 0.2;
      holeDetails.update(time);
      updateCreek(time);
    },
  };
}
