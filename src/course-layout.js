export const teeEdge = 2;
export const cupEdge = -6;
export const root = { minX: -0.64, maxX: 0.74, z: -2.83, depth: 0.32, height: 0.25 };
export const spring = { x: 0.18, z: -2.13, radius: 0.24 };
export const cup = { x: 0, z: -5, radius: 0.205, depth: 0.24 };

export function isNearRoot(x, z) {
  return x > root.minX - 0.16 && x < root.maxX + 0.16 && Math.abs(z - root.z) < 0.30;
}

export const forestCourse = { width: 3.2, teeEdge, cupEdge, cup, startZ: -0.65 };
export const roomCourse = {
  width: 1.35,
  teeEdge: 0.25,
  cupEdge: -2.10,
  startZ: -0.30,
  cup: { x: 0.27, z: -1.78, radius: 0.16, depth: 0.16 },
};
