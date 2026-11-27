import * as THREE from 'three';
import { root, spring } from './course-layout.js';

export function addHoleDetails(scene, bark) {
  const rootPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(root.minX + 0.1, 0.04, root.z + 0.01),
    new THREE.Vector3(-0.27, 0.115, root.z - 0.015),
    new THREE.Vector3(0.23, 0.125, root.z + 0.015),
    new THREE.Vector3(root.maxX - 0.1, 0.055, root.z),
  ]);
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(rootPath, 18, 0.125, 9), bark);
  scene.add(trunk);
  const mossMaterial = new THREE.MeshStandardMaterial({ color: 0x50683b, roughness: 1 });
  for (const distance of [0.15, 0.39, 0.72, 0.88]) {
    const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), mossMaterial);
    moss.position.copy(rootPath.getPoint(distance)).add(new THREE.Vector3(0, 0.12, 0));
    moss.scale.set(1, 0.16, 0.6);
    scene.add(moss);
  }

  const pad = new THREE.Group();
  pad.position.set(spring.x, 0, spring.z);
  const stalk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.09, 0.115, 12),
    new THREE.MeshStandardMaterial({ color: 0xd1b493, roughness: 0.85 }),
  );
  stalk.position.y = 0.055;
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(spring.radius, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xbc7cff, emissive: 0x643f92, emissiveIntensity: 0.58, roughness: 0.64 }),
  );
  cap.scale.y = 0.37;
  cap.position.y = 0.108;
  pad.add(stalk, cap);
  const fleckMaterial = new THREE.MeshBasicMaterial({ color: 0xffddeb });
  const fleckGeometry = new THREE.SphereGeometry(0.015, 8, 4);
  for (let index = 0; index < 9; index++) {
    const radius = 0.045 + (index % 4) * 0.044;
    const angle = index * 2.39996;
    const fleck = new THREE.Mesh(fleckGeometry, fleckMaterial);
    fleck.scale.y = 0.34;
    fleck.position.set(Math.cos(angle) * radius, 0.109 + Math.sqrt(spring.radius ** 2 - radius ** 2) * 0.37,
      Math.sin(angle) * radius);
    pad.add(fleck);
  }
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(0.245, 0.255, 32),
    new THREE.MeshBasicMaterial({ color: 0xbe8af0, transparent: true, opacity: 0.56 }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(spring.x, 0.006, spring.z);
  scene.add(pad, glow);

  let bounceTime = -Infinity;
  return {
    bounce(time) { bounceTime = time; },
    update(time) {
      const seconds = (time - bounceTime) / 1000;
      pad.scale.y = seconds < 0.42 ? 1 - Math.sin(seconds * 18) * Math.exp(-seconds * 6) * 0.42 : 1;
      glow.material.opacity = 0.52 + Math.sin(time * 0.002) * 0.17;
    },
  };
}

export function addCreek(scene) {
  const points = [
    [4.2, 5], [3.7, 2], [3.55, -1], [4.2, -4], [3.7, -7], [3.25, -10], [5.0, -15],
  ];
  const path = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, -0.012, z)));
  const vertices = [];
  const uvs = [];
  const indices = [];
  for (let index = 0; index <= 60; index++) {
    const fraction = index / 60;
    const center = path.getPoint(fraction);
    const tangent = path.getTangent(fraction);
    const width = 0.66 + Math.sin(fraction * 13) * 0.16;
    for (const side of [-1, 1]) {
      vertices.push(center.x + tangent.z * width * side, center.y, center.z - tangent.x * width * side);
      uvs.push((side + 1) / 2, fraction);
    }
    if (index > 0) {
      const vertex = index * 2;
      indices.push(vertex - 2, vertex - 1, vertex, vertex, vertex - 1, vertex + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      varying vec2 streamUV;
      void main() {
        streamUV = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec2 streamUV;
      void main() {
        float edge = smoothstep(0.0, 0.16, min(streamUV.x, 1.0 - streamUV.x));
        float ripples = sin(streamUV.y * 190.0 - time * 2.8 + sin(streamUV.x * 18.0));
        vec3 water = mix(vec3(0.19, 0.28, 0.25), vec3(0.18, 0.40, 0.48), edge);
        gl_FragColor = vec4(water + pow(max(0.0, ripples), 9.0) * 0.09 * edge, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(geometry, material));
  return (time) => { material.uniforms.time.value = time / 1000; };
}
