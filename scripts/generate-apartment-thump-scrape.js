const fs = require('fs');
const path = require('path');

// Original upstairs-apartment sound: irregular floor thumps plus furniture
// stick-slip scraping. No speech, music, alerts, or sampled recordings.
const sampleRate = 44100;
const seconds = 12;
const sampleCount = sampleRate * seconds;
const samples = new Float32Array(sampleCount);
let seed = 627451;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};

let building = 0;
for (let index = 0; index < sampleCount; index++) {
  const white = random() * 2 - 1;
  building = building * .999 + white * .001;
  samples[index] = building * .018;
}

function addFloorThump(startSeconds, strength) {
  const start = Math.floor(startSeconds * sampleRate), duration = Math.floor(sampleRate * (.22 + random() * .13));
  const resonance = 54 + random() * 28;
  let lowNoise = 0;
  for (let step = 0; step < duration && start + step < sampleCount; step++) {
    const time = step / sampleRate, white = random() * 2 - 1;
    lowNoise = lowNoise * .95 + white * .05;
    const impact = (1 - Math.exp(-time * 175)) * Math.exp(-time * (15 + random() * 6));
    const floorRing = Math.sin(Math.PI * 2 * resonance * time) * Math.exp(-time * 22) * .20;
    samples[start + step] += (lowNoise * .92 + floorRing) * impact * strength;
  }
}

function addFurnitureScrape(startSeconds, durationSeconds, strength) {
  const start = Math.floor(startSeconds * sampleRate), duration = Math.floor(durationSeconds * sampleRate);
  let coarse = 0, fine = 0;
  const slipRate = 7 + random() * 6, phase = random() * Math.PI * 2;
  for (let step = 0; step < duration && start + step < sampleCount; step++) {
    const time = step / sampleRate, progress = step / duration, white = random() * 2 - 1;
    coarse = coarse * .70 + white * .30;
    fine = fine * .28 + white * .72;
    const fade = Math.pow(Math.sin(Math.PI * progress), .48);
    const stickSlip = .22 + .78 * Math.pow(Math.max(0, Math.sin(Math.PI * 2 * slipRate * time + phase)), 3.4);
    const unevenPressure = .72 + .28 * Math.sin(Math.PI * 2 * .8 * time + phase * .6);
    samples[start + step] += (coarse * .70 + fine * .30) * fade * stickSlip * unevenPressure * strength;
  }
}

// Uneven running and jumping from above.
[[.54,.32],[1.02,.52],[1.38,.38],[2.08,.62],[2.62,.45],[3.04,.34],[4.70,.58],
 [5.12,.40],[6.56,.66],[7.02,.52],[7.46,.36],[8.94,.60],[9.42,.44],[10.76,.68],[11.24,.50]]
  .forEach(([start, strength]) => addFloorThump(start, strength));

// Furniture movement: intermittent rough drag rather than a continuous hiss.
[[3.52,.84,.22],[5.78,1.08,.26],[8.02,.76,.20],[10.02,.68,.23]].forEach(([start, duration, strength]) => addFurnitureScrape(start, duration, strength));

let peak = 0;
for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
const outputGain = peak ? .72 / peak : 1;
for (let index = 0; index < sampleCount; index++) {
  const time = index / sampleRate;
  const fade = Math.min(1, time / .16, (seconds - time) / .3);
  samples[index] = Math.max(-.88, Math.min(.88, samples[index] * outputGain * fade));
}

const dataSize = sampleCount * 2;
const wav = Buffer.alloc(44 + dataSize);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + dataSize, 4); wav.write('WAVE', 8);
wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(dataSize, 40);
for (let index = 0; index < sampleCount; index++) wav.writeInt16LE(Math.round(samples[index] * 32767), 44 + index * 2);

const output = path.resolve(__dirname, '..', 'assets', 'apartment-thump-scrape-12s.wav');
fs.writeFileSync(output, wav);
console.log(`Wrote ${output}`);
