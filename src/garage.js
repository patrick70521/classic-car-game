import * as THREE from 'three'

export function createGarage() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#14161c')
  scene.fog = new THREE.Fog('#14161c', 12, 28)

  const hemi = new THREE.HemisphereLight('#d7e2f2', '#2a241c', 0.55)
  scene.add(hemi)
  const key = new THREE.SpotLight('#fff4e0', 18, 16, 0.7, 0.45, 1)
  key.position.set(0.4, 5.2, 2.2)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  scene.add(key)
  const fill = new THREE.PointLight('#9eb4d0', 4, 14, 2)
  fill.position.set(-3.2, 2.4, 1)
  scene.add(fill)

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 16),
    new THREE.MeshStandardMaterial({ color: '#3a3e46', roughness: 0.92 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const wallMat = new THREE.MeshStandardMaterial({ color: '#2a2e36', roughness: 0.88 })
  const back = new THREE.Mesh(new THREE.BoxGeometry(14, 5, 0.3), wallMat)
  back.position.set(0, 2.5, -5.2)
  back.receiveShadow = true
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 12), wallMat)
  left.position.set(-6.2, 2.5, 0)
  const right = left.clone()
  right.position.x = 6.2
  scene.add(back, left, right)

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.08, 0.08),
    new THREE.MeshStandardMaterial({ color: '#ffe56a', emissive: '#c9a227', emissiveIntensity: 0.35 }),
  )
  trim.position.set(0, 3.4, -5)
  scene.add(trim)

  const turntable = new THREE.Group()
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 0.08, 40),
    new THREE.MeshStandardMaterial({ color: '#1c1e24', roughness: 0.55, metalness: 0.35 }),
  )
  disc.position.y = 0.04
  disc.receiveShadow = true
  turntable.add(disc)
  scene.add(turntable)

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 40)
  camera.position.set(3.5, 1.65, 4.5)
  camera.lookAt(0, 0.55, 0)
  key.target.position.set(0, 0.5, 0)
  scene.add(key.target)

  function update(dt) {
    turntable.rotation.y += dt * 0.4
  }

  return { scene, camera, turntable, update }
}
