# Sui2Scrape

**x402-Enforced Payments for AI Agents and Automated Systems**

A production-ready blockchain payment system that enforces on-chain payments before AI agents, bots, and automated systems can access premium content. Built on Sui blockchain with encrypted storage on Walrus and decryption via Seal.

[![npm version](https://img.shields.io/npm/v/ai-paywall.svg)](https://www.npmjs.com/package/ai-paywall)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

---

## Problem

AI agents, web scrapers, and automated systems freely access valuable content without compensation:

- **Research datasets** are harvested without attribution
- **Premium APIs** face unauthorized consumption
- **Proprietary data** gets indexed without licensing
- **Content creators** lack enforcement mechanisms for usage rights
- **Rate limiting** remains easily circumvented

Traditional paywalls fail against automated systems. IP-based blocking is ineffective. Authentication tokens can be shared. There exists no universal standard requiring AI agents to pay before accessing protected data.

## Solution

Sui2Scrape implements the **x402 payment protocol**—an open standard for HTTP 402 payments. The system establishes a **verifiable payment protocol** where access to encrypted content requires on-chain proof of payment. The system combines:

- **Sui blockchain** for payment verification and access control
- **Walrus decentralized storage** for encrypted content hosting
- **Seal encryption** for cryptographic content protection
- **Express middleware** for seamless integration
- **Client SDK** for automated payment handling

Content owners encrypt and upload data once. Every access requires a valid AccessPass—an on-chain object minted only after payment. The middleware verifies pass ownership, checks remaining uses, and serves decrypted content. All transactions are immutable and auditable on-chain.

---

## Architecture

```
┌─────────────────┐
│  Content Owner  │
└────────┬────────┘
         │ 1. Upload & Encrypt
         ▼
    ┌─────────┐      ┌──────────┐      ┌────────────┐
    │  Seal   │─────▶│  Walrus  │◀────▶│ Sui Chain  │
    │Encrypt  │      │ Storage  │      │  Registry  │
    └─────────┘      └──────────┘      └────────────┘
                            │                  │
                            │                  │
         ┌──────────────────┴──────────────────┴──────────┐
         │            NPM Middleware (Website)             │
         │  - 402 Payment Required Challenge               │
         │  - AccessPass Verification                      │
         │  - Content Decryption                           │
         └───────────────────┬─────────────────────────────┘
                             │
                             │ 2. Request Protected Route
                             ▼
                     ┌───────────────┐
                     │   AI Agent    │
                     │  Client SDK   │
                     └───────┬───────┘
                             │
                             │ 3. Pay on Sui
                             │ 4. Get AccessPass
                             │ 5. Retry with Proof
                             │
                             ▼
                    ┌─────────────────┐
                    │ Decrypted Data  │
                    └─────────────────┘
```

### Core Components

1. **Registry Contract** ([registry.move](contracts/sources/registry.move)) - Maps domains and resources to encrypted Walrus content
2. **Paywall Contract** ([paywall.move](contracts/sources/paywall.move)) - Mints and manages AccessPass objects
3. **NPM Middleware** ([middleware.ts](packages/ai-paywall/src/middleware.ts)) - Integrates payment enforcement into Express apps
4. **Client SDK** ([client.ts](packages/ai-paywall/src/client.ts)) - Automates payment and access for AI agents
5. **Walrus Integration** ([walrus.ts](registry-app/lib/walrus.ts)) - Stores encrypted content on decentralized storage
6. **Seal Encryption** ([seal.ts](registry-app/lib/seal.ts)) - Encrypts content with cryptographic access control

---

## How It Works

### End-to-End Flow

**1. Content Registration**

Content owners upload premium data to the platform:

```typescript
// Registry registers: domain → resource → Walrus CID + Seal policy
// registry.move:116-177
public entry fun register_resource(
    registry: &mut Registry,
    domain: String,           // e.g., "www.example.com"
    resource: String,         // e.g., "/premium-data"
    walrus_cid: String,       // Encrypted blob ID on Walrus
    seal_policy: String,      // Seal policy ID (hex)
    price: u64,               // Price in MIST (1 SUI = 10^9 MIST)
    receiver: address,        // Payment recipient
    max_uses: u64,            // Uses per AccessPass
    validity_duration: u64,   // Pass lifetime (ms)
    clock: &Clock,
    ctx: &mut TxContext
)
```

The platform:
- Encrypts content using Seal ([seal.ts:60-90](registry-app/lib/seal.ts#L60-L90))
- Uploads encrypted blob to Walrus ([walrus.ts:51-224](registry-app/lib/walrus.ts#L51-L224))
- Registers metadata on Sui Registry contract

**2. Middleware Integration**

Website owners protect routes with the NPM middleware:

```javascript
const { paywall } = require("ai-paywall");

app.use("/premium", paywall({
  price: "0.1",                    // 0.1 SUI
  receiver: "0xYourWalletAddress", // Payment destination
  domain: "www.example.com"
}));
```

When an AI agent requests `/premium`, the middleware:
- Checks for signed headers ([middleware.ts:145-151](packages/ai-paywall/src/middleware.ts#L145-L151))
- Returns **402 Payment Required** if missing ([middleware.ts:218-250](packages/ai-paywall/src/middleware.ts#L218-L250))

**3. Payment Challenge**

Following the x402 protocol, the middleware responds with HTTP 402 Payment Required. The response includes payment details:

```json
{
  "status": 402,
  "paymentRequired": true,
  "price": "0.1",
  "priceInMist": "100000000",
  "receiver": "0xReceiverAddress",
  "packageId": "0xContractAddress",
  "domain": "www.example.com",
  "resource": "/premium",
  "nonce": "unique-challenge-id"
}
```

**4. Agent Purchases AccessPass**

The client SDK automates payment:

```javascript
const client = new PaywallClient({
  privateKey: "your_sui_private_key"
});

// One-line access (handles payment automatically)
const content = await client.access("http://example.com/premium");
```

Behind the scenes ([client.ts:560-728](packages/ai-paywall/src/client.ts#L560-L728)):
- Selects suitable coin for payment
- Splits coin if needed
- Calls `purchase_pass()` on Sui ([paywall.move:84-136](contracts/sources/paywall.move#L84-L136))
- Mints AccessPass object with payment proof

**5. AccessPass Minting**

The Sui contract creates an on-chain access token:

```move
// paywall.move:11-22
public struct AccessPass has key, store {
    id: UID,
    pass_id: u64,
    owner: address,           // Agent's wallet
    domain: String,           // "www.example.com"
    resource: String,         // "/premium"
    remaining: u64,           // Uses left
    expiry: u64,              // Expiration timestamp
    nonce: String,            // Challenge nonce
    price_paid: u64,          // Amount paid in MIST
}
```

Payment goes directly to the content owner's address ([paywall.move:99](contracts/sources/paywall.move#L99)):

```move
transfer::public_transfer(coin::from_balance(coin::into_balance(payment), ctx), receiver);
```

**6. Authenticated Access**

Agent retries with signed headers ([client.ts:941-976](packages/ai-paywall/src/client.ts#L941-L976)):

```
GET /premium HTTP/1.1
Host: www.example.com
x-pass-id: 0xAccessPassObjectId
x-signer: 0xAgentWalletAddress
x-sig: base64_signature
x-ts: timestamp_ms
```

**7. Verification & Decryption**

Middleware validates the request ([middleware.ts:254-531](packages/ai-paywall/src/middleware.ts#L254-L531)):

1. **Fetch AccessPass** from Sui blockchain ([sui.ts](packages/ai-paywall/src/utils/sui.ts))
2. **Verify ownership**: `accessPass.owner === signer` ([middleware.ts:335-338](packages/ai-paywall/src/middleware.ts#L335-L338))
3. **Check domain/resource match** ([middleware.ts:342-347](packages/ai-paywall/src/middleware.ts#L342-L347))
4. **Validate expiry and remaining uses** ([middleware.ts:349-365](packages/ai-paywall/src/middleware.ts#L349-L365))
5. **Verify signature** ([signature.ts](packages/ai-paywall/src/utils/signature.ts))
6. **Fetch encrypted blob** from Walrus ([decryption.ts:267-269](packages/ai-paywall/src/utils/decryption.ts#L267-L269))
7. **Decrypt content** using Seal ([decryption.ts:158-261](packages/ai-paywall/src/utils/decryption.ts#L158-L261))

**8. Content Delivery**

Middleware serves decrypted content to agent. Usage is tracked on-chain:

```move
// paywall.move:140-164
public entry fun consume_pass(
    pass: &mut AccessPass,
    ctx: &mut TxContext,
) {
    assert!(pass.owner == sender, 3);
    assert!(pass.remaining > 0, 2);
    pass.remaining = pass.remaining - 1;

    event::emit(PassConsumed {
        pass_id,
        remaining_after: new_remaining,
    });
}
```

---

## Implementation Deep Dive

### Sui Move Contracts

#### Registry Contract

**Location**: [contracts/sources/registry.move](contracts/sources/registry.move)

The registry maintains a nested mapping structure:

```move
// registry.move:28-36
public struct Registry has key {
    id: UID,
    resources: Table<String, Table<String, ID>>,  // domain → resource → ResourceEntry ID
    admin: address,
    platform_fee_bps: u64,  // Basis points (250 = 2.5%)
    treasury: address,
}
```

Each resource entry stores encryption metadata:

```move
// registry.move:39-53
public struct ResourceEntry has key, store {
    id: UID,
    domain: String,
    resource: String,
    walrus_cid: String,           // Walrus blob ID
    seal_policy: String,          // Policy ID (hex)
    seal_policy_bytes: vector<u8>, // Policy ID (bytes)
    price: u64,
    receiver: address,
    max_uses: u64,
    validity_duration: u64,
    owner: address,
    created_at: u64,
    active: bool,
}
```

**Seal Integration**: The registry enforces decryption access control through `seal_approve` ([registry.move:422-429](contracts/sources/registry.move#L422-L429)):

```move
entry fun seal_approve(
    id: vector<u8>,              // Policy ID (37 bytes)
    resource_entry: &ResourceEntry,
    access_pass: &AccessPass,
    clock: &Clock
) {
    assert!(is_access_valid(id, resource_entry, access_pass, clock), E_NO_ACCESS);
}
```

This function is called by Seal key servers before releasing decryption keys. It verifies:
- Resource is active ([registry.move:385-387](contracts/sources/registry.move#L385-L387))
- Policy ID matches ([registry.move:392-394](contracts/sources/registry.move#L392-L394))
- AccessPass domain/resource match ([registry.move:397-402](contracts/sources/registry.move#L397-L402))
- Pass has remaining uses ([registry.move:405-408](contracts/sources/registry.move#L405-L408))
- Pass hasn't expired ([registry.move:411-415](contracts/sources/registry.move#L411-L415))

#### Paywall Contract

**Location**: [contracts/sources/paywall.move](contracts/sources/paywall.move)

Handles AccessPass lifecycle:

**Purchase** ([paywall.move:84-136](contracts/sources/paywall.move#L84-L136)):
```move
public entry fun purchase_pass(
    payment: Coin<SUI>,
    domain: vector<u8>,
    resource: vector<u8>,
    remaining: u64,
    expiry: u64,
    nonce: vector<u8>,
    receiver: address,
    counter: &mut PassCounter,
    ctx: &mut TxContext,
)
```

**Consumption** ([paywall.move:140-164](contracts/sources/paywall.move#L140-L164)):
```move
public entry fun consume_pass(
    pass: &mut AccessPass,
    ctx: &mut TxContext,
)
```

AccessPass is created as a **shared object** ([paywall.move:135](contracts/sources/paywall.move#L135)) to allow multiple uses from the same pass.

### Walrus Integration

**Location**: [registry-app/lib/walrus.ts](registry-app/lib/walrus.ts)

Walrus provides decentralized storage for encrypted content. The implementation uses HTTP PUT requests to Walrus publishers:

```typescript
// walrus.ts:71-77
const response = await fetch(`${publisherUrl}/v1/blobs?epochs=${epochs}`, {
  method: 'PUT',
  body: encryptedData,
  headers: {
    'Content-Type': 'application/octet-stream',
  },
})
```

**Publisher URLs** ([walrus.ts:28-42](registry-app/lib/walrus.ts#L28-L42)):
- `https://publisher.walrus-testnet.walrus.space`
- `https://walrus-testnet-publisher.nodes.guru`
- `https://walrus-testnet-publisher.everstake.one`

**Response handling** ([walrus.ts:154-202](registry-app/lib/walrus.ts#L154-L202)):
```typescript
const info = responseData.info || responseData
let blobId: string

if (info.newlyCreated) {
  blobId = info.newlyCreated.blobObject?.blobId
} else if (info.alreadyCertified) {
  blobId = info.alreadyCertified.blobId
}
```

**Retrieval** ([decryption.ts:86-117](packages/ai-paywall/src/utils/decryption.ts#L86-L117)):
```typescript
const aggregators = [
  'https://aggregator.walrus-testnet.walrus.space',
  'https://walrus-testnet-aggregator.nodes.guru',
]

const url = `${aggregator}/v1/blobs/${walrusCid}`
const response = await fetch(url)
return await response.arrayBuffer()
```

### Seal Encryption

**Location**: [registry-app/lib/seal.ts](registry-app/lib/seal.ts), [packages/ai-paywall/src/utils/decryption.ts](packages/ai-paywall/src/utils/decryption.ts)

Seal provides threshold encryption with key servers.

**Encryption** ([seal.ts:60-90](registry-app/lib/seal.ts#L60-L90)):
```typescript
const result = await client.encrypt({
  threshold: 2,         // Requires 2 out of N key servers
  packageId,            // Sui package ID
  id,                   // Policy ID (37 bytes hex)
  data,                 // Content to encrypt
})
```

**Key Servers** ([seal.ts:6-9](registry-app/lib/seal.ts#L6-L9)):
```typescript
const DEFAULT_SERVER_OBJECT_IDS = [
  "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
  "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
]
```

**Decryption Flow** ([client.ts:1095-1281](packages/ai-paywall/src/client.ts#L1095-L1281)):

1. Parse encrypted object to extract policy ID:
```typescript
const encryptedObject = EncryptedObject.parse(encryptedData)
const policyId = encryptedObject.id
```

2. Create and sign session key:
```typescript
const sessionKey = await SessionKey.create({
  address: userAddress,
  packageId: packageId,
  ttlMin: 10,
})
const signature = await keypair.signPersonalMessage(personalMessage)
await sessionKey.setPersonalMessageSignature(signature)
```

3. Build transaction calling `seal_approve`:
```typescript
tx.moveCall({
  target: `${packageId}::registry::seal_approve`,
  arguments: [
    tx.pure.vector("u8", Array.from(fromHex(policyId))),
    tx.object(resourceEntryId),
    tx.object(accessPassId),
    tx.object("0x6"),  // Clock
  ],
})
```

4. Fetch decryption keys from Seal servers:
```typescript
await sealClient.fetchKeys({
  ids: [policyIdHex],
  txBytes,
  sessionKey,
  threshold: 2,
})
```

5. Decrypt content:
```typescript
const decryptedData = await sealClient.decrypt({
  data: encryptedData,
  sessionKey,
  txBytes,  // Must match fetchKeys txBytes
})
```

The `txBytes` must be identical between `fetchKeys` and `decrypt` calls for nonce verification.

### NPM Middleware

**Location**: [packages/ai-paywall/src/middleware.ts](packages/ai-paywall/src/middleware.ts)

The middleware integrates into Express applications:

**Configuration** ([middleware.ts:36-63](packages/ai-paywall/src/middleware.ts#L36-L63)):
```typescript
export function paywall(options: PaywallOptions) {
  const normalizedOptions = {
    price: options.price,
    receiver: options.receiver,
    domain: options.domain,
    resourceEntryId: options.resourceEntryId,  // Optional cache
    packageId: contractConfig.packageId,
    passCounterId: contractConfig.passCounterId,
    rpcUrl: contractConfig.rpcUrl,
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    // Middleware logic
  }
}
```

**Request Flow** ([middleware.ts:65-212](packages/ai-paywall/src/middleware.ts#L65-L212)):

1. Extract resource path from request
2. Check for authentication headers (`x-pass-id`, `x-signer`, `x-sig`, `x-ts`)
3. If missing → Send 402 Payment Required
4. If present → Verify access and serve content

**402 Challenge Generation** ([middleware.ts:218-250](packages/ai-paywall/src/middleware.ts#L218-L250)):
```typescript
const challenge: PaymentChallenge = {
  status: 402,
  paymentRequired: true,
  price: options.price,
  priceInMist: convertSuiToMist(options.price),
  receiver: options.receiver,
  packageId: options.packageId,
  domain: options.domain,
  resource: resource,
  nonce: generateNonce(),
}
```

**Access Verification** ([middleware.ts:254-531](packages/ai-paywall/src/middleware.ts#L254-L531)):
```typescript
// Fetch AccessPass from Sui
const accessPass = await fetchAccessPass(passId, packageId, rpcUrl)

// Verify owner
assert(verifyOwner(accessPass.owner, signer))

// Verify domain/resource
assert(matchesAccessPass(accessPass, domain, resource))

// Verify validity
assert(isAccessPassValid(accessPass))

// Verify signature
assert(await verifySignature(passId, domain, resource, timestamp, signer, signature))

// Fetch and decrypt content
const resourceEntry = await fetchResourceEntry(registryId, domain, resource)
const encryptedBlob = await fetchEncryptedBlob(resourceEntry.walrus_cid)
const decrypted = await decryptContent({ ... })

// Serve content
res.send(Buffer.from(decrypted))
```

### Client SDK

**Location**: [packages/ai-paywall/src/client.ts](packages/ai-paywall/src/client.ts)

The SDK provides automated payment handling:

**Initialization** ([client.ts:34-79](packages/ai-paywall/src/client.ts#L34-L79)):
```typescript
const client = new PaywallClient({
  privateKey: "suiprivkey1..."  // Supports bech32, base64, or hex
})
```

**One-Line Access** ([client.ts:858-1068](packages/ai-paywall/src/client.ts#L858-L1068)):
```typescript
// Automatically handles payment and returns content
const content = await client.access(url)
```

**Smart Coin Handling** ([client.ts:253-485](packages/ai-paywall/src/client.ts#L253-L485)):

The SDK automatically:
- Queries all coins owned by wallet ([client.ts:253-274](packages/ai-paywall/src/client.ts#L253-L274))
- Selects optimal coin for payment ([client.ts:280-303](packages/ai-paywall/src/client.ts#L280-L303))
- Splits coin if necessary ([client.ts:310-485](packages/ai-paywall/src/client.ts#L310-L485))
- Handles single-coin edge case by splitting from gas coin ([client.ts:339](packages/ai-paywall/src/client.ts#L339))

**Pass Reuse** ([client.ts:82-210](packages/ai-paywall/src/client.ts#L82-L210)):

Clients can reuse existing AccessPasses:
```typescript
const existingPass = await client.findExistingAccessPass(domain, resource)
if (existingPass) {
  // Use existing pass instead of purchasing new one
}
```

**Automatic Decryption** ([client.ts:858-1068](packages/ai-paywall/src/client.ts#L858-L1068)):
```typescript
const decrypted = await client.access(url, {
  autoDecrypt: {
    domain: "www.example.com",
    resource: "/premium",
  }
})
```

---

## Getting Started

### Installation

```bash
npm install ai-paywall
```

### Content Owner Setup

**1. Register Resource**

Upload content to the platform (via web UI or API):
- Content gets encrypted with Seal
- Encrypted blob stored on Walrus
- Metadata registered on Sui blockchain

**2. Protect Routes**

Integrate middleware into your Express server:

```javascript
const express = require("express");
const { paywall } = require("ai-paywall");

const app = express();

app.use("/premium-data", paywall({
  price: "0.1",                    // Price in SUI
  receiver: "0xYourWalletAddress", // Where payments go
  domain: "api.example.com"
}));

app.listen(3000);
```

### AI Agent Integration

**Basic Access**

```javascript
const { PaywallClient } = require("ai-paywall");

const client = new PaywallClient({
  privateKey: process.env.SUI_PRIVATE_KEY
});

// One line - handles everything
const content = await client.access("https://api.example.com/premium-data");
```

**With Auto-Decryption**

```javascript
const decrypted = await client.access(url, {
  autoDecrypt: {
    domain: "api.example.com",
    resource: "/premium-data"
  }
});
```

**Manual Flow**

```javascript
// 1. Request protected route
const response = await fetch(url);

// 2. Get 402 challenge
if (response.status === 402) {
  const challenge = await response.json();

  // 3. Purchase AccessPass
  const passId = await client.purchaseAccessPass({
    price: challenge.price,
    domain: challenge.domain,
    resource: challenge.resource,
    remaining: 10,
    expiry: 0,
    nonce: challenge.nonce,
    receiver: challenge.receiver,
  });

  // 4. Sign headers
  const timestamp = Date.now().toString();
  const signature = await client.signMessage(passId, challenge.domain, challenge.resource, timestamp);

  // 5. Retry with proof
  const contentResponse = await fetch(url, {
    headers: {
      'x-pass-id': passId,
      'x-signer': client.keypair.toSuiAddress(),
      'x-sig': signature,
      'x-ts': timestamp,
    }
  });

  const content = await contentResponse.arrayBuffer();
}
```

---

## Technical Specifications

### Blockchain

- **Network**: Sui Testnet (production deployment targets mainnet)
- **Package ID**: `0xde39d60a86cd9937907be1c7bcba1f1755860a1298b3f8eb9e1883cf1a0e34ce`
- **Contracts**:
  - Registry: [contracts/sources/registry.move](contracts/sources/registry.move)
  - Paywall: [contracts/sources/paywall.move](contracts/sources/paywall.move)
- **Payment Token**: SUI (native token)
- **Precision**: 1 SUI = 1,000,000,000 MIST

### Storage

- **Provider**: Walrus Decentralized Storage Network
- **Testnet Aggregators**:
  - `aggregator.walrus-testnet.walrus.space`
  - `walrus-testnet-aggregator.nodes.guru`
- **Storage Duration**: Configurable epochs (default: 1 epoch)

### Encryption

- **Method**: Threshold Encryption (Seal)
- **Threshold**: 2-of-N key servers
- **Key Servers**: Sui-operated testnet servers
- **Policy**: Per-resource cryptographic policies enforced on-chain

### Middleware

- **Framework**: Express.js
- **Protocol**: x402 Payment Protocol
- **Response Codes**:
  - `402 Payment Required` - x402 protocol payment challenge (no valid AccessPass)
  - `200 OK` - Access granted, content served
  - `403 Forbidden` - Invalid or expired pass
- **Headers**:
  - `x-pass-id` - AccessPass object ID
  - `x-signer` - Agent wallet address
  - `x-sig` - Signature of payment proof
  - `x-ts` - Request timestamp

### SDK

- **Language**: TypeScript/JavaScript
- **Runtime**: Node.js 16+
- **Dependencies**:
  - `@mysten/sui` - Sui blockchain client
  - `@mysten/seal` - Seal encryption
- **Key Format Support**: Sui bech32, Base64, Hexadecimal

---

## Project Structure

```
scrape2sui/
├── contracts/
│   └── sources/
│       ├── registry.move        # Registry contract (domain → resource → content)
│       └── paywall.move         # AccessPass minting and consumption
├── packages/
│   └── ai-paywall/
│       ├── src/
│       │   ├── middleware.ts    # Express middleware
│       │   ├── client.ts        # AI agent SDK
│       │   ├── types.ts         # TypeScript definitions
│       │   ├── errors.ts        # Error classes
│       │   └── utils/
│       │       ├── sui.ts       # Sui blockchain utilities
│       │       ├── signature.ts # Signature verification
│       │       ├── decryption.ts # Seal decryption
│       │       └── validation.ts # Input validation
│       └── example/
│           ├── new-server-example.js   # Server integration
│           └── new-client-example.js   # Client usage
└── registry-app/
    └── lib/
        ├── sui.ts               # Sui client utilities
        ├── walrus.ts            # Walrus storage integration
        └── seal.ts              # Seal encryption utilities
```

---

## Security Considerations

### On-Chain Verification

All access control is enforced on-chain:
- AccessPass ownership verified via Sui RPC ([middleware.ts:299-331](packages/ai-paywall/src/middleware.ts#L299-L331))
- Domain/resource matching checked against blockchain state ([middleware.ts:342-347](packages/ai-paywall/src/middleware.ts#L342-L347))
- Remaining uses tracked immutably ([paywall.move:157](contracts/sources/paywall.move#L157))

### Signature Security

Request signatures prevent replay attacks:
- Timestamp included in signed message ([client.ts:735-736](packages/ai-paywall/src/client.ts#L735-L736))
- Personal message signing prevents transaction malleability ([client.ts:740](packages/ai-paywall/src/client.ts#L740))
- Signature verification uses Ed25519 ([signature.ts](packages/ai-paywall/src/utils/signature.ts))

### Encryption Security

Content remains encrypted until payment verified:
- Seal threshold encryption (2-of-N) ([seal.ts:64](registry-app/lib/seal.ts#L64))
- Key release requires `seal_approve` verification ([registry.move:422-429](contracts/sources/registry.move#L422-L429))
- Policy ID embedded in encrypted object ([client.ts:1118](packages/ai-paywall/src/client.ts#L1118))

### Payment Security

Payments go directly to content owner:
- No intermediary custody ([paywall.move:99](contracts/sources/paywall.move#L99))
- Platform fee configurable ([registry.move:106](contracts/sources/registry.move#L106))
- Treasury address updatable by admin only ([registry.move:276-283](contracts/sources/registry.move#L276-L283))

---

## Performance

### Latency

- **AccessPass Purchase**: ~2-3 seconds (includes coin splitting, transaction confirmation)
- **Verification**: ~500ms (RPC call to fetch AccessPass state)
- **Decryption**: ~1-2 seconds (Seal key fetch + decryption)
- **Total First Access**: ~4-6 seconds
- **Subsequent Access** (reusing pass): ~2-3 seconds

### Throughput

- **Sui TPS**: 297,000+ theoretical (real-world: ~1,000 TPS)
- **Walrus Bandwidth**: Optimized for large blobs (GB-scale)
- **Middleware**: Bound by Express.js limits (~5,000 req/s per instance)

### Cost

- **AccessPass Purchase**: ~0.001 SUI gas fee + content price
- **Consumption**: ~0.0005 SUI gas fee
- **Walrus Storage**: ~0.0001 SUI per KB per epoch
- **Seal Encryption**: Free (computation only)

---

## Roadmap

### Current (v1.0)

- ✅ Sui Move contracts deployed on testnet
- ✅ Express middleware with 402 enforcement
- ✅ Client SDK with automatic payment
- ✅ Walrus integration for encrypted storage
- ✅ Seal encryption/decryption

### Upcoming (v1.1)

- [ ] Mainnet deployment
- [ ] Multi-chain support (Ethereum L2s via bridge)
- [ ] Usage analytics dashboard
- [ ] Bulk AccessPass purchasing
- [ ] Content versioning

### Future (v2.0)

- [ ] Subscription-based AccessPasses
- [ ] Dynamic pricing based on demand
- [ ] Pass transferability (secondary market)
- [ ] Off-chain signature verification (layer 2)
- [ ] Integration with AI platforms (OpenAI, Anthropic APIs)

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/improvement`)
3. Commit changes (`git commit -am 'Add new feature'`)
4. Push to branch (`git push origin feature/improvement`)
5. Open a Pull Request

### Development Setup

```bash
# Clone repository
git clone https://github.com/technicalclipper/scrape2sui.git
cd scrape2sui

# Install dependencies
npm install

# Build contracts
cd contracts
sui move build

# Build middleware package
cd ../packages/ai-paywall
npm run build

# Run tests
npm test
```

---

## License

ISC License - see [LICENSE](LICENSE) for details.

---

## Links

- **x402 Protocol**: [x402.org](https://www.x402.org)
- **NPM Package**: [ai-paywall](https://www.npmjs.com/package/ai-paywall)
- **GitHub**: [technicalclipper/scrape2sui](https://github.com/technicalclipper/scrape2sui)
- **Documentation**: [sui2scrape.vercel.app](https://sui2scrape.vercel.app/)
- **Sui Blockchain**: [sui.io](https://sui.io)
- **Walrus Storage**: [walrus.xyz](https://walrus.xyz)
- **Seal Encryption**: [mystenlabs/seal](https://github.com/MystenLabs/seal)

---

## Support

For issues, questions, or feature requests:

- Open an issue: [GitHub Issues](https://github.com/technicalclipper/scrape2sui/issues)
---

**Built with**  **Sui** •  **Walrus** •  **Seal**
