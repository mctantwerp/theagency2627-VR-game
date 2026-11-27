import * as THREE from 'three';

export function setupScore(scene, ball, room = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.PlaneGeometry(1.06, 0.353);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const displays = room ? [[-0.76, -0.62, 0.55], [0.74, -1.88, -0.45]]
    : [[-1.92, -1.2, 0.62], [1.92, -4.65, -0.75]];
  for (const [x, z, angle] of displays) {
    const sign = new THREE.Mesh(geometry, material);
    sign.position.set(x, room ? 0.45 : 1.08, z);
    if (room) sign.scale.setScalar(0.62);
    sign.rotation.y = angle;
    scene.add(sign);
  }
  const desktopScore = document.getElementById('score');
  let previousText;
  let previousHint;
  let hint = 'Houd grip vast om de putter af te stellen.';
  const desktopHint = document.getElementById('putter-guide');

  function update() {
    const strokes = ball.getStrokes();
    const text = strokes === 1 ? '1 slag' : `${strokes} slagen`;
    const message = ball.isHoled() ? `Uitgespeeld in ${text}` : text;
    const status = ball.isHoled() ? `${room ? 'Rechtertrigger' : 'Trigger'} • opnieuw spelen` : hint;
    if (message === previousText && status === previousHint) return;

    previousText = message;
    previousHint = status;
    desktopScore.textContent = message;
    desktopHint.textContent = status;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#182f2b';
    context.beginPath();
    context.roundRect(4, 4, 760, 248, 28);
    context.fill();
    context.textAlign = 'center';
    context.fillStyle = '#f2e5bd';
    context.font = '600 52px system-ui';
    context.fillText(message, 384, 101);
    context.fillStyle = '#e3e8da';
    context.font = '34px system-ui';
    context.fillText(status, 384, 164, 702);
    context.font = '27px system-ui';
    context.fillText(room ? 'Houd X vast • Startscherm' : 'Duimstick • Rondlopen   |   Houd X vast • Startscherm', 384, 213);
    texture.needsUpdate = true;
  }

  return { update, message: (text) => { hint = text; } };
}
