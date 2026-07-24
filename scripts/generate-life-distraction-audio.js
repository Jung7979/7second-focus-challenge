const fs = require('fs');
const path = require('path');

// Original 12-second "distracting everyday noise" bed.
// It is synthesized from scratch: room hum, distant speech-like texture,
// keyboard taps, a notification-like chime, and occasional cup clinks.
const sampleRate = 44100;
const duration = 12;
const length = sampleRate * duration;
const samples = new Float32Array(length);
let seed = 91731;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};

function addTone(start, seconds, frequency, amplitude, decay = 5) {
  const from = Math.max(0, Math.floor(start * sampleRate));
  const to = Math.min(length, from + Math.floor(seconds * sampleRate));
  for (let i = from; i < to; i++) {
    const time = (i - from) / sampleRate;
    samples[i] += Math.sin(Math.PI * 2 * frequency * time) * amplitude * Math.exp(-time * decay);
  }
}

function addSoftBurst(start, seconds, amplitude, tone) {
  const from = Math.floor(start * sampleRate);
  const to = Math.min(length, from + Math.floor(seconds * sampleRate));
  let previous = 0;
  for (let i = Math.max(0, from); i < to; i++) {
    const time = (i - from) / seconds / sampleRate;
    const envelope = Math.sin(Math.PI * time);
    const noise = random() * 2 - 1;
    previous = previous * 0.92 + noise * 0.08;
    samples[i] += (previous * 0.60 + Math.sin(Math.PI * 2 * tone * (i - from) / sampleRate) * 0.08) * amplitude * envelope;
  }
}

// A quiet room/air-conditioner bed.
let roomNoise = 0;
for (let i = 0; i < length; i++) {
  const time = i / sampleRate;
  roomNoise = roomNoise * 0.985 + (random() * 2 - 1) * 0.015;
  samples[i] += roomNoise * 0.13 + Math.sin(Math.PI * 2 * 96 * time) * 0.012 + Math.sin(Math.PI * 2 * 153 * time) * 0.006;
}

// Distant, unintelligible conversation-like texture (no speech recording).
[[0.55, .58, .095, 215], [1.75, .44, .08, 305], [2.55, .72, .10, 185],
 [4.12, .62, .09, 270], [5.32, .36, .08, 220], [6.20, .76, .10, 175],
 [7.88, .54, .09, 285], [9.10, .72, .10, 195], [10.72, .48, .08, 250]]
  .forEach(([start, seconds, amplitude, tone]) => addSoftBurst(start, seconds, amplitude, tone));

// Keyboard taps: short, slightly varied percussive clicks.
[1.18, 1.34, 1.50, 3.32, 3.48, 3.63, 3.79, 6.95, 7.10, 7.27, 8.54, 8.70, 8.86, 11.06]
  .forEach((start, index) => {
    addSoftBurst(start, .038 + (index % 3) * .006, .17, 950 + (index % 4) * 145);
    addTone(start, .025, 1400 + (index % 5) * 90, .045, 95);
  });

// A subtle but recognisable phone notification and two cup/desk clinks.
addTone(4.82, .20, 880, .10, 12); addTone(4.91, .18, 1175, .075, 14);
[[2.08, 1360], [9.86, 1180]].forEach(([start, frequency]) => {
  addTone(start, .18, frequency, .11, 18);
  addTone(start + .012, .13, frequency * 1.42, .045, 23);
});

// Gentle fade in/out and clipping protection.
for (let i = 0; i < length; i++) {
  const time = i / sampleRate;
  const fade = Math.min(1, time / .18, (duration - time) / .35);
  samples[i] = Math.max(-.92, Math.min(.92, samples[i] * fade));
}

const dataSize = length * 2;
const wav = Buffer.alloc(44 + dataSize);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + dataSize, 4); wav.write('WAVE', 8);
wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(dataSize, 40);
for (let i = 0; i < length; i++) wav.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2);

const output = path.resolve(__dirname, '..', 'assets', 'life-distraction-12s.wav');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, wav);
console.log(`Wrote ${output} (${duration}s, ${wav.length} bytes)`);
