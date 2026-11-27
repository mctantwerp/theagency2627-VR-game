export function createAudio() {
  let context;
  let output;
  let muted = false;

  function note(frequency, time, length, volume, type = 'sine') {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(volume, time + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + length);
    oscillator.connect(envelope).connect(output);
    oscillator.start(time);
    oscillator.stop(time + length);
  }

  function start() {
    if (!context) {
      context = new AudioContext();
      output = context.createGain();
      output.gain.value = muted ? 0 : 0.44;
      output.connect(context.destination);

      let seed = 192;
      const length = context.sampleRate * 4;
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < length; index++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const fade = Math.min(1, index / 160, (length - index - 1) / 160);
        samples[index] = (seed / 2147483648 - 1) * fade;
      }
      const creek = context.createBufferSource();
      creek.buffer = buffer;
      creek.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 520;
      const creekVolume = context.createGain();
      creekVolume.gain.value = 0.045;
      creek.connect(filter).connect(creekVolume).connect(output);
      creek.start();

      const phrase = [196, 293.66, 329.63, 392, 293.66, 261.63, 220, 329.63, 392, 440, 329.63, 293.66];
      let nextNote = context.currentTime + 0.18;
      let beat = 0;
      function schedule() {
        nextNote = Math.max(nextNote, context.currentTime);
        while (nextNote < context.currentTime + 0.28) {
          const frequency = phrase[beat % phrase.length];
          note(frequency, nextNote, 1.55, 0.043, 'triangle');
          if (beat % 3 === 0) note(frequency * 2, nextNote + 0.12, 1.8, 0.014);
          nextNote += 0.92;
          beat++;
        }
      }
      schedule();
      window.setInterval(schedule, 120);
    }
    context.resume().catch(() => {});
  }

  function toggle() {
    muted = !muted;
    if (output) output.gain.setTargetAtTime(muted ? 0 : 0.44, context.currentTime, 0.05);
    return muted;
  }

  function play(event) {
    if (!context || context.state !== 'running') return;
    const time = context.currentTime;
    switch (event) {
      case 'putt': note(310, time, 0.075, 0.16, 'triangle'); break;
      case 'spring':
        note(390, time, 0.19, 0.11);
        note(620, time + 0.06, 0.33, 0.09);
        break;
      case 'cup':
        note(523.25, time, 0.45, 0.1);
        note(659.25, time + 0.09, 0.55, 0.08);
        note(783.99, time + 0.18, 0.65, 0.06);
        break;
    }
  }

  return { start, toggle, play };
}
