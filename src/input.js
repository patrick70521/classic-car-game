const NAMES = ['up', 'down', 'left', 'right', 'a', 'b', 'x', 'y', 'start', 'select', 'reset']

const KEYMAP = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyA: 'a',
  Enter: 'a',
  KeyB: 'b',
  Escape: 'b',
  Backspace: 'b',
  KeyX: 'x',
  KeyY: 'y',
  Space: 'start',
  ShiftLeft: 'select',
  ShiftRight: 'select',
}

export function createInput(root) {
  const held = Object.fromEntries(NAMES.map((name) => [name, false]))
  const pressed = Object.fromEntries(NAMES.map((name) => [name, false]))
  const keys = Object.fromEntries(NAMES.map((name) => [name, false]))
  const pointers = Object.fromEntries(NAMES.map((name) => [name, false]))
  const buttons = Object.fromEntries(NAMES.map((name) => [name, root.querySelector(`[data-btn="${name}"]`)]))

  function recompute(name) {
    const down = keys[name] || pointers[name]
    if (down && !held[name]) pressed[name] = true
    held[name] = down
    const button = buttons[name]
    if (!button) return
    button.classList.toggle('is-down', down)
    button.setAttribute('aria-pressed', down ? 'true' : 'false')
  }

  function releaseAll() {
    for (const name of NAMES) {
      keys[name] = false
      pointers[name] = false
      recompute(name)
    }
  }

  for (const name of NAMES) {
    const button = buttons[name]
    if (!button) continue
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      try {
        button.setPointerCapture(event.pointerId)
      } catch {
        /* The press still counts if capture is unavailable. */
      }
      pointers[name] = true
      recompute(name)
    })
    const release = () => {
      pointers[name] = false
      recompute(name)
    }
    button.addEventListener('pointerup', release)
    button.addEventListener('pointercancel', release)
    button.addEventListener('contextmenu', (event) => event.preventDefault())
  }

  window.addEventListener('keydown', (event) => {
    const name = KEYMAP[event.code]
    if (!name) return
    event.preventDefault()
    if (event.repeat) return
    keys[name] = true
    recompute(name)
  })

  window.addEventListener('keyup', (event) => {
    const name = KEYMAP[event.code]
    if (!name) return
    keys[name] = false
    recompute(name)
  })

  window.addEventListener('blur', releaseAll)

  const stick = { x: 0, y: 0, active: false }
  let stickEnabled = false
  let stickPointer = null
  const joystick = root.querySelector('#joystick')
  const knob = joystick.querySelector('.joystick-knob')

  function placeKnob(x, y) {
    knob.style.transform = `translate(calc(-50% + ${x * 28}%), calc(-50% + ${-y * 28}%))`
  }

  function clearStick() {
    stickPointer = null
    stick.x = 0
    stick.y = 0
    stick.active = false
    placeKnob(0, 0)
  }

  function moveStick(event) {
    const rect = joystick.getBoundingClientRect()
    const radius = rect.width / 2
    let dx = event.clientX - (rect.left + radius)
    let dy = event.clientY - (rect.top + radius)
    const dist = Math.hypot(dx, dy) || 1
    const max = radius * 0.72
    const clamped = Math.min(dist, max)
    dx = (dx / dist) * clamped
    dy = (dy / dist) * clamped
    let x = dx / max
    let y = -dy / max
    if (Math.hypot(x, y) < 0.14) {
      x = 0
      y = 0
    }
    stick.x = x
    stick.y = y
    stick.active = true
    placeKnob(x, y)
  }

  joystick.addEventListener('pointerdown', (event) => {
    if (!stickEnabled) return
    event.preventDefault()
    stickPointer = event.pointerId
    try {
      joystick.setPointerCapture(event.pointerId)
    } catch {
      /* The drag still tracks if capture is unavailable. */
    }
    moveStick(event)
  })
  joystick.addEventListener('pointermove', (event) => {
    if (event.pointerId !== stickPointer) return
    moveStick(event)
  })
  const endStick = (event) => {
    if (event.pointerId !== stickPointer) return
    clearStick()
  }
  joystick.addEventListener('pointerup', endStick)
  joystick.addEventListener('pointercancel', endStick)
  joystick.addEventListener('contextmenu', (event) => event.preventDefault())

  return {
    held,
    stick,
    setStickEnabled(on) {
      stickEnabled = on
      if (!on) clearStick()
    },
    consumePress(name) {
      const value = pressed[name]
      pressed[name] = false
      return value
    },
  }
}
