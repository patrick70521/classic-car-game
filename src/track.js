export const STRAIGHT = 48
export const RADIUS = 18
export const HALF_WIDTH = 5.5
export const ARC = Math.PI * RADIUS
export const PERIM = STRAIGHT * 2 + ARC * 2
export const CHECKPOINT_RADIUS = 9
export const TREE_RADIUS = 0.8
export const LIMIT = 108

const HALF = STRAIGHT / 2

export const CHECKPOINT_T = [
  HALF / PERIM,
  (STRAIGHT + ARC / 2) / PERIM,
  (STRAIGHT + ARC + HALF) / PERIM,
  (STRAIGHT + ARC + STRAIGHT + ARC / 2) / PERIM,
]

export const CHECKPOINT_NAMES = ['START', 'GATE 1', 'GATE 2', 'GATE 3']

export const FOUNTAIN = { x: 0, z: 0, r: 3.6 }

export const BUILDINGS = [
  { x: 0, z: -48, w: 16, d: 10, h: 9, color: '#e6d3ad' },
  { x: 36, z: -40, w: 12, d: 10, h: 14, color: '#d07a52' },
  { x: 68, z: 0, w: 10, d: 16, h: 16, color: '#7ea4c8' },
  { x: 40, z: 36, w: 12, d: 10, h: 11, color: '#efe6d2' },
  { x: -6, z: 44, w: 18, d: 10, h: 8, color: '#c9846a' },
  { x: -70, z: 8, w: 10, d: 18, h: 13, color: '#8e9a78' },
  { x: -46, z: -40, w: 12, d: 10, h: 10, color: '#d8b48a' },
  { x: 62, z: 30, w: 11, d: 11, h: 12, color: '#b7c4ce' },
  { x: -62, z: -28, w: 12, d: 12, h: 9, color: '#c46b4a' },
]

export const TREES = [
  { x: 8, z: 2, s: 1.05 },
  { x: -7, z: 4, s: 0.9 },
  { x: 2, z: -8, s: 1.15 },
  { x: -4, z: -6, s: 1 },
  { x: 6, z: -5, s: 0.85 },
  { x: -8, z: -2, s: 1.1 },
  { x: 20, z: -52, s: 1.25 },
  { x: -22, z: -54, s: 1.1 },
  { x: 52, z: -24, s: 1.35 },
  { x: 82, z: 16, s: 1.2 },
  { x: 52, z: 50, s: 1.4 },
  { x: 8, z: 58, s: 1.15 },
  { x: -30, z: 54, s: 1.3 },
  { x: -84, z: 26, s: 1.35 },
  { x: -86, z: -12, s: 1.1 },
  { x: -36, z: -56, s: 1.25 },
  { x: 28, z: 60, s: 1 },
  { x: 74, z: -38, s: 1.2 },
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

export function isOnRoad(x, z) {
  return distToCenterline(x, z) <= HALF_WIDTH
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
