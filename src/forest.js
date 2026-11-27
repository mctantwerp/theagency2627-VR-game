import * as THREE from 'three';

export function addForest(scene, woodMaterial) {
  let seed = 503;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  const batches = [];

  function batch(geometry, capacity, material = new THREE.MeshStandardMaterial({ roughness: 1 })) {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.count = 0;
    batches.push(mesh);
    return mesh;
  }

  function place(mesh, x, y, z, width, height, depth, tint, angle = random() * Math.PI * 2) {
    transform.position.set(x, y, z);
    transform.rotation.set(0, angle, 0);
    transform.scale.set(width, height, depth);
    write(mesh, tint);
  }

  function write(mesh, tint) {
    transform.updateMatrix();
    mesh.setMatrixAt(mesh.count, transform.matrix);
    mesh.setColorAt(mesh.count, color.set(tint));
    mesh.count++;
  }

  function branch(mesh, start, end, radius, tint) {
    direction.subVectors(end, start);
    transform.position.copy(start).addScaledVector(direction, 0.5);
    transform.scale.set(radius, direction.length(), radius);
    transform.quaternion.setFromUnitVectors(up, direction.normalize());
    write(mesh, tint);
  }

  const bark = batch(new THREE.CylinderGeometry(0.46, 1, 1, 9), 230, woodMaterial);
  const canopy = batch(new THREE.IcosahedronGeometry(1, 2), 380);
  const stones = batch(new THREE.IcosahedronGeometry(1, 1), 36);
  const foliage = batch(new THREE.SphereGeometry(1, 6, 4), 1920);
  const fernStems = batch(new THREE.CylinderGeometry(0.55, 1, 1, 5), 960);
  const frondBase = new THREE.Vector3();
  const frondTip = new THREE.Vector3();
  const stems = batch(new THREE.CylinderGeometry(0.6, 1, 1, 7), 30);
  const caps = batch(new THREE.LatheGeometry([
    new THREE.Vector2(0, -0.12), new THREE.Vector2(0.73, -0.13),
    new THREE.Vector2(1, -0.03), new THREE.Vector2(0.98, 0.08),
    new THREE.Vector2(0.81, 0.34), new THREE.Vector2(0.52, 0.51),
    new THREE.Vector2(0.2, 0.57), new THREE.Vector2(0, 0.57),
  ], 14), 30);
  const treeColors = [0x557a39, 0x637f38, 0x355839, 0x456f40, 0x798944];

  for (let index = 0; index < 34; index++) {
    const angle = index * 2.39996;
    const ring = 5 + (index % 8) * 2.1;
    const x = Math.cos(angle) * ring;
    const z = Math.sin(angle) * ring - 3;
    if (Math.abs(x) < 2.2 && z > -6.6 && z < 2.8) continue;
    const height = 3.8 + random() * 3.8;
    const base = new THREE.Vector3(x, -0.1, z);
    const fork = new THREE.Vector3(x + random() - 0.5, height * 0.59, z + random() - 0.5);
    branch(bark, base, fork, height * 0.072, 0xe6c7a3);

    for (let limb = 0; limb < 5; limb++) {
      const direction = angle + limb * 1.26;
      const reach = height * (0.18 + random() * 0.17);
      const end = new THREE.Vector3(
        fork.x + Math.cos(direction) * reach,
        height * (0.76 + random() * 0.24),
        fork.z + Math.sin(direction) * reach,
      );
      branch(bark, fork, end, height * 0.032, 0xe6c7a3);
      for (let tuft = 0; tuft < 2; tuft++) {
        const size = height * (0.15 + random() * 0.12);
        place(canopy, end.x + random() - 0.5, end.y + tuft * size * 0.55, end.z + random() - 0.5,
          size, size * 0.66, size * 0.88, treeColors[Math.floor(random() * treeColors.length)]);
      }
    }
  }

  for (const side of [-1, 1]) {
    for (let patch = 0; patch < 12; patch++) {
      const x = side * (2 + random() * 2.2);
      const z = 2 - patch * 0.91 + random() * 0.35;
      const size = 0.53 + random() * 0.67;
      place(stones, x + side * 0.28, 0.02, z + 0.24, size * 0.65, size * 0.4, size * 0.5, 0x6b7468);
      for (let frond = 0; frond < 5; frond++) {
        const angle = frond * 1.26 + patch;
        frondBase.set(x, -0.022, z);
        for (let leaflet = 1; leaflet <= 8; leaflet++) {
          const progress = leaflet / 8;
          const reach = progress * size * 0.75;
          const height = Math.sin(progress * 2.35) * size * 0.5;
          const length = Math.sin(progress * Math.PI) * size * 0.17 + 0.014;
          frondTip.set(x + Math.cos(angle) * reach, height, z + Math.sin(angle) * reach);
          branch(fernStems, frondBase, frondTip, size * (0.009 - progress * 0.005), 0x526234);
          frondBase.copy(frondTip);
          for (const offset of [-1, 1]) {
            const leafAngle = angle + offset * 0.76;
            place(foliage,
              frondTip.x + Math.cos(leafAngle) * length * 0.72,
              frondTip.y, frondTip.z + Math.sin(leafAngle) * length * 0.72,
              length, 0.012, length * 0.29, treeColors[(patch + leaflet) % treeColors.length],
              -leafAngle);
          }
        }
      }
      if (patch % 4 !== 1) continue;
      for (let mushroom = 0; mushroom < 4; mushroom++) {
        const capSize = 0.07 + random() * 0.12;
        const stemHeight = capSize * (1.2 + random());
        const capX = x + side * random() * 0.35;
        const capZ = z + random() * 0.45;
        place(stems, capX, stemHeight / 2, capZ, capSize * 0.21, stemHeight, capSize * 0.21, 0xd9c397);
        place(caps, capX, stemHeight, capZ, capSize, capSize, capSize, mushroom % 2 ? 0xd49a56 : 0xad643d);
      }
    }
  }
  scene.add(...batches);
}
