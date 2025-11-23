# Quick Start: Purchase AccessPass and Fetch Content

## Prerequisites

1. ✅ Content registered in registry-app (you have `walrusCid`, `sealPolicyId`, `domain`, `resource`)
2. ✅ Server running with paywall middleware
3. ✅ Private key with SUI balance

## Step 1: Start the Server

```bash
cd packages/ai-paywall
npm run build
node example/server.js
```

The server should be running on `http://localhost:3000`

## Step 2: Set Your Private Key

```bash
export PRIVATE_KEY=your-sui-private-key
# Or in suiprivkey format:
# export PRIVATE_KEY=suiprivkey1qq4zwedasw8nc0jcpdrkkznff9rkjajp5hque5felwe3ysa6erjgy9gw62r
```

## Step 3: Purchase AccessPass and Fetch Content

**Note**: The server is configured to use registered content:
- Domain: `www.krish.com`
- Resource: `/hidden/dog`
- This content is encrypted with Seal and stored on Walrus

### Option A: Simple One-Line Access (Recommended)

```javascript
const { PaywallClient } = require('ai-paywall');

const client = new PaywallClient({
  privateKey: process.env.PRIVATE_KEY,
});

// This handles everything automatically:
// 1. Detects 402 payment required
// 2. Purchases AccessPass
// 3. Signs headers
// 4. Fetches content
const content = await client.access('http://localhost:3000/premium');
console.log(content);
```

### Option B: Manual Step-by-Step

```javascript
const { PaywallClient } = require('ai-paywall');

// 1. Initialize client
const client = new PaywallClient({
  privateKey: process.env.PRIVATE_KEY,
});

// 2. Get 402 challenge
const response = await fetch('http://localhost:3000/premium');
if (response.status !== 402) {
  throw new Error('Expected 402');
}
const challenge = await response.json();
console.log('Challenge:', challenge);

// 3. Purchase AccessPass and get signed headers
const { headers, accessPassId } = await client.payForAccess(
  'http://localhost:3000/premium'
);
console.log('AccessPass ID:', accessPassId);

// 4. Request content with headers
const contentResponse = await fetch('http://localhost:3000/premium', { headers });

// 5. Handle response
if (contentResponse.headers.get('content-type')?.includes('application/octet-stream')) {
  // Encrypted blob - needs decryption
  const encryptedBlob = await contentResponse.arrayBuffer();
  console.log('Received encrypted blob:', encryptedBlob.byteLength, 'bytes');
  
  // Get metadata from headers
  const walrusCid = contentResponse.headers.get('X-Walrus-CID');
  const sealPolicy = contentResponse.headers.get('X-Seal-Policy');
  const resourceId = contentResponse.headers.get('X-Resource-ID');
  
  console.log('Metadata:', { walrusCid, sealPolicy, resourceId });
  
  // TODO: Decrypt using Seal SDK (see README_DECRYPTION.md)
} else {
  // JSON response (mock content)
  const json = await contentResponse.json();
  console.log('Content:', json);
}
```

## Step 4: Run the Test Script

```bash
# Simple test (uses PaywallClient SDK)
node example/simple-bot-example.js

# Complete test with decryption (requires Seal setup)
node example/test-with-decryption.js

# Original test (uses Sui CLI)
node example/test-complete-flow.js
```

## What Happens Behind the Scenes

1. **First Request**: Client hits `/premium` → Gets `402 Payment Required` with challenge
2. **Purchase**: Client purchases `AccessPass` on Sui blockchain
3. **Sign Headers**: Client signs headers with AccessPass ID and timestamp
4. **Second Request**: Client retries with signed headers
5. **Verification**: Server verifies AccessPass on-chain
6. **Content Fetch**: Server fetches encrypted blob from Walrus
7. **Response**: Server returns encrypted blob (or decrypts if SessionKey provided)

## Important Notes

- **Domain/Resource Must Match**: The domain and resource in your server config must match what you registered in registry-app
- **Encrypted Content**: If content is encrypted with Seal, you'll get an encrypted blob that needs decryption
- **SessionKey**: For server-side decryption, you need to provide a signed SessionKey in the `x-session-key` header
- **AccessPass**: Each AccessPass has `remaining` uses and optional `expiry` time

## Troubleshooting

### "Expected 402, got 200"
- Server might not have paywall middleware configured
- Check that `/premium` route uses `paywall()` middleware

### "AccessPass not found"
- Wait a few seconds after purchase for on-chain indexing
- Verify AccessPass ID is correct

### "Signature verification failed"
- Make sure you're using the correct private key
- Check that AccessPass owner matches signer address

### "Resource not found in registry"
- Make sure domain/resource match what you registered
- Verify registry-app registration was successful

