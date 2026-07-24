const fs = require('fs');
const path = require('path');

// A new, original 12-second rainfall recording made from filtered noise and
// many short, irregular droplet impacts. No musical tones are used.
const sampleRate = 44100;
const seconds = 12;
const sampleCount = sampleRate * seconds;
const samples = new Float32Array(sampleCount);
let seed = 284917;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};

let slowNoise = 0;
for (let index = 0; index < sampleCount; index++) {
  const white = random() * 2 - 1;
  slowNoise = slowNoise * .992 + white * .008;
  const fineRain = white - slowNoise;
  samples[index] = slowNoise * .045 + fineRain * .032;
}

function addDrop(start, duration, strength) {
  let previous = 0;
  for (let step = 0; step < duration && start + step < sampleCount; step++) {
    const time = step / sampleRate;
    const envelope = (1 - Math.exp(-time * 1500)) * Math.exp(-time * (42 + random() * 26));
    const white = random() * 2 - 1;
    previous = previous * .36 + white * .64;
    samples[start + step] += previous * envelope * strength;
  }
}

// Fine drops create the continuous patter; larger drops add occasional detail.
for (let cursor = 0; cursor < sampleCount;) {
  cursor += Math.floor(sampleRate * (.010 + random() * .042));
  addDrop(cursor, Math.floor(sampleRate * (.012 + random() * .040)), .040 + random() * .055);
}
for (let cursor = Math.floor(sampleRate * .18); cursor < sampleCount;) {
  cursor += Math.floor(sampleRate * (.24 + random() * .64));
  addDrop(cursor, Math.floor(sampleRate * (.045 + random() * .075)), .10 + random() * .13);
}

let peak = 0;
for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
const outputGain = peak ? .72 / peak : 1;
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

const output = path.resolve(__dirname, '..', 'assets', 'original-rainfall-12s.wav');
fs.writeFileSync(output, wav);
console.log(`Wrote ${output}`);
