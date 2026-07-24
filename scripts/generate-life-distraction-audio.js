const fs = require('fs');
const path = require('path');

// Original 12-second "distracting everyday noise" bed.
// It is synthesized from scratch: nearby speech-like texture, keyboard taps,
// alert-like chimes, cup/desk clinks, and a slightly busy room tone.
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

// A busy shared-office/cafe room bed.
let roomNoise = 0;
for (let i = 0; i < length; i++) {
  const time = i / sampleRate;
  roomNoise = roomNoise * 0.985 + (random() * 2 - 1) * 0.015;
  samples[i] += roomNoise * 0.18 + Math.sin(Math.PI * 2 * 96 * time) * 0.018 + Math.sin(Math.PI * 2 * 153 * time) * 0.009;
}

// Nearby, unintelligible conversation-like texture (no speech recording).
// Frequent starts/stops intentionally make it harder to ignore than a steady ambience.
[[0.38, .70, .18, 215], [1.28, .56, .15, 305], [2.08, .84, .19, 185],
 [3.42, .68, .16, 270], [4.18, .54, .15, 220], [5.18, .82, .20, 175],
 [6.42, .60, .17, 285], [7.18, .72, .18, 195], [8.48, .88, .20, 250],
 [10.02, .64, .17, 290], [10.92, .52, .16, 205]]
  .forEach(([start, seconds, amplitude, tone]) => addSoftBurst(start, seconds, amplitude, tone));

// Keyboard taps and desk impacts: short, irregular and deliberately noticeable.
[0.92, 1.08, 1.24, 1.40, 2.92, 3.08, 3.23, 3.38, 3.54, 5.92, 6.08,
 6.23, 6.40, 7.74, 7.90, 8.06, 9.42, 9.58, 9.74, 11.18]
  .forEach((start, index) => {
    addSoftBurst(start, .042 + (index % 3) * .008, .27, 950 + (index % 4) * 145);
    addTone(start, .030, 1400 + (index % 5) * 90, .085, 95);
  });

// Repeated notification-like pings and cup/desk clinks create distinct attention shifts.
[[2.48, 784], [4.84, 880], [7.02, 988], [10.42, 784]].forEach(([start, frequency]) => {
  addTone(start, .16, frequency, .22, 13);
  addTone(start + .095, .15, frequency * 1.33, .17, 15);
});
[[1.84, 1360], [5.58, 1180], [8.92, 1290]].forEach(([start, frequency]) => {
  addTone(start, .20, frequency, .18, 18);
  addTone(start + .012, .14, frequency * 1.42, .08, 23);
});

// Gentle fade in/out and clipping protection.
for (let i = 0; i < length; i++) {
  const time = i / sampleRate;
  const fade = Math.min(1, time / .18, (duration - time) / .35);
  samples[i] *= fade;
}

// Keep the distractors clearly audible at the game's default volume without clipping.
const peak = samples.reduce((maximum, sample) => Math.max(maximum, Math.abs(sample)), 0);
const outputGain = peak ? Math.min(3.2, .78 / peak) : 1;
for (let i = 0; i < length; i++) samples[i] = Math.max(-.92, Math.min(.92, samples[i] * outputGain));

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
