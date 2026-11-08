import http from 'node:http'
import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { WebSocketServer } from 'ws'

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const ROOM_TTL = 120
const redisUrl = process.env.REDIS_URL || process.env.KV_URL || process.env.UPSTASH_REDIS_URL || ''

const memory = new Map()
const sockets = new Map()
const watched = new Set()

let pub = null
let sub = null

if (redisUrl) {
  const { default: Redis } = await import('ioredis')
  pub = new Redis(redisUrl, { maxRetriesPerRequest: 2, enableReadyCheck: false })
  sub = new Redis(redisUrl, { maxRetriesPerRequest: 2, enableReadyCheck: false })
  sub.on('message', (channel, raw) => {
    const code = channel.slice('room:'.length)
    let packet
    try {
      packet = JSON.parse(raw)
    } catch {
      return
    }
    const room = sockets.get(code)
    if (!room) return
    const dest = packet.from === 'host' ? room.guest : room.host
    send(dest, packet.payload)
  })
}

function makeCode() {
  const bytes = randomBytes(4)
  let code = ''
  for (let i = 0; i < 4; i += 1) code += ALPHABET[bytes[i] % ALPHABET.length]
  return code
}

function makeToken() {
  return randomBytes(8).toString('hex')
}

function send(socket, payload) {
  if (!socket || socket.readyState !== 1) return
  socket.send(JSON.stringify(payload))
}

async function readRoom(code) {
  if (!pub) return memory.get(code) || null
  const raw = await pub.get(`room:${code}`)
  return raw ? JSON.parse(raw) : null
}

async function writeRoom(code, record) {
  if (!pub) {
    memory.set(code, record)
    return
  }
  await pub.set(`room:${code}`, JSON.stringify(record), 'EX', ROOM_TTL)
}

async function dropRoom(code) {
  sockets.delete(code)
  if (!pub) {
    memory.delete(code)
    return
  }
  await pub.del(`room:${code}`)
  if (watched.has(code)) {
    watched.delete(code)
    await sub.unsubscribe(`room:${code}`)
  }
}

async function watch(code) {
  if (!sub || watched.has(code)) return
  watched.add(code)
  await sub.subscribe(`room:${code}`)
}

function relay(code, from, payload) {
  if (!pub) {
    const room = sockets.get(code)
    if (!room) return
    send(from === 'host' ? room.guest : room.host, payload)
    return
  }
  pub.publish(`room:${code}`, JSON.stringify({ from, payload })).catch(() => {})
}

function slot(code) {
  let room = sockets.get(code)
  if (!room) {
    room = { host: null, guest: null }
    sockets.set(code, room)
  }
  return room
}

const server = http.createServer()
const wss = new WebSocketServer({ server })

wss.on('connection', (socket) => {
  const seat = { role: null, code: null, bye: false }

  socket.on('message', (data) => {
    void handle(socket, seat, data).catch(() => {
      send(socket, { t: 'error', reason: 'NO ROOM' })
    })
  })

  socket.on('close', () => {
    void hangup(socket, seat)
  })
})

async function handle(socket, seat, data) {
  let msg
  try {
    msg = JSON.parse(String(data))
  } catch {
    return
  }
  if (!msg || typeof msg.t !== 'string') return

  if (msg.t === 'host') {
    const code = await freshCode()
    const token = makeToken()
    await watch(code)
    await writeRoom(code, { hostToken: token, guestToken: null })
    const room = slot(code)
    room.host = socket
    seat.role = 'host'
    seat.code = code
    send(socket, { t: 'code', code, token })
    return
  }

  if (msg.t === 'join') {
    const code = String(msg.code || '').toUpperCase()
    const record = await readRoom(code)
    if (!record) {
      send(socket, { t: 'error', reason: 'NO ROOM' })
      return
    }
    if (record.guestToken) {
      send(socket, { t: 'error', reason: 'ROOM FULL' })
      return
    }
    const token = makeToken()
    record.guestToken = token
    await watch(code)
    await writeRoom(code, record)
    const room = slot(code)
    room.guest = socket
    seat.role = 'guest'
    seat.code = code
    send(socket, { t: 'ready', token })
    relay(code, 'guest', { t: 'ready' })
    return
  }

  if (msg.t === 'resume') {
    const code = String(msg.code || '').toUpperCase()
    const record = await readRoom(code)
    const role = msg.role === 'guest' ? 'guest' : 'host'
    const token = record && (role === 'host' ? record.hostToken : record.guestToken)
    if (!record || !token || token !== msg.token) {
      send(socket, { t: 'error', reason: 'NO ROOM' })
      return
    }
    await watch(code)
    const room = slot(code)
    room[role] = socket
    seat.role = role
    seat.code = code
    const matched = role === 'host' ? Boolean(record.guestToken) : true
    if (!matched) {
      send(socket, { t: 'code', code, token: record.hostToken })
      return
    }
    send(socket, { t: 'ready' })
    relay(code, role, { t: 'ready' })
    return
  }

  if (msg.t === 'bye') {
    seat.bye = true
    return
  }

  if (!seat.role || !seat.code) return
  if (msg.t !== 'in' && msg.t !== 'st') return
  const record = await readRoom(seat.code)
  if (record) await writeRoom(seat.code, record)
  relay(seat.code, seat.role, msg)
}

async function hangup(socket, seat) {
  if (!seat.code || !seat.role) return
  const room = sockets.get(seat.code)
  if (room && room[seat.role] === socket) room[seat.role] = null
  if (!seat.bye) return
  relay(seat.code, seat.role, { t: 'left' })
  await dropRoom(seat.code)
}

async function freshCode() {
  for (let i = 0; i < 8; i += 1) {
    const code = makeCode()
    if (!(await readRoom(code))) return code
  }
  return makeCode()
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  server.listen(8787, '0.0.0.0', () => {
    console.log(`room server on 8787${redisUrl ? ' with redis' : ''}`)
  })
}

export default server
