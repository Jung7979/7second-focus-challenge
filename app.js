const screens = Object.fromEntries([...document.querySelectorAll('.screen')].map(screen => [screen.id.replace('-screen', ''), screen]));
const soundNames = { rain: '빗소리', wave: '파도 소리', brown: '브라운 노이즈' };
const songAudio = document.querySelector('#song-audio');
let selectedSound = 'rain', round = 'song', startedAt = 0, audioContext, noiseSource, muted = false, timerFrame, lastWholeSecond = 7;
const records = { song: null, noise: null };

function show(name) { Object.entries(screens).forEach(([key, screen]) => screen.classList.toggle('active', key === name)); }
function createNoise(type) {
  audioContext ??= new AudioContext();
  const size = audioContext.sampleRate * 2;
  const buffer = audioContext.createBuffer(1, size, audioContext.sampleRate);
  const data = buffer.getChannelData(0); let last = 0;
  for (let i = 0; i < size; i++) { const white = Math.random() * 2 - 1; last = type === 'brown' ? (last + .02 * white) / 1.02 : white; data[i] = type === 'wave' ? last * .55 + Math.sin(i / 1700) * .15 : last; }
  const source = audioContext.createBufferSource(), gain = audioContext.createGain();
  source.buffer = buffer; source.loop = true; gain.gain.value = muted ? 0 : .045; source.connect(gain).connect(audioContext.destination); source.start(); return { source, gain };
}
function stopSound() { if (noiseSource) { noiseSource.source.stop(); noiseSource = null; } songAudio.pause(); songAudio.currentTime = 0; }
function stopTimer() { cancelAnimationFrame(timerFrame); }
function updateTimer() {
  const remaining = 7 - (performance.now() - startedAt) / 1000, timer = document.querySelector('#timer-readout');
  if (remaining <= 2) timer.classList.add('is-hidden');
  else { timer.classList.remove('is-hidden'); document.querySelector('#timer-value').textContent = `${remaining.toFixed(2)}초`; const checkpoint = lastWholeSecond - 1; if (checkpoint >= 3 && remaining <= checkpoint + .02) { timer.classList.remove('is-pulse'); void timer.offsetWidth; timer.classList.add('is-pulse'); document.querySelector('#timer-value').textContent = `${checkpoint.toFixed(2)}초`; lastWholeSecond = checkpoint; } }
  timerFrame = requestAnimationFrame(updateTimer);
}
function beginRound(type) {
  round = type; lastWholeSecond = 7; document.querySelector('#timer-readout').classList.remove('is-hidden', 'is-pulse'); document.querySelector('#timer-value').textContent = '7.00초';
  const isSong = type === 'song'; document.querySelector('#round-label').textContent = isSong ? 'ROUND 1 OF 2 · 방해 음악' : `ROUND 2 OF 2 · ${soundNames[selectedSound]}`;
  document.querySelector('#play-hint').textContent = isSong ? '노래가 들리는 동안 시간 감각에만 집중해 보세요.' : `${soundNames[selectedSound]}와 함께 같은 방식으로 7초를 맞혀 보세요.`;
  document.querySelector('#mute-button').classList.remove('hidden'); show('play'); startedAt = performance.now();
  if (isSong) { songAudio.currentTime = 0; songAudio.muted = muted; songAudio.play().catch(() => {}); } else noiseSource = createNoise(selectedSound);
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
  const better = records.noise.difference < records.song.difference;
  document.querySelector('#comparison-copy').textContent = better ? `${soundNames[selectedSound]}에서 7초에 더 가깝게 멈췄어요. 내게 편한 소리 환경을 찾아보세요.` : `두 결과가 달라도 괜찮아요. 상황에 따라 내게 편한 소리 환경을 찾아보세요.`;
  show('result');
}
document.querySelectorAll('.sound-card').forEach(card => card.addEventListener('change', () => document.querySelectorAll('.sound-card').forEach(item => item.classList.toggle('selected', item.contains(document.querySelector('input:checked'))))));
document.querySelector('#start-button').addEventListener('click', () => { selectedSound = document.querySelector('input[name="sound"]:checked').value; show('song-setup'); });
document.querySelector('#song-round-button').addEventListener('click', () => beginRound('song'));
document.querySelector('#noise-round-button').addEventListener('click', () => beginRound('noise'));
document.querySelector('#stop-button').addEventListener('click', recordRound);
document.querySelector('#mute-button').addEventListener('click', event => { muted = !muted; if (noiseSource) noiseSource.gain.gain.value = muted ? 0 : .045; songAudio.muted = muted; event.currentTarget.textContent = muted ? '♬ 소리 켜기' : '♬ 소리 끄기'; event.currentTarget.setAttribute('aria-pressed', muted); });
document.querySelector('#retry-button').addEventListener('click', () => { stopTimer(); stopSound(); records.song = records.noise = null; show('intro'); });
