export function createEngine() {
  let ctx = null
  let master = null
  let low = null
  let high = null
  let filter = null
  let crowdGain = null
  let hornAt = 0

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
    const murmur = ctx.createBufferSource()
    murmur.buffer = murmurBuffer(ctx)
    murmur.loop = true
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 720
    band.Q.value = 0.7
    crowdGain = ctx.createGain()
    crowdGain.gain.value = 0
    murmur.connect(band)
    band.connect(crowdGain)
    crowdGain.connect(ctx.destination)
    murmur.start()
  }

  function unlock() {
    ensure()
    if (ctx && ctx.state === 'suspended') ctx.resume()
  }

  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)

  function update(running, speed, city) {
    if (!ctx || !master) return
    const now = ctx.currentTime
    const pace = Math.min(Math.abs(speed) / 18, 1)
    const rpm = 46 + pace * 78
    const volume = running ? 0.045 + pace * 0.11 : 0
    low.frequency.setTargetAtTime(rpm, now, 0.08)
    high.frequency.setTargetAtTime(rpm * 0.5, now, 0.08)
    filter.frequency.setTargetAtTime(200 + pace * 520, now, 0.1)
    master.gain.setTargetAtTime(volume, now, 0.06)
    const crowd = running ? 0.012 + (city && city.nearSidewalk ? 0.02 : 0) : 0
    if (crowdGain) crowdGain.gain.setTargetAtTime(crowd, now, 0.25)
    if (running && city && city.horn && now > hornAt) {
      hornAt = now + 0.7
      blip(now)
    }
  }

  function blip(now) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(520, now)
    osc.frequency.setValueAtTime(660, now + 0.12)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.3)
  }

  return { update }
}

function murmurBuffer(ctx) {
  const length = ctx.sampleRate * 2
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1
    last = (last + white * 0.03) / 1.03
    data[i] = last * (0.65 + 0.35 * Math.sin(i / 900))
  }
  return buffer
}
