import assert from 'node:assert/strict';
import test from 'node:test';
import { Euler, Group, Quaternion, Raycaster, Scene, Vector2, Vector3 } from 'three';
import { createBall } from '../src/ball.js';
import { roomCourse, roomCourses } from '../src/course-layout.js';
import { createRoomCourse, getRoomPlacement, setupRoomPlacement } from '../src/room-course.js';
import { setupHomeShortcut } from '../src/xr-controls.js';

function poseAt(x, y, z, pitch, yaw = 0) {
  return { transform: {
    position: new Vector3(x, y, z),
    orientation: new Quaternion().setFromEuler(new Euler(pitch, yaw, 0, 'YXZ')),
  } };
}

test('the placement ray hits the real floor only when looking down at a reachable spot', () => {
  const point = new Vector3();
  const aim = pose => getRoomPlacement(pose, point, new Quaternion(), new Vector3());
  assert.equal(aim(poseAt(0, 1.65, 0, 0)), null);
  assert.equal(aim(poseAt(0, 1.65, 0, -0.22)), null);
  assert.ok(Math.abs(aim(poseAt(1, 1.65, 2, -Math.PI / 4, Math.PI / 2)) - Math.PI / 2) < 1e-8);
  assert.ok(point.distanceTo(new Vector3(-0.65, 0, 2)) < 1e-8);
});

test('the room lane is locked in place after confirmation and clears on reference-space reset', (t) => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) };
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });

  const scene = new Scene();
  const course = new Group();
  const rig = new Group();
  scene.add(course, rig);
  const selected = [];
  const showRoomCourse = createRoomCourse(course);
  const placement = setupRoomPlacement(scene, course, rig, (_, index) => {
    showRoomCourse(index);
    selected.push(index);
  });
  placement.reset(true);
  const xr = { isPresenting: true, getReferenceSpace: () => ({}) };
  let pose = poseAt(1, 1.65, 2, 0);
  const stick = { mapping: 'xr-standard', axes: [0, 0, 0, 0], buttons: [] };
  const leftTrigger = { pressed: true };
  const frame = { session: {
    visibilityState: 'visible',
    inputSources: [
      { handedness: 'right', gamepad: stick },
      { handedness: 'left', gamepad: { mapping: 'xr-standard', axes: [], buttons: [leftTrigger] } },
    ],
  }, getViewerPose: () => pose };

  assert.ok(placement.request());
  assert.equal(placement.update(xr, frame), false);
  assert.equal(course.visible, false);
  pose = poseAt(1, 1.65, 2, -Math.PI / 4, Math.PI / 2);
  stick.axes[2] = 0.9;
  assert.equal(placement.update(xr, frame), false);
  assert.equal(placement.update(xr, frame), false);
  assert.deepEqual(selected, [1, 2]);
  stick.axes[2] = 0;
  stick.buttons[4] = { pressed: true };
  placement.update(xr, frame);
  placement.update(xr, frame);
  assert.deepEqual(selected, [1, 2, 1]);
  stick.buttons[4].pressed = false;
  stick.buttons[5] = { pressed: true };
  placement.update(xr, frame);
  assert.deepEqual(selected, [1, 2, 1, 2]);
  for (let step = 0; step < 3; step++) {
    stick.buttons[5].pressed = false;
    placement.update(xr, frame);
    stick.buttons[5].pressed = true;
    placement.update(xr, frame);
  }
  assert.deepEqual(selected, [1, 2, 1, 2, 3, 4, 0]);
  stick.buttons[5].pressed = false;
  stick.buttons[4].pressed = true;
  placement.update(xr, frame);
  assert.equal(selected.at(-1), 4);
  const selectionCount = selected.length;
  assert.ok(placement.request());
  assert.ok(placement.update(xr, frame));
  assert.ok(placement.canPutt());
  assert.ok(course.visible);
  assert.ok(new Vector3(-0.65, 0, 2).applyMatrix4(rig.matrixWorld).length() < 1e-8);
  course.updateMatrixWorld(true);
  const floorRay = new Raycaster(new Vector3(0.3, 1, -0.4), new Vector3(0, -1, 0));
  assert.equal(floorRay.intersectObject(course, true).length, 0);
  floorRay.ray.origin.x = roomCourse.width / 2 + 0.018;
  assert.ok(floorRay.intersectObject(course, true).length > 0);
  const bumper = roomCourses[4].obstacles[0];
  floorRay.ray.origin.set(bumper.x, 1, bumper.z);
  assert.ok(floorRay.intersectObject(course, true).some(({ object, point }) =>
    object.parent.visible && Math.abs(point.y - bumper.height) < 1e-8));

  const anchored = rig.matrixWorld.clone();
  const firstPosition = placement.getViewerPosition().clone();
  pose = poseAt(0.5, 1.65, 2, -0.4);
  assert.equal(placement.request(), false);
  assert.equal(placement.update(xr, frame), false);
  assert.ok(rig.matrixWorld.equals(anchored));
  assert.equal(selected.length, selectionCount);
  assert.ok(Math.abs(placement.getViewerPosition().distanceTo(firstPosition) - 0.5) < 1e-8);
  assert.equal(placement.canStrike(), false);
  leftTrigger.pressed = false;
  stick.buttons[0] = { pressed: true };
  placement.update(xr, frame);
  assert.equal(placement.canStrike(), false);
  leftTrigger.pressed = true;
  placement.update(xr, frame);
  assert.equal(placement.canStrike(), true);
  leftTrigger.pressed = false;
  placement.update(xr, frame);
  assert.equal(placement.canStrike(), false);
  leftTrigger.pressed = true;
  placement.update(xr, frame);
  assert.equal(placement.canStrike(), true);

  frame.session.visibilityState = 'visible-blurred';
  placement.update(xr, frame);
  assert.equal(placement.canPutt(), false);
  assert.equal(placement.canStrike(), false);
  frame.session.visibilityState = 'visible';
  placement.update(xr, frame);
  assert.equal(placement.canStrike(), false);
  placement.reset(true);
  assert.equal(course.visible, false);
  assert.equal(placement.canPutt(), false);
});

test('holding the left X button ends the XR session before returning to the start screen', async () => {
  const events = [];
  const update = setupHomeShortcut(() => events.push('home'));
  const x = { pressed: false };
  const session = {
    visibilityState: 'visible',
    inputSources: [
      { handedness: 'left', gamepad: { mapping: 'xr-standard', buttons: [null, null, null, null, x] } },
      { handedness: 'right', gamepad: { mapping: 'xr-standard', buttons: [null, null, null, null, { pressed: true }] } },
    ],
    async end() { events.push('end'); },
  };
  for (let frame = 0; frame < 10; frame++) update(session, 0.1);
  x.pressed = true;
  for (let frame = 0; frame < 5; frame++) update(session, 0.1);
  assert.deepEqual(events, []);
  update(session, 1);
  for (let frame = 0; frame < 5; frame++) update(session, 0.1);
  assert.deepEqual(events, []);
  await update(session, 0.1);
  await update(session, 0.1);
  await update(session, 0.1);
  assert.deepEqual(events, ['end', 'home']);
});

test('the room ball uses the smaller lane and its offset cup', () => {
  const ball = createBall(new Scene(), undefined, true, roomCourse);
  const start = ball.mesh.position.clone();
  assert.equal(start.z, roomCourse.startZ);
  const speed = 1.62;
  const velocity = new Vector3(roomCourse.cup.x, 0, roomCourse.cup.z - start.z).setLength(speed);
  assert.ok(ball.strike(velocity.x, velocity.z));
  for (let frame = 0; frame < 400 && !ball.isHoled(); frame++) ball.update(1 / 90);
  assert.ok(ball.isHoled());
  assert.equal(ball.mesh.position.y, ball.radius - roomCourse.cup.depth);

  ball.reset();
  assert.ok(ball.mesh.position.equals(start));
  assert.ok(ball.strike(3, 0));
  for (let frame = 0; frame < 500 && !ball.isAtRest(); frame++) {
    ball.update(1 / 90);
    assert.ok(Math.abs(ball.mesh.position.x) <= roomCourse.width / 2 - ball.radius + 1e-8);
  }
});

test('the slalom blocks a direct putt and every obstacle layout can be finished', () => {
  const ball = createBall(new Scene(), undefined, true, roomCourses[2]);
  assert.ok(ball.strike(0, -1.6));
  let reached = ball.mesh.position.z;
  for (let frame = 0; frame < 400 && !ball.isAtRest(); frame++) {
    ball.update(1 / 90);
    reached = Math.min(reached, ball.mesh.position.z);
  }
  assert.ok(reached >= roomCourses[2].obstacles[0].maxZ + ball.radius - 1e-8);

  const routes = [
    [[0, -1.30], [0.17, -1.78]],
    [[0.34, -0.55], [0.34, -0.99], [-0.34, -0.99], [-0.34, -1.78]],
    [[-0.355, -0.54], [-0.355, -1.035], [0.335, -1.035], [0.335, -1.58], [0.32, -1.83]],
    [[0.39, -0.51], [0.39, -1.065], [0.05, -1.23], [0.02, -1.58], [-0.14, -1.83]],
  ];
  for (const [index, route] of routes.entries()) {
    ball.setLayout(roomCourses[index + 1]);
    assert.equal(ball.getStrokes(), 0);
    for (const [x, z] of route) {
      const travel = new Vector2(x - ball.mesh.position.x, z - ball.mesh.position.z);
      const velocity = travel.setLength(Math.sqrt(travel.length() * 1.6) + 0.01);
      assert.ok(ball.strike(velocity.x, velocity.y));
      for (let frame = 0; frame < 400 && !ball.isAtRest() && !ball.isHoled(); frame++) ball.update(1 / 90);
    }
    assert.ok(ball.isHoled(), roomCourses[index + 1].name);
    assert.equal(ball.getStrokes(), route.length);
  }
});

test('a glancing shot deflects sideways off a round bumper', () => {
  const ball = createBall(new Scene(), undefined, true, roomCourses[4]);
  ball.mesh.position.x = 0.19;
  assert.ok(ball.strike(0, -1.6));
  for (let frame = 0; frame < 35; frame++) ball.update(1 / 90);
  assert.ok(ball.mesh.position.x > 0.35);
  assert.ok(ball.mesh.position.z > -0.65);
});
