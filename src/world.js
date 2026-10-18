import * as THREE from 'three'
import {
  BUILDINGS,
  CHECKPOINT_RADIUS,
  CHECKPOINT_T,
  FOUNTAIN,
  HALF_WIDTH,
  LIMIT,
  PERIM,
  TREES,
  TREE_RADIUS,
  boundingRadius,
  checkpointPoses,
  isOnRoad,
  pointOnLoop,
  startPose,
  yawForHeading,
} from './track.js'

export function createWorld(scene) {
  scene.background = new THREE.Color('#8ec6ea')
  scene.fog = new THREE.Fog('#8ec6ea', 55, 150)

  const hemi = new THREE.HemisphereLight('#e7f4ff', '#4d7a3a', 0.85)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight('#fff3dd', 1.45)
  sun.position.set(40, 70, 24)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -90
  sun.shadow.camera.right = 90
  sun.shadow.camera.top = 90
  sun.shadow.camera.bottom = -90
  sun.shadow.camera.near = 10
  sun.shadow.camera.far = 180
  sun.shadow.bias = -0.0004
  scene.add(sun)

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(280, 280),
    new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1, metalness: 0 }),
  )
  grass.rotation.x = -Math.PI / 2
  grass.receiveShadow = true
  scene.add(grass)

  addStrip(scene, -(HALF_WIDTH + 2.6), -(HALF_WIDTH + 0.7), 0.015, '#8d7348')
  addStrip(scene, HALF_WIDTH + 0.7, HALF_WIDTH + 2.6, 0.015, '#8d7348')
  addStrip(scene, -(HALF_WIDTH + 0.85), HALF_WIDTH + 0.85, 0.03, '#d9d9d9')
  addStrip(scene, -HALF_WIDTH, HALF_WIDTH, 0.05, '#3c4046')
  addStrip(scene, HALF_WIDTH - 0.55, HALF_WIDTH - 0.18, 0.065, '#f4f4f4')
  addStrip(scene, -(HALF_WIDTH - 0.18), -(HALF_WIDTH - 0.55), 0.065, '#f4f4f4')
  addDashes(scene)

  const checkpoints = checkpointPoses()
  const gates = checkpoints.map((pose, index) => addGate(scene, pose, index))
  addArrow(scene, checkpoints[0])

  const colliders = []
  for (const building of BUILDINGS) {
    addBuilding(scene, building)
    colliders.push({
      x: building.x,
      z: building.z,
      r: boundingRadius(building.w, building.d),
    })
  }

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 1.3, 6)
  const leafGeo = new THREE.ConeGeometry(1.35, 2.7, 7)
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6d4c32', roughness: 1 })
  const leafMat = new THREE.MeshStandardMaterial({ color: '#2f7d38', roughness: 0.85 })
  for (const tree of TREES) {
    const group = new THREE.Group()
    const trunk = new THREE.Mesh(trunkGeo, trunkMat)
    trunk.position.y = 0.65
    trunk.castShadow = true
    const leaves = new THREE.Mesh(leafGeo, leafMat)
    leaves.position.y = 2.15
    leaves.castShadow = true
    group.add(trunk, leaves)
    group.scale.setScalar(tree.s)
    group.position.set(tree.x, 0, tree.z)
    scene.add(group)
    colliders.push({ x: tree.x, z: tree.z, r: TREE_RADIUS * tree.s })
  }

  const stone = new THREE.Mesh(
    new THREE.CylinderGeometry(FOUNTAIN.r, FOUNTAIN.r + 0.2, 0.7, 24),
    new THREE.MeshStandardMaterial({ color: '#c8c2b6', roughness: 0.85 }),
  )
  stone.position.set(FOUNTAIN.x, 0.35, FOUNTAIN.z)
  stone.castShadow = true
  stone.receiveShadow = true
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(FOUNTAIN.r - 0.7, FOUNTAIN.r - 0.7, 0.25, 24),
    new THREE.MeshStandardMaterial({ color: '#3aa0c8', roughness: 0.15, metalness: 0.1 }),
  )
  water.position.set(FOUNTAIN.x, 0.62, FOUNTAIN.z)
  scene.add(stone, water)
  colliders.push({ x: FOUNTAIN.x, z: FOUNTAIN.z, r: FOUNTAIN.r })

  checkpoints.forEach((pose) => {
    const span = HALF_WIDTH + 0.15
    const rx = Math.sin(pose.heading)
    const rz = -Math.cos(pose.heading)
    colliders.push(
      { x: pose.x + rx * span, z: pose.z + rz * span, r: 0.45 },
      { x: pose.x - rx * span, z: pose.z - rz * span, r: 0.45 },
    )
  })

  let active = -2
  function setActive(index) {
    if (index === active) return
    active = index
    gates.forEach((material, gateIndex) => {
      material.emissiveIntensity = gateIndex === index ? 0.85 : 0.08
    })
  }

  return {
    colliders,
    limit: LIMIT,
    checkpointRadius: CHECKPOINT_RADIUS,
    checkpoints,
    startPose: startPose(),
    isOnRoad,
    setActive,
  }
}

function addStrip(scene, offsetA, offsetB, y, color) {
  const right = Math.max(offsetA, offsetB)
  const left = Math.min(offsetA, offsetB)
  const segments = 180
  const positions = []
  const indices = []
  for (let i = 0; i <= segments; i += 1) {
    const pose = pointOnLoop(i / segments)
    const rx = Math.sin(pose.heading)
    const rz = -Math.cos(pose.heading)
    positions.push(
      pose.x + rx * right,
      y,
      pose.z + rz * right,
      pose.x + rx * left,
      y,
      pose.z + rz * left,
    )
  }
  for (let i = 0; i < segments; i += 1) {
    const a = i * 2
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.92,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
  )
  mesh.receiveShadow = true
  scene.add(mesh)
}

function addDashes(scene) {
  const material = new THREE.MeshStandardMaterial({ color: '#e2c044', roughness: 0.8 })
  const geometry = new THREE.BoxGeometry(0.22, 0.04, 1.7)
  for (let distance = 0; distance < PERIM; distance += 3.6) {
    const pose = pointOnLoop(distance / PERIM)
    if (nearStart(pose)) continue
    const dash = new THREE.Mesh(geometry, material)
    dash.position.set(pose.x, 0.08, pose.z)
    dash.rotation.y = yawForHeading(pose.heading)
    dash.receiveShadow = true
    scene.add(dash)
  }
}

function nearStart(pose) {
  const start = pointOnLoop(CHECKPOINT_T[0])
  return Math.hypot(pose.x - start.x, pose.z - start.z) < 4
}

function addGate(scene, pose, index) {
  const group = new THREE.Group()
  group.position.set(pose.x, 0, pose.z)
  group.rotation.y = yawForHeading(pose.heading)
  const color = index === 0 ? '#d64545' : '#f0c94d'
  const poleMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.08,
    roughness: 0.55,
  })
  const span = HALF_WIDTH + 0.15
  for (const side of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 5.6, 8), poleMat)
    pole.position.set(side * span, 2.8, 0)
    pole.castShadow = true
    group.add(pole)
  }
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_WIDTH * 2, 1.35),
    new THREE.MeshStandardMaterial({
      map: bannerTexture(pose.name, index === 0 ? '#f4f4f4' : '#ffe9a0'),
      roughness: 0.7,
      side: THREE.DoubleSide,
    }),
  )
  banner.position.y = 5.15
  banner.rotation.y = Math.PI
  group.add(banner)
  if (index === 0) addCheckers(group)
  scene.add(group)
  return poleMat
}

function addCheckers(group) {
  const count = 10
  const width = (HALF_WIDTH * 2) / count
  for (let i = 0; i < count; i += 1) {
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.96, 0.04, 1.15),
      new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? '#111111' : '#f7f7f7', roughness: 0.8 }),
    )
    tile.position.set(-HALF_WIDTH + width * (i + 0.5), 0.09, 0)
    tile.receiveShadow = true
    group.add(tile)
  }
}

function addArrow(scene, pose) {
  const group = new THREE.Group()
  group.position.set(pose.x, 0, pose.z)
  group.rotation.y = yawForHeading(pose.heading)
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.85, 2.2, 3),
    new THREE.MeshStandardMaterial({ color: '#f0c94d', roughness: 0.6 }),
  )
  arrow.rotation.x = Math.PI / 2
  arrow.scale.set(1, 1, 0.1)
  arrow.position.set(0, 0.18, 3.4)
  group.add(arrow)
  scene.add(group)
}

function addBuilding(scene, building) {
  const facade = facadeTexture(building.color)
  const wall = new THREE.MeshStandardMaterial({ map: facade, roughness: 0.9 })
  const roof = new THREE.MeshStandardMaterial({ color: '#6e675f', roughness: 0.95 })
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(building.w, building.h, building.d), [
    wall,
    wall,
    roof,
    roof,
    wall,
    wall,
  ])
  mesh.position.set(building.x, building.h / 2, building.z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)
}

function bannerTexture(text, background) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, 512, 128)
  ctx.fillStyle = '#1b1b1b'
  ctx.fillRect(0, 0, 512, 10)
  ctx.fillRect(0, 118, 512, 10)
  ctx.font = 'bold 64px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 256, 68)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function facadeTexture(color) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 160
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 128, 160)
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#d7eef6' : '#8ecbdc'
      ctx.fillRect(16 + col * 36, 16 + row * 32, 20, 22)
    }
  }
  ctx.fillStyle = '#5a3b2e'
  ctx.fillRect(52, 126, 24, 34)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function grassTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#3f8f3c'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 2500; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? '#4ea348' : '#2f7034'
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(32, 32)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}
