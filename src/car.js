import * as THREE from 'three'
import { yawForHeading } from './track.js'

const CAR_RADIUS = 1.15

export function createCar(scene) {
  const pose = { x: 0, z: 0, heading: 0, speed: 0, onRoad: true }
  const root = new THREE.Group()
  scene.add(root)

  const headlight = new THREE.SpotLight('#fff4d2', 18, 42, 0.62, 0.42, 1.1)
  headlight.position.set(0, 1.05, 1.5)
  const headTarget = new THREE.Object3D()
  headTarget.position.set(0, 0.15, 18)
  const nose = new THREE.PointLight('#fff1c9', 1.4, 9, 2)
  nose.position.set(0, 0.95, 1.7)
  root.add(headlight, headTarget, nose)
  headlight.target = headTarget

  const styles = {
    cyber: buildCarBody('cyber'),
    lambo: buildCarBody('lambo'),
    ferrari: buildCarBody('ferrari'),
    bmw: buildCarBody('bmw'),
    porsche: buildCarBody('porsche'),
  }
  root.add(styles.cyber.group, styles.lambo.group, styles.ferrari.group, styles.bmw.group, styles.porsche.group)
  let style = 'cyber'
  for (const key of Object.keys(styles)) styles[key].group.visible = key === style
  const home = scene
  let parked = false

  let steerVisual = 0

  function active() {
    return styles[style]
  }

  function setStyle(id) {
    if (!styles[id]) return
    style = id
    for (const key of Object.keys(styles)) styles[key].group.visible = key === style
  }

  function setColor(hex) {
    active().paint.color.set(hex)
  }

  function mount(parent) {
    parent.add(root)
    parked = parent !== home
    headlight.intensity = parked ? 0 : 18
    nose.intensity = parked ? 0 : 1.4
    if (parked) {
      root.position.set(0, 0.04, 0)
      root.rotation.set(0, 0, 0)
      steerVisual = 0
    }
  }

  function sync(dt, braking) {
    if (!parked) {
      root.position.set(pose.x, 0.04, pose.z)
      root.rotation.y = yawForHeading(pose.heading)
    }
    const current = active()
    current.group.rotation.z = parked ? 0 : -steerVisual * 0.08
    current.tail.emissiveIntensity = braking && pose.speed > 0.4 ? 1 : 0.22
    const spin = (pose.speed / current.wheelRadius) * dt
    for (const wheel of current.wheels) {
      wheel.spin.rotation.x -= spin
      wheel.steerPivot.rotation.y = wheel.front ? -steerVisual : 0
    }
  }

  function dampInto(nx, nz) {
    if (Math.abs(pose.speed) < 0.05) return
    const dir = Math.sign(pose.speed)
    const approaching = dir * (Math.cos(pose.heading) * nx + Math.sin(pose.heading) * nz)
    if (approaching < -0.2) pose.speed *= Math.max(0.08, 1 + approaching * 0.9)
  }

  function pushCircle(cx, cz, radius) {
    const dx = pose.x - cx
    const dz = pose.z - cz
    const min = radius + CAR_RADIUS
    const distSq = dx * dx + dz * dz
    if (distSq >= min * min) return
    const dist = Math.sqrt(distSq) || 0.0001
    const nx = dx / dist
    const nz = dz / dist
    pose.x = cx + nx * min
    pose.z = cz + nz * min
    dampInto(nx, nz)
  }

  function resolveObstacles(world) {
    for (const obstacle of world.colliders) pushCircle(obstacle.x, obstacle.z, obstacle.r)
    const limit = world.limit
    if (Math.abs(pose.x) > limit || Math.abs(pose.z) > limit) {
      pose.x = Math.max(-limit, Math.min(limit, pose.x))
      pose.z = Math.max(-limit, Math.min(limit, pose.z))
      pose.speed *= 0.3
    }
  }

  function update(dt, input, world) {
    const stick = input.stick
    const usingStick = Boolean(stick && stick.active)
    const steerInput = usingStick ? stick.x : (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0)
    const forward = usingStick ? Math.max(0, stick.y) : (input.held.up && !input.held.down ? 1 : 0)
    const back = usingStick ? Math.max(0, -stick.y) : (input.held.down ? 1 : 0)
    const throttle = forward > 0.05
    const braking = back > 0.05
    pose.onRoad = world.isOnRoad(pose.x, pose.z)

    const maxForward = pose.onRoad ? 18 : 7.5
    const maxReverse = pose.onRoad ? 7 : 4
    const engine = pose.onRoad ? 11 : 6
    const drag = pose.onRoad ? 0.4 : 1.7

    if (throttle) pose.speed += engine * forward * dt
    else if (braking) {
      if (pose.speed > 0.45) pose.speed -= 24 * back * dt
      else pose.speed -= engine * 0.75 * back * dt
    } else {
      pose.speed -= pose.speed * drag * dt
      if (Math.abs(pose.speed) < 0.12) pose.speed = 0
    }

    const forwardCap = usingStick && throttle ? maxForward * forward : maxForward
    const reverseCap = usingStick && braking ? maxReverse * back : maxReverse
    if (pose.speed > forwardCap) {
      if (pose.onRoad || usingStick) pose.speed = forwardCap
      else pose.speed = Math.max(forwardCap, pose.speed - 12 * dt)
    }
    if (pose.speed < -reverseCap) pose.speed = -reverseCap

    if (Math.abs(pose.speed) > 0.35) {
      const speedFactor = Math.min(Math.abs(pose.speed) / 18, 1)
      const rate = 0.75 + speedFactor * 1.45
      pose.heading += steerInput * rate * dt * Math.sign(pose.speed)
    }

    pose.x += Math.cos(pose.heading) * pose.speed * dt
    pose.z += Math.sin(pose.heading) * pose.speed * dt
    resolveObstacles(world)

    steerVisual += (steerInput * 0.4 - steerVisual) * Math.min(1, dt * 12)
    sync(dt, braking)
  }

  function reset(origin) {
    parked = false
    headlight.intensity = 18
    nose.intensity = 1.4
    if (root.parent !== home) home.add(root)
    pose.x = origin.x
    pose.z = origin.z
    pose.heading = origin.heading
    pose.speed = 0
    pose.onRoad = true
    steerVisual = 0
    sync(0, false)
  }

  return { pose, update, reset, setStyle, setColor, mount }
}

const BUILDERS = {
  cyber: buildCybertruck,
  lambo: buildLamborghini,
  ferrari: buildFerrari,
  bmw: buildBmw,
  porsche: buildPorsche,
}

export function buildCarBody(id) {
  const build = BUILDERS[id]
  return build ? build() : null
}

function buildCybertruck() {
  const group = new THREE.Group()
  const steel = new THREE.MeshStandardMaterial({ color: '#c5c8ce', roughness: 0.38, metalness: 0.72 })
  const dark = new THREE.MeshStandardMaterial({ color: '#1b1e24', roughness: 0.45, metalness: 0.15 })
  const glass = new THREE.MeshStandardMaterial({ color: '#9eb4c4', roughness: 0.12, metalness: 0.35 })
  const lamp = new THREE.MeshStandardMaterial({
    color: '#fff4cf',
    emissive: '#ffe7a3',
    emissiveIntensity: 1.4,
    roughness: 0.35,
  })
  const tail = new THREE.MeshStandardMaterial({
    color: '#ff3b30',
    emissive: '#ff2a22',
    emissiveIntensity: 0.22,
    roughness: 0.4,
  })

  function addBox(w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }

  addBox(2.05, 0.62, 4.55, 0, 0.62, 0, steel)
  const hood = addBox(1.95, 0.1, 1.7, 0, 0.96, 1.15, steel)
  hood.rotation.x = 0.2
  addBox(1.9, 0.5, 1.55, 0, 1.08, -0.2, steel)
  const windshield = addBox(1.72, 0.42, 0.06, 0, 1.12, 0.55, glass)
  windshield.rotation.x = 0.5
  addBox(1.5, 0.22, 0.05, 0, 1.18, -0.95, glass)
  addBox(1.72, 0.1, 1.35, 0, 0.98, -1.45, steel)
  addBox(1.55, 0.08, 0.1, 0, 0.82, 2.22, lamp)
  addBox(1.7, 0.1, 0.08, 0, 0.72, -2.28, tail)

  const wheels = [
    makeWheel(group, 1.08, 1.5, true, 0.42, dark),
    makeWheel(group, -1.08, 1.5, true, 0.42, dark),
    makeWheel(group, 1.08, -1.5, false, 0.42, dark),
    makeWheel(group, -1.08, -1.5, false, 0.42, dark),
  ]
  return { group, wheels, tail, paint: steel, wheelRadius: 0.42 }
}

function buildLamborghini() {
  const group = new THREE.Group()
  const yellow = new THREE.MeshStandardMaterial({ color: '#f0c106', roughness: 0.32, metalness: 0.22 })
  const black = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.55, metalness: 0.08 })
  const glass = new THREE.MeshStandardMaterial({ color: '#1c242c', roughness: 0.08, metalness: 0.4 })
  const lamp = new THREE.MeshStandardMaterial({
    color: '#fff4cf',
    emissive: '#ffe7a3',
    emissiveIntensity: 1.4,
    roughness: 0.35,
  })
  const tail = new THREE.MeshStandardMaterial({
    color: '#ff3b30',
    emissive: '#ff2a22',
    emissiveIntensity: 0.22,
    roughness: 0.4,
  })

  function addBox(w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }

  addBox(2.08, 0.34, 4.15, 0, 0.4, -0.05, yellow)
  const nose = addBox(1.35, 0.16, 0.85, 0, 0.4, 1.95, yellow)
  nose.rotation.x = 0.35
  addBox(1.95, 0.16, 1.45, 0, 0.58, 0.85, yellow)
  addBox(1.45, 0.32, 1.15, 0, 0.68, -0.15, yellow)
  const windshield = addBox(1.28, 0.36, 0.06, 0, 0.78, 0.42, glass)
  windshield.rotation.x = -0.7
  addBox(1.2, 0.22, 0.05, 0, 0.78, -0.7, glass)
  addBox(0.16, 0.22, 0.7, 0.96, 0.52, 0.15, black)
  addBox(0.16, 0.22, 0.7, -0.96, 0.52, 0.15, black)
  addBox(1.85, 0.2, 0.85, 0, 0.58, -1.45, yellow)
  addBox(0.08, 0.42, 0.08, 0.62, 0.86, -1.85, black)
  addBox(0.08, 0.42, 0.08, -0.62, 0.86, -1.85, black)
  addBox(1.75, 0.07, 0.38, 0, 1.08, -1.9, black)
  addBox(0.42, 0.1, 0.08, 0.55, 0.48, 2.05, lamp)
  addBox(0.42, 0.1, 0.08, -0.55, 0.48, 2.05, lamp)
  addBox(0.55, 0.1, 0.06, 0.62, 0.5, -2.1, tail)
  addBox(0.55, 0.1, 0.06, -0.62, 0.5, -2.1, tail)

  const wheels = [
    makeWheel(group, 1.02, 1.32, true, 0.34, black),
    makeWheel(group, -1.02, 1.32, true, 0.34, black),
    makeWheel(group, 1.02, -1.38, false, 0.34, black),
    makeWheel(group, -1.02, -1.38, false, 0.34, black),
  ]
  return { group, wheels, tail, paint: yellow, wheelRadius: 0.34 }
}

function buildFerrari() {
  const group = new THREE.Group()
  const red = new THREE.MeshStandardMaterial({ color: '#c1121f', roughness: 0.3, metalness: 0.25 })
  const black = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.55, metalness: 0.08 })
  const glass = new THREE.MeshStandardMaterial({ color: '#1c242c', roughness: 0.08, metalness: 0.4 })
  const lamp = new THREE.MeshStandardMaterial({
    color: '#fff4cf',
    emissive: '#ffe7a3',
    emissiveIntensity: 1.4,
    roughness: 0.35,
  })
  const tail = new THREE.MeshStandardMaterial({
    color: '#ff3b30',
    emissive: '#ff2a22',
    emissiveIntensity: 0.45,
    roughness: 0.4,
  })

  function addBox(w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }

  addBox(1.95, 0.32, 3.7, 0, 0.38, -0.1, red)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), red)
  nose.scale.set(1.45, 0.5, 1.15)
  nose.position.set(0, 0.42, 1.72)
  nose.castShadow = true
  group.add(nose)
  addBox(1.7, 0.14, 1.2, 0, 0.52, 0.7, red)
  addBox(1.25, 0.16, 1.05, 0, 0.62, -0.15, black)
  const windshield = addBox(1.15, 0.32, 0.06, 0, 0.7, 0.32, glass)
  windshield.rotation.x = -0.62
  addBox(1.05, 0.2, 0.05, 0, 0.68, -0.62, glass)
  addBox(1.7, 0.18, 0.7, 0, 0.5, -1.35, red)
  for (const x of [0.62, -0.62]) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), tail)
    bulb.position.set(x, 0.46, -1.78)
    bulb.castShadow = true
    group.add(bulb)
  }
  addBox(0.34, 0.08, 0.08, 0.48, 0.46, 1.95, lamp)
  addBox(0.34, 0.08, 0.08, -0.48, 0.46, 1.95, lamp)

  const wheels = [
    makeWheel(group, 0.98, 1.2, true, 0.33, black),
    makeWheel(group, -0.98, 1.2, true, 0.33, black),
    makeWheel(group, 0.98, -1.25, false, 0.33, black),
    makeWheel(group, -0.98, -1.25, false, 0.33, black),
  ]
  return { group, wheels, tail, paint: red, wheelRadius: 0.33 }
}

function buildBmw() {
  const group = new THREE.Group()
  const blue = new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.34, metalness: 0.45 })
  const black = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.55, metalness: 0.08 })
  const glass = new THREE.MeshStandardMaterial({ color: '#1c242c', roughness: 0.08, metalness: 0.4 })
  const lamp = new THREE.MeshStandardMaterial({
    color: '#fff4cf',
    emissive: '#ffe7a3',
    emissiveIntensity: 1.4,
    roughness: 0.35,
  })
  const tail = new THREE.MeshStandardMaterial({
    color: '#ff3b30',
    emissive: '#ff2a22',
    emissiveIntensity: 0.4,
    roughness: 0.4,
  })

  function addBox(w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }

  addBox(1.9, 0.48, 4.35, 0, 0.52, 0, blue)
  addBox(1.78, 0.12, 1.25, 0, 0.8, 1.25, blue)
  addBox(1.72, 0.46, 2.05, 0, 0.96, -0.2, blue)
  addBox(1.7, 0.14, 0.72, 0, 0.82, -1.72, blue)
  const windshield = addBox(1.58, 0.42, 0.06, 0, 1.02, 0.78, glass)
  windshield.rotation.x = -0.48
  addBox(1.42, 0.28, 0.05, 0, 1.05, -1.18, glass)
  addBox(1.2, 0.28, 0.08, 0, 0.5, 2.16, black)
  addBox(0.08, 0.32, 0.06, 0, 0.52, 2.2, blue)
  addBox(0.38, 0.12, 0.08, 0.64, 0.58, 2.1, lamp)
  addBox(0.38, 0.12, 0.08, -0.64, 0.58, 2.1, lamp)
  for (const x of [0.58, 0.34, -0.34, -0.58]) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), tail)
    bulb.position.set(x, 0.58, -2.12)
    bulb.castShadow = true
    group.add(bulb)
  }

  const wheels = [
    makeWheel(group, 0.98, 1.42, true, 0.38, black),
    makeWheel(group, -0.98, 1.42, true, 0.38, black),
    makeWheel(group, 0.98, -1.42, false, 0.38, black),
    makeWheel(group, -0.98, -1.42, false, 0.38, black),
  ]
  return { group, wheels, tail, paint: blue, wheelRadius: 0.38 }
}

function buildPorsche() {
  const group = new THREE.Group()
  const white = new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.28, metalness: 0.35 })
  const black = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.55, metalness: 0.08 })
  const glass = new THREE.MeshStandardMaterial({ color: '#1c242c', roughness: 0.08, metalness: 0.4 })
  const lamp = new THREE.MeshStandardMaterial({
    color: '#fff4cf',
    emissive: '#ffe7a3',
    emissiveIntensity: 1.4,
    roughness: 0.35,
  })
  const tail = new THREE.MeshStandardMaterial({
    color: '#ff3b30',
    emissive: '#ff2a22',
    emissiveIntensity: 0.4,
    roughness: 0.4,
  })

  function addBox(w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }

  addBox(1.88, 0.36, 3.85, 0, 0.42, -0.05, white)
  addBox(1.55, 0.16, 1.15, 0, 0.62, 0.55, white)
  addBox(1.35, 0.22, 1.15, 0, 0.72, -0.25, white)
  const windshield = addBox(1.22, 0.34, 0.06, 0, 0.78, 0.28, glass)
  windshield.rotation.x = -0.72
  addBox(1.15, 0.22, 0.05, 0, 0.74, -0.78, glass)
  const deck = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), white)
  deck.scale.set(1.55, 0.42, 1.05)
  deck.position.set(0, 0.58, -1.25)
  deck.castShadow = true
  group.add(deck)
  for (const x of [0.55, -0.55]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), lamp)
    eye.scale.set(1.7, 0.7, 0.55)
    eye.position.set(x, 0.5, 1.82)
    group.add(eye)
  }
  for (const x of [0.62, -0.62]) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), tail)
    bulb.scale.set(1.4, 0.7, 0.6)
    bulb.position.set(x, 0.48, -1.82)
    group.add(bulb)
  }

  const wheels = [
    makeWheel(group, 0.96, 1.22, true, 0.34, black),
    makeWheel(group, -0.96, 1.22, true, 0.34, black),
    makeWheel(group, 0.96, -1.28, false, 0.34, black),
    makeWheel(group, -0.96, -1.28, false, 0.34, black),
  ]
  return { group, wheels, tail, paint: white, wheelRadius: 0.34 }
}

function makeWheel(parent, x, z, front, radius, accent) {
  const steerPivot = new THREE.Group()
  steerPivot.position.set(x, radius, z)
  const spin = new THREE.Group()
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.3, 18),
    new THREE.MeshStandardMaterial({ color: '#1b1b1b', roughness: 0.95 }),
  )
  tire.rotation.z = Math.PI / 2
  tire.castShadow = true
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.42, radius * 0.42, 0.32, 12),
    new THREE.MeshStandardMaterial({ color: '#c8ccd1', roughness: 0.35, metalness: 0.7 }),
  )
  hub.rotation.z = Math.PI / 2
  const nub = new THREE.Mesh(new THREE.BoxGeometry(0.08, radius * 0.28, 0.08), accent)
  nub.position.set(0, radius * 0.72, 0)
  spin.add(tire, hub, nub)
  steerPivot.add(spin)
  parent.add(steerPivot)
  return { spin, steerPivot, front }
}
