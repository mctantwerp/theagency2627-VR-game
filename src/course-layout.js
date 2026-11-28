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
  name: 'Rechte putt',
  obstacles: [],
  width: 1.35,
  teeEdge: 0.25,
  cupEdge: -2.10,
  startZ: -0.30,
  cup: { x: 0.27, z: -1.78, radius: 0.16, depth: 0.16 },
};

export const roomCourses = [
  roomCourse,
  {
    ...roomCourse,
    name: 'Smalle poort',
    cup: { ...roomCourse.cup, x: 0.17 },
    obstacles: [
      { minX: -0.675, maxX: -0.16, minZ: -1.09, maxZ: -0.92, height: 0.12 },
      { minX: 0.16, maxX: 0.675, minZ: -1.09, maxZ: -0.92, height: 0.12 },
    ],
  },
  {
    ...roomCourse,
    name: 'Slalom',
    cup: { ...roomCourse.cup, x: -0.34 },
    obstacles: [
      { minX: -0.675, maxX: 0.11, minZ: -0.80, maxZ: -0.68, height: 0.10 },
      { minX: -0.11, maxX: 0.675, minZ: -1.33, maxZ: -1.20, height: 0.10 },
    ],
  },
  {
    ...roomCourse,
    name: 'Dubbele poort',
    cup: { ...roomCourse.cup, x: 0.32, z: -1.83, radius: 0.14 },
    obstacles: [
      { minX: -0.675, maxX: -0.49, minZ: -0.80, maxZ: -0.70, height: 0.11 },
      { minX: -0.22, maxX: 0.675, minZ: -0.80, maxZ: -0.70, height: 0.11 },
      { minX: -0.675, maxX: 0.20, minZ: -1.40, maxZ: -1.30, height: 0.11 },
      { minX: 0.47, maxX: 0.675, minZ: -1.40, maxZ: -1.30, height: 0.11 },
    ],
  },
  {
    ...roomCourse,
    name: 'Flipperkast',
    cup: { ...roomCourse.cup, x: -0.14, z: -1.83, radius: 0.14 },
    obstacles: [
      { x: 0.02, z: -0.83, radius: 0.22, height: 0.14 },
      { x: -0.34, z: -1.34, radius: 0.16, height: 0.12 },
      { x: 0.375, z: -1.36, radius: 0.13, height: 0.11 },
    ],
  },
  {
    ...roomCourse,
    name: 'De Looping',
    cup: { ...roomCourse.cup, x: 0.36, z: -1.83, radius: 0.15 },
    loop: { entryZ: -0.89, exitZ: -1.34, exitX: 0.36, radius: 0.315, width: 0.27 },
    obstacles: [
      { minX: -0.675, maxX: -0.135, minZ: -1.04, maxZ: -0.87, height: 0.08 },
      { minX: 0.135, maxX: 0.675, minZ: -1.04, maxZ: -0.87, height: 0.08 },
    ],
  },
];

export const defaultRoomCourseIndex = 1;
