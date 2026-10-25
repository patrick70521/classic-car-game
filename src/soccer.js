import * as THREE from 'three'

const HALF_W = 16
const HALF_L = 26
const GOAL_HALF = 3.5
const GOAL_H = 2.4
const BALL_R = 0.32
const RUN = 7.4

export function createSoccer() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#8ec8ef')
  scene.fog = new THREE.Fog('#8ec8ef', 28, 70)

  const hemi = new THREE.HemisphereLight('#e7f4ff', '#3e7a34', 0.9)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight('#fff6e4', 1.35)
  sun.position.set(-18, 28, 12)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -30
  sun.shadow.camera.right = 30
  sun.shadow.camera.top = 36
  sun.shadow.camera.bottom = -36
  sun.shadow.camera.near = 2
  sun.shadow.camera.far = 80
  scene.add(sun)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 100),
    new THREE.MeshStandardMaterial({ color: '#2c6b32', roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_W * 2 + 1.2, HALF_L * 2 + 1.2),
    new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.95 }),
  )
  pitch.rotation.x = -Math.PI / 2
  pitch.position.y = 0.012
  pitch.receiveShadow = true
  scene.add(pitch)

  addMarkings(scene)
  addGoal(scene, 1)
  addGoal(scene, -1)

  const player = { x: 0, z: -8, heading: 0, vx: 0, vz: 0 }
  const ai = { x: 0, z: 10, heading: Math.PI }
  const keeperFar = { x: 0, z: HALF_L - 2.2, heading: Math.PI }
  const keeperNear = { x: 0, z: -HALF_L + 2.2, heading: 0 }
  const ball = { x: 0, y: BALL_R, z: -6.2, vx: 0, vy: 0, vz: 0 }

  const youKit = createAthlete('#1d4ed8', '#f4f4f4')
  const aiKit = createAthlete('#dc2626', '#f4f4f4')
  const farKit = createAthlete('#eab308', '#111111')
  const nearKit = createAthlete('#16a34a', '#111111')
  scene.add(youKit.root, aiKit.root, farKit.root, nearKit.root)

  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 18, 14),
    new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.42 }),
  )
  ballMesh.castShadow = true
  const ballShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 16),
    new THREE.MeshBasicMaterial({ color: '#102010', transparent: true, opacity: 0.35 }),
  )
  ballShadow.rotation.x = -Math.PI / 2
  scene.add(ballMesh, ballShadow)

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 120)
  const spinAxis = new THREE.Vector3()
  let you = 0
  let them = 0
  let message = ''
  let messageTime = 0
  let kickLock = 0
  let clock = 0
  let snap = true

  function resetPositions() {
    player.x = 0
    player.z = -8
    player.heading = 0
    player.vx = 0
    player.vz = 0
    ai.x = 0
    ai.z = 11
    ai.heading = Math.PI
    keeperFar.x = 0
    keeperNear.x = 0
    ball.x = 0
    ball.y = BALL_R
    ball.z = -6.5
    ball.vx = 0
    ball.vy = 0
    ball.vz = 0
    snap = true
  }

  function reset() {
    you = 0
    them = 0
    message = ''
    messageTime = 0
    kickLock = 0
    resetPositions()
    sync(0)
    aimCamera(1)
  }

  function status() {
    return { you, them, message }
  }

  function update(dt, input, kick) {
    clock += dt
    kickLock = Math.max(0, kickLock - dt)
    if (messageTime > 0) {
      messageTime -= dt
      if (messageTime <= 0) {
        message = ''
        resetPositions()
      }
      sync(0)
      aimCamera(dt)
      return
    }

    movePlayer(dt, input)
    moveChaser(dt)
    moveKeeper(keeperFar, 1, dt)
    moveKeeper(keeperNear, -1, dt)
    separate(player, ai)
    if (kick) tryKick()
    stepBall(dt)
    keepersTouchBall()
    containBall()
    checkGoal()
    sync(dt)
    aimCamera(dt)
  }

  function movePlayer(dt, input) {
    const ix = (input.held.left ? 1 : 0) - (input.held.right ? 1 : 0)
    const iz = (input.held.up ? 1 : 0) - (input.held.down ? 1 : 0)
    const len = Math.hypot(ix, iz)
    if (len > 0) {
      const dx = ix / len
      const dz = iz / len
      player.vx = dx * RUN
      player.vz = dz * RUN
      player.heading = lerpAngle(player.heading, Math.atan2(dx, dz), 1 - Math.exp(-14 * dt))
    } else {
      player.vx *= Math.max(0, 1 - 14 * dt)
      player.vz *= Math.max(0, 1 - 14 * dt)
    }
    player.x = clamp(player.x + player.vx * dt, -HALF_W + 0.7, HALF_W - 0.7)
    player.z = clamp(player.z + player.vz * dt, -HALF_L + 0.7, HALF_L - 0.7)
  }

  function moveChaser(dt) {
    const targetZ = Math.max(ball.z, 1)
    const dx = ball.x - ai.x
    const dz = targetZ - ai.z
    const dist = Math.hypot(dx, dz) || 1
    const step = 4.3 * dt
    ai.x = clamp(ai.x + (dx / dist) * step, -HALF_W + 1, HALF_W - 1)
    ai.z = clamp(ai.z + (dz / dist) * step, 0.4, HALF_L - 2.4)
    if (dist > 0.2) ai.heading = Math.atan2(dx / dist, dz / dist)
    const playerDist = flatDist(player, ball)
    const aiDist = flatDist(ai, ball)
    if (aiDist < 0.95 && playerDist > 1.45 && ball.y < 1.3 && kickLock <= 0) {
      const aimX = clamp(-ball.x * 0.35, -6, 6)
      ball.vx = aimX
      ball.vz = -13
      ball.vy = 3.2
      kickLock = 0.45
    }
  }

  function moveKeeper(keeper, side, dt) {
    const homeZ = side * (HALF_L - 2.2)
    const targetX = clamp(ball.x, -GOAL_HALF + 0.5, GOAL_HALF - 0.5)
    const maxStep = 3.4 * dt
    keeper.x += clamp(targetX - keeper.x, -maxStep, maxStep)
    keeper.z = homeZ
    keeper.heading = side > 0 ? Math.PI : 0
  }

  function tryKick() {
    const dist = flatDist(player, ball)
    if (dist > 2 || ball.y > 1.5) return
    const fx = Math.sin(player.heading)
    const fz = Math.cos(player.heading)
    ball.vx = fx * 18 + player.vx * 0.35
    ball.vz = fz * 18 + player.vz * 0.35
    ball.vy = 7.2
    kickLock = 0.45
  }

  function stepBall(dt) {
    const playerDist = flatDist(player, ball)
    const fx = Math.sin(player.heading)
    const fz = Math.cos(player.heading)
    const ahead = (ball.x - player.x) * fx + (ball.z - player.z) * fz
    const dribbling = kickLock <= 0 && playerDist < 1.7 && ball.y < 1.15 && ahead > -0.55
    if (dribbling) {
      const lead = Math.max(1.05, Math.hypot(player.vx, player.vz) * 0.12)
      const tx = player.x + fx * lead
      const tz = player.z + fz * lead
      const blend = Math.min(1, dt * 22)
      ball.x += (tx - ball.x) * blend
      ball.z += (tz - ball.z) * blend
      ball.y = BALL_R
      ball.vx = fx * Math.hypot(player.vx, player.vz)
      ball.vz = fz * Math.hypot(player.vx, player.vz)
      ball.vy = 0
      return
    }

    ball.vy -= 20 * dt
    ball.x += ball.vx * dt
    ball.y += ball.vy * dt
    ball.z += ball.vz * dt
    if (ball.y < BALL_R) {
      ball.y = BALL_R
      if (ball.vy < 0) ball.vy *= -0.42
      ball.vx *= Math.max(0, 1 - 1.6 * dt)
      ball.vz *= Math.max(0, 1 - 1.6 * dt)
    }
  }

  function keepersTouchBall() {
    deflect(keeperFar, 1)
    deflect(keeperNear, -1)
  }

  function deflect(keeper, side) {
    const dx = ball.x - keeper.x
    const dz = ball.z - keeper.z
    const dist = Math.hypot(dx, dz)
    if (dist > 0.8 || ball.y > 1.4) return
    const speed = Math.hypot(ball.vx, ball.vz)
    if (flatDist(player, ball) < 1.3 && speed < 8) return
    const nx = dx / (dist || 1)
    const nz = dz / (dist || 1)
    ball.x = keeper.x + nx * 0.95
    ball.z = keeper.z + nz * 0.95
    ball.vx = nx * 5
    ball.vz = nz * 4 - side * 4
    ball.vy = Math.max(ball.vy, 2)
  }

  function containBall() {
    if (ball.x > HALF_W - BALL_R) {
      ball.x = HALF_W - BALL_R
      ball.vx *= -0.55
    } else if (ball.x < -HALF_W + BALL_R) {
      ball.x = -HALF_W + BALL_R
      ball.vx *= -0.55
    }
    bouncePosts()
    const mouth = Math.abs(ball.x) < GOAL_HALF - 0.08 && ball.y < GOAL_H - 0.05
    if (!mouth && ball.z > HALF_L - BALL_R) {
      ball.z = HALF_L - BALL_R
      ball.vz *= -0.55
    }
    if (!mouth && ball.z < -HALF_L + BALL_R) {
      ball.z = -HALF_L + BALL_R
      ball.vz *= -0.55
    }
  }

  function bouncePosts() {
    for (const side of [1, -1]) {
      for (const x of [-GOAL_HALF, GOAL_HALF]) bounceCircle(x, side * HALF_L)
    }
  }

  function bounceCircle(px, pz) {
    if (ball.y > GOAL_H) return
    const dx = ball.x - px
    const dz = ball.z - pz
    const min = BALL_R + 0.1
    const dist = Math.hypot(dx, dz)
    if (dist >= min || dist < 0.0001) return
    const nx = dx / dist
    const nz = dz / dist
    ball.x = px + nx * min
    ball.z = pz + nz * min
    const vn = ball.vx * nx + ball.vz * nz
    if (vn < 0) {
      ball.vx -= 1.7 * vn * nx
      ball.vz -= 1.7 * vn * nz
    }
  }

  function checkGoal() {
    if (messageTime > 0 || ball.y > GOAL_H) return
    if (Math.abs(ball.x) > GOAL_HALF - BALL_R * 0.4) return
    if (ball.z > HALF_L + 0.15) award('you')
    else if (ball.z < -HALF_L - 0.15) award('them')
  }

  function award(side) {
    if (side === 'you') you += 1
    else them += 1
    message = side === 'you' ? 'GOAL' : 'THEY SCORED'
    messageTime = 1.5
    ball.vx = 0
    ball.vy = 0
    ball.vz = 0
  }

  function sync(dt) {
    const running = Math.hypot(player.vx, player.vz) > 0.8
    placeAthlete(youKit, player, running)
    placeAthlete(aiKit, ai, true)
    placeAthlete(farKit, keeperFar, Math.abs(ball.x - keeperFar.x) > 0.2)
    placeAthlete(nearKit, keeperNear, Math.abs(ball.x - keeperNear.x) > 0.2)
    ballMesh.position.set(ball.x, ball.y, ball.z)
    ballShadow.position.set(ball.x, 0.04, ball.z)
    const spin = Math.hypot(ball.vx, ball.vz)
    if (spin > 0.2) {
      spinAxis.set(ball.vz, 0, -ball.vx).multiplyScalar(1 / spin)
      ballMesh.rotateOnWorldAxis(spinAxis, (spin / BALL_R) * dt)
    }
  }

  function placeAthlete(kit, person, moving) {
    kit.root.position.set(person.x, 0, person.z)
    kit.root.rotation.y = person.heading
    const swing = moving ? Math.sin(clock * 11) * 0.65 : 0
    kit.leftLeg.rotation.x = swing
    kit.rightLeg.rotation.x = -swing
    kit.leftArm.rotation.x = -swing * 0.55
    kit.rightArm.rotation.x = swing * 0.55
  }

  function aimCamera(dt) {
    const targetX = player.x * 0.72
    const targetY = 5.6
    const targetZ = player.z - 9.2
    const blend = snap ? 1 : 1 - Math.exp(-4 * dt)
    camera.position.x += (targetX - camera.position.x) * blend
    camera.position.y += (targetY - camera.position.y) * blend
    camera.position.z += (targetZ - camera.position.z) * blend
    camera.lookAt(player.x * 0.3, 0.45, player.z + 7)
    snap = false
  }

  reset()
  return { scene, camera, update, reset, status }
}

function separate(player, other) {
  const dx = other.x - player.x
  const dz = other.z - player.z
  const dist = Math.hypot(dx, dz)
  if (dist >= 1.05 || dist < 0.0001) return
  const push = 1.05 - dist
  other.x += (dx / dist) * push
  other.z += (dz / dist) * push
}

function flatDist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function lerpAngle(from, to, t) {
  let delta = to - from
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  return from + delta * t
}

function addMarkings(scene) {
  const material = new THREE.MeshStandardMaterial({ color: '#f7f7f7', roughness: 0.75 })
  const paint = (x, z, w, d) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, d), material)
    mesh.position.set(x, 0.03, z)
    mesh.receiveShadow = true
    scene.add(mesh)
  }
  paint(0, HALF_L, HALF_W * 2, 0.12)
  paint(0, -HALF_L, HALF_W * 2, 0.12)
  paint(-HALF_W, 0, 0.12, HALF_L * 2)
  paint(HALF_W, 0, 0.12, HALF_L * 2)
  paint(0, 0, HALF_W * 2, 0.1)
  for (const side of [1, -1]) {
    const depth = 9
    const width = 13
    const endZ = side * HALF_L
    const boxZ = side * (HALF_L - depth)
    paint(0, boxZ, width, 0.1)
    paint(-width / 2, side * (HALF_L - depth / 2), 0.1, depth)
    paint(width / 2, side * (HALF_L - depth / 2), 0.1, depth)
    paint(0, endZ - side * 0.2, GOAL_HALF * 2, 0.08)
  }
  const circle = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.06, 8, 40), material)
  circle.rotation.x = Math.PI / 2
  circle.position.y = 0.035
  scene.add(circle)
}

function addGoal(scene, side) {
  const z = side * HALF_L
  const white = new THREE.MeshStandardMaterial({ color: '#f4f6f7', roughness: 0.4, metalness: 0.1 })
  for (const x of [-GOAL_HALF, GOAL_HALF]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, GOAL_H, 8), white)
    post.position.set(x, GOAL_H / 2, z)
    post.castShadow = true
    scene.add(post)
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(GOAL_HALF * 2 + 0.14, 0.1, 0.1), white)
  bar.position.set(0, GOAL_H, z)
  bar.castShadow = true
  scene.add(bar)
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(GOAL_HALF * 2, GOAL_H),
    new THREE.MeshStandardMaterial({
      color: '#d5e2e8',
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      roughness: 1,
    }),
  )
  net.position.set(0, GOAL_H / 2, z + side * 1.3)
  if (side < 0) net.rotation.y = Math.PI
  scene.add(net)
}

function createAthlete(shirt, shorts) {
  const root = new THREE.Group()
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.72 })
  const shortsMat = new THREE.MeshStandardMaterial({ color: shorts, roughness: 0.75 })
  const skin = new THREE.MeshStandardMaterial({ color: '#e2b48c', roughness: 0.8 })
  const bootMat = new THREE.MeshStandardMaterial({ color: '#161616', roughness: 0.55 })

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.5, 0.26), shirtMat)
  torso.position.set(0, 1.22, 0)
  torso.castShadow = true
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), skin)
  head.position.set(0, 1.66, 0)
  head.castShadow = true
  root.add(torso, head)

  function limb(x, y, color, tall, boot) {
    const pivot = new THREE.Group()
    pivot.position.set(x, y, 0)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, tall, 0.16), color)
    mesh.position.y = -tall / 2
    mesh.castShadow = true
    pivot.add(mesh)
    if (boot) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.26), bootMat)
      shoe.position.set(0, -tall - 0.02, 0.04)
      shoe.castShadow = true
      pivot.add(shoe)
    }
    root.add(pivot)
    return pivot
  }

  return {
    root,
    leftLeg: limb(-0.13, 0.78, shortsMat, 0.7, true),
    rightLeg: limb(0.13, 0.78, shortsMat, 0.7, true),
    leftArm: limb(-0.32, 1.4, shirtMat, 0.42, false),
    rightArm: limb(0.32, 1.4, shirtMat, 0.42, false),
  }
}

function stripeTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? '#3c9a43' : '#34863a'
    ctx.fillRect(0, i * 32, 64, 32)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function ballTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f7f7f7'
  ctx.fillRect(0, 0, 128, 128)
  ctx.fillStyle = '#111111'
  for (const [x, y] of [[64, 36], [34, 78], [94, 78], [64, 104]]) {
    ctx.beginPath()
    ctx.arc(x, y, 18, 0, Math.PI * 2)
    ctx.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
