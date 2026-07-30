const screens = Object.fromEntries([...document.querySelectorAll('.screen')].map(screen => [screen.id.replace('-screen', ''), screen]));
const soundNames = { rain: '빗소리(백색소음)', wave: '파도소리(백색소음)' };
const songAudio = document.querySelector('#song-audio');
const rainAudio = document.querySelector('#rain-audio');
const waveAudio = document.querySelector('#wave-audio');
const soundVisual = document.querySelector('#sound-visual');
const spectrumCanvas = soundVisual.querySelector('.spectrum-canvas');
const spectrumContext = spectrumCanvas.getContext('2d');
const spectrumColumns = 16, spectrumRows = 11;
const spectrumLevels = new Float32Array(spectrumColumns * spectrumRows);
// 0.1-second loudness envelope extracted from assets/apartment-noise-12s.mp3.
const lifeNoiseEnvelope = [0,0.46,0.97,0.8,0.73,0.65,0.3,0.07,0.02,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.1,0.98,0.12,0.02,0.33,0.63,0.04,0.01,0,0,0,0,0,0,0,0,0,0,0.54,0.94,0.04,0.93,0.09,0.43,0.9,0.04,0.13,1,0.05,0.01,0,0.38,0.9,0.05,0.01,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.03,0.49,0.22,0.61,0.6,0.68,0.58,0.79,0.63,0.24,0.15,0.42,0.67,0.5,0.4,0.17,0.01,0,0.02,0.78,0.08,0.01,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.06,0.9,0.33,0.02,0,0];
const whiteNoiseMixGain = Math.pow(10, -5 / 20);
// Keep the balance between sound types while lowering every playback path by 5 dB.
const playbackMasterGain = Math.pow(10, -5 / 20);
const lifeNoiseGain = Math.pow(10, 3 / 20);
const mixedLifeNoiseGain = Math.pow(10, -1 / 20);
let selectedSound = 'rain', round = 'song', startedAt = 0, audioContext, noiseSource, muted = false, timerFrame, visualFrame, activeAnalyser, visualData, visualTimeData, comparisonStarted = false, comfortChoice = null;
const records = { song: null, noise: null };

function show(name) { Object.entries(screens).forEach(([key, screen]) => screen.classList.toggle('active', key === name)); }
function createNoise(type) {
  audioContext ??= new AudioContext();
  const size = audioContext.sampleRate * (type === 'rain' ? 6 : type === 'mask' ? 5 : 2);
  const buffer = audioContext.createBuffer(1, size, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  let rainBed = 0, pinkB0 = 0, pinkB1 = 0, pinkB2 = 0, pinkB3 = 0, pinkB4 = 0, pinkB5 = 0, pinkB6 = 0;
  for (let i = 0; i < size; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'wave') data[i] = white * .55 + Math.sin(i / 1700) * .15;
    else if (type === 'mask') {
      pinkB0 = .99886 * pinkB0 + white * .0555179; pinkB1 = .99332 * pinkB1 + white * .0750759; pinkB2 = .96900 * pinkB2 + white * .1538520;
      pinkB3 = .86650 * pinkB3 + white * .3104856; pinkB4 = .55000 * pinkB4 + white * .5329522; pinkB5 = -.7616 * pinkB5 - white * .0168980;
      const pink = (pinkB0 + pinkB1 + pinkB2 + pinkB3 + pinkB4 + pinkB5 + pinkB6 + white * .5362) * .11;
      data[i] = pink * .76 + white * .12;
      pinkB6 = white * .115926;
    }
    else { rainBed = rainBed * .985 + white * .015; data[i] = rainBed * .7 + white * .13; }
  }
  if (type === 'rain') {
    for (let cursor = Math.floor(Math.random() * 900); cursor < size; cursor += Math.floor(audioContext.sampleRate * (.045 + Math.random() * .12))) {
      const duration = Math.floor(audioContext.sampleRate * (.012 + Math.random() * .030)), frequency = 1800 + Math.random() * 4200, strength = .18 + Math.random() * .28;
      for (let step = 0; step < duration && cursor + step < size; step++) {
        const time = step / audioContext.sampleRate, envelope = Math.exp(-time * (48 + Math.random() * 34));
        data[cursor + step] += ((Math.random() * 2 - 1) * .48 + Math.sin(Math.PI * 2 * frequency * time) * .32) * envelope * strength;
      }
    }
  }
  const source = audioContext.createBufferSource(), textureGain = audioContext.createGain(), gain = audioContext.createGain(), analyser = audioContext.createAnalyser();
  // The layered filters lower the raw signal level; restore an audible mobile listening volume.
  // Wave keeps a small extra lift because low frequencies are less audible on phone speakers.
  const volume = (type === 'wave' ? 1.02 : type === 'mask' ? .96 : .35) * playbackMasterGain;
  analyser.fftSize = 128; analyser.smoothingTimeConstant = .22;
  const layerSettings = type === 'wave'
    ? [[220, .30, .16, .18], [680, .20, .13, .36], [1750, .11, .08, .62]]
    : type === 'mask'
      ? [[180, .42, .10, .18], [620, .36, .08, .33], [1700, .24, .06, .56], [3900, .12, .05, .88]]
    : [[620, .14, .06, .72], [1900, .20, .09, 1.34], [4800, .25, .11, 2.18]];
  const layers = layerSettings.map(([frequency, base, depth, lfoFrequency]) => {
    const filter = audioContext.createBiquadFilter(), layerGain = audioContext.createGain(), lfo = audioContext.createOscillator(), lfoGain = audioContext.createGain();
    filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = 1.15; layerGain.gain.value = base; lfo.frequency.value = lfoFrequency; lfoGain.gain.value = depth;
    textureGain.connect(filter).connect(layerGain).connect(analyser); lfo.connect(lfoGain).connect(layerGain.gain); lfo.start(); return { lfo, lfoFrequency, depth };
  });
  source.buffer = buffer; source.loop = true; textureGain.gain.value = type === 'wave' ? .86 : type === 'mask' ? .98 : .96;
  gain.gain.value = muted ? 0 : volume; source.connect(textureGain); analyser.connect(gain).connect(audioContext.destination); source.start(); return { source, gain, analyser, layers, volume, type, startedAt: audioContext.currentTime };
}
function paintPolygon(points, fill, stroke) {
  spectrumContext.beginPath(); spectrumContext.moveTo(...points[0]); points.slice(1).forEach(point => spectrumContext.lineTo(...point)); spectrumContext.closePath();
  if (fill) { spectrumContext.fillStyle = fill; spectrumContext.fill(); }
  if (stroke) { spectrumContext.strokeStyle = stroke; spectrumContext.stroke(); }
}
function renderSpectrum(levelAt) {
  const bounds = spectrumCanvas.getBoundingClientRect(), ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(bounds.width)), height = Math.max(1, Math.round(bounds.height));
  if (spectrumCanvas.width !== width * ratio || spectrumCanvas.height !== height * ratio) { spectrumCanvas.width = width * ratio; spectrumCanvas.height = height * ratio; }
  spectrumContext.setTransform(ratio, 0, 0, ratio, 0, 0); spectrumContext.clearRect(0, 0, width, height);
  const isLifeNoise = soundVisual.dataset.mode === 'music';
  const backdrop = spectrumContext.createRadialGradient(width * .5, height * .37, 8, width * .5, height * .45, width * .72);
  backdrop.addColorStop(0, isLifeNoise ? '#5d163f' : '#0b5177'); backdrop.addColorStop(.48, isLifeNoise ? '#190c31' : '#092640'); backdrop.addColorStop(1, '#040914'); spectrumContext.fillStyle = backdrop; spectrumContext.fillRect(0, 0, width, height);
  const tileWidth = width / (spectrumColumns + 1.5), tileHeight = tileWidth * .38, centerX = width * .5, baseY = height * .89;
  const project = (x, y, z = 0) => [centerX + (x - y) * tileWidth * .5, baseY - (x + y) * tileHeight * .5 - z];
  const cells = [];
  for (let row = 0; row < spectrumRows; row++) for (let column = 0; column < spectrumColumns; column++) {
    const index = row * spectrumColumns + column, target = Math.max(.03, Math.min(1, levelAt(column, row)));
    spectrumLevels[index] += (target - spectrumLevels[index]) * (isLifeNoise ? .28 : .16);
    cells.push({ column, row, level: spectrumLevels[index] });
  }
  cells.sort((a, b) => b.column + b.row - (a.column + a.row)).forEach(({ column, row, level }) => {
    const elevation = isLifeNoise ? 4 + Math.pow(level, 1.7) * height * .42 : 2 + Math.pow(level, 1.35) * height * .30;
    const base = [project(column, row), project(column + 1, row), project(column + 1, row + 1), project(column, row + 1)];
    const top = [project(column, row, elevation), project(column + 1, row, elevation), project(column + 1, row + 1, elevation), project(column, row + 1, elevation)];
    const hue = 214 - level * 166, light = 29 + level * 39;
    paintPolygon([top[2], top[3], base[3], base[2]], `hsla(${hue}, 92%, ${Math.max(17, light - 19)}%, .92)`);
    paintPolygon([top[1], top[2], base[2], base[1]], `hsla(${hue + 9}, 95%, ${Math.max(19, light - 10)}%, .92)`);
    spectrumContext.shadowColor = `hsla(${hue}, 100%, 62%, ${.16 + level * .6})`; spectrumContext.shadowBlur = 2 + level * 15;
    paintPolygon(top, `hsl(${hue}, 94%, ${light}%)`, 'rgba(197,233,255,.16)'); spectrumContext.shadowBlur = 0;
  });
  const grid = spectrumContext.createLinearGradient(0, height * .6, 0, height); grid.addColorStop(0, '#9edcff18'); grid.addColorStop(1, '#9edcff00'); spectrumContext.strokeStyle = grid; spectrumContext.lineWidth = 1;
  for (let i = 0; i <= spectrumColumns; i++) { const start = project(i, 0), end = project(i, spectrumRows); spectrumContext.beginPath(); spectrumContext.moveTo(...start); spectrumContext.lineTo(...end); spectrumContext.stroke(); }
  for (let i = 0; i <= spectrumRows; i++) { const start = project(0, i), end = project(spectrumColumns, i); spectrumContext.beginPath(); spectrumContext.moveTo(...start); spectrumContext.lineTo(...end); spectrumContext.stroke(); }
}
function startVisualizer(analyser) {
  activeAnalyser = analyser; visualData = new Uint8Array(analyser.frequencyBinCount); visualTimeData = new Uint8Array(analyser.fftSize); soundVisual.dataset.live = 'true'; cancelAnimationFrame(visualFrame);
  const draw = () => { activeAnalyser.getByteFrequencyData(visualData); activeAnalyser.getByteTimeDomainData(visualTimeData); const now = performance.now() / 1000, elapsed = audioContext.currentTime - noiseSource.startedAt, rms = Math.sqrt(visualTimeData.reduce((sum, value) => sum + Math.pow((value - 128) / 128, 2), 0) / visualTimeData.length), average = visualData.reduce((sum, value) => sum + value, 0) / visualData.length / 255; const isWave = noiseSource?.type === 'wave', isMask = noiseSource?.type === 'mask', lifeEnergy = isMask ? getLifeNoiseEnergy(songAudio.currentTime) : 0; renderSpectrum((column, row) => { const bin = Math.min(visualData.length - 1, 1 + Math.floor(column * (visualData.length - 2) / spectrumColumns)); const audioLevel = visualData[bin] / 255, relativeBand = Math.max(0, Math.min(1, .5 + (audioLevel - average) * 2.6)); const layer = noiseSource.layers[(column + row * 2) % noiseSource.layers.length], layerPulse = (Math.sin(elapsed * layer.lfoFrequency * Math.PI * 2) + 1) / 2; const phase = isWave ? now * 3.1 + column * .72 - row * .88 : isMask ? now * 2.35 + column * .54 - row * .63 : now * 5.6 + column * 1.1 + row * .74; const surfaceWave = (Math.sin(phase) + 1) / 2; const bandShape = isWave ? Math.max(.12, 1 - Math.abs(column - row * 1.02 - 4) / 9) : isMask ? .52 + ((column * 3 + row * 5) % 4) / 10 : .25 + ((column * 7 + row * 11) % 5) / 6; const reactive = relativeBand * .17 + rms * .10; const matchedMotion = layerPulse * (.075 + layer.depth * .45) * bandShape; return .075 + reactive + matchedMotion + surfaceWave * (.035 + bandShape * .085) + lifeEnergy * (isMask ? .24 : 0); }); visualFrame = requestAnimationFrame(draw); };
  draw();
}
function startLifeNoiseVisualizer() {
  soundVisual.dataset.live = 'true'; cancelAnimationFrame(visualFrame);
  const draw = () => { const time = songAudio.currentTime; renderSpectrum((column, row) => { const distance = Math.hypot(column - 7.5, row - 5), center = Math.max(0, 1 - distance / 9), energy = getLifeNoiseEnergy(time + (column - 7.5) * .012 + (row - 5) * .006); const texture = (Math.sin(column * 1.7 + row * .91) + 1) * .06; return .035 + energy * (.32 + center * .5 + texture); }); visualFrame = requestAnimationFrame(draw); };
  draw();
}
function getLifeNoiseEnergy(time) {
  const position = Math.max(0, Math.min(lifeNoiseEnvelope.length - 1, time * 10)), index = Math.floor(position), next = Math.min(lifeNoiseEnvelope.length - 1, index + 1), amount = position - index;
  return lifeNoiseEnvelope[index] * (1 - amount) + lifeNoiseEnvelope[next] * amount;
}
function startRainVisualizer() {
  soundVisual.dataset.live = 'true'; cancelAnimationFrame(visualFrame);
  const draw = () => { const time = rainAudio.currentTime, lifeEnergy = getLifeNoiseEnergy(songAudio.currentTime); renderSpectrum((column, row) => { const passingDrop = Math.pow(Math.max(0, Math.sin(time * 9.4 + column * 1.71 + row * 2.33)), 8); const ripple = (Math.sin(time * 3.8 + column * .82 - row * 1.04) + 1) / 2; const detail = (Math.sin(time * 15.5 + column * 3.7 + row * 5.1) + 1) / 2; return .06 + lifeEnergy * (.18 + ((column + row) % 4) * .035) + ripple * .12 + detail * .06 + passingDrop * (.22 + ((column + row) % 3) * .06); }); visualFrame = requestAnimationFrame(draw); };
  draw();
}
function startWaveVisualizer() {
  soundVisual.dataset.live = 'true'; cancelAnimationFrame(visualFrame);
  const draw = () => { const time = waveAudio.currentTime, lifeEnergy = getLifeNoiseEnergy(songAudio.currentTime); renderSpectrum((column, row) => { const longSwell = (Math.sin(time * 1.07 + column * .46 - row * .72) + 1) / 2; const nearFoam = Math.pow((Math.sin(time * 3.1 + column * .9 - row * 1.15) + 1) / 2, 1.7); return .065 + lifeEnergy * (.16 + ((column + row) % 5) * .028) + longSwell * (.12 + (row / spectrumRows) * .10) + nearFoam * .10; }); visualFrame = requestAnimationFrame(draw); };
  draw();
}
function playLifeNoiseLayer(mixGain = 1) {
  songAudio.currentTime = 0; songAudio.muted = muted; songAudio.volume = playbackMasterGain * lifeNoiseGain * mixGain;
  return songAudio.play().catch(() => { document.querySelector('#play-hint').textContent = '생활소음을 재생하지 못했어요. 새로고침 후 다시 시도해 주세요.'; });
}
function stopVisualizer() { cancelAnimationFrame(visualFrame); delete soundVisual.dataset.live; spectrumLevels.fill(0); }
function stopSound() { if (noiseSource) { noiseSource.source.stop(); noiseSource.layers.forEach(layer => layer.lfo.stop()); noiseSource = null; } songAudio.pause(); songAudio.currentTime = 0; rainAudio.pause(); rainAudio.currentTime = 0; waveAudio.pause(); waveAudio.currentTime = 0; stopVisualizer(); }
function stopTimer() { cancelAnimationFrame(timerFrame); }
function updateTimer() {
  const elapsed = (performance.now() - startedAt) / 1000, timer = document.querySelector('#timer-readout');
  // Keep the existing blind-zone: the readout disappears once 4 seconds have passed,
  // leaving the final three seconds to the user's sense of time.
  if (elapsed >= 4) timer.classList.add('is-hidden');
  else { timer.classList.remove('is-hidden'); document.querySelector('#timer-value').textContent = `${elapsed.toFixed(2)}초`; }
  timerFrame = requestAnimationFrame(updateTimer);
}
function beginRound(type) {
  round = type; document.querySelector('#timer-readout').classList.remove('is-hidden'); document.querySelector('#timer-value').textContent = '0.00초';
  const isSong = type === 'song'; document.querySelector('#round-label').textContent = isSong ? 'ROUND 1 OF 2 · 소리쉼표 OFF' : `ROUND 2 OF 2 · 소리쉼표 ON · ${soundNames[selectedSound]}`;
  document.querySelector('#sound-visual').dataset.mode = isSong ? 'music' : 'noise';
  document.querySelector('#play-hint').textContent = isSong ? '소리쉼표 OFF · 윗집 생활소음 그대로 느껴보세요.' : `소리쉼표 ON · 생활소음에 ${soundNames[selectedSound]}를 더한 환경이에요.`;
  document.querySelector('#mute-button').classList.remove('hidden'); show('play'); startedAt = performance.now(); audioContext?.resume();
  if (isSong) {
    muted = false; songAudio.currentTime = 0; songAudio.muted = false; songAudio.volume = playbackMasterGain * lifeNoiseGain;
    document.querySelector('#mute-button').textContent = '♬ 소리 끄기'; document.querySelector('#mute-button').setAttribute('aria-pressed', 'false');
    songAudio.play().then(startLifeNoiseVisualizer).catch(() => { document.querySelector('#play-hint').textContent = '음원을 재생하지 못했어요. 새로고침 후 다시 시도해 주세요.'; });
  } else if (selectedSound === 'rain') {
    muted = false; rainAudio.currentTime = 0; rainAudio.muted = false; rainAudio.volume = .72 * whiteNoiseMixGain * playbackMasterGain; playLifeNoiseLayer(mixedLifeNoiseGain);
    document.querySelector('#mute-button').textContent = '♬ 소리 끄기'; document.querySelector('#mute-button').setAttribute('aria-pressed', 'false');
    rainAudio.play().then(startRainVisualizer).catch(() => { document.querySelector('#play-hint').textContent = '빗소리를 재생하지 못했어요. 새로고침 후 다시 시도해 주세요.'; });
  } else if (selectedSound === 'wave') {
    muted = false; waveAudio.currentTime = 0; waveAudio.muted = false; waveAudio.volume = .82 * whiteNoiseMixGain * playbackMasterGain; playLifeNoiseLayer(mixedLifeNoiseGain);
    document.querySelector('#mute-button').textContent = '♬ 소리 끄기'; document.querySelector('#mute-button').setAttribute('aria-pressed', 'false');
    waveAudio.play().then(startWaveVisualizer).catch(() => { document.querySelector('#play-hint').textContent = '파도 소리를 재생하지 못했어요. 새로고침 후 다시 시도해 주세요.'; });
  } else { noiseSource = createNoise(selectedSound); audioContext.resume(); startVisualizer(noiseSource.analyser); }
  updateTimer();
}
function recordRound() {
  const elapsed = (performance.now() - startedAt) / 1000; records[round] = { elapsed, difference: Math.abs(elapsed - 7) }; stopTimer(); stopSound();
  if (round === 'song') {
    document.querySelector('#selected-sound-name').textContent = soundNames[selectedSound];
    show('noise-setup');
  } else {
    document.querySelector('#preference-sound-name').textContent = soundNames[selectedSound];
    show('preference');
  }
}
function formatRecord(record) { return `${record.elapsed.toFixed(2)}초`; }
function formatDifference(record) { return `7초와 ${record.difference.toFixed(2)}초 차이`; }
function renderResults(choice) {
  comfortChoice = choice;
  document.querySelector('#song-record').textContent = formatRecord(records.song); document.querySelector('#song-difference').textContent = formatDifference(records.song);
  document.querySelector('#noise-record').textContent = formatRecord(records.noise); document.querySelector('#noise-difference').textContent = formatDifference(records.noise); document.querySelector('#noise-card-label').textContent = `2차 · 소리쉼표 ON · ${soundNames[selectedSound]}`;
  let comparisonCopy;
  if (choice === 'masked') comparisonCopy = `오늘은 소리쉼표 ON으로 ${soundNames[selectedSound]}를 더한 환경이 더 편하게 느껴졌어요. 7초 기록은 재미용 점수이고, 이 결과는 직접 고른 오늘의 사운드 취향이에요.`;
  else if (choice === 'plain') comparisonCopy = '오늘은 생활소음 그대로인 소리쉼표 OFF 환경이 더 편하게 느껴졌어요. 소리 취향은 사람마다 달라요. 다른 사운드도 비교하며 내 공간에 맞는 소리를 찾아보세요.';
  else comparisonCopy = '오늘은 소리쉼표 OFF와 ON 환경이 비슷하게 느껴졌어요. 한 번의 체험으로 정답을 정할 필요는 없어요. 다른 사운드도 들어보며 내 공간에 맞는 소리를 찾아보세요.';
  document.querySelector('#comparison-copy').textContent = comparisonCopy;
  document.querySelector('.compare-card.music').classList.toggle('preferred', choice === 'plain');
  document.querySelector('.compare-card.noise').classList.toggle('preferred', choice === 'masked');
  show('result');
}
document.querySelectorAll('.sound-card').forEach(card => card.addEventListener('click', () => {
  if (comparisonStarted) return;
  comparisonStarted = true; selectedSound = card.querySelector('input').value;
  document.querySelectorAll('.sound-card').forEach(item => item.classList.toggle('selected', item === card));
  beginRound('song');
}));
document.querySelector('#song-round-button').addEventListener('click', () => beginRound('song'));
document.querySelector('#noise-round-button').addEventListener('click', () => beginRound('noise'));
document.querySelector('#stop-button').addEventListener('click', recordRound);
document.querySelector('#mute-button').addEventListener('click', event => { muted = !muted; if (noiseSource) noiseSource.gain.gain.value = muted ? 0 : noiseSource.volume; songAudio.muted = muted; rainAudio.muted = muted; waveAudio.muted = muted; event.currentTarget.textContent = muted ? '♬ 소리 켜기' : '♬ 소리 끄기'; event.currentTarget.setAttribute('aria-pressed', muted); });
document.querySelectorAll('.preference-button').forEach(button => button.addEventListener('click', () => renderResults(button.dataset.choice)));
const comingSoonDialog = document.querySelector('#coming-soon-dialog');
function closeComingSoonDialog() {
  if (typeof comingSoonDialog.close === 'function') comingSoonDialog.close();
  else comingSoonDialog.removeAttribute('open');
}
document.querySelector('#product-link').addEventListener('click', () => {
  if (typeof comingSoonDialog.showModal === 'function') comingSoonDialog.showModal();
  else comingSoonDialog.setAttribute('open', '');
});
document.querySelector('#coming-soon-close').addEventListener('click', closeComingSoonDialog);
comingSoonDialog.addEventListener('click', event => { if (event.target === comingSoonDialog) closeComingSoonDialog(); });
document.querySelector('#retry-button').addEventListener('click', () => { stopTimer(); stopSound(); records.song = records.noise = null; comfortChoice = null; comparisonStarted = false; show('intro'); });
