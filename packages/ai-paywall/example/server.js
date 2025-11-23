// Example Express server using ai-paywall middleware
// Usage: node example/server.js

const express = require('express');
const { paywall } = require('../dist/index'); // Use built dist, or '../src/index' if using ts-node

const app = express();
app.use(express.json());

// Add connection handling middleware FIRST - before paywall
app.use((req, res, next) => {
  // Explicitly close connection after response
  res.setHeader('Connection', 'close');
  
  // Log request start
  console.log(`[Server] Incoming request: ${req.method} ${req.path}`);
  
  // Handle connection errors
  req.on('error', (err) => {
    console.error('[Server] Request error:', err);
  });
  
  res.on('error', (err) => {
    console.error('[Server] Response error:', err);
  });
  
  res.on('finish', () => {
    console.log(`[Server] Response finished: ${req.method} ${req.path} - ${res.statusCode}`);
  });
  
  res.on('close', () => {
    console.log(`[Server] Response closed: ${req.method} ${req.path}`);
  });
  
  next();
});

// Protected route with paywall middleware
// Contract details are baked into the package
// You only need: price, receiver (wallet address), domain!
// 
// This endpoint maps to registered content:
// - Domain: www.krish.com
// - Resource: /hidden/dog
// - Registered in registry-app with Seal encryption
app.use(
  "/premium",
  paywall({
    price: "0.01", // 0.01 SUI
    receiver:
      "0x043d0499d17b09ffffd91a3eebb684553ca7255e273c69ed72e355950e0d77be", // Your wallet address - where payments go
    domain: "www.krish.com", // Must match registered domain in registry-app
  })
);

// Protected route handler
app.get('/premium', (req, res) => {
  console.log('[Server] Route handler called for /premium');
  try {
    // Check if we have encrypted blob (from Seal-encrypted content)
    if (req.paywall?.encryptedBlob) {
      console.log('[Server] Serving encrypted blob from Walrus');
      const resourceEntry = req.paywall.resourceEntry;
      
      // Option 1: Serve encrypted blob as binary
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('X-Walrus-CID', resourceEntry.walrus_cid);
      res.setHeader('X-Seal-Policy', resourceEntry.seal_policy);
      res.setHeader('X-Resource-ID', resourceEntry.resource_id);
      res.send(Buffer.from(req.paywall.encryptedBlob));
      return;
    }
    
    // Option 2: Serve mock content (if no encrypted blob)
    // Access granted! User has valid pass
    const response = {
      success: true,
      message: 'Premium content unlocked!',
      accessPass: req.paywall?.accessPass, // Access pass details
      data: {
        article: 'Premium article content here...',
        author: 'John Doe',
        timestamp: new Date().toISOString(),
      },
    };
    console.log('[Server] Sending response for /premium');
    res.json(response);
    console.log('[Server] Response sent for /premium');
  } catch (error) {
    console.error('[Server] Error in route handler:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'InternalServerError',
        message: error.message || 'An error occurred',
      });
    }
  }
});

// Another protected route
app.get('/premium/data', (req, res) => {
  res.json({
    success: true,
    message: 'Premium data endpoint',
    data: {
      datasets: ['dataset1', 'dataset2', 'dataset3'],
    },
  });
});

// Public route (no paywall)
app.get('/', (req, res) => {
  res.json({
    message: 'Public endpoint - no payment required',
    endpoints: {
      premium: '/premium - Requires payment',
      'premium-data': '/premium/data - Requires payment',
    },
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  // Don't send response if headers already sent
  if (!res.headersSent) {
    res.status(err.statusCode || 500).json({
      error: err.name || 'InternalServerError',
      message: err.message || 'An error occurred',
    });
  }
});

// Handle unhandled promise rejections to prevent server hangs
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Public endpoint: http://localhost:${PORT}/`);
  console.log(`💰 Protected endpoint: http://localhost:${PORT}/premium`);
  console.log(`\n💡 Try accessing /premium without headers to see 402 Payment Required`);
});

