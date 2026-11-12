import { midiFor } from './song.mjs';

const profiles = {
  ring: { length: 2.3, decay: 2.5, brightness: .84 },
  pm: { length: .28, decay: 19, brightness: .57 },
  legato: { length: .7, decay: 5, brightness: .66 },
  clean: { length: 2.1, decay: 2.1, brightness: .73 },
  dead: { length: .11, decay: 50 }
};

export class GuitarAudio {
  #context;
  #output;
  #playback;
  #buffers = new Map();

  get time() {
    return this.#context.currentTime;
  }

  async open() {
    if (!this.#context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error('Web Audio unavailable');
      this.#context = new AudioContext();
      this.#output = this.#context.createDynamicsCompressor();
      this.#output.threshold.value = -16;
      this.#output.ratio.value = 3;
      this.#output.connect(this.#context.destination);
    }
    if (this.#context.state !== 'running') await this.#context.resume();
    if (this.#context.state !== 'running') throw new Error('Audio suspended');
  }

  startPlayback() {
    this.#playback = this.#context.createGain();
    this.#playback.connect(this.#output);
  }

  stopPlayback() {
    if (!this.#playback) return;
    const bus = this.#playback;
    bus.gain.setTargetAtTime(0, this.time, .008);
    window.setTimeout(() => bus.disconnect(), 80);
    this.#playback = null;
  }

  #buffer(midi, type) {
    const key = `${midi}:${type}`;
    if (this.#buffers.has(key)) return this.#buffers.get(key);
    const sampleRate = this.#context.sampleRate;
    const { length, decay, brightness } = profiles[type];
    const buffer = this.#context.createBuffer(1, Math.floor(sampleRate * length), sampleRate);
    const data = buffer.getChannelData(0);
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const harmonics = Array.from({ length: 9 }, (_, index) => {
      const harmonic = index + 1;
      return {
        phase: 2 * Math.PI * frequency * harmonic * (1 + .00012 * harmonic ** 2) / sampleRate,
        gain: Math.sin(harmonic * .58) * brightness ** (harmonic - 1) / harmonic ** .85,
        decay: 2.2 * (harmonic - 1)
      };
    });
    let random = 12345;
    let lowNoise = 0;
    for (let index = 0; index < data.length; index += 1) {
      const time = index / sampleRate;
      random = (Math.imul(1664525, random) + 1013904223) >>> 0;
      const noise = random / 2147483648 - 1;
      lowNoise += .18 * (noise - lowNoise);
      let sound = 0;
      if (type === 'dead') {
        sound = (lowNoise * .72 + noise * .22) * Math.exp(-time * decay);
      } else {
        for (const harmonic of harmonics) {
          sound += Math.sin(harmonic.phase * index) * harmonic.gain * Math.exp(-harmonic.decay * time);
        }
        sound += noise * (type === 'legato' ? .008 : .065) * Math.exp(-time * 155);
        const gain = type === 'clean' ? .8 : 1.5;
        sound = Math.tanh(sound * gain) * Math.exp(-time * decay);
      }
      const attack = type === 'legato' ? .009 : .002;
      const envelope = Math.min(1, time / attack, (length - time) / .022);
      data[index] = sound * Math.max(0, envelope);
    }
    this.#buffers.set(key, buffer);
    return buffer;
  }

  #playBuffer(buffer, time, length, level, output) {
    const source = this.#context.createBufferSource();
    const gain = this.#context.createGain();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(output);
    const end = time + Math.min(length, buffer.duration);
    const fade = Math.min(.024, (end - time) / 3);
    gain.gain.setValueAtTime(level, time);
    gain.gain.setValueAtTime(level, end - fade);
    gain.gain.linearRampToValueAtTime(0, end);
    source.start(time);
    source.stop(end);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
  }

  prepare(events) {
    for (const event of events) {
      if (event.technique !== 'hold') this.#tones(event);
    }
  }

  #tones(event) {
    if (event.technique === 'dead') return [this.#buffer(40, 'dead')];
    const type = event.technique === 'pm' ? 'pm'
      : ['hammer', 'pull'].includes(event.technique) ? 'legato' : 'ring';
    return event.notes.map((note) => this.#buffer(midiFor(note), type));
  }

  strike(event, time, duration, upstroke = false, preview = false) {
    const output = preview ? this.#output : this.#playback;
    if (!output || event.technique === 'hold') return;
    const buffers = this.#tones(event);
    if (upstroke) buffers.reverse();
    const level = (event.technique === 'chord' ? .34 : .39) / Math.sqrt(buffers.length);
    buffers.forEach((buffer, index) => {
      this.#playBuffer(buffer, time + index * .006, Math.max(.04, duration - index * .006), level, output);
    });
  }

  tuningNote(midi) {
    this.#playBuffer(this.#buffer(midi, 'clean'), this.time + .025, 1.65, .5, this.#output);
  }

  tick(time, accent) {
    if (!this.#playback) return;
    const oscillator = this.#context.createOscillator();
    const gain = this.#context.createGain();
    oscillator.frequency.value = accent ? 1580 : 1060;
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? .13 : .08, time + .004);
    gain.gain.exponentialRampToValueAtTime(.0001, time + .05);
    oscillator.connect(gain);
    gain.connect(this.#playback);
    oscillator.start(time);
    oscillator.stop(time + .052);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
}
