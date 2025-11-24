#!/usr/bin/env node
/**
 * Example: Setting up a new server with registered content
 * 
 * This shows how to create a server that protects routes with content
 * that was already registered through registry-app.
 * 
 * Prerequisites:
 * - Content registered in registry-app
 * - You have: domain, resource path, price, receiver address
 * 
 * Usage:
 *   export WALRUS_DOMAIN=www.yourdomain.com
 *   export WALRUS_RESOURCE=/your/resource/path
 *   export RESOURCE_ENTRY_ID=0x...  # Optional but recommended
 *   export RECEIVER_ADDRESS=0x...    # Your wallet address
 *   node example/new-server-example.js
 */

const express = require('express');
const { paywall } = require('../dist/index');

const app = express();
app.use(express.json());

// ============================================
// STEP 1: Configure Your Registered Content
// ============================================
// Get these values from your registry-app registration
const REGISTERED_RESOURCE = {
  domain: process.env.WALRUS_DOMAIN || "www.demo1.com",
  resource: process.env.WALRUS_RESOURCE || "/hidden/dog",
  price: process.env.RESOURCE_PRICE || "0.01", // Price in SUI
  receiver:
    process.env.RECEIVER_ADDRESS ||
    "0xdd87d36f82daca75db0a6a601e7174070ec7469946e39124e984ea25d8fd2baa", // Your wallet address
};

// ============================================
// STEP 2: Protect Your Route with Middleware
// ============================================
// The middleware will:
// - Check for payment headers on every request
// - Verify AccessPass on Sui blockchain
// - Fetch encrypted content from Walrus
// - Store encrypted blob in req.paywall.encryptedBlob
app.use(REGISTERED_RESOURCE.resource, paywall({
  price: REGISTERED_RESOURCE.price,
  receiver: REGISTERED_RESOURCE.receiver,
  domain: REGISTERED_RESOURCE.domain,  // Must match registry registration
}));

// ============================================
// STEP 3: Create Route Handler
// ============================================
// After middleware verifies access, your handler receives:
// - req.paywall.encryptedBlob - The encrypted content from Walrus
// - req.paywall.resourceEntry - Metadata about the resource
// - req.paywall.accessPass - The AccessPass that was verified
app.get(REGISTERED_RESOURCE.resource, (req, res) => {
  console.log('[Server] Access granted!');
  
  // The middleware has already:
  // ✅ Verified AccessPass on-chain
  // ✅ Fetched encrypted content from Walrus
  // ✅ Stored it in req.paywall.encryptedBlob
  
  if (req.paywall?.encryptedBlob) {
    // Return encrypted blob for client-side decryption
    console.log(`[Server] Serving encrypted blob (${req.paywall.encryptedBlob.byteLength} bytes)`);
    
    // Note: Middleware already sets X-Resource-Entry-ID header
    // But we can also set additional helpful headers here
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Walrus-CID', req.paywall.resourceEntry?.walrus_cid || '');
    res.setHeader('X-Seal-Policy', req.paywall.resourceEntry?.seal_policy || '');
    
    res.send(Buffer.from(req.paywall.encryptedBlob));
  } else {
    // Fallback: Return metadata (this shouldn't happen normally)
    res.json({
      message: 'Access granted but no encrypted content found',
      resourceEntry: req.paywall?.resourceEntry,
      accessPass: req.paywall?.accessPass,
    });
  }
});

// ============================================
// STEP 4: Optional - Public Routes
// ============================================
app.get('/', (req, res) => {
  res.json({
    message: 'Server is running',
    protectedRoute: REGISTERED_RESOURCE.resource,
    domain: REGISTERED_RESOURCE.domain,
    price: `${REGISTERED_RESOURCE.price} SUI`,
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ============================================
// STEP 5: Start Server
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          Protected Content Server                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔒 Protected route: http://localhost:${PORT}${REGISTERED_RESOURCE.resource}`);
  console.log(`📋 Domain: ${REGISTERED_RESOURCE.domain}`);
  console.log(`💰 Price: ${REGISTERED_RESOURCE.price} SUI`);
  console.log(`📍 Receiver: ${REGISTERED_RESOURCE.receiver}`);
  console.log('');
  console.log('💡 Clients can access using PaywallClient:');
  console.log('   const client = new PaywallClient({ privateKey: "..." });');
  console.log(`   const content = await client.access('http://localhost:${PORT}${REGISTERED_RESOURCE.resource}');`);
  console.log('');
});

