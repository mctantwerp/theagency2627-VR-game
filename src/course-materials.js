import * as THREE from 'three';

function paintTexture(base, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = base;
  context.fillRect(0, 0, 256, 256);

  let seed = 31;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  paint(context, random);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

export function createTurfMaterial() {
  const map = paintTexture('#648746', (context, random) => {
    for (let index = 0; index < 17000; index++) {
      const x = random() * 256;
      const y = random() * 256;
      context.fillStyle = random() < 0.5 ? '#a6bd6d55' : '#263f2566';
      context.fillRect(x, y, 1, 1 + random() * 4);
    }
  });
  map.repeat.set(6, 16);
  return new THREE.MeshStandardMaterial({ map, roughness: 1 });
}

export function createWoodMaterial() {
  const map = paintTexture('#8e5434', (context, random) => {
    for (let index = 0; index < 260; index++) {
      const x = random() * 256;
      const y = random() * 256;
      const length = 10 + random() * 130;
      context.strokeStyle = random() < 0.55 ? '#44231945' : '#e1a86855';
      context.lineWidth = 0.5 + random() * 2.2;
      context.beginPath();
      context.moveTo(x, y);
      context.bezierCurveTo(x + length * 0.3, y - 7, x + length * 0.7, y + 5, x + length, y);
      context.stroke();
    }
  });
  return new THREE.MeshStandardMaterial({ map, roughness: 0.86 });
}

export function createForestFloorMaterial() {
  const map = paintTexture('#526048', (context, random) => {
    for (let index = 0; index < 720; index++) {
      const x = random() * 256;
      const y = random() * 256;
      const radius = 4 + random() * 17;
      const color = random() < 0.53 ? '#9b98762a' : '#26342955';
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, '#00000000');
      context.fillStyle = gradient;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    for (let index = 0; index < 6500; index++) {
      context.fillStyle = random() < 0.54 ? '#a4a37b66' : '#252d2559';
      context.fillRect(random() * 256, random() * 256, 1, 1 + random() * 2);
    }
  });
  map.repeat.set(42, 42);
  return new THREE.MeshStandardMaterial({ map, roughness: 1 });
}
