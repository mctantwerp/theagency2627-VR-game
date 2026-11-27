import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

export function startScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x17293a);
  scene.fog = new THREE.Fog(0x17293a, 8, 30);

  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.6, 3);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.append(renderer.domElement, VRButton.createButton(renderer));

  scene.add(new THREE.HemisphereLight(0xb5d6ee, 0x29452c, 2));
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(15, 48),
    new THREE.MeshStandardMaterial({ color: 0x34533c }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const marker = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.3, 1),
    new THREE.MeshStandardMaterial({ color: 0x9be9d2, emissive: 0x1d6655 }),
  );
  marker.position.set(0, 1.2, -2);
  scene.add(marker);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  renderer.setAnimationLoop(() => renderer.render(scene, camera));
}
