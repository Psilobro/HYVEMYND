const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from www directory
app.use(express.static(path.join(__dirname, 'www')));

// Health check for Render
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    rooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'www/index.html'));
});

// Room management
const rooms = new Map();

function createRoom(roomId) {
  return {
    id: roomId,
    players: new Map(),
    gameState: null,
    history: [],
    created: Date.now()
  };
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('join-room', (data) => {
    const { roomId, playerName } = data;
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, createRoom(roomId));
    }
    
    const room = rooms.get(roomId);
    socket.join(roomId);
    
    // Assign color based on join order
    const playerColor = room.players.size === 0 ? 'white' : 'black';
    
    room.players.set(socket.id, {
      id: socket.id,
      name: playerName || `Player ${room.players.size + 1}`,
      color: playerColor,
      connected: true
    });
    
    socket.emit('room-joined', {
      roomId,
      playerColor,
      players: Array.from(room.players.values()),
      gameState: room.gameState
    });
    
    socket.to(roomId).emit('player-joined', {
      player: room.players.get(socket.id),
      players: Array.from(room.players.values())
    });
    
    console.log(`Player ${socket.id} joined room ${roomId} as ${playerColor}`);
  });

  socket.on('game-action', (data) => {
    const { roomId, action, gameState } = data;
    
    if (!rooms.has(roomId)) return;
    
    const room = rooms.get(roomId);
    const player = room.players.get(socket.id);
    
    room.gameState = gameState;
    room.history.push({
      action,
      gameState: JSON.parse(JSON.stringify(gameState)),
      timestamp: Date.now(),
      player: socket.id,
      playerName: player?.name || 'Unknown'
    });
    
    // Broadcast to all other players in room
    socket.to(roomId).emit('game-action', {
      action,
      gameState,
      player: socket.id,
      playerName: player?.name || 'Unknown'
    });
    
    console.log(`Action in room ${roomId}:`, action.type, 'by', player?.name);
  });

  socket.on('chat-message', (data) => {
    const { roomId, message } = data;
    
    if (!rooms.has(roomId)) return;
    
    const room = rooms.get(roomId);
    const player = room.players.get(socket.id);
    
    const chatMessage = {
      id: Date.now() + Math.random(),
      message: message.trim(),
      playerName: player?.name || 'Unknown',
      playerColor: player?.color || 'white',
      timestamp: Date.now()
    };
    
    // Broadcast to all players in room (including sender)
    io.to(roomId).emit('chat-message', chatMessage);
    
    console.log(`Chat in room ${roomId}:`, player?.name, '-', message);
  });

  socket.on('player-typing', (data) => {
    const { roomId, isTyping } = data;
    
    if (!rooms.has(roomId)) return;
    
    const room = rooms.get(roomId);
    const player = room.players.get(socket.id);
    
    // Broadcast to other players only
    socket.to(roomId).emit('player-typing', {
      playerName: player?.name || 'Unknown',
      playerColor: player?.color || 'white',
      isTyping
    });
  });

  socket.on('disconnect', () => {
    // Mark player as disconnected in all rooms
    for (const [roomId, room] of rooms) {
      if (room.players.has(socket.id)) {
        room.players.get(socket.id).connected = false;
        socket.to(roomId).emit('player-disconnected', {
          playerId: socket.id,
          players: Array.from(room.players.values())
        });
        
        // Clean up empty rooms after 5 minutes
        if (Array.from(room.players.values()).every(p => !p.connected)) {
          setTimeout(() => {
            if (rooms.has(roomId) && 
                Array.from(rooms.get(roomId).players.values()).every(p => !p.connected)) {
              rooms.delete(roomId);
              console.log(`Cleaned up empty room: ${roomId}`);
            }
          }, 5 * 60 * 1000);
        }
      }
    }
    console.log('Player disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 HYVEMYND multiplayer server running on port ${PORT}`);
  console.log(`🌍 Ready for worldwide Hive battles!`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});