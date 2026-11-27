import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, Vector3 } from 'three';
import { walkWithThumbstick } from '../src/walking.js';

function setupWalk(x, y) {
  const rig = new Group();
  const viewer = new Vector3(0, 1.65, 0);
  const right = new Vector3(1, 0, 0);
  const gamepad = { mapping: 'xr-standard', axes: [0, 0, x, y], buttons: [] };
  const session = { visibilityState: 'visible', inputSources: [{ gamepad }] };
  const walk = (practice = false) => walkWithThumbstick(session, rig, viewer, right, 1 / 90, practice);
  return { rig, viewer, right, gamepad, session, walk };
}

test('either Quest thumbstick walks in the viewing direction and keeps floor height', () => {
  const { rig, viewer, right, session, walk } = setupWalk(0, -1);
  session.inputSources.unshift({ gamepad: null });
  assert.ok(walk());
  assert.ok(viewer.z < 0);
  assert.equal(rig.position.z, viewer.z);
  assert.equal(rig.position.y, 0);
  assert.equal(viewer.y, 1.65);

  right.set(0, 0, -1);
  const previousZ = viewer.z;
  assert.ok(walk());
  assert.ok(viewer.x < 0);
  assert.equal(viewer.z, previousZ);
});

test('thumbstick drift and inactive sessions leave the rig available for real walking', () => {
  const { rig, viewer, gamepad, session, walk } = setupWalk(0.10, -0.08);
  assert.equal(walk(), false);
  assert.equal(rig.position.lengthSq(), 0);

  gamepad.axes[3] = -1;
  session.visibilityState = 'visible-blurred';
  assert.equal(walk(), false);
  session.visibilityState = 'visible';
  gamepad.buttons[1] = { pressed: true };
  assert.equal(walk(), false);
  assert.equal(viewer.z, 0);
});

test('virtual walking stops at the root and the edge of the map', () => {
  const { viewer, gamepad, walk } = setupWalk(0, -1);
  viewer.z = -2.52;
  assert.equal(walk(), false);
  assert.ok(walk(true));

  viewer.set(2.545, 1.65, 0);
  gamepad.axes[2] = 1;
  gamepad.axes[3] = 0;
  assert.ok(walk());
  assert.equal(viewer.x, 2.55);
  assert.equal(walk(), false);

  viewer.x = 2.8;
  gamepad.axes[2] = -1;
  assert.ok(walk());
  assert.ok(viewer.x < 2.8 && viewer.x > 2.55);
});
