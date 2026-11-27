import * as THREE from 'three';
import { cupEdge, isNearRoot, root, teeEdge } from './course-layout.js';

export function setupTeleport(scene, rig, ball, practice = false) {
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.115, 0.132, 36),
    new THREE.MeshBasicMaterial({ color: 0xd8e99b, transparent: true, opacity: 0.75 }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);
  let requested = null;
  const right = new THREE.Vector3(1, 0, 0);
  const viewRotation = new THREE.Quaternion();
  const viewerPosition = new THREE.Vector3();
  let hasViewer = false;

  function request(hand, stance = null) {
    requested = ball.isAtRest() ? { hand, stance } : null;
  }

  function update(xr, frame) {
    const ready = ball.isAtRest();
    marker.visible = xr.isPresenting && ready;
    const { x, z } = ball.mesh.position;
    marker.position.set(x, 0.004, z);
    const landing = requested;
    requested = null;
    const referenceSpace = xr.isPresenting ? xr.getReferenceSpace() : null;
    const pose = referenceSpace ? frame?.getViewerPose(referenceSpace) : null;
    if (pose?.transform.orientation) {
      const orientation = pose.transform.orientation;
      viewRotation.set(orientation.x, orientation.y, orientation.z, orientation.w);
      right.set(1, 0, 0).applyQuaternion(viewRotation);
      right.y = 0;
      if (right.lengthSq() < 0.001) right.set(1, 0, 0);
      right.normalize();
    }
    hasViewer = Boolean(pose);
    if (!pose) return false;
    viewerPosition.copy(pose.transform.position).add(rig.position);
    if (!landing || !marker.visible) return false;

    const viewer = pose.transform.position;
    const sideOffset = landing.hand === 'left' ? 0.30 : -0.30;
    const behind = 0.65;
    const offsetX = landing.stance?.[0] ?? right.x * sideOffset - right.z * behind;
    const offsetZ = landing.stance?.[1] ?? right.z * sideOffset + right.x * behind;
    const targetX = x + offsetX;
    let targetZ = THREE.MathUtils.clamp(z + offsetZ,
      cupEdge + 0.30, teeEdge + 0.45);
    if (!practice && isNearRoot(targetX, targetZ)) {
      targetZ = root.z + (offsetZ < 0 ? -0.32 : 0.32);
    }
    rig.position.set(targetX - viewer.x, 0, targetZ - viewer.z);
    rig.updateMatrixWorld(true);
    viewerPosition.copy(viewer).add(rig.position);
    return true;
  }

  function alignAddress(x, z) {
    if (!hasViewer) return false;
    const targetX = viewerPosition.x + x;
    const targetZ = viewerPosition.z + z;
    if (Math.abs(targetX) > 2.1 || targetZ < cupEdge - 0.35 || targetZ > teeEdge + 0.55 ||
        (!practice && isNearRoot(targetX, targetZ))) return false;

    rig.position.x += x;
    rig.position.z += z;
    rig.updateMatrixWorld(true);
    viewerPosition.x = targetX;
    viewerPosition.z = targetZ;
    return true;
  }

  return {
    request,
    alignAddress,
    update,
    right,
    getViewerPosition: () => hasViewer ? viewerPosition : null,
    cancel: () => { requested = null; },
  };
}
