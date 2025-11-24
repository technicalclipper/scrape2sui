# ai-paywall

Express middleware and client SDK for protecting routes behind Sui blockchain payments with Seal encryption - perfect for forcing AI agents to pay before accessing premium content.

## 🚀 Quick Start

### Installation

```bash
npm install ai-paywall
```

---

## 📖 Table of Contents

- [Server-Side Usage](#server-side-usage) - Protecting routes with middleware
- [Client-Side Usage](#client-side-usage) - Accessing protected content
- [Examples](#examples) - Working examples
- [Configuration](#configuration) - Options and settings
- [How It Works](#how-it-works) - System overview
- [Architecture](#architecture) - Deep technical details

---

## 🖥️ Server-Side Usage

### Basic Setup

Protect your routes with just **3 parameters**! All contract details are baked into the package.

```javascript
const express = require('express');
const { paywall } = require('ai-paywall');

const app = express();

// Protect a route - that's it!
app.use('/premium', paywall({
  price: '0.01',                    // Price in SUI
  receiver: '0x...',                // Your wallet address (where payments go)
  domain: 'www.example.com',        // Your domain (must match registry)
}));

// Protected route handler
app.get('/premium', (req, res) => {
  // Middleware has already:
  // ✅ Verified AccessPass on-chain
  // ✅ Fetched encrypted content from Walrus
  // ✅ Stored it in req.paywall.encryptedBlob
  
  res.setHeader('Content-Type', 'application/octet-stream');
  res.send(Buffer.from(req.paywall.encryptedBlob));
});
```

### Setting Up with Registered Content

If you've already registered content in registry-app:

```javascript
const express = require('express');
const { paywall } = require('ai-paywall');

const app = express();

// Your registered resource configuration
const RESOURCE = {
  domain: 'www.yourdomain.com',
  resource: '/hidden/content',
  price: '0.01',
  receiver: '0x...', // Your wallet address
  resourceEntryId: '0x...', // Optional: speeds up lookup
};

// Protect the route
app.use(RESOURCE.resource, paywall({
  price: RESOURCE.price,
  receiver: RESOURCE.receiver,
  domain: RESOURCE.domain,
  resourceEntryId: RESOURCE.resourceEntryId, // Optional optimization
  // Note: If resourceEntryId not provided, middleware queries registry automatically
}));

// Route handler
app.get(RESOURCE.resource, (req, res) => {
  // Serve encrypted content
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('X-Resource-Entry-ID', req.paywall.resourceEntry?.resource_id);
  res.send(Buffer.from(req.paywall.encryptedBlob));
});
```

**See [example/new-server-example.js](./example/new-server-example.js) for a complete working example.**

### What the Middleware Does

1. ✅ Checks for payment headers on every request
2. ✅ Returns `402 Payment Required` if no valid headers
3. ✅ Verifies AccessPass on Sui blockchain (no database needed!)
4. ✅ Fetches ResourceEntry from registry by domain/resource
5. ✅ Downloads encrypted content from Walrus storage
6. ✅ Stores encrypted blob in `req.paywall.encryptedBlob`
7. ✅ Provides ResourceEntry ID via `X-Resource-Entry-ID` header

### Request Object

After middleware verification, `req.paywall` contains:

```typescript
req.paywall = {
  accessPass: AccessPass,      // Verified AccessPass object
  verified: true,              // Verification status
  encryptedBlob: ArrayBuffer,  // Encrypted content from Walrus
  resourceEntry: {             // Resource metadata
    domain: string,
    resource: string,
    walrus_cid: string,
    seal_policy: string,
    resource_id: string,       // ResourceEntry object ID
    // ... other fields
  }
}
```

---

## 🤖 Client-Side Usage

### Basic Access

The client SDK handles everything automatically: payment detection, AccessPass purchase, authentication, and decryption.

```javascript
const { PaywallClient } = require('ai-paywall');

// Initialize client
const client = new PaywallClient({
  privateKey: process.env.PRIVATE_KEY,
});

// Access and decrypt in one call
const decrypted = await client.accessAndDecrypt(
  'http://example.com/premium',
  'www.example.com',  // Domain from registry
  '/premium'          // Resource path
  // ResourceEntry ID automatically extracted from server headers!
);
```

**That's it!** The client automatically:
- ✅ Detects 402 payment required
- ✅ Purchases AccessPass if needed
- ✅ Signs authentication headers
- ✅ Makes authenticated request
- ✅ Extracts ResourceEntry ID from server headers
- ✅ Decrypts content using Seal

### Step-by-Step Access (Manual Control)

```javascript
const { PaywallClient } = require('ai-paywall');

const client = new PaywallClient({
  privateKey: process.env.PRIVATE_KEY,
});

// Step 1: Access protected route (gets encrypted blob)
const encryptedBlob = await client.access('http://example.com/premium');

// Step 2: Find AccessPass (if needed for decryption)
const accessPassId = await client.findExistingAccessPass('www.example.com', '/premium');

// Step 3: Decrypt content
const decrypted = await client.decrypt(
  encryptedBlob,
  resourceEntryId,  // Get from server's X-Resource-Entry-ID header
  accessPassId
);
```

**See [example/new-client-example.js](./example/new-client-example.js) for a complete working example.**

---

## 📝 Examples

### Server Example

```bash
cd example
export WALRUS_DOMAIN=www.yourdomain.com
export WALRUS_RESOURCE=/your/resource/path
export RECEIVER_ADDRESS=0x...
node new-server-example.js
```

### Client Example

```bash
cd example
export PRIVATE_KEY=your-private-key
export SERVER_URL=http://localhost:3000
export WALRUS_DOMAIN=www.yourdomain.com
export WALRUS_RESOURCE=/your/resource/path
node new-client-example.js
```

**See [example/README.md](./example/README.md) for more details.**

---

## ⚙️ Configuration

### Middleware Options

```typescript
interface PaywallOptions {
  price: string;           // Price in SUI (e.g., "0.01")
  receiver: string;        // Your wallet address (where payments go)
  domain: string;          // Domain name (must match registry exactly)
  resourceEntryId?: string; // Optional: ResourceEntry ID (optimization cache)
  mockContent?: string;     // Optional: Mock content for testing
}
```

### Client Options

```typescript
interface PaywallClientOptions {
  privateKey: string;      // Base64 or hex private key
  rpcUrl?: string;         // Optional: Sui RPC URL (default: testnet)
}
```

---

## 🔄 How It Works

### Request Flow

```
1. Client Request (no headers)
   ↓
2. Middleware → 402 Payment Required
   ↓
3. Client Purchases AccessPass (on-chain)
   ↓
4. Client Signs Headers (x-pass-id, x-sig, etc.)
   ↓
5. Client Retries Request (with headers)
   ↓
6. Middleware Verifies AccessPass (on-chain)
   ↓
7. Middleware Fetches ResourceEntry (from registry)
   ↓
8. Middleware Fetches Encrypted Content (from Walrus)
   ↓
9. Middleware Returns Encrypted Blob + Headers
   ↓
10. Client Decrypts Content (using Seal)
```

### Response Codes

- **402 Payment Required**: No payment headers or invalid pass
- **403 Forbidden**: Invalid pass, expired, or no remaining uses
- **200 OK**: Access granted (encrypted blob in response)

### Client Headers

Clients must include these headers when accessing protected routes:

| Header | Description | Example |
|--------|-------------|---------|
| `x-pass-id` | AccessPass object ID | `0x1234...` |
| `x-signer` | Owner address (signer) | `0xabcd...` |
| `x-sig` | Signature (base64) | `signature...` |
| `x-ts` | Timestamp (ms) | `1704067200000` |

---

## 🏗️ Architecture

For detailed technical information about the system architecture, components, and data flows, see:

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system architecture explanation

### Key Components

1. **Registry App** - Content registration and encryption
2. **Paywall Middleware** - Access control and content delivery
3. **PaywallClient** - Payment and content access SDK
4. **Sui Blockchain** - AccessPass and registry storage
5. **Walrus Storage** - Decentralized encrypted content storage
6. **Seal Encryption** - Zero-knowledge encryption/decryption

---

## ❓ Troubleshooting

### "Resource not found in registry"

- ✅ Check `domain` matches registry exactly (case-sensitive)
- ✅ Check route path matches `resource` exactly
- ✅ Verify ResourceEntry exists on Sui blockchain
- ✅ Try providing `resourceEntryId` in middleware options (optional optimization)

### "AccessPass not found"

- ✅ Client needs to purchase AccessPass first
- ✅ AccessPass must match domain/resource
- ✅ Check AccessPass has remaining uses

### "Invalid signature"

- ✅ Client must sign headers with correct private key
- ✅ Signature must match AccessPass owner
- ✅ Timestamp must be recent

### "ResourceEntry ID not found"

- ✅ Server should automatically provide `X-Resource-Entry-ID` header
- ✅ Check middleware is correctly fetching ResourceEntry
- ✅ Verify resource is registered in registry

---

## 📚 Documentation

- **[README.md](./README.md)** - This file (main documentation)
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed system architecture
- **[example/README.md](./example/README.md)** - Example scripts guide

---

## 🔒 Security Features

- ✅ On-chain verification (no database required)
- ✅ Signature verification (prevents forgery)
- ✅ Zero-knowledge encryption (Seal servers never see content)
- ✅ Threshold cryptography (multiple key servers required)
- ✅ Replay protection (nonces prevent request replay)
- ✅ Time-limited access (SessionKey expires after TTL)

---

## 📄 License

[Your License Here]
