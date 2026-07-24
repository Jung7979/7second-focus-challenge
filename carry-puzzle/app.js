const COLS = 5, ROWS = 4, GAME_SECONDS = 30;
const pieces = [
  { id: 'hoodie', name: '후드', icon: '🧥', w: 3, h: 2, color: '#ffb34f' },
  { id: 'tops', name: '티셔츠', icon: '👕', w: 2, h: 2, color: '#8fc6ff' },
  { id: 'pants', name: '팬츠', icon: '👖', w: 1, h: 2, color: '#a9a0f5' },
  { id: 'pouch', name: '세면 파우치', icon: '🧴', w: 2, h: 1, color: '#ffc3a8' },
  { id: 'tee', name: '반팔', icon: '👚', w: 2, h: 1, color: '#a5dfc1' },
  { id: 'socks', name: '양말', icon: '🧦', w: 1, h: 1, color: '#ff9fb0' },
  { id: 'charger', name: '충전기', icon: '🔌', w: 1, h: 1, color: '#d5b692' },
  { id: 'underwear', name: '속옷', icon: '🩲', w: 1, h: 1, color: '#d7a9e8' },
  { id: 'passport', name: '여권', icon: '🛂', w: 1, h: 1, color: '#80cbd0' }
];
const screens = Object.fromEntries([...document.querySelectorAll('.screen')].map(screen => [screen.id.replace('-screen', ''), screen]));
const board = document.querySelector('#board'), tray = document.querySelector('#tray'), timerValue = document.querySelector('#timer-value'), pieceCount = document.querySelector('#piece-count'), hint = document.querySelector('#game-hint');
let state = {}, dragging = null, timerId = null, startedAt = 0, playing = false;

function show(name) { Object.entries(screens).forEach(([key, screen]) => screen.classList.toggle('active', key === name)); }
function resetState() { state = Object.fromEntries(pieces.map(piece => [piece.id, { x: null, y: null }])); }
function isPlaced(piece) { return state[piece.id].x !== null; }
function createPiece(piece) {
  const element = document.createElement('button');
  element.type = 'button'; element.className = 'piece'; element.dataset.id = piece.id; element.style.background = piece.color;
  element.innerHTML = `<span class="emoji">${piece.icon}</span><span>${piece.name}</span>`;
  element.addEventListener('pointerdown', beginDrag); return element;
}
function render() {
  board.innerHTML = ''; tray.innerHTML = '';
  pieces.forEach(piece => {
    const element = createPiece(piece), position = state[piece.id];
    if (isPlaced(piece)) {
      element.classList.add('placed'); element.style.position = 'absolute'; element.style.width = `${piece.w / COLS * 100}%`; element.style.height = `${piece.h / ROWS * 100}%`;
      element.style.left = `${position.x / COLS * 100}%`; element.style.top = `${position.y / ROWS * 100}%`; board.append(element);
    } else { element.style.width = `${piece.w * 48}px`; element.style.height = `${piece.h * 48}px`; tray.append(element); }
  });
  const packed = pieces.filter(isPlaced).length; pieceCount.textContent = `${packed} / ${pieces.length}`;
}
function occupiedCells(exceptId) {
  const cells = new Set();
  pieces.filter(piece => piece.id !== exceptId && isPlaced(piece)).forEach(piece => {
    const position = state[piece.id];
    for (let y = position.y; y < position.y + piece.h; y++) for (let x = position.x; x < position.x + piece.w; x++) cells.add(`${x},${y}`);
  });
  return cells;
}
function canPlace(piece, x, y) {
  if (x < 0 || y < 0 || x + piece.w > COLS || y + piece.h > ROWS) return false;
  const occupied = occupiedCells(piece.id);
  for (let row = y; row < y + piece.h; row++) for (let col = x; col < x + piece.w; col++) if (occupied.has(`${col},${row}`)) return false;
  return true;
}
function beginDrag(event) {
  if (!playing) return;
  event.preventDefault(); const id = event.currentTarget.dataset.id, piece = pieces.find(item => item.id === id), previous = { ...state[id] }, boardRect = board.getBoundingClientRect(), dragWidth = boardRect.width / COLS * piece.w, dragHeight = boardRect.height / ROWS * piece.h;
  state[id] = { x: null, y: null }; dragging = { piece, previous, element: event.currentTarget, offsetX: dragWidth / 2, offsetY: dragHeight / 2 };
  document.body.append(dragging.element); dragging.element.classList.add('dragging'); dragging.element.style.width = `${dragWidth}px`; dragging.element.style.height = `${dragHeight}px`; moveDrag(event);
  document.addEventListener('pointermove', moveDrag); document.addEventListener('pointerup', endDrag, { once: true });
}
function moveDrag(event) { if (!dragging) return; dragging.element.style.left = `${event.clientX - dragging.offsetX}px`; dragging.element.style.top = `${event.clientY - dragging.offsetY}px`; }
function endDrag(event) {
  document.removeEventListener('pointermove', moveDrag); if (!dragging) return;
  const boardRect = board.getBoundingClientRect(), cellWidth = boardRect.width / COLS, cellHeight = boardRect.height / ROWS;
  const x = Math.round((event.clientX - boardRect.left - dragging.piece.w * cellWidth / 2) / cellWidth), y = Math.round((event.clientY - boardRect.top - dragging.piece.h * cellHeight / 2) / cellHeight);
  if (canPlace(dragging.piece, x, y)) { state[dragging.piece.id] = { x, y }; hint.textContent = '좋아요! 남은 짐도 빈칸 없이 채워보세요.'; }
  else { state[dragging.piece.id] = dragging.previous; hint.textContent = '겹치거나 밖으로 나갔어요. 빈칸에 맞춰 다시 놓아보세요.'; }
  dragging = null; render(); if (pieces.every(isPlaced)) finish(true);
}
function updateTimer() {
  const remaining = Math.max(0, GAME_SECONDS - (performance.now() - startedAt) / 1000); timerValue.textContent = Math.ceil(remaining);
  if (remaining <= 0) finish(false);
}
function startGame() { clearInterval(timerId); resetState(); render(); playing = true; startedAt = performance.now(); timerValue.textContent = GAME_SECONDS; hint.textContent = '조각을 길게 눌러 드래그하면 칸에 맞춰 놓을 수 있어요.'; show('game'); timerId = setInterval(updateTimer, 100); }
function finish(success) {
  if (!playing) return; playing = false; clearInterval(timerId);
  document.querySelector('#result-eyebrow').textContent = success ? 'PACKING COMPLETE' : 'TIME UP · TRY AGAIN';
  document.querySelector('#result-title').innerHTML = success ? '캐리어를<br /><strong>빈틈없이 채웠어요!</strong>' : '조금만 더<br /><strong>효율적으로 담아볼까요?</strong>';
  document.querySelector('#result-copy').textContent = success ? `30초 안에 여행 짐 ${pieces.length}개를 모두 담았어요. 압축 파우치로 의류와 소품을 분류하면 여행 준비가 더 간편해집니다.` : '남은 조각이 있어요. 압축 파우치로 짐의 부피를 줄이고, 다시 한 번 캐리어 빈칸을 채워보세요.';
  show('result');
}
document.querySelector('#start-button').addEventListener('click', startGame);
document.querySelector('#restart-button').addEventListener('click', startGame);
document.querySelector('#play-again-button').addEventListener('click', startGame);
resetState(); render();
