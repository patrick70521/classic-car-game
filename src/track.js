export const STRAIGHT = 48
export const RADIUS = 18
export const HALF_WIDTH = 5.5
export const ARC = Math.PI * RADIUS
export const PERIM = STRAIGHT * 2 + ARC * 2
export const CHECKPOINT_RADIUS = 9
export const TREE_RADIUS = 0.8
export const LIMIT = 116
export const STREET_HALF = 5.2

const HALF = STRAIGHT / 2

export const CHECKPOINT_T = [
  HALF / PERIM,
  (STRAIGHT + ARC / 2) / PERIM,
  (STRAIGHT + ARC + HALF) / PERIM,
  (STRAIGHT + ARC + STRAIGHT + ARC / 2) / PERIM,
]

export const CHECKPOINT_NAMES = ['START', 'GATE 1', 'GATE 2', 'GATE 3']

export const CHRISTMAS = { x: 0, z: 0, r: 2.7 }

const LONG = 112
const H = STREET_HALF

export const STREETS = [
  { x: 0, z: -24, halfX: LONG, halfZ: 8 },
  { x: 0, z: 24, halfX: LONG, halfZ: 8 },
  { x: 0, z: -58, halfX: LONG, halfZ: H },
  { x: 0, z: 58, halfX: LONG, halfZ: H },
  { x: 0, z: -88, halfX: LONG, halfZ: H },
  { x: 0, z: 88, halfX: LONG, halfZ: H },
  { x: -66, z: 0, halfX: H, halfZ: LONG },
  { x: 66, z: 0, halfX: H, halfZ: LONG },
  { x: -94, z: 0, halfX: H, halfZ: LONG },
  { x: 94, z: 0, halfX: H, halfZ: LONG },
  { x: -50, z: 0, halfX: 18, halfZ: 10 },
  { x: 50, z: 0, halfX: 18, halfZ: 10 },
]

export const BUILDINGS = [
  { x: -80, z: -73, w: 12, d: 9, h: 36, color: '#2a242c' },
  { x: -40, z: -73, w: 10, d: 8, h: 30, color: '#243044' },
  { x: 0, z: -73, w: 14, d: 9, h: 44, color: '#3a2430' },
  { x: 40, z: -73, w: 10, d: 8, h: 32, color: '#2c2830' },
  { x: 80, z: -73, w: 12, d: 9, h: 34, color: '#1e3040' },
  { x: -80, z: -43, w: 11, d: 8, h: 30, color: '#342830' },
  { x: -40, z: -43, w: 10, d: 8, h: 40, color: '#243448' },
  { x: 0, z: -43, w: 12, d: 8, h: 48, color: '#3a2834' },
  { x: 40, z: -43, w: 10, d: 8, h: 34, color: '#2a3038' },
  { x: 80, z: -43, w: 11, d: 8, h: 30, color: '#243040' },
  { x: -80, z: 0, w: 10, d: 12, h: 46, color: '#2e2434' },
  { x: 80, z: 0, w: 10, d: 12, h: 42, color: '#1c3044' },
  { x: -80, z: 43, w: 11, d: 8, h: 30, color: '#322830' },
  { x: -40, z: 43, w: 10, d: 8, h: 36, color: '#243848' },
  { x: 0, z: 43, w: 12, d: 8, h: 52, color: '#3c2432' },
  { x: 40, z: 43, w: 10, d: 8, h: 40, color: '#2a323c' },
  { x: 80, z: 43, w: 11, d: 8, h: 32, color: '#203044' },
  { x: -80, z: 73, w: 12, d: 9, h: 34, color: '#2a242c' },
  { x: -40, z: 73, w: 10, d: 8, h: 30, color: '#243044' },
  { x: 0, z: 73, w: 14, d: 9, h: 46, color: '#3a2430' },
  { x: 40, z: 73, w: 10, d: 8, h: 36, color: '#2c2830' },
  { x: 80, z: 73, w: 12, d: 9, h: 30, color: '#1e3040' },
]

export const TAIPEI_101 = { x: 18, z: -108, r: 8 }

export const TREES = [
  { x: -22, z: -43, s: 1.15 },
  { x: 22, z: -43, s: 1 },
  { x: -22, z: 43, s: 1.2 },
  { x: 22, z: 43, s: 0.95 },
  { x: -58, z: -43, s: 1.25 },
  { x: 58, z: 43, s: 1.15 },
  { x: -108, z: -46, s: 1.3 },
  { x: 108, z: 44, s: 1.2 },
  { x: -18, z: -100, s: 1.35 },
  { x: 24, z: 102, s: 1.15 },
]

export function boundingRadius(w, d) {
  return Math.hypot(w, d) / 2
}

export function pointOnLoop(t) {
  const wrapped = ((t % 1) + 1) % 1
  let d = wrapped * PERIM
  if (d < STRAIGHT) {
    return { x: -HALF + d, z: -RADIUS, heading: 0 }
  }
  d -= STRAIGHT
  if (d < ARC) {
    const a = -Math.PI / 2 + d / RADIUS
    return {
      x: HALF + Math.cos(a) * RADIUS,
      z: Math.sin(a) * RADIUS,
      heading: a + Math.PI / 2,
    }
  }
  d -= ARC
  if (d < STRAIGHT) {
    return { x: HALF - d, z: RADIUS, heading: Math.PI }
  }
  d -= STRAIGHT
  const a = Math.PI / 2 + d / RADIUS
  return {
    x: -HALF + Math.cos(a) * RADIUS,
    z: Math.sin(a) * RADIUS,
    heading: a + Math.PI / 2,
  }
}

export function projectT(x, z) {
  if (x >= HALF) {
    let a = Math.atan2(z, x - HALF)
    if (a < -Math.PI / 2) a += Math.PI * 2
    return (STRAIGHT + (a + Math.PI / 2) * RADIUS) / PERIM
  }
  if (x <= -HALF) {
    let a = Math.atan2(z, x + HALF)
    if (a < 0) a += Math.PI * 2
    return (STRAIGHT + ARC + STRAIGHT + (a - Math.PI / 2) * RADIUS) / PERIM
  }
  if (z >= 0) return (STRAIGHT + ARC + (HALF - x)) / PERIM
  return (x + HALF) / PERIM
}

export function distToCenterline(x, z) {
  const cx = Math.max(-HALF, Math.min(HALF, x))
  return Math.abs(Math.hypot(x - cx, z) - RADIUS)
}

export function isOnOval(x, z) {
  return distToCenterline(x, z) <= HALF_WIDTH
}

export function isOnStreet(x, z) {
  for (const street of STREETS) {
    if (Math.abs(x - street.x) <= street.halfX && Math.abs(z - street.z) <= street.halfZ) return true
  }
  return false
}

export function isOnRoad(x, z) {
  return isOnOval(x, z) || isOnStreet(x, z)
}

export function yawForHeading(heading) {
  return Math.PI / 2 - heading
}

export function startPose() {
  const gate = pointOnLoop(CHECKPOINT_T[0])
  const back = 10
  return {
    x: gate.x - Math.cos(gate.heading) * back,
    z: gate.z - Math.sin(gate.heading) * back,
    heading: gate.heading,
  }
}

export function checkpointPoses() {
  return CHECKPOINT_T.map((t, index) => {
    const pose = pointOnLoop(t)
    return { ...pose, name: CHECKPOINT_NAMES[index] }
  })
}
