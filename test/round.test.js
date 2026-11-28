import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createBall } from '../src/ball.js';
import { setupTeleport } from '../src/teleport.js';
import { cup } from '../src/course-layout.js';
import { createPerforatedSurface } from '../src/cup.js';
import { setupPutter } from '../src/putter.js';
import { walkWithThumbstick } from '../src/walking.js';

function finishPutt(ball) {
  for (let frame = 0; frame < 900 && !ball.isAtRest() && !ball.isHoled(); frame++) {
    ball.update(1 / 90);
  }
  assert.ok(ball.isAtRest() || ball.isHoled());
}

function puttToward(ball, x, z, speed) {
  const direction = new THREE.Vector2(x - ball.mesh.position.x, z - ball.mesh.position.z);
  const distance = direction.length();
  direction.setLength(speed ?? Math.sqrt(distance * 1.6) + 0.035);
  assert.ok(ball.strike(direction.x, direction.y));
  finishPutt(ball);
}

test('the player can finish through both routes and reset', () => {
  const events = [];
  const ball = createBall(new THREE.Scene(), event => events.push(event));
  const start = ball.mesh.position.clone();
  puttToward(ball, -1, -2);
  puttToward(ball, -1, -4);
  puttToward(ball, 0, -5);
  assert.ok(ball.isHoled());
  assert.equal(ball.getStrokes(), 3);
  assert.deepEqual(events, ['putt', 'putt', 'putt', 'cup']);

  ball.reset();
  assert.ok(ball.mesh.position.equals(start));
  assert.equal(ball.getStrokes(), 0);
  assert.ok(ball.isAtRest());

  events.length = 0;
  puttToward(ball, 0.18, -2.13, 1.75);
  assert.ok(ball.mesh.position.z < -2.83);
  puttToward(ball, 0, -5);
  assert.equal(ball.getStrokes(), 2);
  assert.deepEqual(events, ['putt', 'spring', 'putt', 'cup']);
});

test('hard putts travel farther and an escaped ball returns to its previous position', () => {
  const ball = createBall(new THREE.Scene());
  puttToward(ball, 0, 1.5, 0.55);
  const short = ball.mesh.position.z;
  ball.reset();
  puttToward(ball, 0, 1.5, 1.1);
  assert.ok(ball.mesh.position.z > short);
  const rest = ball.mesh.position.clone();
  ball.strike(1, 0);
  ball.mesh.position.x = 4;
  ball.update(1 / 90);
  assert.ok(ball.mesh.position.equals(rest));
  assert.ok(ball.isAtRest());
});

test('teleport lands on the side for the selected hand and keeps floor height', () => {
  const scene = new THREE.Scene();
  const rig = new THREE.Group();
  const ball = createBall(scene);
  const teleport = setupTeleport(scene, rig, ball);
  const viewer = { x: 0.14, y: 1.7, z: -0.24 };
  const xr = { isPresenting: true, getReferenceSpace: () => ({}) };
  const frame = { getViewerPose: () => ({ transform: { position: viewer } }) };

  for (const x of [-1.46, 0, 1.46]) {
    ball.mesh.position.x = x;
    for (const hand of ['left', 'right']) {
      teleport.request(hand);
      assert.ok(teleport.update(xr, frame));
      assert.equal(rig.position.y, 0);
      assert.ok((x - rig.position.x - viewer.x) * (hand === 'right' ? 1 : -1) > 0.29);
      assert.ok(rig.position.z + viewer.z > ball.mesh.position.z);
    }
  }
  ball.mesh.position.set(0, ball.radius, -1);
  const orientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const rotatedFrame = { getViewerPose: () => ({ transform: { position: viewer, orientation } }) };
  for (const hand of ['left', 'right']) {
    teleport.request(hand);
    assert.ok(teleport.update(xr, rotatedFrame));
    const stance = rig.position.clone().add(new THREE.Vector3(viewer.x, 0, viewer.z));
    const ballSide = ball.mesh.position.clone().sub(stance).dot(teleport.right);
    assert.ok(ballSide * (hand === 'right' ? 1 : -1) > 0.29);
  }
  ball.strike(0, -1);
  teleport.request('right');
  assert.equal(teleport.update(xr, frame), false);
});

function setupController(hand = 'right', position = new THREE.Vector3(-0.26, 0.84, -0.29), controls = {}) {
  const scene = new THREE.Scene();
  const rig = new THREE.Group();
  scene.add(rig);
  const ball = createBall(scene);
  const targets = [new THREE.Group(), new THREE.Group()];
  const grips = [new THREE.Group(), new THREE.Group()];
  const update = setupPutter({ xr: { getController: i => targets[i], getControllerGrip: i => grips[i] } },
    scene, rig, ball, { ...controls, teleport() {}, reset() {}, mute() {}, alignAddress(x, z) {
      rig.position.x += x;
      rig.position.z += z;
      rig.updateMatrixWorld(true);
      return true;
    } });
  const target = targets[0];
  const grip = grips[0];
  target.dispatchEvent({ type: 'connected', data: { targetRayMode: 'tracked-pointer', handedness: hand } });
  grip.position.copy(position);
  grip.rotation.x = -0.4;
  update(1 / 90);
  assert.equal(scene.children[2].visible, false);
  target.dispatchEvent({ type: 'squeezestart' });
  update(1 / 90);
  assert.equal(scene.children[2].visible, true);
  target.dispatchEvent({ type: 'squeezeend' });
  update(1 / 90);
  const club = scene.children[2];
  return { club, head: club.children.at(-1), ball, rig, target, grip, update };
}

test('grip calibration tracks the full controller rotation and preserves shaft length', () => {
  const { club, head, grip, target, update } = setupController();
  assert.equal(club.visible, true);
  target.dispatchEvent({ type: 'squeezeend' });
  const before = head.getWorldPosition(new THREE.Vector3());
  const length = before.distanceTo(grip.getWorldPosition(new THREE.Vector3()));
  assert.ok(length > 0.7);
  grip.rotation.y += Math.PI / 4;
  grip.position.y += 0.14;
  for (let frame = 0; frame < 32; frame++) update(1 / 90);
  const after = head.getWorldPosition(new THREE.Vector3());
  assert.ok(before.distanceTo(after) > 0.08);
  assert.ok(Math.abs(after.distanceTo(club.position) - length) < 1e-8);
  assert.ok(club.position.distanceTo(grip.getWorldPosition(new THREE.Vector3())) < 1e-8);
});

test('normal, soft and hard swings work without a button and practice swings never count', () => {
  const { ball, target, grip, update } = setupController();
  const address = grip.position.clone();
  function swing(steps = 28, sideOffset = 0) {
    grip.position.copy(address);
    grip.position.x += sideOffset;
    update(1 / 90, true);
    for (let index = 0; index < steps; index++) {
      grip.position.z -= 0.17 / steps;
      update(1 / 90);
    }
  }
  target.dispatchEvent({ type: 'squeezestart' });
  swing();
  assert.equal(ball.getStrokes(), 0);
  target.dispatchEvent({ type: 'squeezeend' });
  swing(20, 0.23);
  assert.equal(ball.getStrokes(), 0);
  swing();
  assert.equal(ball.getStrokes(), 1);
  finishPutt(ball);
  const softDistance = -0.65 - ball.mesh.position.z;
  assert.ok(softDistance > 0.06 && softDistance < 0.9);
  ball.reset();
  swing(6);
  assert.equal(ball.getStrokes(), 1);
  finishPutt(ball);
  assert.ok(-0.65 - ball.mesh.position.z > softDistance);
  ball.reset();
  grip.position.copy(address);
  update(1 / 90, true);
  grip.position.z -= 0.2;
  update(1 / 90, true);
  assert.equal(ball.getStrokes(), 0);
});

test('a putt can start with the face already near the ball', () => {
  const { ball, grip, update } = setupController();
  grip.position.z -= 0.08;
  update(1 / 90, true);
  for (let frame = 0; frame < 12; frame++) {
    grip.position.z -= 0.0025;
    update(1 / 90);
  }
  assert.equal(ball.getStrokes(), 1);
});

test('a fast sweep catches a near-height miss but still needs horizontal aim', () => {
  const { ball, head, grip, update } = setupController();
  const address = grip.position.clone();
  const dt = 1 / 30;
  function sweep(side, height) {
    grip.position.copy(address).add(new THREE.Vector3(side, height, 0.01));
    update(dt, true);
    assert.ok(head.getWorldPosition(new THREE.Vector3()).z > ball.mesh.position.z);
    grip.position.z -= 0.205;
    update(dt);
    assert.ok(head.getWorldPosition(new THREE.Vector3()).z < ball.mesh.position.z);
  }

  sweep(0.26, 0.172);
  assert.equal(ball.getStrokes(), 0);
  sweep(0, 0.23);
  assert.equal(ball.getStrokes(), 0);
  sweep(0, 0.172);
  assert.equal(ball.getStrokes(), 1);
});

test('a gated putter only strikes when enabled before contact', () => {
  let enabled = false;
  const { ball, head, grip, update } = setupController(undefined, undefined, { strikeEnabled: () => enabled });
  const address = grip.position.clone();
  const step = 1 / 90;
  function swing(releaseAt = -1) {
    grip.position.copy(address);
    update(step, true);
    for (let index = 0; index < 28; index++) {
      if (index === releaseAt) enabled = false;
      grip.position.z -= 0.006;
      update(step);
    }
  }
  assert.equal(head.material.color.getHex(), 0x9baea4);
  swing();
  assert.equal(ball.getStrokes(), 0);
  enabled = true;
  update(step);
  assert.equal(ball.getStrokes(), 0);
  swing(6);
  assert.equal(ball.getStrokes(), 0);
  enabled = true;
  swing();
  assert.equal(ball.getStrokes(), 1);
  assert.equal(head.material.color.getHex(), 0xffd47d);
});

test('the green has an opening and the ball falls through before scoring', () => {
  const shape = new THREE.Shape().moveTo(-1.6, -2).lineTo(1.6, -2)
    .lineTo(1.6, 6).lineTo(-1.6, 6).closePath();
  const green = new THREE.Mesh(createPerforatedSurface(shape, 3.2, 8), new THREE.MeshBasicMaterial());
  const raycaster = new THREE.Raycaster(new THREE.Vector3(cup.x, 1, cup.z), new THREE.Vector3(0, -1, 0));
  assert.equal(raycaster.intersectObject(green).length, 0);
  raycaster.ray.origin.x += cup.radius + 0.1;
  assert.ok(raycaster.intersectObject(green).length > 0);

  const events = [];
  const ball = createBall(new THREE.Scene(), event => events.push(event), true);
  ball.mesh.position.set(cup.x, ball.radius, cup.z + 0.32);
  assert.ok(ball.strike(0, -0.7));
  for (let frame = 0; frame < 150 && ball.mesh.position.y >= ball.radius && !ball.isAtRest(); frame++) {
    ball.update(1 / 90);
  }
  assert.ok(ball.mesh.position.y < ball.radius);
  assert.ok(ball.mesh.visible);
  assert.ok(!ball.isHoled());
  assert.ok(!ball.isAtRest());
  finishPutt(ball);
  assert.ok(ball.isHoled());
  assert.ok(Math.abs(ball.mesh.position.y - (ball.radius - cup.depth)) < 1e-8);
  assert.deepEqual(events, ['putt', 'cup']);
});

test('a fast putt through the opening drops but a wide putt stays on the green', () => {
  for (const [x, expected] of [[cup.x, true], [cup.x + cup.radius + 0.03, false]]) {
    const ball = createBall(new THREE.Scene(), undefined, true);
    ball.mesh.position.set(x, ball.radius, cup.z + 0.8);
    assert.ok(ball.strike(0, -4));
    for (let frame = 0; frame < 40; frame++) ball.update(1 / 90);
    assert.equal(ball.isHoled(), expected);
  }
});

test('a right-hand or left-hand grip on its own side can be calibrated', () => {
  for (const [hand, x] of [['right', 0.26], ['left', -0.26]]) {
    const { club, head, grip, update } = setupController(hand, new THREE.Vector3(x, 0.84, -0.29));
    assert.ok(club.visible);
    assert.ok(club.position.equals(grip.getWorldPosition(new THREE.Vector3())));
    const address = head.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(address.x) < 1e-8);
    grip.position.x += 0.08;
    for (let frame = 0; frame < 15; frame++) update(1 / 90);
    assert.ok(Math.abs(head.getWorldPosition(new THREE.Vector3()).x - 0.08) < 1e-5);
  }
});

test('lowering the grip at address never pushes the blade into the ball', () => {
  const { club, head, ball, grip, update } = setupController('right', new THREE.Vector3(-0.1, 0.88, -0.19));
  const start = head.getWorldPosition(new THREE.Vector3());
  const length = start.distanceTo(club.position);
  for (let step = 0; step < 8; step++) {
    grip.position.y -= 0.005;
    for (let frame = 0; frame < 3; frame++) update(1 / 90);
    const blade = head.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.hypot(blade.x - start.x, blade.z - start.z) < 1e-8);
    assert.ok(Math.abs(blade.distanceTo(club.position) - length) < 1e-8);
  }
  assert.equal(ball.getStrokes(), 0);
});

test('the default stance shows the shaft from both eyes', () => {
  const scene = new THREE.Scene();
  const rig = new THREE.Group();
  const ball = createBall(scene);
  const teleport = setupTeleport(scene, rig, ball);
  const xr = { isPresenting: true, getReferenceSpace: () => ({}) };
  const viewer = new THREE.Vector3(0, 1.65, 0);
  const frame = { getViewerPose: () => ({ transform: { position: viewer } }) };
  for (const [hand, sign] of [['right', 1], ['left', -1]]) {
    teleport.request(hand);
    assert.ok(teleport.update(xr, frame));
    const position = new THREE.Vector3(sign * 0.24, 0.85, -0.15).add(rig.position);
    const { head, rig: calibratedRig } = setupController(hand, position);
    const calibratedHand = position.clone().add(calibratedRig.position);
    const blade = head.getWorldPosition(new THREE.Vector3());
    for (const eyeOffset of [-0.032, 0.032]) {
      const eye = teleport.getViewerPosition().clone().add(calibratedRig.position).add(new THREE.Vector3(eyeOffset, 0, 0));
      const angle = THREE.MathUtils.radToDeg(calibratedHand.clone().sub(eye).angleTo(blade.clone().sub(eye)));
      assert.ok(angle > 6, `shaft spans ${angle.toFixed(1)} degrees from the ${hand}-hand stance`);
    }
  }
});

test('turning only your head before teleport preserves the calibrated address', () => {
  const scene = new THREE.Scene();
  const rig = new THREE.Group();
  scene.add(rig);
  const ball = createBall(scene);
  const teleport = setupTeleport(scene, rig, ball);
  const targets = [new THREE.Group(), new THREE.Group()];
  const grips = [new THREE.Group(), new THREE.Group()];
  const update = setupPutter({ xr: { getController: i => targets[i], getControllerGrip: i => grips[i] } },
    scene, rig, ball, { teleport: teleport.request, getViewerPosition: teleport.getViewerPosition, alignAddress: teleport.alignAddress, reset() {}, mute() {} });
  const xr = { isPresenting: true, getReferenceSpace: () => ({}) };
  const viewer = { position: new THREE.Vector3(0, 1.66, 0), orientation: new THREE.Quaternion() };
  const frame = { getViewerPose: () => ({ transform: viewer }) };
  const target = targets[0];
  grips[0].position.set(0.24, 0.85, -0.15);

  target.dispatchEvent({ type: 'connected', data: { targetRayMode: 'tracked-pointer', handedness: 'right' } });
  assert.ok(teleport.update(xr, frame));
  target.dispatchEvent({ type: 'squeezestart' });
  update(1 / 90, true);
  target.dispatchEvent({ type: 'squeezeend' });
  update(1 / 90);
  const blade = scene.children.at(-2).children.at(-1);
  const relative = blade.getWorldPosition(new THREE.Vector3()).sub(ball.mesh.position);

  ball.mesh.position.set(0.55, ball.radius, -4);
  viewer.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
  target.dispatchEvent({ type: 'selectstart' });
  assert.ok(teleport.update(xr, frame));
  update(1 / 90, true);
  assert.ok(blade.getWorldPosition(new THREE.Vector3()).sub(ball.mesh.position).distanceTo(relative) < 1e-8);
  assert.equal(ball.getStrokes(), 0);
});

test('a landing behind the root stays on the backswing side of the ball', () => {
  const scene = new THREE.Scene();
  const ball = createBall(scene);
  const rig = new THREE.Group();
  const teleport = setupTeleport(scene, rig, ball);
  ball.mesh.position.set(0.5, ball.radius, -3.45);
  const xr = { isPresenting: true, getReferenceSpace: () => ({}) };
  const frame = { getViewerPose: () => ({ transform: { position: new THREE.Vector3(0, 1.66, 0) } }) };
  teleport.request('right', [-0.30, 0.65]);
  assert.ok(teleport.update(xr, frame));
  assert.ok(rig.position.z > ball.mesh.position.z + 0.65);
});

test('lowering an angled face cannot launch a horizontal putt', () => {
  const { head, ball, grip, update } = setupController();
  grip.rotation.x -= Math.PI / 18;
  update(1 / 90, true);
  const aboveBall = ball.mesh.position.clone().add(new THREE.Vector3(0, 0.105, 0.1));
  grip.position.add(aboveBall.sub(head.getWorldPosition(new THREE.Vector3())));
  update(1 / 90, true);
  for (let frame = 0; frame < 25; frame++) {
    grip.position.y -= 0.005;
    update(1 / 90);
  }
  assert.equal(ball.getStrokes(), 0);
});

test('a single gentle side-on follow-through only counts one stroke', () => {
  const scene = new THREE.Scene();
  const rig = new THREE.Group();
  scene.add(rig);
  const ball = createBall(scene);
  const targets = [new THREE.Group(), new THREE.Group()];
  const grips = [new THREE.Group(), new THREE.Group()];
  const update = setupPutter({ xr: { getController: i => targets[i], getControllerGrip: i => grips[i] } },
    scene, rig, ball, { teleport() {}, reset() {}, mute() {}, alignAddress(x, z) {
      rig.position.x += x;
      rig.position.z += z;
      rig.updateMatrixWorld(true);
      return true;
    } });
  const grip = grips[0];
  const target = targets[0];
  const torso = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const worldSide = ball.mesh.position.clone().setY(0).add(new THREE.Vector3(0.65, 0, 0.30));
  const shoulder = new THREE.Vector3(0.18, 1.42, -0.01);
  const neutral = new THREE.Vector3(0.23, 0.84, -0.18);
  const neutralRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.3, 0, 0.07));
  const strokeAxis = new THREE.Vector3(0, 0, 1);
  function pose(angle) {
    const arc = new THREE.Quaternion().setFromAxisAngle(strokeAxis, angle);
    grip.position.copy(neutral).sub(shoulder).applyQuaternion(arc).add(shoulder).applyQuaternion(torso).add(worldSide);
    grip.quaternion.multiplyQuaternions(torso, arc).multiply(neutralRotation);
  }
  target.dispatchEvent({ type: 'connected', data: { targetRayMode: 'tracked-pointer', handedness: 'right' } });
  pose(0);
  target.dispatchEvent({ type: 'squeezestart' });
  update(1 / 90);
  target.dispatchEvent({ type: 'squeezeend' });
  pose(-0.14);
  update(1 / 90, true);
  for (let angle = -0.14; angle <= 0.17; angle += 0.2 / 90) {
    pose(angle);
    update(1 / 90);
    ball.update(1 / 90);
  }
  assert.equal(ball.getStrokes(), 1);
});

test('calibration fits a natural extended grip without steepening the shaft', () => {
  const pose = new THREE.Vector3(0.20, 0.84, 0.05);
  const { ball, rig, grip, head } = setupController('right', pose);
  const blade = head.getWorldPosition(new THREE.Vector3());
  const shaft = grip.getWorldPosition(new THREE.Vector3()).sub(blade);
  const lean = THREE.MathUtils.radToDeg(shaft.angleTo(new THREE.Vector3(0, 1, 0)));
  assert.ok(lean <= 20.001);
  assert.ok(rig.position.length() > 0.15);
  assert.ok(grip.position.equals(pose));
  assert.ok(Math.abs(blade.x - ball.mesh.position.x) < 1e-7);
  assert.ok(Math.abs(blade.z - ball.mesh.position.z - 0.129) < 1e-7);
  assert.equal(ball.getStrokes(), 0);
});

test('a small dip is lifted to floor level but a blade below the floor cannot strike', () => {
  const { ball, head, grip, update } = setupController();
  const address = grip.position.clone();

  function swingAt(height) {
    grip.position.copy(address);
    grip.position.y = height;
    update(1 / 90, true);
    for (let frame = 0; frame < 28; frame++) {
      grip.position.z -= 0.17 / 28;
      update(1 / 90);
    }
  }

  swingAt(address.y - 0.12);
  assert.ok(head.getWorldPosition(new THREE.Vector3()).y < 0);
  assert.equal(ball.getStrokes(), 0);
  assert.ok(ball.isAtRest());

  swingAt(address.y - 0.055);
  assert.ok(Math.abs(head.getWorldPosition(new THREE.Vector3()).y - 0.022) < 1e-6);
  assert.equal(ball.getStrokes(), 1);
});

test('walking past the ball with the thumbstick cannot count as a putt', () => {
  const { ball, rig, head, update } = setupController();
  const viewer = new THREE.Vector3(0, 1.65, 0).add(rig.position);
  const right = new THREE.Vector3(1, 0, 0);
  const gamepad = { mapping: 'xr-standard', axes: [0, 0, 0, -1], buttons: [] };
  const session = { visibilityState: 'visible', inputSources: [{ gamepad }] };

  for (let frame = 0; frame < 25; frame++) {
    const walked = walkWithThumbstick(session, rig, viewer, right, 1 / 90);
    assert.ok(walked);
    update(1 / 90, walked);
  }
  assert.ok(head.getWorldPosition(new THREE.Vector3()).z < ball.mesh.position.z);
  assert.equal(ball.getStrokes(), 0);
});
