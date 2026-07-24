const fs = require('fs');
const path = require('path');

// Original 12-second audible ocean-surf texture. It uses noise swells and
// foam-like high-frequency detail, not a tonal oscillator.
const sampleRate = 44100;
const seconds = 12;
const sampleCount = sampleRate * seconds;
const samples = new Float32Array(sampleCount);
let seed = 764321;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};

let low = 0, mid = 0;
for (let index = 0; index < sampleCount; index++) {
  const time = index / sampleRate, white = random() * 2 - 1;
  low = low * .997 + white * .003;
  mid = mid * .92 + white * .08;
  const foam = white - mid;
  const swell = .36 + .23 * (Math.sin(Math.PI * 2 * .17 * time - .8) + 1) / 2 + .11 * (Math.sin(Math.PI * 2 * .41 * time + .5) + 1) / 2;
  samples[index] = low * swell * 1.4 + mid * swell * .52 + foam * Math.max(0, swell - .38) * .32;
}

let peak = 0;
for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
const outputGain = peak ? .74 / peak : 1;
for (let index = 0; index < sampleCount; index++) {
  const time = index / sampleRate;
  const fade = Math.min(1, time / .2, (seconds - time) / .35);
  samples[index] = Math.max(-.92, Math.min(.92, samples[index] * outputGain * fade));
}

const dataSize = sampleCount * 2;
const wav = Buffer.alloc(44 + dataSize);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + dataSize, 4); wav.write('WAVE', 8);
wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(dataSize, 40);
for (let index = 0; index < sampleCount; index++) wav.writeInt16LE(Math.round(samples[index] * 32767), 44 + index * 2);

const output = path.resolve(__dirname, '..', 'assets', 'original-wave-12s.wav');
fs.writeFileSync(output, wav);
console.log(`Wrote ${output}`);
