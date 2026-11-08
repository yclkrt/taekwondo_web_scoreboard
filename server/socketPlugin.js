import { Server } from 'socket.io';
import os from 'os';

// Helper to determine the best local IPv4 address
export function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Must be IPv4 and not loopback (127.0.0.1)
      if (net.family === 'IPv4' && !net.internal) {
        // Prefer Wi-Fi or Ethernet (en0, eth0, wlan0, etc.)
        if (/^(en|eth|wlan|Wi-Fi|Ethernet)/i.test(name)) {
          return net.address;
        }
        candidates.push(net.address);
      }
    }
  }

  return candidates[0] || '127.0.0.1';
}

// In-memory room management
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      clients: new Map(), // socketId -> { role, slot, name }
      judges: {}, // slot -> { socketId, name, online }
      state: null,
      consensusPending: [], // buffer of recent judge clicks
    });
  }
  return rooms.get(roomId);
}

export function setupSocketServer(io) {
  io.on('connection', (socket) => {
    let currentRoomId = null;
    let clientInfo = null;

    // Join room event
    socket.on('join_room', ({ roomId = 'TKD-1', role = 'scoreboard', slot = null, name = '' }) => {
      currentRoomId = roomId;
      clientInfo = { role, slot: slot !== null ? Number(slot) : null, name };

      socket.join(roomId);
      const room = getOrCreateRoom(roomId);
      room.clients.set(socket.id, clientInfo);

      if (role === 'judge' && clientInfo.slot) {
        room.judges[clientInfo.slot] = {
          socketId: socket.id,
          name: name || `Hakem ${clientInfo.slot}`,
          online: true,
          slot: clientInfo.slot,
        };
      }

      // If room has existing state, send to newly joined client
      if (room.state) {
        socket.emit('state_update', room.state);
      }

      // Broadcast active judges list to room
      io.to(roomId).emit('judges_update', Object.values(room.judges));
      console.log(`[Socket] ${role} joined ${roomId} (slot: ${slot}, name: ${name})`);
    });

    // Scoreboard or operator updates match state
    socket.on('state_sync', ({ roomId, state }) => {
      const targetRoom = roomId || currentRoomId;
      if (!targetRoom) return;
      const room = getOrCreateRoom(targetRoom);
      room.state = state;
      // Broadcast to others in the room
      socket.to(targetRoom).emit('state_update', state);
    });

    // Judge sends scoring click
    socket.on('judge_action', (data) => {
      const targetRoom = data.roomId || currentRoomId;
      if (!targetRoom) return;

      const actionPayload = {
        ...data,
        timestamp: Date.now(),
        judgeSocketId: socket.id,
      };

      // Broadcast judge action to the room (scoreboard handles visual display & consensus)
      io.to(targetRoom).emit('judge_action', actionPayload);
    });

    // Operator sends direct action (timer, gamjeom, point override, buzzer)
    socket.on('remote_command', (data) => {
      const targetRoom = data.roomId || currentRoomId;
      if (!targetRoom) return;
      io.to(targetRoom).emit('remote_command', data);
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      if (currentRoomId && clientInfo) {
        const room = rooms.get(currentRoomId);
        if (room) {
          room.clients.delete(socket.id);
          if (clientInfo.role === 'judge' && clientInfo.slot) {
            if (room.judges[clientInfo.slot]) {
              room.judges[clientInfo.slot].online = false;
            }
          }
          io.to(currentRoomId).emit('judges_update', Object.values(room.judges));
        }
      }
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
}

// Vite plugin export
export function taekwondoSocketPlugin() {
  return {
    name: 'taekwondo-socket-plugin',
    configureServer(server) {
      const io = new Server(server.httpServer, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
        },
      });

      setupSocketServer(io);

      // Add API endpoint to query network info (IP, Port)
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/network-info') {
          const localIp = getLocalIpAddress();
          const port = server.config.server.port || 5173;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ localIp, port }));
          return;
        }
        next();
      });

      console.log(`[TKD Scoreboard] Socket.IO attached. Local IP: ${getLocalIpAddress()}`);
    },
  };
}

