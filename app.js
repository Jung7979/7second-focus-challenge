const screens = { intro: document.querySelector('#intro-screen'), play: document.querySelector('#play-screen'), result: document.querySelector('#result-screen') };
const soundNames = { rain: '빗소리', wave: '파도 소리', brown: '브라운 노이즈' };
let selectedSound = 'rain', startedAt = 0, audioContext, noiseSource, muted = false, timerFrame, lastWholeSecond = 7;

function show(name) { Object.entries(screens).forEach(([key, screen]) => screen.classList.toggle('active', key === name)); }
function selectedValue() { return document.querySelector('input[name="sound"]:checked').value; }

function createNoise(type) {
  audioContext ??= new AudioContext();
  const bufferSize = audioContext.sampleRate * 2;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    last = type === 'brown' ? (last + 0.02 * white) / 1.02 : white;
    data[i] = type === 'wave' ? (last * .55 + Math.sin(i / 1700) * .15) : last;
  }
  const source = audioContext.createBufferSource(); const gain = audioContext.createGain();
  source.buffer = buffer; source.loop = true; gain.gain.value = muted ? 0 : .045;
  source.connect(gain).connect(audioContext.destination); source.start();
  return { source, gain };
}

function stopSound() { if (noiseSource) { noiseSource.source.stop(); noiseSource = null; } }
function resultCopy(diff) { return diff <= .2 ? '7초 감각이 정말 정확하네요!' : diff <= .7 ? '좋아요. 소리에 잠시 집중해 보셨네요.' : '시간 감각은 매번 달라도 괜찮아요. 내게 편한 소리를 찾아보세요.'; }
function updateTimer() {
  const elapsed = (performance.now() - startedAt) / 1000;
  const remaining = 7 - elapsed;
  const timer = document.querySelector('#timer-readout');
  if (remaining < 1) {
    timer.classList.add('is-hidden');
  } else {
    timer.classList.remove('is-hidden');
    document.querySelector('#timer-value').textContent = `${remaining.toFixed(2)}초`;
    const checkpoint = lastWholeSecond - 1;
    if (checkpoint >= 1 && remaining <= checkpoint + .02) {
      timer.classList.remove('is-pulse');
      void timer.offsetWidth;
      timer.classList.add('is-pulse');
      document.querySelector('#timer-value').textContent = `${checkpoint.toFixed(2)}초`;
      lastWholeSecond = checkpoint;
    }
  }
  timerFrame = requestAnimationFrame(updateTimer);
}
function stopTimer() { cancelAnimationFrame(timerFrame); }

document.querySelectorAll('.sound-card').forEach(card => card.addEventListener('change', () => {
  document.querySelectorAll('.sound-card').forEach(item => item.classList.toggle('selected', item.contains(document.querySelector('input:checked'))));
}));

document.querySelector('#start-button').addEventListener('click', () => {
  selectedSound = selectedValue();
  document.querySelector('#sound-name').textContent = `${soundNames[selectedSound]}와 함께`;
  lastWholeSecond = 7;
  document.querySelector('#timer-readout').classList.remove('is-hidden', 'is-pulse');
  document.querySelector('#timer-value').textContent = '7.00초';
  show('play'); startedAt = performance.now(); noiseSource = createNoise(selectedSound); updateTimer();
});

document.querySelector('#stop-button').addEventListener('click', () => {
  const elapsed = (performance.now() - startedAt) / 1000; const difference = Math.abs(elapsed - 7);
  stopTimer(); stopSound(); document.querySelector('#record-value').textContent = `${elapsed.toFixed(2)}초`;
  document.querySelector('#difference-value').textContent = `7초와 ${difference.toFixed(2)}초 차이`;
  document.querySelector('#result-copy').textContent = resultCopy(difference); show('result');
});

document.querySelector('#mute-button').addEventListener('click', event => {
  muted = !muted; if (noiseSource) noiseSource.gain.gain.value = muted ? 0 : .045;
  event.currentTarget.textContent = muted ? '♬ 소리 켜기' : '♬ 소리 끄기'; event.currentTarget.setAttribute('aria-pressed', muted);
});
document.querySelector('#retry-button').addEventListener('click', () => { stopTimer(); stopSound(); show('intro'); });
