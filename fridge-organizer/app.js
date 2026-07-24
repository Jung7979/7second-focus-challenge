const foods = [
  { name: '딸기', icon: '🍓', type: 'produce' }, { name: '상추', icon: '🥬', type: 'produce' },
  { name: '토마토', icon: '🍅', type: 'produce' }, { name: '치즈', icon: '🧀', type: 'deli' },
  { name: '반찬', icon: '🥘', type: 'deli' }, { name: '요거트', icon: '🥛', type: 'deli' },
  { name: '소스', icon: '🥫', type: 'snack' }, { name: '쿠키', icon: '🍪', type: 'snack' }
];

const foodList = document.querySelector('#foods');
const containers = document.querySelectorAll('.container');
const timerEl = document.querySelector('#timer');
const mission = document.querySelector('#mission');
const feedback = document.querySelector('#feedback');
const result = document.querySelector('#result');
let chosen = null, complete = 0, seconds = 15, timerId = null, playing = true;

function paintFoods() {
  foodList.innerHTML = foods.map((food, index) => `<button class="food" data-index="${index}" type="button"><span class="icon">${food.icon}</span><span class="name">${food.name}</span></button>`).join('');
  foodList.querySelectorAll('.food').forEach(button => button.addEventListener('click', () => chooseFood(button)));
}

function chooseFood(button) {
  if (!playing || button.classList.contains('done')) return;
  document.querySelectorAll('.food.active').forEach(card => card.classList.remove('active'));
  button.classList.add('active'); chosen = Number(button.dataset.index);
  feedback.textContent = `${foods[chosen].name}, 어디에 보관할까요?`;
}

function tryStore(target) {
  if (!playing) return;
  if (chosen === null) { feedback.textContent = '먼저 재료를 탭해 선택하세요.'; return; }
  const card = foodList.querySelector(`[data-index="${chosen}"]`);
  if (foods[chosen].type === target.dataset.type) {
    card.classList.remove('active'); card.classList.add('done');
    complete += 1; mission.textContent = `정리한 재료 ${complete} / ${foods.length}`;
    feedback.textContent = '좋아요! 신선하게 보관했어요.';
    target.classList.add('selected-target'); setTimeout(() => target.classList.remove('selected-target'), 180);
    chosen = null;
    if (complete === foods.length) finish(true);
  } else {
    feedback.textContent = '다른 용기에 담아보세요!';
    target.animate([{transform:'translateX(0)'},{transform:'translateX(-7px)'},{transform:'translateX(7px)'},{transform:'translateX(0)'}], {duration:240});
  }
}

function finish(success) {
  playing = false; clearInterval(timerId); result.classList.add('show'); result.setAttribute('aria-hidden', 'false');
  document.querySelector('#resultTitle').textContent = success ? '냉장고 정리 완료!' : '시간이 끝났어요!';
  document.querySelector('#resultCopy').textContent = success ? '재료를 용도별로 정리했어요. 밀폐 보관으로 냄새와 신선도를 함께 관리해 보세요.' : `총 ${complete}개를 정리했어요. 밀폐용기 세트로 다음 정리는 더 빠르게 해보세요.`;
}

function reset() {
  clearInterval(timerId); chosen = null; complete = 0; seconds = 15; playing = true;
  timerEl.textContent = '0:15'; mission.textContent = '정리한 재료 0 / 8'; feedback.textContent = '신선함을 지켜볼까요?';
  result.classList.remove('show'); result.setAttribute('aria-hidden', 'true'); paintFoods();
  timerId = setInterval(() => { seconds -= 1; timerEl.textContent = `0:${String(Math.max(seconds, 0)).padStart(2, '0')}`; if (seconds <= 0) finish(false); }, 1000);
}

containers.forEach(container => container.addEventListener('click', () => tryStore(container)));
document.querySelector('#restart').addEventListener('click', reset);
document.querySelector('#again').addEventListener('click', reset);
reset();
