// ─── Tile definitions ─────────────────────────────────────────────────────────
const TILE_ICONS = {
  empty:     '',
  floor:     '',
  wall:      '🧱',
  grass:     '🌿',
  desk:      '🖥️',
  chair:     '🪑',
  meeting:   '📋',
  plant:     '🌱',
  bathroom:  '🚽',
  reception: '📞',
  sofa:      '🛋️',
  coffee:    '☕',
  door:      '🚪',
};

// ─── State ────────────────────────────────────────────────────────────────────
let myId       = null;
let myName     = '';
let currentMap = null;   // { id, name, readonly, rows, cols, grid }
let players    = {};     // { [socketId]: { id, name, avatar, x, y } }
let selectedMapId = 'office';

// ─── Socket ───────────────────────────────────────────────────────────────────
const socket = io();

// ─── DOM ─────────────────────────────────────────────────────────────────────
const loginScreen    = document.getElementById('login-screen');
const app            = document.getElementById('app');
const inputName      = document.getElementById('input-name');
const mapSelector    = document.getElementById('map-selector');
const btnEnter       = document.getElementById('btn-enter');
const mapNameEl      = document.getElementById('map-name');
const countNumEl     = document.getElementById('count-num');
const myTagEl        = document.getElementById('my-tag');
const grid           = document.getElementById('grid');
const playerList     = document.getElementById('player-list');
const roomList       = document.getElementById('room-list');
const roomSidebar    = document.getElementById('room-sidebar');
const btnChangeMap   = document.getElementById('btn-change-map');
const btnCloseSidebar= document.getElementById('btn-close-sidebar');

// ─── Fetch map list and build login selector ───────────────────────────────────
async function initLogin() {
  const res  = await fetch('/api/maps');
  const maps = await res.json();

  maps.forEach(m => {
    const btn = document.createElement('button');
    btn.className   = 'map-option' + (m.id === selectedMapId ? ' active' : '');
    btn.textContent = m.name;
    btn.dataset.id  = m.id;
    btn.addEventListener('click', () => {
      selectedMapId = m.id;
      mapSelector.querySelectorAll('.map-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    mapSelector.appendChild(btn);

    // Also add to room sidebar list
    const li = document.createElement('li');
    li.textContent  = m.name;
    li.dataset.id   = m.id;
    li.addEventListener('click', () => changeMap(m.id));
    roomList.appendChild(li);
  });
}

// ─── Enter the office ─────────────────────────────────────────────────────────
btnEnter.addEventListener('click', enterOffice);
inputName.addEventListener('keydown', e => { if (e.key === 'Enter') enterOffice(); });

function enterOffice() {
  const name = inputName.value.trim();
  if (!name) { inputName.focus(); return; }
  myName = name;
  loginScreen.classList.add('hidden');
  app.classList.remove('hidden');
  myTagEl.textContent = ''; // will set after join confirmed
  socket.emit('join', { name, mapId: selectedMapId });
}

// ─── Load and render map ──────────────────────────────────────────────────────
async function loadMap(mapId) {
  const res = await fetch(`/api/maps/${mapId}`);
  currentMap = await res.json();

  mapNameEl.textContent = currentMap.name;
  renderGrid();
  renderAllPlayers();
}

function renderGrid() {
  grid.innerHTML = '';
  for (let row = 0; row < currentMap.rows; row++) {
    for (let col = 0; col < currentMap.cols; col++) {
      const type = currentMap.grid[row][col];
      const cell = document.createElement('div');
      cell.className    = `cell tile-${type}`;
      cell.dataset.x    = col;
      cell.dataset.y    = row;
      cell.textContent  = TILE_ICONS[type] || '';
      grid.appendChild(cell);
    }
  }
}

// ─── Player Avatar management ─────────────────────────────────────────────────
function getAvatarEl(id) {
  return document.getElementById(`avatar-${id}`);
}

function createAvatar(player) {
  const el = document.createElement('div');
  el.className = 'player-avatar' + (player.id === myId ? ' is-me' : '');
  el.id        = `avatar-${player.id}`;

  const emoji = document.createElement('span');
  emoji.textContent = player.avatar;

  const label = document.createElement('span');
  label.className   = 'avatar-label';
  label.textContent = player.name;

  el.appendChild(emoji);
  el.appendChild(label);

  positionAvatar(el, player.x, player.y);
  document.getElementById('grid-wrapper').appendChild(el);
  return el;
}

function positionAvatar(el, x, y) {
  const CELL = 40; // px — matches --cell
  el.style.left = (x * CELL) + 'px';
  el.style.top  = (y * CELL) + 'px';
}

function removeAvatar(id) {
  const el = getAvatarEl(id);
  if (el) el.remove();
}

function renderAllPlayers() {
  // Remove old avatars
  document.querySelectorAll('.player-avatar').forEach(el => el.remove());
  // Render all
  Object.values(players).forEach(p => createAvatar(p));
  renderPlayerList();
}

// ─── Player sidebar list ──────────────────────────────────────────────────────
function renderPlayerList() {
  playerList.innerHTML = '';
  const here = Object.values(players).filter(p => p.mapId === (currentMap?.id));
  countNumEl.textContent = here.length;

  here.forEach(p => {
    const li = document.createElement('li');
    if (p.id === myId) li.classList.add('is-me');
    li.innerHTML = `<span>${p.avatar}</span><span class="p-name">${p.name}${p.id === myId ? ' (tú)' : ''}</span>`;
    playerList.appendChild(li);
  });
}

// ─── Socket events ────────────────────────────────────────────────────────────
socket.on('init', ({ players: serverPlayers, myId: serverId }) => {
  myId = serverId;
  players = {};
  serverPlayers.forEach(p => { players[p.id] = p; });
  myTagEl.textContent = `${players[myId]?.avatar || ''} ${myName}`;
  loadMap(selectedMapId);
});

socket.on('player:joined', (player) => {
  players[player.id] = player;
  // Only render if player is on the same map
  if (player.mapId === currentMap?.id) {
    createAvatar(player);
    renderPlayerList();
  }
});

socket.on('player:moved', ({ id, x, y }) => {
  if (!players[id]) return;
  players[id].x = x;
  players[id].y = y;
  const el = getAvatarEl(id);
  if (el) positionAvatar(el, x, y);
});

socket.on('player:left', (id) => {
  removeAvatar(id);
  delete players[id];
  renderPlayerList();
});

// ─── Keyboard movement ────────────────────────────────────────────────────────
const DIRS = {
  ArrowUp:    { dx:  0, dy: -1 },
  ArrowDown:  { dx:  0, dy:  1 },
  ArrowLeft:  { dx: -1, dy:  0 },
  ArrowRight: { dx:  1, dy:  0 },
  w: { dx:  0, dy: -1 },
  s: { dx:  0, dy:  1 },
  a: { dx: -1, dy:  0 },
  d: { dx:  1, dy:  0 },
};

document.addEventListener('keydown', (e) => {
  if (!myId || !currentMap) return;
  const dir = DIRS[e.key];
  if (!dir) return;
  e.preventDefault();

  const me = players[myId];
  if (!me) return;

  const nx = me.x + dir.dx;
  const ny = me.y + dir.dy;

  // Bounds check
  if (nx < 0 || ny < 0 || nx >= currentMap.cols || ny >= currentMap.rows) return;

  socket.emit('move', { x: nx, y: ny });
  // Optimistic local update
  me.x = nx; me.y = ny;
  const el = getAvatarEl(myId);
  if (el) positionAvatar(el, nx, ny);
});

// ─── Change map / room ────────────────────────────────────────────────────────
btnChangeMap.addEventListener('click', () => {
  roomSidebar.classList.toggle('hidden');
});
btnCloseSidebar.addEventListener('click', () => {
  roomSidebar.classList.add('hidden');
});

function changeMap(mapId) {
  if (mapId === currentMap?.id) { roomSidebar.classList.add('hidden'); return; }
  selectedMapId = mapId;
  roomSidebar.classList.add('hidden');

  // Remove current avatars
  document.querySelectorAll('.player-avatar').forEach(el => el.remove());
  players = {};

  socket.emit('changeMap', { mapId });
}

// Socket: new map init after room change
socket.on('init', ({ players: serverPlayers, myId: serverId }) => {
  if (serverId) myId = serverId;
  players = {};
  serverPlayers.forEach(p => { players[p.id] = p; });
  loadMap(selectedMapId);
  myTagEl.textContent = `${players[myId]?.avatar || ''} ${myName}`;
});

// ─── Init ─────────────────────────────────────────────────────────────────────
initLogin();
