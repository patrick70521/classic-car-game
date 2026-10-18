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

  return {
    held,
    consumePress(name) {
      const value = pressed[name]
      pressed[name] = false
      return value
    },
  }
}
