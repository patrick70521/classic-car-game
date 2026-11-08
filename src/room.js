export function roomUrl() {
  if (import.meta.env.VITE_ROOM_URL) return import.meta.env.VITE_ROOM_URL
  if (location.port === '5173') return `ws://${location.hostname}:8787`
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/api/room`
}

export function createRoom(handlers) {
  let socket = null
  let role = null
  let code = null
  let token = null
  let intentional = false
  let failed = false
  let retries = 0
  let status = 'idle'
  let reconnectTimer = null
  let lifeTimer = null

  function clearTimers() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (lifeTimer) clearTimeout(lifeTimer)
    reconnectTimer = null
    lifeTimer = null
  }

  function setStatus(next) {
    status = next
    handlers.onStatus(next)
  }

  function open(resume) {
    clearTimers()
    const ws = new WebSocket(roomUrl())
    socket = ws
    ws.addEventListener('open', () => {
      retries = 0
      lifeTimer = setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) ws.close()
      }, 240000)
      if (resume) ws.send(JSON.stringify({ t: 'resume', role, code, token }))
      else if (role === 'host') ws.send(JSON.stringify({ t: 'host' }))
      else ws.send(JSON.stringify({ t: 'join', code }))
    })
    ws.addEventListener('message', (event) => {
      let msg
      try {
        msg = JSON.parse(event.data)
      } catch {
        return
      }
      if (msg.t === 'code') {
        code = msg.code
        token = msg.token
        setStatus('waiting')
        handlers.onCode(code)
        return
      }
      if (msg.t === 'ready') {
        if (msg.token) token = msg.token
        setStatus('live')
        handlers.onReady()
        return
      }
      if (msg.t === 'error') {
        failed = true
        setStatus('error')
        handlers.onError(msg.reason || 'NO ROOM')
        ws.close()
        return
      }
      if (msg.t === 'left') {
        failed = true
        setStatus('lost')
        handlers.onLeft()
        return
      }
      if (msg.t === 'in') handlers.onInput(msg)
      if (msg.t === 'st') handlers.onState(msg)
    })
    ws.addEventListener('close', () => {
      if (lifeTimer) clearTimeout(lifeTimer)
      lifeTimer = null
      if (intentional || failed) return
      if (socket !== ws) return
      retries += 1
      if (!code || !token || retries > 6) {
        setStatus('lost')
        handlers.onLeft()
        return
      }
      setStatus('reconnecting')
      const delay = Math.min(1000 * 2 ** (retries - 1), 8000)
      reconnectTimer = setTimeout(() => open(true), delay)
    })
  }

  function send(payload) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify(payload))
  }

  function leave() {
    intentional = true
    failed = true
    clearTimers()
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ t: 'bye' }))
      socket.close()
    } else if (socket) {
      socket.close()
    }
    socket = null
    role = null
    code = null
    token = null
    status = 'idle'
  }

  return {
    host() {
      leave()
      intentional = false
      failed = false
      retries = 0
      role = 'host'
      setStatus('connecting')
      open(false)
    },
    join(nextCode) {
      leave()
      intentional = false
      failed = false
      retries = 0
      role = 'guest'
      code = nextCode
      setStatus('connecting')
      open(false)
    },
    send,
    leave,
    role: () => role,
    status: () => status,
  }
}
