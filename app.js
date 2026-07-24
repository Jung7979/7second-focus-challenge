const screens = Object.fromEntries([...document.querySelectorAll('.screen')].map(screen => [screen.id.replace('-screen', ''), screen]));
const soundNames = { rain: '빗소리', wave: '파도 소리' };
const songAudio = document.querySelector('#song-audio');
const soundVisual = document.querySelector('#sound-visual');
const spectrumCanvas = soundVisual.querySelector('.spectrum-canvas');
const spectrumContext = spectrumCanvas.getContext('2d');
const spectrumColumns = 16, spectrumRows = 11;
const spectrumLevels = new Float32Array(spectrumColumns * spectrumRows);
const lifeNoiseEvents = [[.92, .52], [1.84, .9], [2.48, 1], [2.92, .64], [3.42, .48], [4.84, 1], [5.58, .86], [6.08, .62], [7.02, 1], [7.74, .56], [8.92, .88], [9.42, .58], [10.42, 1], [11.18, .55]];
let selectedSound = 'rain', round = 'song', startedAt = 0, audioContext, noiseSource, muted = false, timerFrame, visualFrame, activeAnalyser, visualData, visualTimeData, comparisonStarted = false;
const records = { song: null, noise: null };

function show(name) { Object.entries(screens).forEach(([key, screen]) => screen.classList.toggle('active', key === name)); }
function createNoise(type) {
  audioContext ??= new AudioContext();
  const size = audioContext.sampleRate * 2;
  const buffer = audioContext.createBuffer(1, size, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = type === 'wave' ? white * .55 + Math.sin(i / 1700) * .15 : white;
  }
  const source = audioContext.createBufferSource(), textureGain = audioContext.createGain(), gain = audioContext.createGain(), analyser = audioContext.createAnalyser(), lfo = audioContext.createOscillator(), lfoGain = audioContext.createGain();
  const volume = .045;
  analyser.fftSize = 64; analyser.smoothingTimeConstant = .72;
  const lfoFrequency = type === 'wave' ? .72 : 1.85;
  source.buffer = buffer; source.loop = true; textureGain.gain.value = type === 'wave' ? .62 : .55; lfo.frequency.value = lfoFrequency; lfoGain.gain.value = type === 'wave' ? .28 : .38;
  gain.gain.value = muted ? 0 : volume; source.connect(textureGain).connect(analyser).connect(gain).connect(audioContext.destination); lfo.connect(lfoGain).connect(textureGain.gain); source.start(); lfo.start(); return { source, gain, analyser, lfo, volume, type, lfoFrequency, startedAt: audioContext.currentTime };
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
    const elevation = isLifeNoise ? 4 + Math.pow(level, 1.7) * height * .22 : 2 + Math.pow(level, 1.35) * height * .16;
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
  const draw = () => { activeAnalyser.getByteFrequencyData(visualData); activeAnalyser.getByteTimeDomainData(visualTimeData); const now = performance.now() / 1000, rms = Math.sqrt(visualTimeData.reduce((sum, value) => sum + Math.pow((value - 128) / 128, 2), 0) / visualTimeData.length); const isWave = noiseSource?.type === 'wave', modulationTime = (audioContext.currentTime - noiseSource.startedAt) * noiseSource.lfoFrequency, modulation = (Math.sin(modulationTime * Math.PI * 2 - Math.PI / 2) + 1) / 2; renderSpectrum((column, row) => { const bin = Math.min(visualData.length - 1, 1 + Math.floor(column * (visualData.length - 2) / spectrumColumns)); const audioLevel = visualData[bin] / 255; const phase = isWave ? now * 4.1 + column * .7 - row * .92 : now * 8.4 + column * 1.14 + row * .62; const travel = (Math.sin(phase) + 1) / 2; const bandShape = isWave ? Math.max(0, 1 - Math.abs(column - row * 1.02 - 4) / 8) : ((column * 7 + row * 11) % 5) / 5; const reactive = Math.pow(audioLevel, .72) * .15 + rms * .18; const gentlePulse = modulation * (.07 + bandShape * .11); const flowingSurface = travel * (.045 + bandShape * .13); return .08 + reactive + gentlePulse + flowingSurface + (isWave ? Math.sin(now * 1.1) * .025 : Math.sin(now * 2.8 + row) * .035); }); visualFrame = requestAnimationFrame(draw); };
  draw();
}
function startLifeNoiseVisualizer() {
  soundVisual.dataset.live = 'true'; cancelAnimationFrame(visualFrame);
  const draw = () => { const time = songAudio.currentTime; const eventPulse = lifeNoiseEvents.reduce((total, [at, strength]) => total + strength * Math.exp(-Math.pow((time - at) / .2, 2)), 0); renderSpectrum((column, row) => { const distance = Math.hypot(column - 7.5, row - 5); const center = Math.max(0, 1 - distance / 9); const movement = (Math.sin(time * 15 + column * 1.36 + row * .88) + Math.cos(time * 9 - column * .66 + row * 1.08)) * .13; const eventTexture = eventPulse * (.42 + center * 1.05 + ((column * 3 + row) % 4) * .11); return .16 + center * .22 + movement + eventTexture; }); visualFrame = requestAnimationFrame(draw); };
  draw();
}
function stopVisualizer() { cancelAnimationFrame(visualFrame); delete soundVisual.dataset.live; spectrumLevels.fill(0); }
function stopSound() { if (noiseSource) { noiseSource.source.stop(); noiseSource.lfo.stop(); noiseSource = null; } songAudio.pause(); songAudio.currentTime = 0; stopVisualizer(); }
function stopTimer() { cancelAnimationFrame(timerFrame); }
function updateTimer() {
  const remaining = 7 - (performance.now() - startedAt) / 1000, timer = document.querySelector('#timer-readout');
  if (remaining <= 3) timer.classList.add('is-hidden');
  else { timer.classList.remove('is-hidden'); document.querySelector('#timer-value').textContent = `${remaining.toFixed(2)}초`; }
  timerFrame = requestAnimationFrame(updateTimer);
}
function beginRound(type) {
  round = type; document.querySelector('#timer-readout').classList.remove('is-hidden'); document.querySelector('#timer-value').textContent = '7.00초';
  const isSong = type === 'song'; document.querySelector('#round-label').textContent = isSong ? 'ROUND 1 OF 2 · 생활소음 모드' : `ROUND 2 OF 2 · ${soundNames[selectedSound]}`;
  document.querySelector('#sound-visual').dataset.mode = isSong ? 'music' : 'noise';
  document.querySelector('#play-hint').textContent = isSong ? '생활소음이 들리는 동안 시간 감각에만 집중해 보세요.' : `${soundNames[selectedSound]}와 함께 같은 방식으로 7초를 맞혀 보세요.`;
  document.querySelector('#mute-button').classList.remove('hidden'); show('play'); startedAt = performance.now(); audioContext?.resume();
  if (isSong) {
    muted = false; songAudio.currentTime = 0; songAudio.muted = false; songAudio.volume = 1;
    document.querySelector('#mute-button').textContent = '♬ 소리 끄기'; document.querySelector('#mute-button').setAttribute('aria-pressed', 'false');
    songAudio.play().then(startLifeNoiseVisualizer).catch(() => { document.querySelector('#play-hint').textContent = '음원을 재생하지 못했어요. 새로고침 후 다시 시도해 주세요.'; });
  } else { noiseSource = createNoise(selectedSound); audioContext.resume(); startVisualizer(noiseSource.analyser); }
  updateTimer();
}
function recordRound() {
  const elapsed = (performance.now() - startedAt) / 1000; records[round] = { elapsed, difference: Math.abs(elapsed - 7) }; stopTimer(); stopSound();
  if (round === 'song') { document.querySelector('#selected-sound-name').textContent = soundNames[selectedSound]; show('noise-setup'); } else renderResults();
}
function formatRecord(record) { return `${record.elapsed.toFixed(2)}초`; }
function formatDifference(record) { return `7초와 ${record.difference.toFixed(2)}초 차이`; }
function renderResults() {
  document.querySelector('#song-record').textContent = formatRecord(records.song); document.querySelector('#song-difference').textContent = formatDifference(records.song);
  document.querySelector('#noise-record').textContent = formatRecord(records.noise); document.querySelector('#noise-difference').textContent = formatDifference(records.noise); document.querySelector('#noise-card-label').textContent = `2차 · ${soundNames[selectedSound]}`;
  const gap = Math.abs(records.noise.difference - records.song.difference);
  let comparisonCopy;
  if (gap <= .1) comparisonCopy = '두 소리에서 비슷한 기록이 나왔어요. 이 게임은 집중력을 평가하지 않는 짧은 시간 감각 체험입니다. 오늘 내게 편한 소리를 찾아보세요.';
  else if (records.song.difference < records.noise.difference) comparisonCopy = '이번 라운드에서는 생활소음 모드에서 7초에 더 가깝게 멈췄어요. 한 번의 기록은 집중력의 우열을 뜻하지 않아요. 생활소음과 백색소음 중 오늘 더 편한 환경을 찾아보세요.';
  else comparisonCopy = `이번 라운드에서는 ${soundNames[selectedSound]}에서 7초에 더 가깝게 멈췄어요. 한 번의 기록은 집중력의 우열을 뜻하지 않아요. 오늘 내게 편한 소리 환경을 찾아보세요.`;
  document.querySelector('#comparison-copy').textContent = comparisonCopy;
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
document.querySelector('#mute-button').addEventListener('click', event => { muted = !muted; if (noiseSource) noiseSource.gain.gain.value = muted ? 0 : noiseSource.volume; songAudio.muted = muted; event.currentTarget.textContent = muted ? '♬ 소리 켜기' : '♬ 소리 끄기'; event.currentTarget.setAttribute('aria-pressed', muted); });
document.querySelector('#retry-button').addEventListener('click', () => { stopTimer(); stopSound(); records.song = records.noise = null; comparisonStarted = false; show('intro'); });
