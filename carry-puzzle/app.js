const COLS = 8, ROWS = 6, GAME_SECONDS = 45;
const pieces = [
  { id: 'hoodie', name: '후드', w: 3, h: 2, cells: [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]], clip: 'none', color: '#ffb34f', sprite: 0 },
  { id: 'tops', name: '티셔츠', w: 2, h: 3, cells: [[0,0],[0,1],[0,2],[1,2]], clip: 'polygon(0 0,50% 0,50% 66.667%,100% 66.667%,100% 100%,0 100%)', color: '#8fc6ff', sprite: 1 },
  { id: 'pants', name: '팬츠', w: 1, h: 4, cells: [[0,0],[0,1],[0,2],[0,3]], clip: 'none', color: '#a9a0f5', sprite: 2 },
  { id: 'pouch', name: '세면 파우치', w: 3, h: 2, cells: [[0,0],[1,0],[2,0],[1,1]], clip: 'polygon(0 0,100% 0,100% 50%,66.667% 50%,66.667% 100%,33.333% 100%,33.333% 50%,0 50%)', color: '#ffc3a8', sprite: 3 },
  { id: 'tee', name: '반팔', w: 3, h: 2, cells: [[1,0],[2,0],[0,1],[1,1]], clip: 'polygon(33.333% 0,100% 0,100% 50%,66.667% 50%,66.667% 100%,0 100%,0 50%,33.333% 50%)', color: '#a5dfc1', sprite: 4 },
  { id: 'socks', name: '양말', w: 2, h: 2, cells: [[0,0],[1,0],[0,1]], clip: 'polygon(0 0,100% 0,100% 50%,50% 50%,50% 100%,0 100%)', color: '#ff9fb0', sprite: 5 },
  { id: 'charger', name: '충전기', w: 2, h: 2, cells: [[0,0],[1,0],[0,1],[1,1]], clip: 'none', color: '#d5b692', sprite: 6 },
  { id: 'underwear', name: '속옷', w: 2, h: 2, cells: [[0,0],[0,1],[1,1]], clip: 'polygon(0 0,50% 0,50% 50%,100% 50%,100% 100%,0 100%)', color: '#d7a9e8', sprite: 7 },
  { id: 'passport', name: '여권', w: 3, h: 1, cells: [[0,0],[1,0],[2,0]], clip: 'none', color: '#80cbd0', sprite: 8 },
  { id: 'shoes', name: '신발', w: 3, h: 2, cells: [[0,0],[0,1],[1,1],[2,1]], clip: 'polygon(0 0,33.333% 0,33.333% 50%,100% 50%,100% 100%,0 100%)', color: '#f1cd88', sprite: 9 },
  { id: 'cap', name: '모자', w: 3, h: 2, cells: [[0,0],[1,0],[2,0],[1,1]], clip: 'polygon(0 0,100% 0,100% 50%,66.667% 50%,66.667% 100%,33.333% 100%,33.333% 50%,0 50%)', color: '#d9b5ed', sprite: 10 },
  { id: 'guide', name: '여행 안내서', w: 5, h: 1, cells: [[0,0],[1,0],[2,0],[3,0],[4,0]], clip: 'none', color: '#b7d6a8', sprite: 11 }
];
const screens = Object.fromEntries([...document.querySelectorAll('.screen')].map(screen => [screen.id.replace('-screen', ''), screen]));
const board = document.querySelector('#board'), tray = document.querySelector('#tray'), timerValue = document.querySelector('#timer-value'), pieceCount = document.querySelector('#piece-count'), hint = document.querySelector('#game-hint');
let state = {}, dragging = null, timerId = null, startedAt = 0, playing = false;

function show(name) { Object.entries(screens).forEach(([key, screen]) => screen.classList.toggle('active', key === name)); }
function resetState() { state = Object.fromEntries(pieces.map(piece => [piece.id, { x: null, y: null }])); }
function isPlaced(piece) { return state[piece.id].x !== null; }
function applyProductImage(element, piece) {
  element.style.backgroundColor = 'transparent';
  element.style.backgroundImage = `url(assets/pieces-shaped/${piece.id}.png)`;
  element.style.backgroundSize = '100% 100%';
  element.style.backgroundPosition = 'center';
  element.style.backgroundOrigin = 'border-box';
  element.style.backgroundClip = 'border-box';
  element.style.borderColor = 'transparent';
  element.style.boxShadow = 'none';
  element.style.filter = 'drop-shadow(0 4px 7px #183c6330)';
  element.style.setProperty('--piece-fill', piece.color);
}
function puzzleOutline(piece) {
  const occupied = new Set(piece.cells.map(([x, y]) => `${x},${y}`));
  const edges = [];
  const cells = piece.cells.map(([x, y]) => `<rect class="piece-cell" x="${x}" y="${y}" width="1" height="1" />`).join('');
  piece.cells.forEach(([x, y]) => {
    if (!occupied.has(`${x},${y - 1}`)) edges.push(`M${x} ${y}H${x + 1}`);
    if (!occupied.has(`${x + 1},${y}`)) edges.push(`M${x + 1} ${y}V${y + 1}`);
    if (!occupied.has(`${x},${y + 1}`)) edges.push(`M${x + 1} ${y + 1}H${x}`);
    if (!occupied.has(`${x - 1},${y}`)) edges.push(`M${x} ${y + 1}V${y}`);
  });
  return `<svg class="piece-outline" viewBox="0 0 ${piece.w} ${piece.h}" preserveAspectRatio="none" aria-hidden="true">${cells}<path d="${edges.join('')}" /></svg>`;
}
function createPiece(piece) {
  const element = document.createElement('button');
  element.type = 'button'; element.className = 'piece'; element.dataset.id = piece.id; applyProductImage(element, piece);
  element.innerHTML = `${puzzleOutline(piece)}<span class="piece-label">${piece.name}</span>`;
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
    piece.cells.forEach(([cellX, cellY]) => cells.add(`${position.x + cellX},${position.y + cellY}`));
  });
  return cells;
}
function canPlace(piece, x, y) {
  if (x < 0 || y < 0 || x + piece.w > COLS || y + piece.h > ROWS) return false;
  const occupied = occupiedCells(piece.id);
  for (const [cellX, cellY] of piece.cells) if (occupied.has(`${x + cellX},${y + cellY}`)) return false;
  return true;
}
function beginDrag(event) {
  if (!playing) return;
  event.preventDefault(); const id = event.currentTarget.dataset.id, piece = pieces.find(item => item.id === id), previous = { ...state[id] }, preview = document.createElement('div');
  state[id] = { x: null, y: null }; preview.className = 'drop-preview'; applyProductImage(preview, piece); preview.innerHTML = `${puzzleOutline(piece)}<span class="piece-label">${piece.name}</span>`; board.append(preview);
  dragging = { piece, previous, source: event.currentTarget, preview }; dragging.source.style.visibility = 'hidden'; moveDrag(event);
  document.addEventListener('pointermove', moveDrag); document.addEventListener('pointerup', endDrag, { once: true });
}
function getDropPoint(event, piece) {
  const boardRect = board.getBoundingClientRect(), cellWidth = boardRect.width / COLS, cellHeight = boardRect.height / ROWS;
  return { x: Math.round((event.clientX - boardRect.left - piece.w * cellWidth / 2) / cellWidth), y: Math.round((event.clientY - boardRect.top - piece.h * cellHeight / 2) / cellHeight), boardRect, cellWidth, cellHeight };
}
function moveDrag(event) {
  if (!dragging) return; const { x, y, boardRect, cellWidth, cellHeight } = getDropPoint(event, dragging.piece), inside = event.clientX >= boardRect.left && event.clientX <= boardRect.right && event.clientY >= boardRect.top && event.clientY <= boardRect.bottom;
  dragging.preview.hidden = !inside; dragging.preview.classList.toggle('invalid', !canPlace(dragging.piece, x, y));
  dragging.preview.style.width = `${dragging.piece.w * cellWidth}px`; dragging.preview.style.height = `${dragging.piece.h * cellHeight}px`; dragging.preview.style.left = `${Math.max(0, Math.min(COLS - dragging.piece.w, x)) * cellWidth}px`; dragging.preview.style.top = `${Math.max(0, Math.min(ROWS - dragging.piece.h, y)) * cellHeight}px`;
}
function endDrag(event) {
  document.removeEventListener('pointermove', moveDrag); if (!dragging) return;
  const { x, y } = getDropPoint(event, dragging.piece); dragging.source.style.visibility = ''; dragging.preview.remove();
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
