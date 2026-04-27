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
let currentMap = null;   // { id, name, readonly, rows, cols, grid }
let players = {};     // { [socketId]: { id, name, avatar, x, y } }
let selectedMapId = 'office';

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

// ─── Chat DOM ────────────────────────────────────────────────────────────────
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const btnSendChat = document.getElementById('btn-send-chat');
const notificationSound = new Audio('/notification.mp3');
notificationSound.volume = 0.5;

// ─── Voice Chat State ────────────────────────────────────────────────────────
const btnVoiceToggle = document.getElementById('btn-voice-toggle');
let localStream = null;
let isVoiceActive = false;
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
}

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

  // --- NUEVO: Guardar el nombre ---
  localStorage.setItem('savedPlayerName', name);

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

// ─── Socket events ────────────────────────────────────────────────────────────
socket.on('init', ({ players: serverPlayers, myId: serverId }) => {
  if (serverId) myId = serverId;
  players = {};
  serverPlayers.forEach(p => { players[p.id] = p; });
  myTagEl.textContent = `${myName}`;
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

function appendMessage(msg) {
  const isMe = msg.senderId === myId;

  // --- NUEVO: Sonido si el mensaje no es mío ---
  if (!isMe) {
    notificationSound.play().catch(err => console.log("Esperando interacción para sonar..."));
    updateNewMessageIndicator(); // Función para el header
  }

  const msgEl = document.createElement('div');
  msgEl.className = `chat-msg ${isMe ? 'is-me' : ''}`;

  msgEl.innerHTML = `
    <div class="chat-msg-header">
      <span class="chat-msg-sender">${msg.senderAvatar} ${msg.senderName}</span>
      <span class="chat-msg-time">${msg.time}</span>
    </div>
    <div class="chat-msg-text">${msg.text}</div>
  `;

  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
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
  chatMessages.innerHTML = ''; // Clear chat when changing room

  socket.emit('changeMap', { mapId });
}

// Redundant init handler removed

// ─── Voice Chat Logic ────────────────────────────────────────────────────────
btnVoiceToggle.addEventListener('click', toggleVoiceChat);

async function toggleVoiceChat() {
  if (isVoiceActive) {
    stopVoiceChat();
  } else {
    await startVoiceChat();
  }
}

async function startVoiceChat() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    isVoiceActive = true;
    btnVoiceToggle.classList.add('active');
    btnVoiceToggle.innerHTML = '🎤 Voz: ON';

    // Notify others that I've joined voice
    socket.emit('voice:join');
    
    // For anyone already in voice room, I'll initiate connection
    // (Actually, usually the newcomer waits for others or vice-versa. 
    // Let's say: when I join, others will see me and caller will be those who were already there).
    // Or simpler: everyone who sees 'voice:join' from another person will try to initiate if they are also in voice.
  } catch (err) {
    console.error('Error accessing microphone:', err);
    alert('No se pudo acceder al micrófono.');
  }
}

function stopVoiceChat() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  isVoiceActive = false;
  btnVoiceToggle.classList.remove('active');
  btnVoiceToggle.innerHTML = '🎤 Activar Voz';

  socket.emit('voice:leave');

  // Close all peer connections
  Object.keys(peers).forEach(peerId => {
    if (peers[peerId]) {
      peers[peerId].close();
      delete peers[peerId];
    }
    const audioEl = document.getElementById(`audio-${peerId}`);
    if (audioEl) audioEl.remove();
  });
}

// Signaling events
socket.on('voice:joined', (peerId) => {
  if (!isVoiceActive) return;
  // If a new person joins voice, the person already in voice (me) initiates the call
  initiateCall(peerId);
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
    if (!isVoiceActive) return;
    if (signalData.type === 'offer') await handleOffer(fromId, signalData);
    else if (signalData.type === 'answer') await handleAnswer(fromId, signalData);
    else if (signalData.candidate) await handleCandidate(fromId, signalData);
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
    addRemoteAudio(peerId, event.streams[0]);
  };

  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
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
  addScreenCard(id, name);
  initiateScreenCall(id);
});

socket.on('screen:stopped', (id) => {
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
  const pc = createScreenPeerConnection(peerId);
  screenPeers[peerId].pc = pc;

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('signal', { toId: peerId, signalData: offer, streamType: 'screen' });
}

async function handleScreenOffer(fromId, offer) {
  // If we don't have a card for them yet (race condition?), add it
  if (!screenPeers[fromId]) {
    // We might not have the name here... using ID as fallback
    addScreenCard(fromId, "Usuario");
  }

  const pc = createScreenPeerConnection(fromId);
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

function createScreenPeerConnection(peerId) {
  const pc = new RTCPeerConnection(rtcConfig);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { toId: peerId, signalData: event.candidate, streamType: 'screen' });
    }
  };

  pc.ontrack = (event) => {
    console.log('[WebRTC] Received remote screen track for:', peerId);
    if (screenPeers[peerId]) {
      screenPeers[peerId].videoEl.srcObject = event.streams[0];
      // If this is the focused peer, update focus video too
      if (focusedPeerId === peerId) {
        focusedVideo.srcObject = event.streams[0];
      }
    }
  };

  if (localScreenStream) {
    localScreenStream.getTracks().forEach(track => pc.addTrack(track, localScreenStream));
  } else {
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
