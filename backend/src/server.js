const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { initFirebase } = require('./firebase');
const { getCachedLiveScores, startLiveScorePolling, stopLiveScorePolling } = require('./liveScoreManager');

dotenv.config();

// Initialize Firebase Admin SDK
initFirebase();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ==========================================
// CLIENT PROXY ENDPOINT
// ==========================================
/**
 * Express endpoint for client devices (5,000 to 20,000+ DAU).
 * Reads directly from global in-memory object (0 third-party API hits per user).
 * Instantaneous ~1ms response time under high traffic.
 */
app.get('/api/live-scores', (req, res) => {
  const data = getCachedLiveScores();
  res.setHeader('Cache-Control', 'public, max-age=15');
  res.json(data);
});

// Alias endpoint for existing frontend calls to /football-current-live
app.get('/football-current-live', (req, res) => {
  const data = getCachedLiveScores();
  res.setHeader('Cache-Control', 'public, max-age=15');
  res.json(data.matches || []);
});


// Health check endpoint for VPS process manager (PM2 / Docker)
app.get('/health', (req, res) => {
  const cache = getCachedLiveScores();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    lastUpdated: cache.lastUpdated,
    liveMatches: cache.count
  });
});

// Start Express server
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Football Live Score Proxy Server running on port ${PORT}`);
  console.log(`📡 Client Proxy Endpoint: http://localhost:${PORT}/api/live-scores`);
  console.log(`====================================================`);

  // Start dynamic polling loop in background
  startLiveScorePolling();
});

// Graceful Shutdown Handler
function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
  stopLiveScorePolling();
  
  server.close(() => {
    console.log('[Server] Closed all connections. Process exiting.');
    process.exit(0);
  });

  // Force exit after 10s if shutdown hangs
  setTimeout(() => {
    console.error('[Server] Could not close connections in time, forcing exit.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
