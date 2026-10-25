import * as THREE from 'three'
import {
  BUILDINGS,
  CHECKPOINT_RADIUS,
  CHECKPOINT_T,
  CHRISTMAS,
  HALF_WIDTH,
  LIMIT,
  PERIM,
  STREETS,
  TREES,
  TREE_RADIUS,
  boundingRadius,
  checkpointPoses,
  isOnOval,
  isOnRoad,
  pointOnLoop,
  startPose,
  yawForHeading,
} from './track.js'

export function createWorld(scene) {
  scene.background = new THREE.Color('#070b16')
  scene.fog = new THREE.Fog('#070b16', 42, 145)

  const hemi = new THREE.HemisphereLight('#31425c', '#12141a', 0.55)
  scene.add(hemi)
  const moon = new THREE.DirectionalLight('#c5d4ee', 0.62)
  moon.position.set(-30, 48, -18)
  moon.castShadow = true
  moon.shadow.mapSize.set(2048, 2048)
  moon.shadow.camera.left = -110
  moon.shadow.camera.right = 110
  moon.shadow.camera.top = 110
  moon.shadow.camera.bottom = -110
  moon.shadow.camera.near = 10
  moon.shadow.camera.far = 180
  moon.shadow.bias = -0.0004
  scene.add(moon)

  const snowGround = new THREE.Mesh(
    new THREE.PlaneGeometry(280, 280),
    new THREE.MeshStandardMaterial({ map: snowTexture(), roughness: 0.96, metalness: 0 }),
  )
  snowGround.rotation.x = -Math.PI / 2
  snowGround.receiveShadow = true
  scene.add(snowGround)
  addStars(scene)

  addStrip(scene, -(HALF_WIDTH + 2.6), -(HALF_WIDTH + 0.7), 0.015, '#8d7348')
  addStrip(scene, HALF_WIDTH + 0.7, HALF_WIDTH + 2.6, 0.015, '#8d7348')
  addStrip(scene, -(HALF_WIDTH + 0.85), HALF_WIDTH + 0.85, 0.03, '#d9d9d9')
  addStrip(scene, -HALF_WIDTH, HALF_WIDTH, 0.05, '#3c4046')
  addStrip(scene, HALF_WIDTH - 0.55, HALF_WIDTH - 0.18, 0.065, '#f4f4f4')
  addStrip(scene, -(HALF_WIDTH - 0.18), -(HALF_WIDTH - 0.55), 0.065, '#f4f4f4')
  addDashes(scene)
  for (const street of STREETS) addStreet(scene, street)
  addStreetLamps(scene)

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
  const leafMat = new THREE.MeshStandardMaterial({ color: '#c5d0c8', roughness: 0.75 })
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

  addChristmasTree(scene)
  colliders.push({ x: CHRISTMAS.x, z: CHRISTMAS.z, r: CHRISTMAS.r })
  const snowfall = createSnow(scene)

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

  function update(dt, x, z) {
    snowfall.update(dt, x, z)
  }

  return {
    colliders,
    limit: LIMIT,
    checkpointRadius: CHECKPOINT_RADIUS,
    checkpoints,
    startPose: startPose(),
    isOnRoad,
    setActive,
    update,
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
  const material = new THREE.MeshStandardMaterial({
    color: '#e2c044',
    emissive: '#c9a227',
    emissiveIntensity: 0.35,
    roughness: 0.8,
  })
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
  const facade = nightFacade(building.color)
  const wall = new THREE.MeshStandardMaterial({
    map: facade.map,
    emissiveMap: facade.emissiveMap,
    emissive: '#ffd8a8',
    emissiveIntensity: 0.85,
    roughness: 0.88,
  })
  const roof = new THREE.MeshStandardMaterial({ color: '#e7eef5', roughness: 0.78 })
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

function nightFacade(color) {
  const canvas = document.createElement('canvas')
  const glow = document.createElement('canvas')
  canvas.width = glow.width = 128
  canvas.height = glow.height = 192
  const ctx = canvas.getContext('2d')
  const lit = glow.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 128, 192)
  lit.fillStyle = '#000'
  lit.fillRect(0, 0, 128, 192)
  const panes = ['#ffd27a', '#ffe7b0', '#8fd0ff', '#ffb060', '#1a1c22']
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const pane = panes[(row * 3 + col * 2) % panes.length]
      ctx.fillStyle = pane
      ctx.fillRect(16 + col * 36, 14 + row * 34, 20, 22)
      if (pane !== '#1a1c22') {
        lit.fillStyle = '#fff'
        lit.fillRect(16 + col * 36, 14 + row * 34, 20, 22)
      }
    }
  }
  const map = new THREE.CanvasTexture(canvas)
  const emissiveMap = new THREE.CanvasTexture(glow)
  map.colorSpace = THREE.SRGBColorSpace
  emissiveMap.colorSpace = THREE.SRGBColorSpace
  return { map, emissiveMap }
}

function snowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#d5dee8'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 1800; i += 1) {
    ctx.fillStyle = i % 3 === 0 ? '#eef3f8' : '#c3ceda'
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(28, 28)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function addStars(scene) {
  const positions = []
  for (let i = 0; i < 180; i += 1) {
    const angle = Math.random() * Math.PI * 2
    const radius = 80 + Math.random() * 60
    positions.push(Math.cos(angle) * radius, 28 + Math.random() * 40, Math.sin(angle) * radius)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#f7f4ea', size: 0.55, sizeAttenuation: true })))
}

function addStreet(scene, street) {
  const vertical = street.halfZ > street.halfX
  const length = (vertical ? street.halfZ : street.halfX) * 2
  const width = (vertical ? street.halfX : street.halfZ) * 2
  const sidewalk = new THREE.Mesh(
    new THREE.PlaneGeometry(length + 3.2, width + 3.2),
    new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.92 }),
  )
  const road = new THREE.Mesh(new THREE.PlaneGeometry(length, width), streetMaterial(length))
  sidewalk.rotation.x = -Math.PI / 2
  road.rotation.x = -Math.PI / 2
  sidewalk.position.y = 0.03
  road.position.y = 0.055
  const group = new THREE.Group()
  group.add(sidewalk, road)
  if (vertical) group.rotation.y = Math.PI / 2
  group.position.set(street.x, 0, street.z)
  sidewalk.receiveShadow = true
  road.receiveShadow = true
  scene.add(group)
}

function streetMaterial(length) {
  const map = streetTexture()
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping
  map.repeat.set(Math.max(1, length / 8), 1)
  return new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0.02 })
}

function streetTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#23262c'
  ctx.fillRect(0, 0, 128, 64)
  ctx.fillStyle = '#f2f2f2'
  ctx.fillRect(0, 2, 128, 3)
  ctx.fillRect(0, 59, 128, 3)
  ctx.fillStyle = '#e2c14e'
  ctx.fillRect(8, 29, 36, 6)
  ctx.fillRect(72, 29, 36, 6)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function addStreetLamps(scene) {
  const poleMat = new THREE.MeshStandardMaterial({ color: '#2a2e33', roughness: 0.7, metalness: 0.2 })
  const bulbMat = new THREE.MeshStandardMaterial({
    color: '#ffe7b8',
    emissive: '#ffd27a',
    emissiveIntensity: 1.6,
    roughness: 0.35,
  })
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.2, 6)
  const bulbGeo = new THREE.SphereGeometry(0.18, 8, 6)
  for (const street of STREETS) {
    const vertical = street.halfZ > street.halfX
    const span = vertical ? street.halfZ : street.halfX
    const side = (vertical ? street.halfX : street.halfZ) + 1.35
    for (let offset = -span + 8; offset <= span - 8; offset += 26) {
      for (const sign of [-1, 1]) {
        const x = street.x + (vertical ? sign * side : offset)
        const z = street.z + (vertical ? offset : sign * side)
        if (isOnOval(x, z) || Math.hypot(x, z) < 16) continue
        const pole = new THREE.Mesh(poleGeo, poleMat)
        pole.position.set(x, 2.1, z)
        const bulb = new THREE.Mesh(bulbGeo, bulbMat)
        bulb.position.set(x, 4.25, z)
        scene.add(pole, bulb)
      }
    }
  }
}

function addChristmasTree(scene) {
  const group = new THREE.Group()
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.48, 1.15, 8),
    new THREE.MeshStandardMaterial({ color: '#5c3b24', roughness: 1 }),
  )
  trunk.position.y = 0.58
  trunk.castShadow = true
  group.add(trunk)
  const leaf = new THREE.MeshStandardMaterial({ color: '#1d6a34', roughness: 0.82 })
  const snow = new THREE.MeshStandardMaterial({ color: '#f4f7fb', roughness: 0.62 })
  for (const tier of [
    { y: 1.85, r: 2.15, h: 2.15 },
    { y: 3.25, r: 1.55, h: 1.85 },
    { y: 4.45, r: 0.95, h: 1.5 },
  ]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(tier.r, tier.h, 8), leaf)
    cone.position.y = tier.y
    cone.castShadow = true
    const cap = new THREE.Mesh(new THREE.ConeGeometry(tier.r * 0.62, tier.h * 0.28, 8), snow)
    cap.position.y = tier.y + tier.h * 0.3
    group.add(cone, cap)
  }
  const ornamentGeo = new THREE.SphereGeometry(0.16, 8, 6)
  const colors = ['#e23d3d', '#f2c14e', '#3b82f6', '#f472b6', '#f8fafc']
  const spots = [
    [1.15, 1.7, 0.35], [-0.95, 1.9, 0.7], [0.2, 2.15, -1.2],
    [0.85, 2.9, 0.55], [-0.7, 3.15, -0.4], [0.15, 3.4, 0.85],
    [-0.35, 4.15, 0.45], [0.4, 4.35, -0.25],
  ]
  spots.forEach(([x, y, z], index) => {
    const ball = new THREE.Mesh(
      ornamentGeo,
      new THREE.MeshStandardMaterial({
        color: colors[index % colors.length],
        emissive: colors[index % colors.length],
        emissiveIntensity: 0.35,
        roughness: 0.35,
      }),
    )
    ball.position.set(x, y, z)
    group.add(ball)
  })
  const star = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.36),
    new THREE.MeshStandardMaterial({ color: '#ffe38a', emissive: '#ffd45a', emissiveIntensity: 1.5, roughness: 0.3 }),
  )
  star.position.y = 5.45
  group.add(star)
  const glow = new THREE.PointLight('#ffd27a', 6, 22, 2)
  glow.position.y = 3.2
  group.add(glow)
  group.position.set(CHRISTMAS.x, 0, CHRISTMAS.z)
  scene.add(group)
}

function createSnow(scene) {
  const count = 1400
  const spread = 46
  const positions = new Float32Array(count * 3)
  const speeds = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * spread * 2
    positions[i * 3 + 1] = Math.random() * 24
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread * 2
    speeds[i] = 2.4 + Math.random() * 3.2
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: '#f7fbff', size: 0.16, transparent: true, opacity: 0.9, depthWrite: false }),
  )
  scene.add(points)
  return {
    update(dt, x, z) {
      for (let i = 0; i < count; i += 1) {
        const index = i * 3
        positions[index + 1] -= speeds[i] * dt
        positions[index] += Math.sin(positions[index + 1] * 0.7 + i) * dt * 0.35
        const dx = positions[index] - x
        const dz = positions[index + 2] - z
        if (positions[index + 1] < 0 || Math.abs(dx) > spread || Math.abs(dz) > spread) {
          positions[index] = x + (Math.random() - 0.5) * spread * 2
          positions[index + 1] = 16 + Math.random() * 10
          positions[index + 2] = z + (Math.random() - 0.5) * spread * 2
        }
      }
      geometry.attributes.position.needsUpdate = true
    },
  }
}
