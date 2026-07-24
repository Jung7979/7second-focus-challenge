const screens = Object.fromEntries([...document.querySelectorAll('.screen')].map(screen => [screen.id.replace('-screen', ''), screen]));
const soundNames = { rain: '빗소리', wave: '파도 소리' };
const songAudio = document.querySelector('#song-audio');
const soundVisual = document.querySelector('#sound-visual');
const visualBars = [...soundVisual.querySelectorAll('i')];
let selectedSound = 'rain', round = 'song', startedAt = 0, audioContext, noiseSource, songSource, songGain, songAnalyser, muted = false, timerFrame, visualFrame, activeAnalyser, visualData, comparisonStarted = false;
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
  const source = audioContext.createBufferSource(), gain = audioContext.createGain(), analyser = audioContext.createAnalyser();
  const volume = .045;
  analyser.fftSize = 64; analyser.smoothingTimeConstant = .72;
  source.buffer = buffer; source.loop = true; gain.gain.value = muted ? 0 : volume; source.connect(analyser).connect(gain).connect(audioContext.destination); source.start(); return { source, gain, analyser, volume };
}
function getSongAnalyser() {
  audioContext ??= new AudioContext();
  if (!songSource) { songSource = audioContext.createMediaElementSource(songAudio); songGain = audioContext.createGain(); songAnalyser = audioContext.createAnalyser(); songAnalyser.fftSize = 64; songAnalyser.smoothingTimeConstant = .72; songSource.connect(songGain).connect(songAnalyser).connect(audioContext.destination); }
  return songAnalyser;
}
function startVisualizer(analyser) {
  activeAnalyser = analyser; visualData = new Uint8Array(analyser.frequencyBinCount); soundVisual.dataset.live = 'true'; cancelAnimationFrame(visualFrame);
  const draw = () => { activeAnalyser.getByteFrequencyData(visualData); visualBars.forEach((bar, index) => { const bin = Math.min(visualData.length - 1, 2 + Math.floor(index * (visualData.length - 3) / visualBars.length)); const level = visualData[bin] / 255; bar.style.height = `${34 + level * 185}px`; bar.style.transform = `translateY(${(1 - level) * 10}px)`; }); visualFrame = requestAnimationFrame(draw); };
  draw();
}
function stopVisualizer() { cancelAnimationFrame(visualFrame); delete soundVisual.dataset.live; visualBars.forEach(bar => { bar.style.height = ''; bar.style.transform = ''; }); }
function stopSound() { if (noiseSource) { noiseSource.source.stop(); noiseSource = null; } songAudio.pause(); songAudio.currentTime = 0; stopVisualizer(); }
function stopTimer() { cancelAnimationFrame(timerFrame); }
function updateTimer() {
  const remaining = 7 - (performance.now() - startedAt) / 1000, timer = document.querySelector('#timer-readout');
  if (remaining <= 2) timer.classList.add('is-hidden');
  else { timer.classList.remove('is-hidden'); document.querySelector('#timer-value').textContent = `${remaining.toFixed(2)}초`; }
  timerFrame = requestAnimationFrame(updateTimer);
}
function beginRound(type) {
  round = type; document.querySelector('#timer-readout').classList.remove('is-hidden'); document.querySelector('#timer-value').textContent = '7.00초';
  const isSong = type === 'song'; document.querySelector('#round-label').textContent = isSong ? 'ROUND 1 OF 2 · 음악 모드' : `ROUND 2 OF 2 · ${soundNames[selectedSound]}`;
  document.querySelector('#sound-visual').dataset.mode = isSong ? 'music' : 'noise';
  document.querySelector('#play-hint').textContent = isSong ? '노래가 들리는 동안 시간 감각에만 집중해 보세요.' : `${soundNames[selectedSound]}와 함께 같은 방식으로 7초를 맞혀 보세요.`;
  document.querySelector('#mute-button').classList.remove('hidden'); show('play'); startedAt = performance.now(); audioContext?.resume();
  if (isSong) { const analyser = getSongAnalyser(); audioContext.resume(); songAudio.currentTime = 0; songGain.gain.value = muted ? 0 : 1; songAudio.play().catch(() => {}); startVisualizer(analyser); } else { noiseSource = createNoise(selectedSound); audioContext.resume(); startVisualizer(noiseSource.analyser); }
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
  else if (records.song.difference < records.noise.difference) comparisonCopy = '이번 라운드에서는 음악 모드에서 7초에 더 가깝게 멈췄어요. 한 번의 기록은 집중력의 우열을 뜻하지 않아요. 음악과 백색소음 중 오늘 더 편한 환경을 찾아보세요.';
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
document.querySelector('#mute-button').addEventListener('click', event => { muted = !muted; if (noiseSource) noiseSource.gain.gain.value = muted ? 0 : noiseSource.volume; if (songGain) songGain.gain.value = muted ? 0 : 1; event.currentTarget.textContent = muted ? '♬ 소리 켜기' : '♬ 소리 끄기'; event.currentTarget.setAttribute('aria-pressed', muted); });
document.querySelector('#retry-button').addEventListener('click', () => { stopTimer(); stopSound(); records.song = records.noise = null; comparisonStarted = false; show('intro'); });
