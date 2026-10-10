import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { market } from './services/market';
import authRoutes from './routes/auth';
import portfolioRoutes from './routes/portfolio';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors({
  origin: '*', // Allow all origins for local testing convenience
}));
app.use(express.json());

// HTTP API Routes
app.use('/api/auth', authRoutes);
app.use('/api/portfolio', portfolioRoutes);

// Stock metadata & history endpoints
app.get('/api/stocks', (req, res) => {
  res.json(market.getStocks());
});

app.get('/api/stocks/:symbol/history', (req, res) => {
  const { symbol } = req.params;
  const history = market.getHistory(symbol.toUpperCase());
  if (history.length === 0) {
    return res.status(404).json({ error: `No history found for symbol: ${symbol}` });
  }
  res.json(history);
});

// Serve compiled React frontend if present
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  console.log(`[QuantFlow Server] Serving frontend static assets from ${frontendDistPath}`);
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Create HTTP server and mount WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Store active WebSocket connections
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);

  // Send initial stock prices on connect
  ws.send(JSON.stringify({
    type: 'INIT',
    data: market.getStocks()
  }));

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err);
    clients.delete(ws);
  });
});

// Broadcast market simulator ticks to all connected clients
market.on('tick', (updates) => {
  const message = JSON.stringify({
    type: 'TICK',
    data: updates,
  });

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
});

// Broadcast candle close events to updates charts
market.on('candle', (candles) => {
  const message = JSON.stringify({
    type: 'CANDLE',
    data: candles,
  });

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
});

// Start the market simulation engine and bootstrap the server
market.startSimulation();

server.listen(PORT, () => {
  console.log(`[QuantFlow Server] HTTP and WebSocket server running on port ${PORT}`);
});
