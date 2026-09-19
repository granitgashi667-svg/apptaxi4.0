import express from 'express';
import http from 'node:http';
import cors from 'cors';
import { Server } from 'socket.io';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

// Kjo nis bootstrap-in (tenant + admin G/1 + 18 tabela)
import './database.js';

import apiRoutes from './routes/index.js';
import { setupSocket } from './socket.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.set('io', io);
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API
app.use('/api', apiRoutes);

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'TaxiApp 3.0', time: new Date().toISOString() });
});

// Frontend statik — NUK prekim faqet ekzistuese!
app.use(express.static(ROOT));
app.use('/js', express.static(join(ROOT, 'js')));
app.use('/css', express.static(join(ROOT, 'css')));

// Fallback vetëm për rrugët që s'janë API
app.get(/^\/(?!api).*/, (_req, res) => {
  res.sendFile(join(ROOT, 'index.html'));
});

// Socket.io
setupSocket(io);

// Nisje
server.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🚕 TaxiApp 3.0 — Serveri u nis`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`🔑 Login: POST /api/auth/login`);
  console.log(`   → username: ${process.env.FIRST_ADMIN_USERNAME || 'G'}`);
  console.log(`   → password: ${process.env.FIRST_ADMIN_PASSWORD || '1'}`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
});
