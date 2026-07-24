const questions = [
  { q: '이동할 때 가장 자주 드는 생각은?', a: [['A','도착 전부터 목과 어깨가 뻐근해요.',3],['B','잠깐만 자도 자세가 불편해요.',2],['C','창밖 보며 끝까지 괜찮아요.',1]] },
  { q: '비행기·버스에서 주로 하는 행동은?', a: [['A','고개가 자꾸 한쪽으로 떨어져요.',3],['B','가방을 베고 잠깐 쉬어요.',2],['C','계속 앉아 영상을 봐요.',1]] },
  { q: '여행 후 가장 먼저 피곤함을 느끼는 곳은?', a: [['A','목과 어깨',3],['B','허리와 등',2],['C','다리',1]] },
  { q: '다음 여행 이동 시간은 어느 정도인가요?', a: [['A','3시간 이상 장거리',3],['B','1~3시간',2],['C','1시간 이내',1]] }
];
let current = 0, score = 0;
const question = document.querySelector('#question'), answers = document.querySelector('#answers'), step = document.querySelector('#step'), bar = document.querySelector('#bar');
function render() {
  const item = questions[current]; step.textContent = `QUESTION ${current + 1} / ${questions.length}`; bar.style.width = `${((current + 1) / questions.length) * 100}%`; question.textContent = item.q;
  answers.innerHTML = item.a.map(([mark, text], idx) => `<button class="answer" type="button" data-index="${idx}"><span>${mark}</span>${text}</button>`).join('');
  answers.querySelectorAll('.answer').forEach(button => button.addEventListener('click', () => choose(Number(button.dataset.index))));
}
function choose(index) { score += questions[current].a[index][2]; current += 1; if (current < questions.length) render(); else showResult(); }
function showResult() {
  document.querySelector('#quiz').hidden = true; const result = document.querySelector('#result'); result.hidden = false;
  const title = document.querySelector('#resultTitle'), copy = document.querySelector('#resultCopy'), tip = document.querySelector('#tipText');
  if (score >= 10) { title.textContent = '목 휴식이 필요한\n장거리 이동형'; copy.textContent = '이동 중 고개가 흔들리거나 목이 쉽게 뻐근해지는 편이에요. 가볍게 챙기는 목 지지 아이템이 여행 컨디션을 바꿀 수 있어요.'; tip.textContent = '목이 흔들리지 않도록 U자형 목베개를 턱 아래까지 밀착해 보세요.'; }
  else if (score >= 7) { title.textContent = '잠깐의 휴식도\n챙기면 좋은 균형형'; copy.textContent = '이동 시간에는 버티지만, 잠깐의 불편함이 여행 후 피로로 남을 수 있어요.'; tip.textContent = '가방 공간을 차지하지 않는 압축형 목베개를 준비해 보세요.'; }
  else { title.textContent = '여행 준비가 좋은\n가벼운 이동형'; copy.textContent = '짧은 이동에는 비교적 편안하지만, 장거리 여행 때는 목 휴식을 미리 챙겨두면 좋아요.'; tip.textContent = '다음 장거리 이동을 위해 접어서 보관하는 목베개를 챙겨보세요.'; }
}
document.querySelector('#restart').addEventListener('click', () => { current = 0; score = 0; document.querySelector('#result').hidden = true; document.querySelector('#quiz').hidden = false; render(); window.scrollTo({top:0,behavior:'smooth'}); });
render();
