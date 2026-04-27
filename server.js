const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);
const PORT   = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Tile legend ──────────────────────────────────────────────────────────────
// E=empty  F=floor  W=wall  G=grass  D=desk  C=chair
// M=meeting table  P=plant  T=bathroom  R=reception  S=sofa  K=coffee
const T = {
  E: 'empty', F: 'floor', W: 'wall',  G: 'grass',
  D: 'desk',  C: 'chair', M: 'meeting', P: 'plant',
  B: 'bathroom', R: 'reception', S: 'sofa', K: 'coffee',
  O: 'door'
};

// ── Pre-made office maps (read-only) ─────────────────────────────────────────
// Each map is a 16×16 grid expressed as rows of 16 tile-type keys.
const PRESET_MAPS = {
  office: {
    name: '🏢 Oficina Principal',
    readonly: true,
    grid: [
//     0    1    2    3    4    5    6    7    8    9   10   11   12   13   14   15
      [T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W],
      [T.W, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.W],
      [T.W, T.F, T.D, T.C, T.F, T.D, T.C, T.F, T.D, T.C, T.F, T.D, T.C, T.F, T.F, T.W],
      [T.W, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.W],
      [T.W, T.F, T.D, T.C, T.F, T.D, T.C, T.F, T.D, T.C, T.F, T.D, T.C, T.F, T.F, T.W],
      [T.W, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.W],
      [T.W, T.W, T.W, T.F, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.F, T.W, T.W, T.W],
      [T.W, T.F, T.F, T.O, T.F, T.F, T.M, T.M, T.M, T.F, T.F, T.F, T.O, T.F, T.F, T.W],
      [T.W, T.F, T.F, T.F, T.F, T.C, T.M, T.M, T.M, T.C, T.F, T.F, T.F, T.F, T.F, T.W],
      [T.W, T.F, T.F, T.F, T.F, T.C, T.M, T.M, T.M, T.C, T.F, T.F, T.F, T.F, T.F, T.W],
      [T.W, T.F, T.F, T.F, T.F, T.F, T.M, T.M, T.M, T.F, T.F, T.F, T.F, T.F, T.F, T.W],
      [T.W, T.F, T.S, T.S, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.K, T.F, T.P, T.F, T.W],
      [T.W, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.P, T.F, T.W],
      [T.W, T.R, T.R, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.W],
      [T.W, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.W],
      [T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.O, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W],
    ]
  },

  chill: {
    name: '🛋️ Sala Chill',
    readonly: true,
    grid: [
      [T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W],
      [T.W, T.G, T.G, T.G, T.G, T.G, T.G, T.G, T.G, T.G, T.G, T.G, T.G, T.G, T.G, T.W],
      [T.W, T.G, T.P, T.G, T.G, T.G, T.G, T.G, T.G, T.G, T.G, T.G, T.G, T.P, T.G, T.W],
      [T.W, T.G, T.G, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.G, T.G, T.W],
      [T.W, T.G, T.G, T.F, T.S, T.S, T.F, T.F, T.F, T.S, T.S, T.F, T.F, T.G, T.G, T.W],
      [T.W, T.G, T.G, T.F, T.S, T.S, T.F, T.K, T.F, T.S, T.S, T.F, T.F, T.G, T.G, T.W],
      [T.W, T.G, T.G, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.G, T.G, T.W],
      [T.W, T.G, T.G, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.G, T.G, T.W],
      [T.W, T.G, T.G, T.F, T.F, T.F, T.M, T.M, T.M, T.F, T.F, T.F, T.F, T.G, T.G, T.W],
      [T.W, T.G, T.G, T.F, T.F, T.C, T.M, T.M, T.M, T.C, T.F, T.F, T.F, T.G, T.G, T.W],
      [T.W, T.G, T.G, T.F, T.F, T.C, T.M, T.M, T.M, T.C, T.F, T.F, T.F, T.G, T.G, T.W],
      [T.W, T.G, T.G, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.G, T.G, T.W],
      [T.W, T.G, T.G, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.G, T.G, T.W],
      [T.W, T.G, T.G, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.F, T.G, T.G, T.W],
      [T.W, T.G, T.P, T.G, T.G, T.G, T.G, T.G, T.G, T.G, T.G, T.G, T.G, T.P, T.G, T.W],
      [T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.O, T.W, T.W, T.W, T.W, T.W, T.W, T.W, T.W],
    ]
  }
};

// ── API: list maps ───────────────────────────────────────────────────────────
app.get('/api/maps', (req, res) => {
  const list = Object.entries(PRESET_MAPS).map(([id, m]) => ({
    id, name: m.name, readonly: m.readonly
  }));
  res.json(list);
});

// ── API: get one map ─────────────────────────────────────────────────────────
app.get('/api/maps/:id', (req, res) => {
  const map = PRESET_MAPS[req.params.id];
  if (!map) return res.status(404).json({ error: 'Map not found' });
  res.json({ id: req.params.id, name: map.name, readonly: map.readonly, rows: 16, cols: 16, grid: map.grid });
});

// ── Socket.io: real-time presence ────────────────────────────────────────────
// players[socketId] = { id, name, avatar, x, y, mapId }
const players = {};

const AVATARS = ['🧑', '👩', '👨', '🧔', '👱', '👩‍💼', '👨‍💼', '🧑‍💻', '👩‍💻', '👨‍💻'];

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // New player joins a map
  socket.on('join', ({ name, mapId }) => {
    const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    const map    = PRESET_MAPS[mapId] || PRESET_MAPS['office'];

    // Find a walkable spawn position
    let spawnX = 1, spawnY = 14;
    outer: for (let y = 14; y >= 1; y--) {
      for (let x = 1; x < 15; x++) {
        if (map.grid[y][x] === T.F || map.grid[y][x] === T.G || map.grid[y][x] === T.E) {
          spawnX = x; spawnY = y; break outer;
        }
      }
    }

    players[socket.id] = { id: socket.id, name, avatar, x: spawnX, y: spawnY, mapId };

    socket.join(mapId);

    // Send current players on the same map to the newcomer
    const others = Object.values(players).filter(p => p.mapId === mapId);
    socket.emit('init', { players: others, myId: socket.id });

    // Tell others a new player arrived
    socket.to(mapId).emit('player:joined', players[socket.id]);

    console.log(`  ${name} joined map "${mapId}" at (${spawnX},${spawnY})`);
  });

  // Player moves
  socket.on('move', ({ x, y }) => {
    const p = players[socket.id];
    if (!p) return;

    const map = PRESET_MAPS[p.mapId];
    if (!map) return;

    // Collision check: only allow walkable tiles
    const tileType = map.grid[y]?.[x];
    const walkable = [T.F, T.G, T.E];
    if (!walkable.includes(tileType)) return;

    p.x = x; p.y = y;
    io.to(p.mapId).emit('player:moved', { id: socket.id, x, y });
  });

  // Player changes map room
  socket.on('changeMap', ({ mapId }) => {
    const p = players[socket.id];
    if (!p || !PRESET_MAPS[mapId]) return;

    socket.leave(p.mapId);
    socket.to(p.mapId).emit('player:left', socket.id);

    p.mapId = mapId;
    p.x = 1; p.y = 14;
    socket.join(mapId);

    const others = Object.values(players).filter(pl => pl.mapId === mapId);
    socket.emit('init', { players: others, myId: socket.id });
    socket.to(mapId).emit('player:joined', p);
  });

  // Chat message
  socket.on('chat:message', (text) => {
    const p = players[socket.id];
    if (!p || !text || text.trim() === '') return;

    const messageData = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      senderId: socket.id,
      senderName: p.name,
      senderAvatar: p.avatar,
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    io.to(p.mapId).emit('chat:message', messageData);
  });

  // Signaling relay for WebRTC (voice or screen)
  socket.on('signal', ({ toId, signalData, streamType }) => {
    // Relay the signal to the specific peer
    io.to(toId).emit('signal', {
      fromId: socket.id,
      signalData,
      streamType: streamType || 'voice'
    });
  });

  // Voice Chat status management
  socket.on('voice:join', () => {
    const p = players[socket.id];
    if (p) {
      p.voiceActive = true;
      socket.to(p.mapId).emit('voice:joined', socket.id);
      io.to(p.mapId).emit('player:voice-changed', { id: socket.id, voiceActive: true });
    }
  });

  socket.on('voice:leave', () => {
    const p = players[socket.id];
    if (p) {
      p.voiceActive = false;
      socket.to(p.mapId).emit('voice:left', socket.id);
      io.to(p.mapId).emit('player:voice-changed', { id: socket.id, voiceActive: false });
    }
  });

  // Screen Sharing status management
  socket.on('screen:start', () => {
    const p = players[socket.id];
    if (p) {
      p.screenActive = true;
      socket.to(p.mapId).emit('screen:started', { id: socket.id, name: p.name });
    }
  });

  socket.on('screen:stop', () => {
    const p = players[socket.id];
    if (p) {
      p.screenActive = false;
      socket.to(p.mapId).emit('screen:stopped', socket.id);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    const p = players[socket.id];
    if (p) {
      socket.to(p.mapId).emit('player:left', socket.id);
      console.log(`[-] Left: ${p.name}`);
      delete players[socket.id];
    }
  });
});

server.listen(PORT, () => {
  console.log(`ZEP Office server → http://localhost:${PORT}`);
});
