const fs = require('fs');
const path = require('path');

// Original upstairs-apartment noise: irregular footfall/jump thumps and
// furniture-drag friction. It contains no speech or recordings of people.
const sampleRate = 44100;
const seconds = 12;
const sampleCount = sampleRate * seconds;
const samples = new Float32Array(sampleCount);
let seed = 810329;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};

let buildingHum = 0;
for (let index = 0; index < sampleCount; index++) {
  const white = random() * 2 - 1;
  buildingHum = buildingHum * .998 + white * .002;
  samples[index] = buildingHum * .028;
}

function addThump(startSeconds, strength) {
  const start = Math.floor(startSeconds * sampleRate), duration = Math.floor(sampleRate * (.18 + random() * .12));
  let low = 0;
  for (let step = 0; step < duration && start + step < sampleCount; step++) {
    const time = step / sampleRate, white = random() * 2 - 1;
    low = low * .94 + white * .06;
    const attack = 1 - Math.exp(-time * 120), envelope = attack * Math.exp(-time * (13 + random() * 7));
    samples[start + step] += low * envelope * strength * .9;
  }
}

function addFurnitureDrag(startSeconds, durationSeconds, strength) {
  const start = Math.floor(startSeconds * sampleRate), duration = Math.floor(durationSeconds * sampleRate);
  let rough = 0;
  for (let step = 0; step < duration && start + step < sampleCount; step++) {
    const progress = step / duration, white = random() * 2 - 1;
    rough = rough * .58 + white * .42;
    const envelope = Math.pow(Math.sin(Math.PI * progress), .55);
    const uneven = .62 + .38 * Math.sin(progress * Math.PI * (7 + random() * 2));
    samples[start + step] += rough * envelope * uneven * strength;
  }
}

// Clusters of uneven child-like running/jump impacts (without vocal sounds).
[[.62,.22],[1.08,.31],[1.46,.25],[2.34,.42],[2.72,.34],[3.18,.28],[4.86,.39],
 [5.26,.28],[6.72,.44],[7.10,.35],[7.56,.30],[9.18,.38],[9.62,.29],[10.92,.42],[11.36,.34]]
  .forEach(([start, strength]) => addThump(start, strength));

[[3.74,.72,.16],[6.02,.88,.18],[8.20,.62,.14],[10.14,.58,.15]].forEach(([start, duration, strength]) => addFurnitureDrag(start, duration, strength));

let peak = 0;
for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
const outputGain = peak ? .70 / peak : 1;
for (let index = 0; index < sampleCount; index++) {
  const time = index / sampleRate;
  const fade = Math.min(1, time / .15, (seconds - time) / .3);
  samples[index] = Math.max(-.88, Math.min(.88, samples[index] * outputGain * fade));
}

const dataSize = sampleCount * 2;
const wav = Buffer.alloc(44 + dataSize);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + dataSize, 4); wav.write('WAVE', 8);
wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(dataSize, 40);
for (let index = 0; index < sampleCount; index++) wav.writeInt16LE(Math.round(samples[index] * 32767), 44 + index * 2);

const output = path.resolve(__dirname, '..', 'assets', 'apartment-upstairs-noise-12s.wav');
fs.writeFileSync(output, wav);
console.log(`Wrote ${output}`);
