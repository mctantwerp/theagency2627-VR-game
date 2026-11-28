import * as THREE from 'three';

const palettes = [
  { name: 'Lichte eik', base: 0xd1ad82, trim: 0x796456, bumper: 0x606d5e, track: 0x596e63, accent: 0xffd59c, wood: true },
  { name: 'Grafiet', base: 0x545b64, trim: 0xa6b5c2, bumper: 0x365c72, track: 0x35434f, accent: 0xafe7ff },
  { name: 'Donker hout', base: 0x79503d, trim: 0xc0865e, bumper: 0x6b465a, track: 0x5e3e55, accent: 0xffba8d, wood: true },
];

function createGrain() {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const bend = 0.7 * Math.sin(x * 0.042 + y * 0.073) + 0.33 * Math.sin(x * 0.12);
      const grain = Math.sin(y * 0.57 + bend) * Math.sin(y * 0.17 + bend);
      const shade = Math.round(245 - 13 * grain ** 2);
      pixels.set([shade, shade, shade, 255], (y * size + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createRoomAppearance() {
  const grain = createGrain();
  const play = {
    foot: new THREE.MeshStandardMaterial({ color: 0x323a35, roughness: 0.91 }),
    body: new THREE.MeshStandardMaterial({ roughness: 0.74 }),
    trim: new THREE.MeshStandardMaterial({ roughness: 0.48, metalness: 0.22 }),
    bumper: new THREE.MeshStandardMaterial({ roughness: 0.86 }),
    track: new THREE.MeshStandardMaterial({ roughness: 0.58, side: THREE.DoubleSide }),
    accent: new THREE.MeshBasicMaterial(),
  };
  const ghost = { transparent: true, opacity: 0.65, depthWrite: false };
  const preview = {
    body: new THREE.MeshBasicMaterial(ghost),
    track: new THREE.MeshBasicMaterial({ ...ghost, side: THREE.DoubleSide }),
    accent: new THREE.MeshBasicMaterial(),
  };
  let index = 0;
  try {
    const saved = globalThis.localStorage?.getItem('lichtvallei.room-style');
    const match = palettes.findIndex(({ name }) => name === saved);
    if (match >= 0) index = match;
  } catch {
    // The style can still be set for this session.
  }

  function apply() {
    const { base, trim, bumper, track, accent, wood } = palettes[index];
    play.body.color.setHex(base);
    const map = wood ? grain : null;
    if (play.body.map !== map) {
      play.body.map = map;
      play.body.needsUpdate = true;
    }
    play.trim.color.setHex(trim);
    play.bumper.color.setHex(bumper);
    play.track.color.setHex(track);
    play.accent.color.setHex(accent);
    preview.body.color.setHex(base);
    preview.track.color.setHex(track);
    preview.accent.color.setHex(accent);
  }

  apply();
  return {
    play, preview,
    name: () => palettes[index].name,
    next() {
      index = (index + 1) % palettes.length;
      apply();
      try {
        globalThis.localStorage?.setItem('lichtvallei.room-style', palettes[index].name);
      } catch {
        // The game stays playable when storage is unavailable.
      }
    },
  };
}
