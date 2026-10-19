const MODES = [
  { id: 'free', label: 'FREE DRIVE' },
  { id: 'race', label: 'LAP RACE' },
  { id: 'cruise', label: 'TIMED CRUISE' },
  { id: 'soccer', label: 'SOCCER' },
]

const BEST_KEY = 'classic-car-best-ms'
const RACE_LAPS = 3

export function createGame({ input, car, world, chase, hud, soccer }) {
  let state = 'menu'
  let mode = 'free'
  let selection = 0
  let menuHold = 0
  let nextCp = 1
  let laps = 0
  let raceMs = 0
  let cruiseMs = 0
  let cruiseRunning = false
  let splitMs = null
  let splitCount = 0
  let splitMark = 0
  let finished = false
  let newBest = false
  let waitExit = false

  function readBest() {
    try {
      const value = Number(localStorage.getItem(BEST_KEY))
      return Number.isFinite(value) && value > 0 ? value : null
    } catch {
      return null
    }
  }

  function writeBest(value) {
    try {
      localStorage.setItem(BEST_KEY, String(value))
    } catch {
      /* storage can be blocked; the race still finishes */
    }
  }

  function freshRun(nextMode) {
    mode = nextMode
    car.reset(world.startPose)
    chase.snapNext()
    nextCp = 1
    laps = 0
    raceMs = 0
    cruiseMs = 0
    cruiseRunning = false
    splitMs = null
    splitCount = 0
    splitMark = 0
    finished = false
    newBest = false
    waitExit = false
    world.setActive(nextMode === 'free' ? -1 : 1)
  }

  function goMenu() {
    state = 'menu'
    freshRun('free')
    world.setActive(-1)
  }

  function startMode(id) {
    state = 'play'
    freshRun(id)
    if (id === 'soccer') soccer.reset()
  }

  function distanceTo(index) {
    const gate = world.checkpoints[index]
    return Math.hypot(car.pose.x - gate.x, car.pose.z - gate.z)
  }

  function collectGate() {
    const completedLoop = nextCp === 0
    if (mode === 'race' && completedLoop) {
      laps += 1
      if (laps >= RACE_LAPS) {
        finished = true
        const best = readBest()
        newBest = best == null || raceMs < best
        if (newBest) writeBest(raceMs)
      }
    }
    if (mode === 'cruise' && completedLoop && cruiseRunning) {
      splitMs = cruiseMs - splitMark
      splitMark = cruiseMs
      splitCount += 1
    }
    nextCp = (nextCp + 1) % world.checkpoints.length
    world.setActive(finished || mode === 'free' ? -1 : nextCp)
  }

  function updateGates() {
    if (mode === 'free' || finished) return
    if (mode === 'cruise' && !cruiseRunning) return
    const distance = distanceTo(nextCp)
    if (waitExit) {
      if (distance > world.checkpointRadius + 2) waitExit = false
      return
    }
    if (distance <= world.checkpointRadius) collectGate()
  }

  function update(dt) {
    const edge = {
      up: input.consumePress('up'),
      down: input.consumePress('down'),
      left: input.consumePress('left'),
      right: input.consumePress('right'),
      a: input.consumePress('a'),
      b: input.consumePress('b'),
      x: input.consumePress('x'),
      y: input.consumePress('y'),
      start: input.consumePress('start'),
      select: input.consumePress('select'),
      reset: input.consumePress('reset'),
    }

    if (edge.reset) {
      goMenu()
      render()
      return
    }

    if (state === 'menu') {
      const dir = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0)
      if (dir === 0) menuHold = 0
      else if (edge.up || edge.down) {
        selection = (selection + dir + MODES.length) % MODES.length
        menuHold = 0
      } else {
        menuHold += dt
        if (menuHold > 0.42) {
          selection = (selection + dir + MODES.length) % MODES.length
          menuHold = 0.22
        }
      }
      if (edge.a) startMode(MODES[selection].id)
      render()
      return
    }

    if (edge.b || edge.select) {
      goMenu()
      render()
      return
    }

    if (edge.start) state = state === 'pause' ? 'play' : 'pause'
    if (state === 'pause') {
      render()
      return
    }

    if (mode === 'soccer') {
      soccer.update(dt, input, edge.a)
      render()
      return
    }

    if (mode === 'cruise' && edge.a) {
      cruiseRunning = !cruiseRunning
      if (cruiseRunning && distanceTo(nextCp) <= world.checkpointRadius) waitExit = true
    }

    car.update(dt, input, world)
    if (mode === 'race' && !finished) raceMs += dt * 1000
    if (mode === 'cruise' && cruiseRunning) cruiseMs += dt * 1000
    updateGates()
    render()
  }

  function render() {
    const mph = Math.round(Math.abs(car.pose.speed) * 4)
    if (state === 'menu') {
      hud.innerHTML = `
        <div class="menu">
          <div class="title">PICK<br>GAME</div>
          ${MODES.map((item, index) => `<div class="item${index === selection ? ' sel' : ''}">${item.label}</div>`).join('')}
          <div class="hint">PAD OR ARROWS<br>A TO START</div>
        </div>`
      return
    }

    if (mode === 'soccer') {
      const { you, them, message } = soccer.status()
      const board = `<div class="stats">YOU ${you}<br>THEM ${them}</div><div class="speed">A KICK</div>`
      if (state === 'pause') {
        hud.innerHTML = `
          ${board}
          <div class="menu">
            <div class="title">PAUSED</div>
            <div class="hint">START RESUME<br>B MENU</div>
          </div>`
        return
      }
      const banner = message ? `<div class="menu"><div class="title">${message}</div></div>` : ''
      hud.innerHTML = board + banner
      return
    }

    const speed = `<div class="speed">${mph} MPH${car.pose.onRoad ? '' : '<br><span class="warn">OFF ROAD</span>'}</div>`
    if (state === 'pause') {
      hud.innerHTML = `
        ${speed}
        <div class="menu">
          <div class="title">PAUSED</div>
          <div class="hint">START RESUME<br>B MENU</div>
        </div>`
      return
    }

    if (mode === 'free') {
      hud.innerHTML = speed
      return
    }

    if (mode === 'race') {
      const best = readBest()
      const lapShown = finished ? RACE_LAPS : Math.min(laps + 1, RACE_LAPS)
      const next = world.checkpoints[nextCp].name
      hud.innerHTML = `
        <div class="stats">
          LAP ${lapShown}/${RACE_LAPS}<br>
          ${formatTime(raceMs)}<br>
          BEST ${best == null ? '--:--.--' : formatTime(best)}<br>
          ${finished ? `<span class="good">${newBest ? 'NEW BEST' : 'FINISHED'}</span><br>B MENU` : `NEXT ${next}`}
        </div>
        ${speed}`
      return
    }

    const timerLabel = cruiseRunning ? 'A STOP' : cruiseMs > 0 ? 'A RESUME' : 'A START'
    hud.innerHTML = `
      <div class="stats">
        ${cruiseRunning || cruiseMs > 0 ? formatTime(cruiseMs) : 'READY'}<br>
        SPLIT ${splitMs == null ? '--:--.--' : formatTime(splitMs)}<br>
        LAPS ${splitCount}<br>
        NEXT ${world.checkpoints[nextCp].name}<br>
        ${timerLabel}
      </div>
      ${speed}`
  }

  goMenu()
  return {
    update,
    view() {
      return state !== 'menu' && mode === 'soccer' ? 'soccer' : 'car'
    },
  }
}

function formatTime(ms) {
  const clamped = Math.max(0, Math.floor(ms))
  const minutes = Math.floor(clamped / 60000)
  const seconds = Math.floor((clamped % 60000) / 1000)
  const cents = Math.floor((clamped % 1000) / 10)
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(cents).padStart(2, '0')}`
}
