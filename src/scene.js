import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { createAudio } from './audio.js';
import { createBall } from './ball.js';
import { setupPutter } from './putter.js';
import { setupScore } from './score.js';
import { setupTeleport } from './teleport.js';
import { walkWithThumbstick } from './walking.js';
import { createWorld } from './world.js';

export function startScene() {
  const scene = new THREE.Scene();
  const practice = new URLSearchParams(window.location.search).has('practice');
  const world = createWorld(scene, practice);
  const audio = createAudio();
  let time = 0;
  const ball = createBall(scene, (event) => {
    if (event === 'spring') world.bounce(time);
    audio.play(event);
  }, practice);
  const score = setupScore(scene, ball);
  const modeLink = document.getElementById('mode');
  if (practice) {
    document.getElementById('course-guide').textContent = 'Vlakke oefenbaan voor grip en korte putts.';
    modeLink.textContent = 'Naar de bosbaan';
    modeLink.href = './';
  }
  let previousTime = null;
  let resetRequest = null;
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.6, 3);
  const rig = new THREE.Group();
  rig.add(camera);
  scene.add(rig);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');

  const soundButton = document.getElementById('sound');
  function toggleAudio() {
    const muted = audio.toggle();
    soundButton.textContent = muted ? 'Geluid aan' : 'Geluid uit';
    if (!muted) audio.start();
  }
  const teleport = setupTeleport(scene, rig, ball, practice);
  const updatePutter = setupPutter(renderer, scene, rig, ball, {
    teleport: teleport.request,
    getViewerPosition: teleport.getViewerPosition,
    alignAddress: teleport.alignAddress,
    reset: (hand, stance) => { resetRequest = { hand, stance }; },
    mute: toggleAudio,
    message: score.message,
  });
  renderer.xr.addEventListener('sessionend', () => {
    rig.position.set(0, 0, 0);
    camera.position.set(0, 1.6, 3);
    camera.quaternion.identity();
    previousTime = null;
    updatePutter(0);
  });
  const vrButton = VRButton.createButton(renderer);
  vrButton.addEventListener('click', audio.start);
  soundButton.addEventListener('click', toggleAudio);
  document.getElementById('reset').addEventListener('click', () => { resetRequest = {}; });
  document.body.append(renderer.domElement, vrButton);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  renderer.setAnimationLoop((frameTime, frame) => {
    time = frameTime;
    const delta = previousTime === null ? 0 : (time - previousTime) / 1000;
    previousTime = time;

    const resetting = resetRequest !== null;
    if (resetRequest) {
      ball.reset();
      teleport.cancel();
      if (resetRequest.hand && renderer.xr.isPresenting) {
        teleport.request(resetRequest.hand, resetRequest.stance);
      } else {
        rig.position.set(0, 0, 0);
        rig.updateMatrixWorld(true);
      }
      resetRequest = null;
    }

    ball.update(delta);
    const teleported = teleport.update(renderer.xr, frame);
    const walking = !resetting && !teleported && walkWithThumbstick(
      frame?.session, rig, teleport.getViewerPosition(), teleport.right, delta, practice,
    );
    updatePutter(delta, resetting || teleported || walking);
    score.update();
    world.update(time);
    renderer.render(scene, camera);
  });
}
