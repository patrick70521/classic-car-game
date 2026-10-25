import * as THREE from 'three'
import { buildCarBody } from './car.js'

const ORDER = ['cyber', 'lambo', 'ferrari', 'bmw', 'porsche']
const RADIUS = 4.8

export function createGarage() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#14161c')
  scene.fog = new THREE.Fog('#14161c', 18, 40)

  const hemi = new THREE.HemisphereLight('#d7e2f2', '#2a241c', 0.7)
  scene.add(hemi)
  const key = new THREE.SpotLight('#fff4e0', 22, 28, 0.85, 0.4, 1)
  key.position.set(0.6, 6.4, 8)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  scene.add(key)
  const fill = new THREE.PointLight('#9eb4d0', 8, 24, 2)
  fill.position.set(-6, 3.2, 2)
  const fillRight = new THREE.PointLight('#d0c4a8', 8, 24, 2)
  fillRight.position.set(6, 3.2, -1)
  const rear = new THREE.PointLight('#8ea0b8', 5, 18, 2)
  rear.position.set(0, 3, -7)
  scene.add(fill, fillRight, rear)

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 26),
    new THREE.MeshStandardMaterial({ color: '#3a3e46', roughness: 0.92 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const wallMat = new THREE.MeshStandardMaterial({ color: '#2a2e36', roughness: 0.88 })
  const back = new THREE.Mesh(new THREE.BoxGeometry(24, 6, 0.3), wallMat)
  back.position.set(0, 3, -11)
  back.receiveShadow = true
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 22), wallMat)
  left.position.set(-12, 3, -1)
  const right = left.clone()
  right.position.x = 12
  scene.add(back, left, right)

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.08, 0.08),
    new THREE.MeshStandardMaterial({ color: '#ffe56a', emissive: '#c9a227', emissiveIntensity: 0.35 }),
  )
  trim.position.set(0, 4.2, -10.8)
  scene.add(trim)

  const ring = new THREE.Group()
  scene.add(ring)
  const pads = []
  const bodies = {}
  const discMat = new THREE.MeshStandardMaterial({ color: '#1c1e24', roughness: 0.55, metalness: 0.35 })
  for (let i = 0; i < ORDER.length; i += 1) {
    const angle = (i / ORDER.length) * Math.PI * 2
    const spinner = new THREE.Group()
    spinner.position.set(Math.sin(angle) * RADIUS, 0, Math.cos(angle) * RADIUS)
    spinner.rotation.y = angle
    spinner.userData.outward = angle
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.08, 36), discMat)
    disc.position.y = 0.04
    disc.receiveShadow = true
    const body = buildCarBody(ORDER[i])
    body.group.position.y = 0.06
    spinner.add(disc, body.group)
    ring.add(spinner)
    pads.push(spinner)
    bodies[ORDER[i]] = body
  }

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 60)
  camera.position.set(0, 1.9, 10.6)
  camera.lookAt(0, 0.65, 4.8)
  key.target.position.set(0, 0.65, 4.8)
  scene.add(key.target)

  let focusIndex = 0
  let ringYaw = 0

  function focus(index) {
    focusIndex = index
  }

  function paint(id, hex) {
    const body = bodies[id]
    if (body) body.paint.color.set(hex)
  }

  function update(dt) {
    const step = (Math.PI * 2) / ORDER.length
    const target = -focusIndex * step
    const delta = Math.atan2(Math.sin(target - ringYaw), Math.cos(target - ringYaw))
    ringYaw += delta * Math.min(1, dt * 5)
    ring.rotation.y = ringYaw
    for (let i = 0; i < pads.length; i += 1) {
      if (i === focusIndex) pads[i].rotation.y += dt * 0.45
      else pads[i].rotation.y = pads[i].userData.outward
    }
  }

  return { scene, camera, focus, paint, update }
}
