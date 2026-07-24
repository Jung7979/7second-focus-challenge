const fs = require('fs');
const path = require('path');

// Original 12-second soft rainfall: continuous, layered rain texture without
// discrete impact clicks, designed to avoid a popcorn-like sound.
const sampleRate = 44100;
const seconds = 12;
const sampleCount = sampleRate * seconds;
const samples = new Float32Array(sampleCount);
let seed = 190427;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};

let slow = 0, middle = 0, shimmer = 0;
for (let index = 0; index < sampleCount; index++) {
  const time = index / sampleRate, white = random() * 2 - 1;
  slow = slow * .996 + white * .004;
  middle = middle * .91 + white * .09;
  shimmer = shimmer * .58 + white * .42;
  const softHiss = white - middle;
  const rainBody = middle - slow;
  const rainfall = .60 + .11 * Math.sin(Math.PI * 2 * .13 * time + .8) + .06 * Math.sin(Math.PI * 2 * .37 * time - .5);
  samples[index] = (slow * .17 + rainBody * .31 + softHiss * .21 + shimmer * .08) * rainfall;
}

let peak = 0;
for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
const outputGain = peak ? .68 / peak : 1;
for (let index = 0; index < sampleCount; index++) {
  const time = index / sampleRate;
  const fade = Math.min(1, time / .25, (seconds - time) / .4);
  samples[index] = Math.max(-.88, Math.min(.88, samples[index] * outputGain * fade));
}

const dataSize = sampleCount * 2;
const wav = Buffer.alloc(44 + dataSize);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + dataSize, 4); wav.write('WAVE', 8);
wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(dataSize, 40);
for (let index = 0; index < sampleCount; index++) wav.writeInt16LE(Math.round(samples[index] * 32767), 44 + index * 2);

const output = path.resolve(__dirname, '..', 'assets', 'soft-rainfall-12s.wav');
fs.writeFileSync(output, wav);
console.log(`Wrote ${output}`);
