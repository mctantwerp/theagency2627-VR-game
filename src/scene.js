import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { createAudio } from './audio.js';
import { createBall } from './ball.js';
import { forestCourse, roomCourse } from './course-layout.js';
import { createRoomAppearance } from './room-appearance.js';
import { createRoomButton } from './room-button.js';
import { createRoomCourse, setupRoomPlacement } from './room-course.js';
import { setupPutter } from './putter.js';
import { setupScore } from './score.js';
import { setupTeleport } from './teleport.js';
import { walkWithThumbstick } from './walking.js';
import { createWorld } from './world.js';
import { setupHomeShortcut } from './xr-controls.js';

export function startScene() {
  const scene = new THREE.Scene();
  const mode = new URLSearchParams(window.location.search);
  const room = mode.has('room');
  const practice = !room && mode.has('practice');
  let layout = room ? roomCourse : forestCourse;
  const roomAppearance = room ? createRoomAppearance() : null;
  let showRoomCourse;
  const course = room ? new THREE.Group() : scene;
  if (room) {
    scene.add(course);
    scene.background = new THREE.Color(0x142721);
    showRoomCourse = createRoomCourse(course, roomAppearance.play);
  }
  const world = room ? null : createWorld(scene, practice);
  const audio = createAudio();
  let time = 0;
  const ball = createBall(course, (event) => {
    if (event === 'spring') world?.bounce(time);
    audio.play(event);
  }, practice || room, layout);
  const score = setupScore(course, ball, room);
  const modeLink = document.getElementById('mode');
  const courseGuide = document.getElementById('course-guide');
  if (room) {
    courseGuide.textContent = 'Kies A/B voor een baan en Y voor de stijl. Voeg banen toe met de trekker en druk de rechterduimstick in om te spelen.';
    document.getElementById('room-mode').remove();
  } else if (practice) {
    courseGuide.textContent = 'Vlakke oefenbaan voor grip en korte putts.';
  }
  if (room || practice) {
    modeLink.textContent = 'Naar het startscherm';
    modeLink.href = './';
  }
  let previousTime = null;
  let resetRequest = null;
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.6, 3);
  const rig = new THREE.Group();
  rig.add(camera);
  scene.add(rig);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: room });
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
  const teleport = room ? null : setupTeleport(scene, rig, ball, practice);
  const placement = room ? setupRoomPlacement(scene, course, rig, (next, index) => {
    layout = next;
    ball.setLayout(next);
    showRoomCourse(index);
  }, roomAppearance) : null;
  const updatePutter = setupPutter(renderer, scene, rig, ball, {
    teleport: teleport?.request,
    getViewerPosition: room ? placement.getViewerPosition : teleport.getViewerPosition,
    alignAddress: teleport?.alignAddress,
    requestPlacement: placement?.request,
    canPutt: placement?.canPutt,
    strikeEnabled: placement?.canStrike,
    getAimTarget: () => {
      const loop = layout.loop;
      if (loop && ball.mesh.position.z >= loop.entryZ) return { x: 0, z: loop.entryZ };
      return layout.cup;
    },
    calibrationKey: room ? 'lichtvallei.putter.room.v1' : undefined,
    puttHint: room ? 'Houd de linkertrigger ingedrukt om te slaan.' : undefined,
    reset: placement?.next ?? ((hand, stance) => { resetRequest = { hand, stance }; }),
    mute: toggleAudio,
    message: score.message,
  });
  const updateHomeShortcut = setupHomeShortcut(() => window.location.assign('./'));

  let roomReferenceSpace;
  function clearRoomPlacement() {
    ball.reset();
    placement.reset(true);
    updatePutter(0, true);
  }
  if (room) {
    renderer.xr.addEventListener('sessionstart', () => {
      scene.background = null;
      renderer.setClearAlpha(0);
      clearRoomPlacement();
      roomReferenceSpace = renderer.xr.getReferenceSpace();
      roomReferenceSpace.addEventListener('reset', clearRoomPlacement);
    });
  }
  renderer.xr.addEventListener('sessionend', () => {
    if (room) {
      roomReferenceSpace?.removeEventListener('reset', clearRoomPlacement);
      scene.background = new THREE.Color(0x142721);
      placement.reset();
      ball.reset();
    } else {
      rig.position.set(0, 0, 0);
    }
    camera.position.set(0, 1.6, 3);
    camera.quaternion.identity();
    previousTime = null;
    updatePutter(0);
  });
  const vrButton = room ? createRoomButton(renderer, courseGuide) : VRButton.createButton(renderer);
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
    updateHomeShortcut(frame?.session, delta);

    const resetting = resetRequest !== null;
    if (resetRequest) {
      ball.reset();
      if (teleport) {
        teleport.cancel();
        if (resetRequest.hand && renderer.xr.isPresenting) {
          teleport.request(resetRequest.hand, resetRequest.stance);
        } else {
          rig.position.set(0, 0, 0);
          rig.updateMatrixWorld(true);
        }
      }
      resetRequest = null;
    }

    ball.update(delta);
    const relocated = room ? placement.update(renderer.xr, frame, delta) : teleport.update(renderer.xr, frame);
    const walking = !room && !resetting && !relocated && walkWithThumbstick(
      frame?.session, rig, teleport.getViewerPosition(), teleport.right, delta, practice,
    );
    updatePutter(delta, resetting || relocated || walking);
    score.update(placement?.getRound());
    world?.update(time);
    renderer.render(scene, camera);
  });
}
