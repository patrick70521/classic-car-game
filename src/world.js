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
  TAIPEI_101,
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
  const skyDisc = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 18, 14),
    new THREE.MeshBasicMaterial({ color: '#f4f1e4' }),
  )
  scene.add(skyDisc)
  const skyPoint = new THREE.Vector3()

  const snowGround = new THREE.Mesh(
    new THREE.PlaneGeometry(280, 280),
    new THREE.MeshStandardMaterial({ map: snowTexture(), roughness: 0.96, metalness: 0 }),
  )
  snowGround.rotation.x = -Math.PI / 2
  snowGround.receiveShadow = true
  scene.add(snowGround)
  const stars = addStars(scene)

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

  const facades = []
  const colliders = []
  for (const building of BUILDINGS) {
    facades.push(addBuilding(scene, building))
    colliders.push({
      x: building.x,
      z: building.z,
      r: boundingRadius(building.w, building.d),
    })
  }
  addTaipei101(scene, colliders)
  addShops(scene)
  addMalls(scene)
  addLanterns(scene)
  const signals = addSignals(scene)
  addCrosswalks(scene)

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
  const movers = []
  const people = createPeople(scene, movers)
  const traffic = createTraffic(scene, movers)

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
  let clock = 0
  let nearSidewalk = false
  let hornArmed = false
  function setActive(index) {
    if (index === active) return
    active = index
    gates.forEach((material, gateIndex) => {
      material.emissiveIntensity = gateIndex === index ? 0.85 : 0.08
    })
  }

  function update(dt, x, z) {
    clock += Math.max(0, dt)
    const span = 30
    const loop = span * WEATHER.length
    const wrapped = ((clock % loop) + loop) % loop
    const u = wrapped / span
    const index = Math.floor(u) % WEATHER.length
    const blend = u - Math.floor(u)
    const smooth = blend * blend * (3 - 2 * blend)
    const weather = mixWeather(WEATHER[index], WEATHER[(index + 1) % WEATHER.length], smooth)
    applyWeather(weather, {
      background: scene.background,
      fog: scene.fog,
      hemi,
      sun: moon,
      ground: snowGround.material,
      stars,
      facades,
      disc: skyDisc,
      skyPoint,
    })
    snowfall.update(dt, x, z, weather.snow, weather.rain)
    const lights = signalState(clock)
    signals.update(lights)
    people.update(dt, lights)
    traffic.update(dt, x, z, lights)
    nearSidewalk = people.near(x, z)
    if (traffic.near(x, z) && Math.random() < dt * 0.4) hornArmed = true
  }

  function ambience() {
    const horn = hornArmed
    hornArmed = false
    return { nearSidewalk, horn }
  }

  return {
    colliders,
    movers,
    limit: LIMIT,
    checkpointRadius: CHECKPOINT_RADIUS,
    checkpoints,
    startPose: startPose(),
    isOnRoad,
    setActive,
    update,
    ambience,
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
  return wall
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
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: '#f7f4ea', size: 0.55, sizeAttenuation: true, transparent: true, opacity: 1 }),
  )
  scene.add(points)
  return points
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
    update(dt, x, z, snowAmount, rainAmount) {
      const snow = snowAmount || 0
      const rain = rainAmount || 0
      const falling = Math.max(snow, rain)
      points.material.opacity = falling * 0.92
      points.material.color.set(rain > snow ? '#f4f7fb' : '#f7fbff')
      points.material.size = rain > snow ? 0.28 : 0.16
      const fallScale = rain > snow ? 3.2 : 1
      if (falling < 0.03) return
      for (let i = 0; i < count; i += 1) {
        const index = i * 3
        positions[index + 1] -= speeds[i] * fallScale * dt
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

const WEATHER = [
  { sky: '#070b16', fog: '#070b16', hemiSky: '#31425c', hemiGround: '#12141a', hemi: 0.55, sun: '#c5d4ee', sunLevel: 0.62, sunPos: [-30, 48, -18], fogNear: 42, fogFar: 145, snow: 1, rain: 0, stars: 1, ground: '#ffffff', windows: 0.9 },
  { sky: '#8ec8f0', fog: '#b7d4ee', hemiSky: '#f6d7a8', hemiGround: '#6d7c68', hemi: 0.95, sun: '#ffe0a8', sunLevel: 1.35, sunPos: [40, 22, -36], fogNear: 70, fogFar: 190, snow: 0, rain: 0, stars: 0, ground: '#8d9390', windows: 0.22 },
  { sky: '#e07a3a', fog: '#c46a48', hemiSky: '#ffb07a', hemiGround: '#3a342c', hemi: 0.7, sun: '#ff8a3a', sunLevel: 0.95, sunPos: [-55, 10, 24], fogNear: 36, fogFar: 120, snow: 0, rain: 1, stars: 0, ground: '#3e4650', windows: 0.45 },
  { sky: '#d4784a', fog: '#a85a40', hemiSky: '#ffc09a', hemiGround: '#2a3038', hemi: 0.62, sun: '#ffb080', sunLevel: 0.72, sunPos: [-36, 16, 12], fogNear: 40, fogFar: 140, snow: 1, rain: 0, stars: 0.2, ground: '#c5ced8', windows: 0.7 },
].map((phase) => ({
  ...phase,
  sky: new THREE.Color(phase.sky),
  fog: new THREE.Color(phase.fog),
  hemiSky: new THREE.Color(phase.hemiSky),
  hemiGround: new THREE.Color(phase.hemiGround),
  sun: new THREE.Color(phase.sun),
  sunPos: new THREE.Vector3(...phase.sunPos),
  ground: new THREE.Color(phase.ground),
}))

const weatherScratch = {
  sky: new THREE.Color(),
  fog: new THREE.Color(),
  hemiSky: new THREE.Color(),
  hemiGround: new THREE.Color(),
  sun: new THREE.Color(),
  sunPos: new THREE.Vector3(),
  ground: new THREE.Color(),
}

function mixWeather(a, b, t) {
  return {
    sky: weatherScratch.sky.copy(a.sky).lerp(b.sky, t),
    fog: weatherScratch.fog.copy(a.fog).lerp(b.fog, t),
    hemiSky: weatherScratch.hemiSky.copy(a.hemiSky).lerp(b.hemiSky, t),
    hemiGround: weatherScratch.hemiGround.copy(a.hemiGround).lerp(b.hemiGround, t),
    sun: weatherScratch.sun.copy(a.sun).lerp(b.sun, t),
    sunPos: weatherScratch.sunPos.copy(a.sunPos).lerp(b.sunPos, t),
    ground: weatherScratch.ground.copy(a.ground).lerp(b.ground, t),
    hemi: a.hemi + (b.hemi - a.hemi) * t,
    sunLevel: a.sunLevel + (b.sunLevel - a.sunLevel) * t,
    fogNear: a.fogNear + (b.fogNear - a.fogNear) * t,
    fogFar: a.fogFar + (b.fogFar - a.fogFar) * t,
    snow: a.snow + (b.snow - a.snow) * t,
    rain: a.rain + (b.rain - a.rain) * t,
    stars: a.stars + (b.stars - a.stars) * t,
    windows: a.windows + (b.windows - a.windows) * t,
  }
}

function applyWeather(weather, view) {
  view.background.copy(weather.sky)
  view.fog.color.copy(weather.fog)
  view.fog.near = weather.fogNear
  view.fog.far = weather.fogFar
  view.hemi.color.copy(weather.hemiSky)
  view.hemi.groundColor.copy(weather.hemiGround)
  view.hemi.intensity = weather.hemi
  view.sun.color.copy(weather.sun)
  view.sun.intensity = weather.sunLevel
  view.sun.position.copy(weather.sunPos)
  view.skyPoint.copy(weather.sunPos)
  if (view.skyPoint.lengthSq() < 1) view.skyPoint.set(0, 1, 0)
  view.disc.position.copy(view.skyPoint.normalize().multiplyScalar(100))
  view.disc.material.color.copy(weather.sun)
  view.ground.color.copy(weather.ground)
  view.stars.material.opacity = weather.stars
  for (const facade of view.facades) facade.emissiveIntensity = weather.windows
}

function signTexture(text, background, ink) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 180
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, 512, 180)
  ctx.fillStyle = ink
  ctx.font = '700 78px "PingFang TC", "Heiti TC", "Noto Sans CJK TC", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 256, 96)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function addTaipei101(scene, colliders) {
  const group = new THREE.Group()
  const glass = new THREE.MeshStandardMaterial({
    color: '#9fd0e8',
    emissive: '#7eb6d4',
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.45,
  })
  const tiers = [
    [16, 10, 16],
    [13, 12, 13],
    [10.5, 12, 10.5],
    [8, 12, 8],
    [6, 10, 6],
    [4.2, 8, 4.2],
    [2.4, 6, 2.4],
  ]
  let y = 0
  for (const [w, h, d] of tiers) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glass)
    mesh.position.y = y + h / 2
    mesh.castShadow = true
    group.add(mesh)
    y += h
  }
  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.45, 10, 6),
    new THREE.MeshStandardMaterial({ color: '#d7e7f2', metalness: 0.6, roughness: 0.3 }),
  )
  spire.position.y = y + 5
  group.add(spire)
  group.position.set(TAIPEI_101.x, 0, TAIPEI_101.z)
  scene.add(group)
  colliders.push({ x: TAIPEI_101.x, z: TAIPEI_101.z, r: TAIPEI_101.r })
}

const SHOPS = [
  { x: -80, z: -73, d: 9, text: '牛肉麵', color: '#c1121f' },
  { x: -40, z: -73, d: 8, text: '小籠包', color: '#e4572e' },
  { x: 40, z: -73, d: 8, text: '珍珠奶茶', color: '#1d4ed8' },
  { x: 80, z: -73, d: 9, text: '夜市', color: '#b45309' },
]

function addShops(scene) {
  for (const shop of SHOPS) {
    const group = new THREE.Group()
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 0.28, 1.3),
      new THREE.MeshStandardMaterial({ color: shop.color, roughness: 0.55 }),
    )
    awning.position.set(0, 3.1, 0.35)
    const texture = signTexture(shop.text, shop.color, '#fff8e8')
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(6.2, 1.8),
      new THREE.MeshStandardMaterial({ map: texture, emissive: shop.color, emissiveMap: texture, emissiveIntensity: 0.4, roughness: 0.65 }),
    )
    sign.position.set(0, 4.4, 0.12)
    group.add(awning, sign)
    group.position.set(shop.x, 0, shop.z + shop.d / 2 + 0.45)
    scene.add(group)
  }
}

function addMalls(scene) {
  addBillboard(scene, 0, -73, 9, 1, '百貨', '#123a63')
  addBillboard(scene, 0, 73, 9, -1, '商場', '#3b1764')
}

function addBillboard(scene, x, z, depth, face, text, color) {
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 5.5),
    new THREE.MeshStandardMaterial({
      map: signTexture(text, color, '#fff4d2'),
      emissive: color,
      emissiveIntensity: 0.55,
      roughness: 0.45,
    }),
  )
  board.position.set(x, 18, z + face * (depth / 2 + 0.2))
  if (face < 0) board.rotation.y = Math.PI
  scene.add(board)
}

function addLanterns(scene) {
  const red = new THREE.MeshStandardMaterial({ color: '#d01212', emissive: '#ff3b30', emissiveIntensity: 0.85, roughness: 0.45 })
  const gold = new THREE.MeshStandardMaterial({ color: '#e2b657', emissive: '#ffd56a', emissiveIntensity: 0.55, roughness: 0.4 })
  const wire = new THREE.Mesh(
    new THREE.BoxGeometry(96, 0.06, 0.06),
    new THREE.MeshStandardMaterial({ color: '#24180f' }),
  )
  wire.position.set(0, 6.2, -58)
  scene.add(wire)
  for (let i = 0; i < 9; i += 1) {
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), i % 2 ? gold : red)
    lantern.scale.y = 1.25
    lantern.position.set(-40 + i * 10, 5.3, -58)
    scene.add(lantern)
  }
  const glow = new THREE.PointLight('#ffb070', 8, 30, 2)
  glow.position.set(0, 5.4, -58)
  scene.add(glow)
}

const CROSSINGS = [
  { x: 66, z: -58 },
  { x: -66, z: -58 },
  { x: 66, z: 58 },
  { x: -66, z: 58 },
]

function addSignals(scene) {
  const lights = []
  for (const crossing of CROSSINGS) {
    const pole = new THREE.Group()
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 4.2, 0.18),
      new THREE.MeshStandardMaterial({ color: '#222' }),
    )
    post.position.y = 2.1
    const housing = new THREE.MeshStandardMaterial({ color: '#161616', emissive: '#222', emissiveIntensity: 0.4 })
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.7, 0.46), housing)
    head.position.y = 4.5
    const red = lampMesh('#ff3b30', 5)
    const yellow = lampMesh('#ffd23a', 4.5)
    const green = lampMesh('#3dff6a', 4)
    pole.add(post, head, red, yellow, green)
    pole.position.set(crossing.x + 8, 0, crossing.z + 8)
    scene.add(pole)
    lights.push({ housing, red: red.material, yellow: yellow.material, green: green.material })
  }
  return {
    update(state) {
      for (const light of lights) {
        const lit = state.yellow ? '#ffd23a' : state.ewRed ? '#ff3b30' : '#3dff6a'
        light.housing.emissive.set(lit)
        light.housing.emissiveIntensity = 1.1
        light.red.emissiveIntensity = state.ewRed ? 2.4 : 0.05
        light.yellow.emissiveIntensity = state.yellow ? 2.2 : 0.05
        light.green.emissiveIntensity = state.ewRed || state.yellow ? 0.05 : 2.4
      }
    },
  }
}

function lampMesh(color, y) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 10, 8),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2 }),
  )
  mesh.position.set(0, y, 0.22)
  return mesh
}

function signalState(time) {
  const phase = time % 10
  return {
    ewRed: phase >= 4.2,
    nsRed: phase < 5,
    yellow: (phase >= 4.2 && phase < 5) || phase > 9.3,
  }
}

function addCrosswalks(scene) {
  const material = new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.8 })
  for (const crossing of CROSSINGS) {
    for (let i = -3; i <= 3; i += 1) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 3.4), material)
      stripe.position.set(crossing.x + i * 0.75, 0.08, crossing.z)
      scene.add(stripe)
    }
  }
}

function createPeople(scene, movers) {
  const colors = ['#243044', '#6b2430', '#1f4d3a', '#3a3428', '#123a63']
  const skin = new THREE.MeshStandardMaterial({ color: '#e0b090', roughness: 0.8 })
  function person(index) {
    const group = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.72, 0.22),
      new THREE.MeshStandardMaterial({ color: colors[index % colors.length], roughness: 0.7 }),
    )
    body.position.y = 0.75
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), skin)
    head.position.y = 1.26
    group.add(body, head)
    scene.add(group)
    const mover = { x: 0, z: 0, r: 0.4 }
    movers.push(mover)
    return { group, mover }
  }
  const walkers = []
  for (let i = 0; i < 8; i += 1) {
    const p = person(i)
    p.axis = 'x'
    p.origin = -46
    p.span = 92
    p.fixed = -66
    p.offset = i / 8
    p.speed = 0.7 + (i % 3) * 0.15
    p.dir = i % 2 ? 1 : -1
    walkers.push(p)
  }
  for (let i = 0; i < 6; i += 1) {
    const p = person(i + 3)
    p.axis = 'z'
    p.origin = -40
    p.span = 80
    p.fixed = 74
    p.offset = i / 6
    p.speed = 0.65
    p.dir = i % 2 ? 1 : -1
    walkers.push(p)
  }
  const crossers = [
    { from: -64, to: -51, x: 70, road: 'ew' },
    { from: 51, to: 64, x: -70, road: 'ew' },
  ].map((spec, index) => ({ ...spec, person: person(index + 1), t: index * 0.4, dir: 1 }))
  return {
    update(dt, lights) {
      for (const p of walkers) {
        p.offset += (dt * p.speed * p.dir) / p.span
        p.offset = ((p.offset % 1) + 1) % 1
        const pos = p.origin + p.offset * p.span
        if (p.axis === 'x') {
          p.mover.x = pos
          p.mover.z = p.fixed
        } else {
          p.mover.x = p.fixed
          p.mover.z = pos
        }
        p.group.position.set(p.mover.x, 0, p.mover.z)
      }
      for (const cross of crossers) {
        if (lights.ewRed) cross.t += dt * 0.28 * cross.dir
        if (cross.t > 1) {
          cross.t = 1
          cross.dir = -1
        }
        if (cross.t < 0) {
          cross.t = 0
          cross.dir = 1
        }
        cross.person.mover.x = cross.x
        cross.person.mover.z = cross.from + (cross.to - cross.from) * cross.t
        cross.person.group.position.set(cross.person.mover.x, 0, cross.person.mover.z)
      }
    },
    near(x, z) {
      const close = (mover) => Math.hypot(mover.x - x, mover.z - z) < 18
      return walkers.some((p) => close(p.mover)) || crossers.some((cross) => close(cross.person.mover))
    },
  }
}

function createTraffic(scene, movers) {
  const carLoop = [
    { x: -70, z: -56 },
    { x: 62, z: -56 },
    { x: 62, z: 56 },
    { x: -62, z: 56 },
  ]
  const taxiLoop = [
    { x: -60, z: 86 },
    { x: 60, z: 86 },
    { x: 60, z: 90 },
    { x: -60, z: 90 },
  ]
  const scooterA = [
    { x: -40, z: -86 },
    { x: 70, z: -86 },
  ]
  const scooterB = [
    { x: 90, z: -40 },
    { x: 90, z: 40 },
  ]
  const specs = [
    { path: carLoop, kind: 'car', color: '#f4f4f4', speed: 7, at: 0 },
    { path: carLoop, kind: 'car', color: '#1d4ed8', speed: 8, at: 1 },
    { path: carLoop, kind: 'car', color: '#1a1a1a', speed: 6.5, at: 2 },
    { path: taxiLoop, kind: 'car', color: '#f0c106', speed: 9, at: 0 },
    { path: taxiLoop, kind: 'car', color: '#f0c106', speed: 8, at: 2 },
    { path: scooterA, kind: 'scooter', color: '#d01212', speed: 12, at: 0 },
    { path: scooterA, kind: 'scooter', color: '#1f4d3a', speed: 11, at: 1 },
    { path: scooterB, kind: 'scooter', color: '#e4572e', speed: 13, at: 0 },
    { path: scooterB, kind: 'scooter', color: '#123a63', speed: 12, at: 1 },
  ]
  const vehicles = specs.map((spec) => {
    const group = makeVehicle(spec.kind, spec.color)
    scene.add(group)
    const at = spec.path[spec.at % spec.path.length]
    const mover = { x: at.x, z: at.z, r: spec.kind === 'scooter' ? 0.8 : 1.15 }
    movers.push(mover)
    return {
      ...spec,
      group,
      mover,
      x: at.x,
      z: at.z,
      leg: (spec.at + 1) % spec.path.length,
    }
  })
  return {
    update(dt, px, pz, lights) {
      for (const vehicle of vehicles) {
        const target = vehicle.path[vehicle.leg]
        let dx = target.x - vehicle.x
        let dz = target.z - vehicle.z
        let dist = Math.hypot(dx, dz)
        if (dist < 1.4) {
          vehicle.leg = (vehicle.leg + 1) % vehicle.path.length
          const next = vehicle.path[vehicle.leg]
          dx = next.x - vehicle.x
          dz = next.z - vehicle.z
          dist = Math.hypot(dx, dz) || 1
        }
        let speed = vehicle.speed
        if (stoppedByLight(vehicle.x, vehicle.z, dx, dz, lights)) speed = 0
        const gap = Math.hypot(vehicle.x - px, vehicle.z - pz)
        if (gap < 7 && gap > 0.05) {
          vehicle.x += ((vehicle.x - px) / gap) * dt * 3.2
          vehicle.z += ((vehicle.z - pz) / gap) * dt * 3.2
          speed *= 0.35
        }
        vehicle.x += (dx / dist) * speed * dt
        vehicle.z += (dz / dist) * speed * dt
        vehicle.group.position.set(vehicle.x, 0, vehicle.z)
        vehicle.group.rotation.y = Math.atan2(dx, dz)
        vehicle.mover.x = vehicle.x
        vehicle.mover.z = vehicle.z
      }
      for (let i = 0; i < vehicles.length; i += 1) {
        for (let j = i + 1; j < vehicles.length; j += 1) {
          const a = vehicles[i]
          const b = vehicles[j]
          const ox = a.x - b.x
          const oz = a.z - b.z
          const gap = Math.hypot(ox, oz) || 0.001
          const need = a.mover.r + b.mover.r + 0.35
          if (gap >= need) continue
          const push = (need - gap) * 0.5
          a.x += (ox / gap) * push
          a.z += (oz / gap) * push
          b.x -= (ox / gap) * push
          b.z -= (oz / gap) * push
          a.group.position.set(a.x, 0, a.z)
          b.group.position.set(b.x, 0, b.z)
          a.mover.x = a.x
          a.mover.z = a.z
          b.mover.x = b.x
          b.mover.z = b.z
        }
      }
    },
    near(x, z) {
      return vehicles.some((vehicle) => Math.hypot(vehicle.x - x, vehicle.z - z) < 16)
    },
  }
}

function stoppedByLight(x, z, dx, dz, lights) {
  const movingX = Math.abs(dx) >= Math.abs(dz)
  for (const crossing of CROSSINGS) {
    if (Math.hypot(crossing.x - x, crossing.z - z) > 8) continue
    const toward = (crossing.x - x) * dx + (crossing.z - z) * dz
    if (toward <= 0) continue
    if (movingX && lights.ewRed) return true
    if (!movingX && lights.nsRed) return true
  }
  return false
}

function makeVehicle(kind, color) {
  const group = new THREE.Group()
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.25 })
  const dark = new THREE.MeshStandardMaterial({ color: '#1b1b1b', roughness: 0.9 })
  if (kind === 'scooter') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 1.8), paint)
    body.position.y = 0.68
    const rider = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.46, 0.36), dark)
    rider.position.set(0, 1.12, -0.1)
    group.add(body, rider)
    addWheel(group, 0, 0.62, 0.32)
    addWheel(group, 0, -0.62, 0.32)
    return group
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.55, 2.9), paint)
  body.position.y = 0.58
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.42, 1.2), dark)
  cabin.position.y = 1.02
  group.add(body, cabin)
  for (const [x, z] of [[0.68, 0.95], [-0.68, 0.95], [0.68, -0.95], [-0.68, -0.95]]) addWheel(group, x, z, 0.28)
  return group
}

function addWheel(group, x, z, radius) {
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.18, 8),
    new THREE.MeshStandardMaterial({ color: '#1b1b1b', roughness: 0.95 }),
  )
  wheel.rotation.z = Math.PI / 2
  wheel.position.set(x, radius, z)
  group.add(wheel)
}
