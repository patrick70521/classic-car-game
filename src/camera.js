export function createChaseCamera(camera) {
  let snap = true

  function update(dt, pose) {
    const follow = 9
    const height = 3.7
    const fx = Math.cos(pose.heading)
    const fz = Math.sin(pose.heading)
    const targetX = pose.x - fx * follow
    const targetY = height
    const targetZ = pose.z - fz * follow
    const blend = snap ? 1 : 1 - Math.exp(-4.2 * dt)
    camera.position.x += (targetX - camera.position.x) * blend
    camera.position.y += (targetY - camera.position.y) * blend
    camera.position.z += (targetZ - camera.position.z) * blend
    camera.lookAt(pose.x + fx * 5, 1.05, pose.z + fz * 5)
    snap = false
  }

  return {
    update,
    snapNext() {
      snap = true
    },
  }
}
