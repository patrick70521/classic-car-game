import { spawn } from 'node:child_process'

const children = [
  spawn(process.execPath, ['api/room.mjs'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '--port', '5173', '--strictPort'], { stdio: 'inherit' }),
]

function stop() {
  for (const child of children) child.kill('SIGTERM')
  process.exit(0)
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
for (const child of children) {
  child.on('exit', (code) => {
    if (code) stop()
  })
}
