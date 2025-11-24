# Server Setup Guide

This guide explains how to set up a new server to protect routes with content that was already registered through registry-app.

## Overview

After registering content in registry-app, you have:
- ✅ Content encrypted with Seal
- ✅ Encrypted blob stored on Walrus (with `walrusCid`)
- ✅ ResourceEntry registered on Sui blockchain
- ✅ Seal Policy ID generated

Now you want to serve this protected content on your own server.

---

## Step-by-Step Setup

### Step 1: Install the Package

```bash
npm install ai-paywall
# OR if using from local package
npm install ../packages/ai-paywall
```

### Step 2: Get Your Registration Details

From your registry-app registration, you should have:

```bash
export WALRUS_DOMAIN=www.demo1.com
export WALRUS_RESOURCE=/hidden/dog
export WALRUS_BLOB_ID=wqwm17mRGo5PkXPo5p_I-RXtNIH4kdM-UnPVksBQ5lY
export SEAL_POLICY_ID=f02db2d9f0844665d33376e822e6c2e0c150344572fb7b8f4d4b6323621b5895cbe9653375
export RESOURCE_ENTRY_ID=0x44ace4be0c2ca4bf48bdb4f6a8069ff2beb73c3b33409035cffefa160ff40f5d
```

### Step 3: Create Your Server

Create a new file `server.js`:

```javascript
const express = require('express');
const { paywall } = require('ai-paywall');

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Configure paywall middleware for your registered resource
app.use('/hidden/dog', paywall({
  price: '0.01',                           // Price in SUI (should match registry)
  receiver: '0x...',                       // Your wallet address (receives payments)
  domain: process.env.WALRUS_DOMAIN || 'www.demo1.com',  // Domain from registry
}));

// Protected route handler
app.get('/hidden/dog', (req, res) => {
  // Access granted! The middleware has already:
  // - Verified the AccessPass on-chain
  // - Fetched encrypted content from Walrus
  // - Stored it in req.paywall.encryptedBlob
  
  // Option 1: Return encrypted blob for client-side decryption
  if (req.paywall?.encryptedBlob) {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(Buffer.from(req.paywall.encryptedBlob));
    return;
  }
  
  // Option 2: Return metadata (for debugging)
  res.json({
    message: 'Access granted',
    resourceEntry: req.paywall?.resourceEntry,
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📦 Protected route: http://localhost:${PORT}/hidden/dog`);
});
```

### Step 4: Set Environment Variables

Create `.env` file or export variables:

```bash
# Domain and resource from your registry registration
export WALRUS_DOMAIN=www.demo1.com
export WALRUS_RESOURCE=/hidden/dog

# Resource Entry ID from Sui blockchain
export RESOURCE_ENTRY_ID=0x44ace4be0c2ca4bf48bdb4f6a8069ff2beb73c3b33409035cffefa160ff40f5d

# Your wallet address (where payments go)
export RECEIVER_ADDRESS=0x...
```

### Step 5: Start Your Server

```bash
node server.js
```

---

## How It Works

### Request Flow

```
1. Client Request (no headers)
   GET /hidden/dog
   
   ↓
   
2. Middleware Checks Headers
   - No headers found
   
   ↓
   
3. Returns 402 Payment Required
   {
     "status": 402,
     "paymentRequired": true,
     "price": "0.01",
     "domain": "www.demo1.com",
     "resource": "/hidden/dog",
     ...
   }
   
   ↓
   
4. Client Purchases AccessPass (using PaywallClient)
   - Calls purchaseAccessPass()
   - Gets AccessPass ID
   
   ↓
   
5. Client Signs Headers
   - x-pass-id: AccessPass ID
   - x-signer: Client address
   - x-sig: Signature
   - x-ts: Timestamp
   
   ↓
   
6. Client Retries Request (with headers)
   GET /hidden/dog
   Headers: { x-pass-id, x-signer, x-sig, x-ts }
   
   ↓
   
7. Middleware Verifies AccessPass
   - Fetches AccessPass from Sui blockchain
   - Verifies owner matches signer
   - Checks domain/resource match
   - Validates expiry and remaining uses
   - Verifies signature
   
   ↓
   
8. Middleware Fetches Encrypted Content
   - Queries registry for ResourceEntry
   - Gets walrus_cid from ResourceEntry
   - Fetches encrypted blob from Walrus
   - Stores in req.paywall.encryptedBlob
   
   ↓
   
9. Route Handler Executes
   - req.paywall.encryptedBlob contains encrypted content
   - Route handler can return it to client
   
   ↓
   
10. Client Receives Encrypted Blob
    - Client uses PaywallClient.decrypt() to decrypt
```

---

## Client-Side Usage

Clients (AI bots) access your protected content using PaywallClient:

```javascript
const { PaywallClient } = require('ai-paywall');

const client = new PaywallClient({
  privateKey: process.env.PRIVATE_KEY,
});

// Option 1: Get encrypted blob, decrypt separately (ResourceEntry ID from headers)
const encryptedBlob = await client.access('http://your-server.com/hidden/dog');
// Note: For manual decrypt, you need ResourceEntry ID and AccessPass ID
const accessPassId = await client.findExistingAccessPass(domain, resource);
const decrypted = await client.decrypt(
  encryptedBlob,
  process.env.RESOURCE_ENTRY_ID, // Or extract from response headers
  accessPassId
);

// Option 2: Access and decrypt in one call (ResourceEntry ID from server headers)
// Server automatically provides X-Resource-Entry-ID header - no need to configure client!
const decrypted = await client.accessAndDecrypt(
  'http://your-server.com/hidden/dog',
  process.env.WALRUS_DOMAIN,
  process.env.WALRUS_RESOURCE
  // ResourceEntry ID is automatically extracted from X-Resource-Entry-ID header
);
```

---

## Configuration Details

### Middleware Configuration

```javascript
app.use('/your-route', paywall({
  price: '0.01',              // Price in SUI (should match registry price)
  receiver: '0x...',          // Your wallet address (receives payments)
  domain: 'www.yourdomain.com', // Domain from registry registration
}));
```

**Important**: 
- `domain` must match exactly what was registered in registry-app
- `resource` is automatically extracted from the route path
- Contract details (packageId, treasuryId, etc.) are loaded automatically

### Environment Variables for Middleware

The middleware uses environment variables to find registered resources:

```bash
# Required for middleware to find ResourceEntry
export WALRUS_DOMAIN=www.demo1.com
export WALRUS_RESOURCE=/hidden/dog

# Optional: Direct ResourceEntry ID (faster lookup)
export RESOURCE_ENTRY_ID=0x44ace4be0c2ca4bf48bdb4f6a8069ff2beb73c3b33409035cffefa160ff40f5d
```

### Environment Variables for Clients

Clients need minimal configuration - server provides ResourceEntry ID via headers:

```bash
# Required for client
export WALRUS_DOMAIN=www.demo1.com
export WALRUS_RESOURCE=/hidden/dog
export PRIVATE_KEY=your-private-key

# Optional: RESOURCE_ENTRY_ID can be used as fallback if server doesn't send header
# But server should always provide X-Resource-Entry-ID header automatically
```

---

## Complete Example

Here's a complete server setup:

### `server.js`

```javascript
const express = require('express');
const { paywall } = require('ai-paywall');
require('dotenv').config(); // Optional: for .env file support

const app = express();
app.use(express.json());

// Your registered resource details
const REGISTERED_RESOURCE = {
  domain: process.env.WALRUS_DOMAIN || 'www.demo1.com',
  resource: process.env.WALRUS_RESOURCE || '/hidden/dog',
  price: process.env.RESOURCE_PRICE || '0.01',
  receiver: process.env.RECEIVER_ADDRESS || '0x...', // Your wallet
};

// Protect the route with paywall middleware
app.use(REGISTERED_RESOURCE.resource, paywall({
  price: REGISTERED_RESOURCE.price,
  receiver: REGISTERED_RESOURCE.receiver,
  domain: REGISTERED_RESOURCE.domain,
}));

// Protected route handler
app.get(REGISTERED_RESOURCE.resource, (req, res) => {
  console.log('[Server] Access granted for:', req.paywall?.resourceEntry?.domain);
  
  // The middleware has already fetched encrypted content from Walrus
  if (req.paywall?.encryptedBlob) {
    // Return encrypted blob for client-side decryption
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', req.paywall.encryptedBlob.byteLength);
    res.send(Buffer.from(req.paywall.encryptedBlob));
  } else {
    // Fallback: return metadata
    res.json({
      message: 'Access granted',
      resourceEntry: req.paywall?.resourceEntry,
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    protectedRoute: REGISTERED_RESOURCE.resource,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔒 Protected: http://localhost:${PORT}${REGISTERED_RESOURCE.resource}`);
  console.log(`📋 Domain: ${REGISTERED_RESOURCE.domain}`);
  console.log(`💰 Price: ${REGISTERED_RESOURCE.price} SUI`);
});
```

### `.env`

```bash
# Registry registration details
WALRUS_DOMAIN=www.demo1.com
WALRUS_RESOURCE=/hidden/dog
RESOURCE_ENTRY_ID=0x44ace4be0c2ca4bf48bdb4f6a8069ff2beb73c3b33409035cffefa160ff40f5d

# Server configuration
RECEIVER_ADDRESS=0x...  # Your wallet address
RESOURCE_PRICE=0.01     # Price in SUI
PORT=3000
```

---

## Testing

### 1. Test Without Payment (Expect 402)

```bash
curl http://localhost:3000/hidden/dog
```

Response:
```json
{
  "status": 402,
  "paymentRequired": true,
  "price": "0.01",
  "domain": "www.demo1.com",
  "resource": "/hidden/dog",
  ...
}
```

### 2. Test With PaywallClient

```javascript
const { PaywallClient } = require('ai-paywall');

const client = new PaywallClient({
  privateKey: process.env.PRIVATE_KEY,
});

// This will automatically:
// - Get 402
// - Purchase AccessPass
// - Sign headers
// - Get encrypted content
const encryptedBlob = await client.access('http://localhost:3000/hidden/dog');

console.log('Received:', encryptedBlob.byteLength, 'bytes');
```

---

## Key Points

### ✅ What the Middleware Does Automatically

1. **Checks for payment headers** on every request
2. **Verifies AccessPass** on Sui blockchain (no database needed!)
3. **Fetches ResourceEntry** from registry to get Walrus CID
4. **Downloads encrypted content** from Walrus storage
5. **Stores encrypted blob** in `req.paywall.encryptedBlob`

### ✅ What You Need to Provide

1. **Price** - Should match what's in registry
2. **Receiver** - Your wallet address (gets payments)
3. **Domain** - Must match registry registration exactly
4. **Route path** - Must match resource path from registry

### ✅ What Clients Get

1. **Encrypted blob** - Content encrypted with Seal
2. **Metadata** - ResourceEntry details in response headers (optional)
3. **Automatic decryption** - Using PaywallClient.decrypt()

---

## Multiple Resources

If you registered multiple resources, protect each route separately:

```javascript
// Resource 1
app.use('/premium/content1', paywall({
  price: '0.01',
  receiver: '0x...',
  domain: 'www.example.com',
}));

// Resource 2
app.use('/premium/content2', paywall({
  price: '0.02',
  receiver: '0x...',
  domain: 'www.example.com',
}));

// Resource handlers
app.get('/premium/content1', (req, res) => {
  res.setHeader('Content-Type', 'application/octet-stream');
  res.send(Buffer.from(req.paywall.encryptedBlob));
});

app.get('/premium/content2', (req, res) => {
  res.setHeader('Content-Type', 'application/octet-stream');
  res.send(Buffer.from(req.paywall.encryptedBlob));
});
```

---

## Troubleshooting

### "Resource not found in registry"

- ✅ Check `WALRUS_DOMAIN` matches registry exactly
- ✅ Check route path matches `WALRUS_RESOURCE` exactly
- ✅ Verify ResourceEntry exists on Sui blockchain
- ✅ Try setting `RESOURCE_ENTRY_ID` directly

### "AccessPass not found"

- ✅ Client needs to purchase AccessPass first
- ✅ AccessPass must match domain/resource
- ✅ Check AccessPass has remaining uses

### "Invalid signature"

- ✅ Client must sign headers with correct private key
- ✅ Signature must match AccessPass owner
- ✅ Timestamp must be recent

---

## Summary

1. **Register content** in registry-app → Get ResourceEntry ID
2. **Set up Express server** → Use paywall middleware
3. **Configure middleware** → Match domain/resource from registry
4. **Protect routes** → Middleware handles everything automatically
5. **Clients access** → Using PaywallClient SDK

That's it! The middleware handles all the blockchain verification, Walrus fetching, and access control automatically.

