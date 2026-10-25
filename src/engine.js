export function createEngine() {
  let ctx = null
  let master = null
  let low = null
  let high = null
  let filter = null

  function ensure() {
    if (ctx) return
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    ctx = new AudioCtx()
    master = ctx.createGain()
    master.gain.value = 0
    filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 220
    filter.Q.value = 0.7
    low = ctx.createOscillator()
    low.type = 'sawtooth'
    low.frequency.value = 46
    high = ctx.createOscillator()
    high.type = 'square'
    high.frequency.value = 23
    const highGain = ctx.createGain()
    highGain.gain.value = 0.35
    low.connect(filter)
    high.connect(highGain)
    highGain.connect(filter)
    filter.connect(master)
    master.connect(ctx.destination)
    low.start()
    high.start()
  }

  function unlock() {
    ensure()
    if (ctx && ctx.state === 'suspended') ctx.resume()
  }

  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)

  function update(running, speed) {
    if (!ctx || !master) return
    const now = ctx.currentTime
    const pace = Math.min(Math.abs(speed) / 18, 1)
    const rpm = 46 + pace * 78
    const volume = running ? 0.045 + pace * 0.11 : 0
    low.frequency.setTargetAtTime(rpm, now, 0.08)
    high.frequency.setTargetAtTime(rpm * 0.5, now, 0.08)
    filter.frequency.setTargetAtTime(200 + pace * 520, now, 0.1)
    master.gain.setTargetAtTime(volume, now, 0.06)
  }

  return { update }
}
