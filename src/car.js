import * as THREE from 'three'
import { yawForHeading } from './track.js'

const CAR_RADIUS = 1.15

export function createCar(scene) {
  const pose = { x: 0, z: 0, heading: 0, speed: 0, onRoad: true }
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)
  scene.add(root)

  const paint = new THREE.MeshStandardMaterial({ color: '#f3efe4', roughness: 0.42, metalness: 0.18 })
  const stripe = new THREE.MeshStandardMaterial({ color: '#b4332a', roughness: 0.5, metalness: 0.05 })
  const dark = new THREE.MeshStandardMaterial({ color: '#1a242c', roughness: 0.25, metalness: 0.08 })
  const chrome = new THREE.MeshStandardMaterial({ color: '#d5d8dd', roughness: 0.28, metalness: 0.85 })
  const tireMat = new THREE.MeshStandardMaterial({ color: '#1b1b1b', roughness: 0.95 })
  const hubMat = new THREE.MeshStandardMaterial({ color: '#c8ccd1', roughness: 0.35, metalness: 0.7 })
  const tailMat = new THREE.MeshStandardMaterial({
    color: '#ff3b30',
    emissive: '#ff2a22',
    emissiveIntensity: 0.25,
    roughness: 0.4,
  })
  const lampMat = new THREE.MeshStandardMaterial({
    color: '#fff4cf',
    emissive: '#ffe7a3',
    emissiveIntensity: 0.55,
    roughness: 0.35,
  })

  function addBox(w, h, d, x, y, z, material, parent = body) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  addBox(1.82, 0.46, 4.05, 0, 0.58, 0, paint)
  addBox(1.7, 0.14, 1.35, 0, 0.84, 1.15, paint)
  addBox(1.66, 0.16, 0.72, 0, 0.86, -1.55, paint)
  addBox(1.56, 0.46, 1.65, 0, 1.02, -0.28, paint)
  addBox(1.84, 0.08, 3.3, 0, 0.78, -0.1, stripe)
  addBox(1.42, 0.34, 0.06, 0, 1.08, 0.52, dark).rotation.x = -0.42
  addBox(1.36, 0.28, 0.06, 0, 1.08, -1.08, dark)
  addBox(0.62, 0.28, 0.05, 0.78, 1.05, -0.28, dark)
  addBox(0.62, 0.28, 0.05, -0.78, 1.05, -0.28, dark)
  addBox(1.92, 0.16, 0.16, 0, 0.42, 2.08, chrome)
  addBox(1.92, 0.16, 0.16, 0, 0.42, -2.08, chrome)
  addBox(0.28, 0.16, 0.08, 0.62, 0.72, 2.08, lampMat)
  addBox(0.28, 0.16, 0.08, -0.62, 0.72, 2.08, lampMat)
  addBox(0.32, 0.16, 0.08, 0.62, 0.72, -2.08, tailMat)
  addBox(0.32, 0.16, 0.08, -0.62, 0.72, -2.08, tailMat)

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.22, 0.04),
    new THREE.MeshStandardMaterial({ map: plateTexture(), roughness: 0.6 }),
  )
  plate.position.set(0, 0.48, -2.2)
  body.add(plate)

  const cabin = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), dark)
  cabin.position.set(0.28, 1.18, -0.15)
  cabin.castShadow = true
  body.add(cabin)

  const wheels = []
  function makeWheel(x, z, front) {
    const steerPivot = new THREE.Group()
    steerPivot.position.set(x, 0.36, z)
    const spin = new THREE.Group()
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 18), tireMat)
    tire.rotation.z = Math.PI / 2
    tire.castShadow = true
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 12), hubMat)
    hub.rotation.z = Math.PI / 2
    const nub = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.08), stripe)
    nub.position.set(0, 0.28, 0)
    spin.add(tire, hub, nub)
    steerPivot.add(spin)
    body.add(steerPivot)
    wheels.push({ spin, steerPivot, front })
  }

  makeWheel(0.95, 1.28, true)
  makeWheel(-0.95, 1.28, true)
  makeWheel(0.95, -1.28, false)
  makeWheel(-0.95, -1.28, false)

  let steerVisual = 0

  function sync(dt, braking) {
    root.position.set(pose.x, 0.04, pose.z)
    root.rotation.y = yawForHeading(pose.heading)
    body.rotation.z = -steerVisual * 0.08
    tailMat.emissiveIntensity = braking && pose.speed > 0.4 ? 1 : 0.22
    const spin = (pose.speed / 0.36) * dt
    for (const wheel of wheels) {
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
    const steerInput = (input.held.left ? 1 : 0) - (input.held.right ? 1 : 0)
    const throttle = input.held.up && !input.held.down
    const braking = input.held.down
    pose.onRoad = world.isOnRoad(pose.x, pose.z)

    const maxForward = pose.onRoad ? 18 : 7.5
    const maxReverse = pose.onRoad ? 7 : 4
    const engine = pose.onRoad ? 11 : 6
    const drag = pose.onRoad ? 0.4 : 1.7

    if (throttle) pose.speed += engine * dt
    else if (braking) {
      if (pose.speed > 0.45) pose.speed -= 24 * dt
      else pose.speed -= engine * 0.75 * dt
    } else {
      pose.speed -= pose.speed * drag * dt
      if (Math.abs(pose.speed) < 0.12) pose.speed = 0
    }

    if (pose.speed > maxForward) {
      if (pose.onRoad) pose.speed = maxForward
      else pose.speed = Math.max(maxForward, pose.speed - 12 * dt)
    }
    if (pose.speed < -maxReverse) pose.speed = -maxReverse

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
    pose.x = origin.x
    pose.z = origin.z
    pose.heading = origin.heading
    pose.speed = 0
    pose.onRoad = true
    steerVisual = 0
    sync(0, false)
  }

  return { pose, update, reset }
}

function plateTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 48
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f4d35e'
  ctx.fillRect(0, 0, 128, 48)
  ctx.strokeStyle = '#222'
  ctx.lineWidth = 6
  ctx.strokeRect(3, 3, 122, 42)
  ctx.fillStyle = '#222'
  ctx.font = 'bold 22px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('CLASSIC', 64, 26)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
