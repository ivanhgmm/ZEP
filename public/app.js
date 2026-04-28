// ─── Tile definitions ─────────────────────────────────────────────────────────
const TILE_ICONS = {
  empty: '',
  floor: '',
  wall: '🧱',
  grass: '🌿',
  desk: '🖥️',
  chair: '🪑',
  meeting: '📋',
  plant: '🌱',
  bathroom: '🚽',
  reception: '📞',
  sofa: '🛋️',
  coffee: '☕',
  door: '🚪',
};

// ─── State ────────────────────────────────────────────────────────────────────
let myId = null;
let myName = '';
let myAvatar = '🧑';
let currentMap = null;   // { id, name, readonly, rows, cols, grid }
let players = {};     // { [socketId]: { id, name, avatar, x, y } }
let selectedMapId = 'office';

// ─── Constants ────────────────────────────────────────────────────────────────
const AVATARS = ['🧑', '👩', '👨', '🧔', '👱', '👩‍💼', '👨‍💼', '🧑‍💻', '👩‍💻', '👨‍💻', '👽', '🐶', '🐱', '🤖'];

// ─── Socket ───────────────────────────────────────────────────────────────────
const socket = io();

// ─── DOM ─────────────────────────────────────────────────────────────────────
const loginScreen = document.getElementById('login-screen');
const app = document.getElementById('app');
const inputName = document.getElementById('input-name');
const mapSelector = document.getElementById('map-selector');
const btnEnter = document.getElementById('btn-enter');
const mapNameEl = document.getElementById('map-name');
const countNumEl = document.getElementById('count-num');
const myTagEl = document.getElementById('my-tag');
const grid = document.getElementById('grid');
const playerList = document.getElementById('player-list');
const roomList = document.getElementById('room-list');
const roomSidebar = document.getElementById('room-sidebar');
const btnChangeMap = document.getElementById('btn-change-map');
const btnCloseSidebar = document.getElementById('btn-close-sidebar');

// ─── New Room Configuration DOM ──────────────────────────────────────────────
const inputRoomCode = document.getElementById('input-room-code');
const inputRoomLabel = document.getElementById('input-room-label');
const recentRoomsContainer = document.getElementById('recent-rooms-container');
const recentRoomsList = document.getElementById('recent-rooms-list');
const sidebarRoomCode = document.getElementById('sidebar-room-code');

// ─── Chat DOM ────────────────────────────────────────────────────────────────
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const btnSendChat = document.getElementById('btn-send-chat');
const notificationSound = new Audio('/notification.mp3');
notificationSound.volume = 0.5;

// ─── Voice Chat State ────────────────────────────────────────────────────────
const btnVoiceToggle = document.getElementById('btn-voice-toggle');
let localStream = null;
let isMicActive = false; // Whether our microphone track is sending audio
let peers = {}; // { [peerId]: RTCPeerConnection }
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// ─── Screen Share State ──────────────────────────────────────────────────────
const btnScreenToggle = document.getElementById('btn-screen-toggle');
const screenSidebar = document.getElementById('screen-sidebar');
const screenCardsContainer = document.getElementById('screen-cards-container');
const screenFocusOverlay = document.getElementById('screen-focus-overlay');
const btnCloseFocus = document.getElementById('btn-close-focus');
const focusedVideo = document.getElementById('focused-video');
const screenFocusTitle = document.getElementById('screen-focus-title');

let localScreenStream = null;
let isScreenSharing = false;
let screenPeers = {}; // { [peerId]: { pc, name, cardEl, videoEl } }
let focusedPeerId = null;

// ─── Chat Minimization Logic ────────────────────────────────────────────────
const chatContainer = document.getElementById('chat-container');
const chatHeader = document.getElementById('chat-header');
const btnMinimizeChat = document.getElementById('btn-minimize-chat');

chatHeader.addEventListener('click', toggleChatMinimize);

function toggleChatMinimize() {
  chatContainer.classList.toggle('minimized');
  const isMinimized = chatContainer.classList.contains('minimized');
  btnMinimizeChat.textContent = isMinimized ? '▲' : '━';

  // If expanding, scroll to bottom
  if (!isMinimized) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

// ─── Terms and Conditions Logic ─────────────────────────────────────────────
const termsOverlay = document.getElementById('terms-overlay');
const btnAcceptTerms = document.getElementById('btn-accept-terms');
const btnDeclineTerms = document.getElementById('btn-decline-terms');
const termsErrorMsg = document.getElementById('terms-error-msg');

function checkTerms() {
  const accepted = localStorage.getItem('evogrid_terms_accepted');
  if (accepted !== 'true') {
    termsOverlay.classList.remove('hidden');
  }
}

btnAcceptTerms.addEventListener('click', () => {
  localStorage.setItem('evogrid_terms_accepted', 'true');
  termsOverlay.classList.add('hidden');
});

btnDeclineTerms.addEventListener('click', () => {
  termsErrorMsg.classList.remove('hidden');
});

// Run check on load
checkTerms();

// ─── Fetch map list and build login selector ───────────────────────────────────
async function initLogin() {
  const res = await fetch('/api/maps');
  const maps = await res.json();

  maps.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'map-option' + (m.id === selectedMapId ? ' active' : '');
    btn.textContent = m.name;
    btn.dataset.id = m.id;
    btn.addEventListener('click', () => {
      selectedMapId = m.id;
      mapSelector.querySelectorAll('.map-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    mapSelector.appendChild(btn);

    // Also add to room sidebar list
    const li = document.createElement('li');
    li.textContent = m.name;
    li.dataset.id = m.id;
    li.addEventListener('click', () => changeMap(m.id));
    roomList.appendChild(li);
  });

  loadRecentRooms();
}

function loadRecentRooms() {
  const roomsStr = localStorage.getItem('evogrid_recent_rooms');
  if (!roomsStr) return;
  try {
    const rooms = JSON.parse(roomsStr);
    if (!rooms || rooms.length === 0) return;
    recentRoomsContainer.classList.remove('hidden');
    recentRoomsList.innerHTML = '';
    rooms.forEach(room => {
      const btn = document.createElement('button');
      btn.className = 'recent-room-tag';
      btn.textContent = room.label || `${room.mapName} - ${room.code}`;

      btn.addEventListener('click', () => {
        selectedMapId = room.mapId;
        mapSelector.querySelectorAll('.map-option').forEach(b => b.classList.remove('active'));
        const activeBtn = mapSelector.querySelector(`.map-option[data-id="${room.mapId}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        inputRoomCode.value = room.code;
        inputRoomLabel.value = room.label || '';
        inputName.focus();
      });
      recentRoomsList.appendChild(btn);
    });
  } catch (e) {
    console.error('Error loading recent rooms', e);
  }
}

function saveRecentRoom(mapId, mapName, code, label) {
  if (!code) return;
  let rooms = [];
  try {
    const str = localStorage.getItem('evogrid_recent_rooms');
    if (str) rooms = JSON.parse(str);
  } catch (e) { }

  rooms = rooms.filter(r => !(r.mapId === mapId && r.code === code));
  rooms.unshift({ mapId, mapName, code, label });
  if (rooms.length > 5) rooms = rooms.slice(0, 5);
  localStorage.setItem('evogrid_recent_rooms', JSON.stringify(rooms));
  loadRecentRooms();
}

function initAvatarSelector() {
  const container = document.getElementById('avatar-selector');
  const savedAvatar = localStorage.getItem('savedPlayerAvatar') || AVATARS[0];
  myAvatar = savedAvatar;
  
  const previewEl = document.getElementById('current-avatar-preview');
  if (previewEl) previewEl.textContent = myAvatar;

  AVATARS.forEach(emoji => {
    const el = document.createElement('div');
    el.className = 'avatar-option' + (emoji === myAvatar ? ' active' : '');
    el.textContent = emoji;
    el.addEventListener('click', () => {
      myAvatar = emoji;
      container.querySelectorAll('.avatar-option').forEach(a => a.classList.remove('active'));
      el.classList.add('active');
      const previewEl = document.getElementById('current-avatar-preview');
      if (previewEl) previewEl.textContent = emoji;
      const accordion = document.getElementById('avatar-accordion');
      if (accordion) accordion.removeAttribute('open');
    });
    container.appendChild(el);
  });
}

// Initialize on load
initAvatarSelector();

// ─── Enter the office ─────────────────────────────────────────────────────────
btnEnter.addEventListener('click', enterOffice);
inputName.addEventListener('keydown', e => { if (e.key === 'Enter') enterOffice(); });

// --- NUEVO: Cargar el nombre guardado ---
const savedName = localStorage.getItem('savedPlayerName');
if (savedName) {
  inputName.value = savedName;
  btnEnter.focus(); // El usuario solo tiene que dar Enter y listo
} else {
  inputName.focus(); // Si no hay nombre, que empiece a escribir
}

function enterOffice() {
  const name = inputName.value.trim();
  if (!name) { inputName.focus(); return; }

  const code = inputRoomCode.value.trim();
  const label = inputRoomLabel.value.trim();

  // --- NUEVO: Guardar el nombre y avatar ---
  localStorage.setItem('savedPlayerName', name);
  localStorage.setItem('savedPlayerAvatar', myAvatar);

  // find map name
  const mapBtn = mapSelector.querySelector(`.map-option[data-id="${selectedMapId}"]`);
  const mapName = mapBtn ? mapBtn.textContent : selectedMapId;

  if (code) {
    saveRecentRoom(selectedMapId, mapName, code, label);
  }

  const roomId = code ? `${selectedMapId}-${code}` : selectedMapId;
  const baseMapId = selectedMapId;

  myName = name;
  loginScreen.classList.add('hidden');
  app.classList.remove('hidden');
  myTagEl.textContent = ''; // will set after join confirmed
  socket.emit('join', { name, roomId, baseMapId, avatar: myAvatar });
}

// ─── Load and render map ──────────────────────────────────────────────────────
async function loadMap(mapId) {
  const res = await fetch(`/api/maps/${mapId}`);
  currentMap = await res.json();
  console.log(currentMap);

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
      cell.className = `cell tile-${type}`;
      cell.dataset.x = col;
      cell.dataset.y = row;
      cell.textContent = TILE_ICONS[type] || '';
      grid.appendChild(cell);
    }
  }

  // Render Zones Overlays
  if (currentMap.zones) {
    const CELL = 40; // match --cell
    currentMap.zones.forEach(zone => {
      const el = document.createElement('div');
      el.className = 'zone-overlay';
      el.style.left = (zone.rect.minX * CELL) + 'px';
      el.style.top = (zone.rect.minY * CELL) + 'px';
      el.style.width = ((zone.rect.maxX - zone.rect.minX + 1) * CELL) + 'px';
      el.style.height = ((zone.rect.maxY - zone.rect.minY + 1) * CELL) + 'px';
      grid.appendChild(el);
    });
  }
}

// ─── Player Avatar management ─────────────────────────────────────────────────
function getAvatarEl(id) {
  return document.getElementById(`avatar-${id}`);
}

function createAvatar(player) {
  const el = document.createElement('div');
  el.className = 'player-avatar' + (player.id === myId ? ' is-me' : '');
  el.id = `avatar-${player.id}`;

  const emoji = document.createElement('span');
  emoji.textContent = player.avatar;

  const label = document.createElement('span');
  label.className = 'avatar-label';
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
  el.style.top = (y * CELL) + 'px';
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

  updateIsolation(); // Apply isolation logic on full render
}

// ─── Player sidebar list ──────────────────────────────────────────────────────
function renderPlayerList() {
  playerList.innerHTML = '';
  const here = Object.values(players).filter(p => p.mapId === (currentMap?.id));
  countNumEl.textContent = here.length;

  here.forEach(p => {
    const li = document.createElement('li');
    if (p.id === myId) li.classList.add('is-me');

    const voiceIcon = p.voiceActive ? '<span class="speaking-indicator"></span>' : '';
    li.innerHTML = `<span>${p.avatar}</span><span class="p-name">${p.name}${p.id === myId ? ' (tú)' : ''}</span> ${voiceIcon}`;
    playerList.appendChild(li);
  });
}

socket.on('init', ({ players: serverPlayers, myId: serverId }) => {
  if (serverId) myId = serverId;
  players = {};
  serverPlayers.forEach(p => {
    players[p.id] = p;
    // Screen sharing and isolation filtering will be handled by updateIsolation()
    // after the map is fully loaded in loadMap().

    // Also initiate voice connection with everyone (Passive listening)
    if (p.id !== myId) {
      setupVoiceConnection(p.id);
    }
  });

  const me = players[myId];
  const baseMapId = me ? me.baseMapId : selectedMapId;
  const currentRoomId = me ? me.roomId : selectedMapId;

  const codeSuffix = currentRoomId !== baseMapId ? ` (${currentRoomId.replace(baseMapId + '-', '')})` : '';
  myTagEl.textContent = `${myName}${codeSuffix}`;

  loadMap(baseMapId);
});

socket.on('player:joined', (player) => {
  players[player.id] = player;

  const me = players[myId];
  const sameRoom = me && me.roomId === player.roomId;

  // Only render if player is on the same map and room
  if (sameRoom) {
    createAvatar(player);
    renderPlayerList();
    // Passive voice listening: newcomer is handled by existing users via ID comparison
    setupVoiceConnection(player.id);
  }
});

function setupVoiceConnection(peerId) {
  if (peers[peerId]) return;
  // Standard mesh logic: one side initiates
  if (myId < peerId) {
    console.log('[Voice] Initiating passive connection to:', peerId);
    initiateCall(peerId);
  }
}

// ─── Spatial Audio Zones ──────────────────────────────────────────────────────
function getZoneId(x, y) {
  if (!currentMap || !currentMap.zones) return 'global';
  for (const zone of currentMap.zones) {
    if (x >= zone.rect.minX && x <= zone.rect.maxX &&
      y >= zone.rect.minY && y <= zone.rect.maxY) {
      return zone.id;
    }
  }
  return 'global';
}

function updateIsolation() {
  const pMe = players[myId];
  if (!pMe || !currentMap) return;

  const myZone = getZoneId(pMe.x, pMe.y);

  // Update UI indicator
  const zoneIndicator = document.getElementById('zone-indicator');
  if (zoneIndicator) {
    if (myZone !== 'global') {
      const zoneDef = currentMap.zones.find(z => z.id === myZone);
      zoneIndicator.textContent = `🎧 Zona Privada: ${zoneDef ? zoneDef.name : ''}`;
      zoneIndicator.classList.remove('hidden');
      zoneIndicator.classList.add('active');
    } else {
      zoneIndicator.classList.add('hidden');
      zoneIndicator.classList.remove('active');
    }
  }

  // Mute/unmute remote audios and screen shares
  Object.keys(peers).forEach(peerId => {
    const pPeer = players[peerId];
    if (!pPeer) return;
    const peerZone = getZoneId(pPeer.x, pPeer.y);
    const audioEl = document.getElementById(`audio-${peerId}`);

    let canHearAndSee = false;
    if (myZone === 'global' && peerZone === 'global') {
      canHearAndSee = true; // both outside
    } else if (myZone === peerZone && myZone !== 'global') {
      canHearAndSee = true; // both in same private zone
    }

    // Voice Isolation
    if (audioEl) {
      audioEl.muted = !canHearAndSee;
    }

    const avatarEl = getAvatarEl(peerId);
    if (avatarEl) {
      if (!canHearAndSee) {
        avatarEl.classList.add('muted-zone');
      } else {
        avatarEl.classList.remove('muted-zone');
      }
    }

    // Screen Sharing Isolation
    if (pPeer.screenActive) {
      if (canHearAndSee) {
        if (!screenPeers[peerId]) {
          addScreenCard(peerId, pPeer.name);
          initiateScreenCall(peerId);
        }
      } else {
        if (screenPeers[peerId]) {
          removeScreenCard(peerId);
        }
      }
    }
  });
}

socket.on('player:moved', ({ id, x, y }) => {
  if (!players[id]) return;
  players[id].x = x;
  players[id].y = y;
  const el = getAvatarEl(id);
  if (el) positionAvatar(el, x, y);

  // Update audio and screen when anyone moves
  updateIsolation();
});

socket.on('player:left', (id) => {
  removeAvatar(id);
  delete players[id];
  renderPlayerList();

  // Cleanup voice if peer left
  if (peers[id]) {
    peers[id].close();
    delete peers[id];
  }
  const audioEl = document.getElementById(`audio-${id}`);
  if (audioEl) audioEl.remove();

  // Cleanup screen if peer left
  removeScreenCard(id);
});

socket.on('player:voice-changed', ({ id, voiceActive }) => {
  if (players[id]) {
    players[id].voiceActive = voiceActive;
    renderPlayerList();

    // Toggle speaking animation on avatar
    const el = getAvatarEl(id);
    if (el) {
      if (voiceActive) el.classList.add('speaking');
      else el.classList.remove('speaking');
    }
  }
});

// ─── Chat Logic ──────────────────────────────────────────────────────────────
function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  socket.emit('chat:message', text);
  chatInput.value = '';
}

btnSendChat.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.stopPropagation(); // Evitar que el movimiento del teclado capture el Enter
    sendMessage();
  }
});

socket.on('chat:message', (msg) => {
  appendMessage(msg);
});

socket.on('chat:reaction', ({ messageId, emoji, senderId }) => {
  updateMessageReactions(messageId, emoji, senderId);
});

function appendMessage(msg) {
  const isMe = msg.senderId === myId;

  // --- NUEVO: Sonido si el mensaje no es mío ---
  if (!isMe) {
    notificationSound.play().catch(err => console.log("Esperando interacción para sonar..."));
    updateNewMessageIndicator(); // Función para el header
  }

  const msgEl = document.createElement('div');
  msgEl.className = `chat-msg ${isMe ? 'is-me' : ''}`;
  msgEl.id = `chat-msg-${msg.id}`;

  msgEl.innerHTML = `
    <div class="chat-msg-header">
      <span class="chat-msg-sender">${msg.senderAvatar} ${msg.senderName}</span>
      <span class="chat-msg-time">${msg.time}</span>
    </div>
    <div class="chat-msg-body">
      <div class="chat-msg-text">${msg.text}</div>
      <div class="msg-actions">
        <button class="btn-react" title="Reaccionar">+</button>
        <div class="reaction-picker hidden">
          <span onclick="sendReaction('${msg.id}', '❤️')">❤️</span>
          <span onclick="sendReaction('${msg.id}', '👍')">👍</span>
          <span onclick="sendReaction('${msg.id}', '😂')">😂</span>
          <span onclick="sendReaction('${msg.id}', '🎉')">🎉</span>
          <span onclick="sendReaction('${msg.id}', '😮')">😮</span>
          <span onclick="sendReaction('${msg.id}', '😢')">😢</span>
        </div>
      </div>
    </div>
    <div class="reactions-container" id="reactions-${msg.id}"></div>
  `;

  // Interaction for picker
  const btnReact = msgEl.querySelector('.btn-react');
  const picker = msgEl.querySelector('.reaction-picker');
  btnReact.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close other pickers if any
    document.querySelectorAll('.reaction-picker').forEach(p => {
      if (p !== picker) p.classList.add('hidden');
    });
    picker.classList.toggle('hidden');
  });

  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Global click to close pickers
document.addEventListener('click', () => {
  document.querySelectorAll('.reaction-picker').forEach(p => p.classList.add('hidden'));
});

function sendReaction(messageId, emoji) {
  socket.emit('chat:reaction', { messageId, emoji });
}

function updateMessageReactions(messageId, emoji, senderId) {
  const container = document.getElementById(`reactions-${messageId}`);
  if (!container) return;

  // Key for reaction bubble
  const bubbleId = `reaction-${messageId}-${emoji}`;
  let bubble = document.getElementById(bubbleId);

  if (!bubble) {
    bubble = document.createElement('span');
    bubble.className = 'reaction-bubble';
    bubble.id = bubbleId;
    bubble.dataset.count = 0;
    bubble.innerHTML = `${emoji} <span class="count">0</span>`;
    container.appendChild(bubble);
  }

  let count = parseInt(bubble.dataset.count);
  count++;
  bubble.dataset.count = count;
  bubble.querySelector('.count').textContent = count;

  // Animation effect
  bubble.classList.remove('pop');
  void bubble.offsetWidth;
  bubble.classList.add('pop');
}

function updateAvatarVoiceIndicator(id, active) {
  const el = getAvatarEl(id);
  if (el) {
    if (active) el.classList.add('speaking');
    else el.classList.remove('speaking');
  }
}

// ─── Keyboard movement ────────────────────────────────────────────────────────
const DIRS = {
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  w: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  a: { dx: -1, dy: 0 },
  d: { dx: 1, dy: 0 },
};

document.addEventListener('keydown', (e) => {
  if (!myId || !currentMap) return;
  // If user is typing in chat input, don't move the character
  if (document.activeElement === chatInput) return;

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

  updateIsolation();
});

// ─── Change map / room ────────────────────────────────────────────────────────
btnChangeMap.addEventListener('click', () => {
  roomSidebar.classList.toggle('hidden');
});
btnCloseSidebar.addEventListener('click', () => {
  roomSidebar.classList.add('hidden');
});

function changeMap(mapId) {
  const code = sidebarRoomCode.value.trim();
  const targetRoomId = code ? `${mapId}-${code}` : mapId;

  const me = players[myId];
  if (targetRoomId === me?.roomId) { roomSidebar.classList.add('hidden'); return; }

  selectedMapId = mapId;
  roomSidebar.classList.add('hidden');

  // Remove current avatars
  document.querySelectorAll('.player-avatar').forEach(el => el.remove());
  players = {};
  chatMessages.innerHTML = ''; // Clear chat when changing room

  // Cleanup voice and screen connections
  Object.keys(peers).forEach(id => {
    if (peers[id]) peers[id].close();
    const el = document.getElementById(`audio-${id}`);
    if (el) el.remove();
  });
  peers = {};

  Object.keys(screenPeers).forEach(id => {
    removeScreenCard(id);
  });

  socket.emit('changeMap', { roomId: targetRoomId, baseMapId: mapId });
}

// Redundant init handler removed

// ─── Voice Chat Logic ────────────────────────────────────────────────────────
btnVoiceToggle.addEventListener('click', toggleMicrophone);

async function toggleMicrophone() {
  if (isMicActive) {
    muteMicrophone();
  } else {
    await unmuteMicrophone();
  }
}

async function unmuteMicrophone() {
  try {
    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Add track to all existing connections
      Object.keys(peers).forEach(peerId => {
        const pc = peers[peerId];
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        // Force renegotiation to let others know we are sending audio
        renegotiate(peerId);
      });
    } else {
      localStream.getAudioTracks().forEach(track => track.enabled = true);
    }

    isMicActive = true;
    btnVoiceToggle.classList.add('active');
    btnVoiceToggle.innerHTML = '🎤 Micro: ON';

    socket.emit('voice:join'); // For UI indicator (speaking icon)
  } catch (err) {
    console.error('Error accessing microphone:', err);
    alert('No se pudo acceder al micrófono.');
  }
}

function muteMicrophone() {
  if (localStream) {
    localStream.getAudioTracks().forEach(track => track.enabled = false);
  }
  isMicActive = false;
  btnVoiceToggle.classList.remove('active');
  btnVoiceToggle.innerHTML = '🎤 Micrófono';

  socket.emit('voice:leave'); // For UI indicator
}

async function renegotiate(peerId) {
  const pc = peers[peerId];
  if (!pc) return;
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('signal', { toId: peerId, signalData: offer });
  } catch (err) {
    console.error('Renegotiation failed:', err);
  }
}

// Signaling events for voice are now passive (connections established on join)
socket.on('voice:joined', (peerId) => {
  // Just used for the speaking indicator UI
});

socket.on('voice:left', (peerId) => {
  if (peers[peerId]) {
    peers[peerId].close();
    delete peers[peerId];
  }
  const audioEl = document.getElementById(`audio-${peerId}`);
  if (audioEl) audioEl.remove();
});

socket.on('signal', async ({ fromId, signalData, streamType }) => {
  if (streamType === 'screen') {
    if (signalData.type === 'offer') await handleScreenOffer(fromId, signalData);
    else if (signalData.type === 'answer') await handleScreenAnswer(fromId, signalData);
    else if (signalData.candidate) await handleScreenCandidate(fromId, signalData);
  } else {
    if (signalData.type === 'offer') {
      console.log('[Voice] Received offer from:', fromId);
      await handleOffer(fromId, signalData);
    }
    else if (signalData.type === 'answer') {
      console.log('[Voice] Received answer from:', fromId);
      await handleAnswer(fromId, signalData);
    }
    else if (signalData.candidate) {
      await handleCandidate(fromId, signalData);
    }
  }
});

async function initiateCall(peerId) {
  const pc = createPeerConnection(peerId);
  peers[peerId] = pc;

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('signal', { toId: peerId, signalData: offer });
}

async function handleOffer(fromId, offer) {
  const pc = createPeerConnection(fromId);
  peers[fromId] = pc;

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('signal', { toId: fromId, signalData: answer });
}

async function handleAnswer(fromId, answer) {
  const pc = peers[fromId];
  if (pc) {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
}

async function handleCandidate(fromId, candidate) {
  const pc = peers[fromId];
  if (pc) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('Error adding ice candidate:', e);
    }
  }
}

function createPeerConnection(peerId) {
  const pc = new RTCPeerConnection(rtcConfig);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { toId: peerId, signalData: event.candidate });
    }
  };

  pc.ontrack = (event) => {
    console.log('[Voice] Received remote track from:', peerId);
    addRemoteAudio(peerId, event.streams[0]);
  };

  pc.onconnectionstatechange = () => {
    console.log(`[Voice] Connection state with ${peerId}: ${pc.connectionState}`);
  };

  if (localStream) {
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });
  }

  return pc;
}

function addRemoteAudio(peerId, stream) {
  let audioEl = document.getElementById(`audio-${peerId}`);
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.id = `audio-${peerId}`;
    audioEl.autoplay = true;
    document.body.appendChild(audioEl);
  }
  audioEl.srcObject = stream;
  audioEl.play().catch(e => console.log("[Voice] Autoplay blocked, waiting for interaction", e));
}

// ─── Screen Sharing Logic ────────────────────────────────────────────────────
btnScreenToggle.addEventListener('click', toggleScreenShare);
btnCloseFocus.addEventListener('click', closeScreenFocus);

async function toggleScreenShare() {
  if (isScreenSharing) {
    stopScreenShare();
  } else {
    await startScreenShare();
  }
}

async function startScreenShare() {
  try {
    localScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    isScreenSharing = true;
    btnScreenToggle.classList.add('active');
    btnScreenToggle.innerHTML = '💻 Compartiendo...';

    // Broadcast that I started sharing
    socket.emit('screen:start');

    localScreenStream.getVideoTracks()[0].onended = () => {
      stopScreenShare();
    };
  } catch (err) {
    console.error('Error starting screen share:', err);
  }
}

function stopScreenShare() {
  if (localScreenStream) {
    localScreenStream.getTracks().forEach(track => track.stop());
    localScreenStream = null;
  }
  isScreenSharing = false;
  btnScreenToggle.classList.remove('active');
  btnScreenToggle.innerHTML = '💻 Compartir Pantalla';
  socket.emit('screen:stop');
}

socket.on('screen:started', ({ id, name }) => {
  if (id === myId) return;
  if (players[id]) players[id].screenActive = true;
  updateIsolation();
});

socket.on('screen:stopped', (id) => {
  if (players[id]) players[id].screenActive = false;
  removeScreenCard(id);
});

function addScreenCard(id, name) {
  if (screenPeers[id]) return;

  const card = document.createElement('div');
  card.className = 'screen-card';
  card.id = `card-${id}`;
  card.innerHTML = `
    <div class="screen-card-header">
      <span class="sharer-name">${name}</span>
      <div class="card-actions">
        <button class="btn-card expand-btn">Ampliar</button>
      </div>
    </div>
    <video class="screen-card-video" autoplay playsinline muted></video>
  `;

  screenCardsContainer.appendChild(card);
  screenSidebar.classList.remove('hidden');

  const video = card.querySelector('video');
  const expandBtn = card.querySelector('.expand-btn');

  expandBtn.addEventListener('click', () => expandScreen(id));

  screenPeers[id] = { name, cardEl: card, videoEl: video, pc: null };
}

function removeScreenCard(id) {
  const peer = screenPeers[id];
  if (peer) {
    if (peer.pc) peer.pc.close();
    peer.cardEl.remove();
    delete screenPeers[id];
  }

  if (Object.keys(screenPeers).length === 0) {
    screenSidebar.classList.add('hidden');
  }

  if (focusedPeerId === id) {
    closeScreenFocus();
  }
}

function expandScreen(id) {
  const peer = screenPeers[id];
  if (!peer) return;

  focusedPeerId = id;
  screenFocusTitle.textContent = `Pantalla de ${peer.name}`;
  focusedVideo.srcObject = peer.videoEl.srcObject;
  screenFocusOverlay.classList.remove('hidden');
}

function closeScreenFocus() {
  screenFocusOverlay.classList.add('hidden');
  focusedVideo.srcObject = null;
  focusedPeerId = null;
}

async function initiateScreenCall(peerId) {
  // As a viewer, we initiate a call to receive the stream
  const pc = createScreenPeerConnection(peerId, false);
  screenPeers[peerId].pc = pc;

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('signal', { toId: peerId, signalData: offer, streamType: 'screen' });
}

async function handleScreenOffer(fromId, offer) {
  if (!screenPeers[fromId]) {
    addScreenCard(fromId, players[fromId]?.name || "Usuario");
  }

  // As a sharer receiving an offer from a viewer, we send our stream
  const pc = createScreenPeerConnection(fromId, true);
  screenPeers[fromId].pc = pc;

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('signal', { toId: fromId, signalData: answer, streamType: 'screen' });
}

async function handleScreenAnswer(fromId, answer) {
  const peer = screenPeers[fromId];
  if (peer && peer.pc) {
    await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
}

async function handleScreenCandidate(fromId, candidate) {
  const peer = screenPeers[fromId];
  if (peer && peer.pc) {
    try {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('Error adding screen ice candidate:', e);
    }
  }
}

function createScreenPeerConnection(peerId, isSharer) {
  const pc = new RTCPeerConnection(rtcConfig);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { toId: peerId, signalData: event.candidate, streamType: 'screen' });
    }
  };

  pc.ontrack = (event) => {
    console.log('[Screen] Received remote track from:', peerId);
    if (screenPeers[peerId]) {
      screenPeers[peerId].videoEl.srcObject = event.streams[0];
      screenPeers[peerId].videoEl.play().catch(e => console.log("[Screen] Autoplay blocked", e));
      if (focusedPeerId === peerId) {
        focusedVideo.srcObject = event.streams[0];
        focusedVideo.play().catch(e => { });
      }
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`[Screen] Connection state with ${peerId}: ${pc.connectionState}`);
  };

  if (isSharer && localScreenStream) {
    console.log('[Screen] Adding local screen tracks to PC for:', peerId);
    localScreenStream.getTracks().forEach(track => pc.addTrack(track, localScreenStream));
  } else {
    // If we are the viewer, or if we don't have a stream, we just want to receive
    console.log('[Screen] Adding recvonly transceiver for:', peerId);
    pc.addTransceiver('video', { direction: 'recvonly' });
  }

  return pc;
}
const msgBadge = document.getElementById('new-message-badge');

chatInput.addEventListener('focus', () => {
  msgBadge.classList.add('hidden');
});

function updateNewMessageIndicator() {
  msgBadge.classList.remove('hidden');
  document.title = "Nuevo mensaje - EvoSeed";

  // Volver al título normal tras 3 segundos
  setTimeout(() => {
    document.title = "Oficina Virtual - EvoSeed";
  }, 3000);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
initLogin();
