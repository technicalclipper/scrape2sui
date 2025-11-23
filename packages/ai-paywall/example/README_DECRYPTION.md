# Complete Guide: Purchasing AccessPass and Fetching Decrypted Content

This guide shows you how to use the ai-paywall package to purchase AccessPass and fetch decrypted content after registering content in the registry-app.

## Prerequisites

1. **Content Registered**: You've registered content using the registry-app website
   - You should have: `walrusCid`, `sealPolicyId`, `domain`, `resource`
   
2. **Server Running**: Express server with paywall middleware
   ```bash
   cd packages/ai-paywall
   npm run build
   node example/server.js
   ```

3. **Environment Setup**:
   ```bash
   export PRIVATE_KEY=your-sui-private-key  # Base64, hex, or suiprivkey format
   ```

## Step-by-Step Guide

### Option 1: Simple Usage (Recommended)

The simplest way is to use the `PaywallClient.access()` method which handles everything automatically:

```javascript
const { PaywallClient } = require('ai-paywall');

// Initialize client
const client = new PaywallClient({
  privateKey: process.env.PRIVATE_KEY,
});

// Access protected content - everything is automatic!
const content = await client.access('http://localhost:3000/premium');
console.log(content);
```

**What happens automatically:**
1. ✅ Makes request → Gets 402 Payment Required
2. ✅ Purchases AccessPass (handles coin splitting)
3. ✅ Signs headers
4. ✅ Retries request with headers
5. ✅ Returns content (encrypted blob or decrypted if server supports it)

### Option 2: Manual Control with Decryption

If you need to decrypt content client-side using Seal:

```javascript
const { PaywallClient } = require('ai-paywall');
const { SealClient, SessionKey, EncryptedObject } = require('@mysten/seal');
const { SuiClient, getFullnodeUrl } = require('@mysten/sui.js/client');
const { TransactionBlock } = require('@mysten/sui.js/transactions');
const { fromHEX } = require('@mysten/sui.js/utils');
const contractConfig = require('ai-paywall/dist/config/contract.json');

// Step 1: Initialize PaywallClient
const paywallClient = new PaywallClient({
  privateKey: process.env.PRIVATE_KEY,
});

// Step 2: Get 402 challenge
const response = await fetch('http://localhost:3000/premium');
if (response.status !== 402) {
  throw new Error('Expected 402');
}
const challenge = await response.json();

// Step 3: Purchase AccessPass
const { headers, accessPassId } = await paywallClient.payForAccess(
  'http://localhost:3000/premium'
);

// Step 4: Request content with headers
const contentResponse = await fetch('http://localhost:3000/premium', { headers });
const encryptedBlob = await contentResponse.arrayBuffer();

// Step 5: Decrypt using Seal
// You need: resourceId, sealPolicyId from registry
// Get these from the registry using domain/resource
const resourceEntry = await getResourceFromRegistry(
  challenge.domain,
  challenge.resource
);

// Create SessionKey
const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
const sessionKey = await SessionKey.create({
  address: paywallClient.keypair.toSuiAddress(),
  packageId: contractConfig.packageId,
  ttlMin: 10,
  suiClient,
});

// Sign SessionKey (requires wallet interaction)
// In production, use wallet adapter to sign
const personalMessage = sessionKey.getPersonalMessage();
// ... sign with wallet ...
await sessionKey.setPersonalMessageSignature(signature);

// Decrypt
const sealClient = new SealClient({
  suiClient,
  serverConfigs: [/* Seal server configs */],
  verifyKeyServers: false,
});

const policyIdBytes = fromHEX(normalizeHexString(resourceEntry.seal_policy));
const tx = new TransactionBlock();
tx.moveCall({
  target: `${contractConfig.packageId}::registry::seal_approve`,
  arguments: [
    tx.pure(Array.from(policyIdBytes), 'vector<u8>'),
    tx.object(resourceEntry.resource_id),
    tx.object(accessPassId),
    tx.object('0x6'), // Clock
  ],
});
const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

await sealClient.fetchKeys({
  ids: [EncryptedObject.parse(new Uint8Array(encryptedBlob)).id],
  txBytes,
  sessionKey,
  threshold: 2,
});

const decryptedData = await sealClient.decrypt({
  data: new Uint8Array(encryptedBlob),
  sessionKey,
  txBytes,
});

console.log('Decrypted content:', decryptedData);
```

## Quick Start Example

See `test-with-decryption.js` for a complete working example:

```bash
# Set your private key
export PRIVATE_KEY=your-private-key

# Run the test
node example/test-with-decryption.js
```

## Important Notes

1. **Server-Side vs Client-Side Decryption**:
   - If server has SessionKey signature, it decrypts server-side
   - Otherwise, server returns encrypted blob for client-side decryption

2. **SessionKey Requirements**:
   - SessionKey must be signed by the user's wallet
   - This requires wallet integration (not just private key)
   - For testing, you can export a pre-signed SessionKey

3. **Registry Lookup**:
   - To decrypt, you need `resourceId` and `sealPolicyId` from registry
   - These are fetched automatically by the middleware
   - For client-side decryption, you may need to query registry separately

## Testing with Registered Content

1. **Register content** in registry-app:
   - Upload file
   - Set domain: `www.example.com`
   - Set resource: `/premium`
   - Set price
   - Copy `walrusCid` and `sealPolicyId`

2. **Update server** to use registered domain/resource:
   ```javascript
   app.use('/premium', paywall({
     price: '0.01',
     receiver: '0x...',
     domain: 'www.example.com', // Must match registry
   }));
   ```

3. **Run client**:
   ```javascript
   const content = await client.access('http://localhost:3000/premium');
   ```

The middleware will:
- Verify AccessPass
- Fetch resource from registry
- Fetch encrypted blob from Walrus
- Return encrypted blob (or decrypt if SessionKey provided)

