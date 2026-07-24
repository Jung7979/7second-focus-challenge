const fs = require('fs');
const path = require('path');

// Original everyday room ambience: soft room tone, distant human-presence
// texture, paper movement, and subdued keyboard activity. No tonal alerts.
const sampleRate = 44100;
const seconds = 12;
const sampleCount = sampleRate * seconds;
const samples = new Float32Array(sampleCount);
let seed = 539771;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};

let roomLow = 0, roomMid = 0;
for (let index = 0; index < sampleCount; index++) {
  const white = random() * 2 - 1;
  roomLow = roomLow * .997 + white * .003;
  roomMid = roomMid * .94 + white * .06;
  samples[index] = roomLow * .085 + (roomMid - roomLow) * .048 + white * .012;
}

function addNoiseBurst(startSeconds, durationSeconds, strength, smoothing, shape = 'soft') {
  const start = Math.floor(startSeconds * sampleRate), duration = Math.floor(durationSeconds * sampleRate);
  let previous = 0;
  for (let step = 0; step < duration && start + step < sampleCount; step++) {
    const progress = step / duration, white = random() * 2 - 1;
    previous = previous * smoothing + white * (1 - smoothing);
    const envelope = shape === 'tap'
      ? (1 - Math.exp(-progress * 36)) * Math.exp(-progress * 7.5)
      : Math.pow(Math.sin(Math.PI * progress), .72);
    samples[start + step] += previous * envelope * strength;
  }
}

// Distant, unintelligible conversation-like room texture.
[[.55,.74,.082], [1.64,.52,.065], [2.48,.88,.09], [4.06,.66,.075], [5.12,.62,.08], [6.38,.86,.09], [8.04,.58,.075], [9.16,.92,.09], [10.82,.62,.07]]
  .forEach(([start, duration, strength]) => addNoiseBurst(start, duration, strength, .88));

// Typing and desk/paper handling, kept subtle and non-tonal.
[1.18,1.33,1.49,3.20,3.37,3.54,3.71,6.98,7.15,7.31,8.70,8.87,9.03,11.22]
  .forEach(start => addNoiseBurst(start, .040 + random() * .018, .15 + random() * .07, .24, 'tap'));
[[2.05,.38,.045], [5.78,.52,.05], [9.92,.44,.046]].forEach(([start, duration, strength]) => addNoiseBurst(start, duration, strength, .72));

let peak = 0;
for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
const outputGain = peak ? .68 / peak : 1;
for (let index = 0; index < sampleCount; index++) {
  const time = index / sampleRate;
  const fade = Math.min(1, time / .2, (seconds - time) / .35);
  samples[index] = Math.max(-.86, Math.min(.86, samples[index] * outputGain * fade));
}

const dataSize = sampleCount * 2;
const wav = Buffer.alloc(44 + dataSize);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + dataSize, 4); wav.write('WAVE', 8);
wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(dataSize, 40);
for (let index = 0; index < sampleCount; index++) wav.writeInt16LE(Math.round(samples[index] * 32767), 44 + index * 2);

const output = path.resolve(__dirname, '..', 'assets', 'everyday-room-noise-12s.wav');
fs.writeFileSync(output, wav);
console.log(`Wrote ${output}`);
