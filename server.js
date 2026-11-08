import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupSocketServer, getLocalIpAddress } from './server/socketPlugin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

setupSocketServer(io);

// Network info API
app.get('/api/network-info', (req, res) => {
  const localIp = getLocalIpAddress();
  res.json({ localIp, port: PORT });
});

// Serve static assets from Vite build dist folder
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 5173;
httpServer.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIpAddress();
  console.log(`\n======================================================`);
  console.log(`🥋 Taekwondo Web Scoreboard Server Running!`);
  console.log(`👉 Local:   http://localhost:${PORT}`);
  console.log(`👉 Network: http://${localIp}:${PORT}`);
  console.log(`======================================================\n`);
});

