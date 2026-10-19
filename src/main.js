import * as THREE from 'three'
import './shell.css'
import { createChaseCamera } from './camera.js'
import { createCar } from './car.js'
import { createGame } from './game.js'
import { createInput } from './input.js'
import { createSoccer } from './soccer.js'
import { createWorld } from './world.js'

const screen = document.getElementById('screen')
const hud = document.getElementById('hud')
const canvas = document.createElement('canvas')
screen.prepend(canvas)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 240)
const world = createWorld(scene)
const car = createCar(scene)
const chase = createChaseCamera(camera)
const soccer = createSoccer()
const input = createInput(document.getElementById('device'))
const game = createGame({ input, car, world, chase, hud, soccer })

function resize() {
  const width = Math.max(1, screen.clientWidth)
  const height = Math.max(1, screen.clientHeight)
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  soccer.camera.aspect = width / height
  soccer.camera.updateProjectionMatrix()
}

const observer = new ResizeObserver(resize)
observer.observe(screen)
resize()

let last = performance.now()
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000)
  last = now
  game.update(dt)
  if (game.view() === 'soccer') {
    renderer.render(soccer.scene, soccer.camera)
  } else {
    chase.update(dt, car.pose)
    renderer.render(scene, camera)
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
