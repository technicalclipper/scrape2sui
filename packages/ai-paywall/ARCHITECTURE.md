# System Architecture Overview

This document explains how the ai-paywall system works end-to-end, including all client and server components.

## 🏗️ System Components

The system consists of **4 main components**:

1. **Registry App** (Server-side) - Content registration and encryption
2. **Paywall Middleware** (Server-side) - Access control and content delivery
3. **PaywallClient** (Client-side) - Payment and content access
4. **Sui Blockchain** - AccessPass management and registry storage
5. **Walrus Storage** - Encrypted content storage
6. **Seal Encryption** - Content encryption/decryption

---

## 📋 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTENT REGISTRATION FLOW                     │
└─────────────────────────────────────────────────────────────────┘

Content Owner → Registry App → Seal Encryption → Walrus Storage → Sui Registry
     │              │               │                  │              │
     │          1. Upload          │                  │              │
     │         Content File        │                  │              │
     │              │               │                  │              │
     │              │           2. Encrypt            │              │
     │              │         with Seal SDK           │              │
     │              │               │                  │              │
     │              │               │           3. Upload            │
     │              │               │         to Walrus (HTTP)       │
     │              │               │                  │              │
     │              │               │                  │        4. Register
     │              │               │                  │      ResourceEntry
     │              │               │                  │      on Sui (on-chain)
     │              │               │                  │              │
     └──────────────┴───────────────┴──────────────────┴──────────────┘
                          Returns: ResourceEntry ID, Seal Policy ID, Walrus Blob ID


┌─────────────────────────────────────────────────────────────────┐
│                      CONTENT ACCESS FLOW                         │
└─────────────────────────────────────────────────────────────────┘

AI Bot/Client → Paywall Middleware → Sui Blockchain → Walrus → Seal Decryption
     │                 │                   │              │           │
     │           1. Request               │              │           │
     │         (no headers)               │              │           │
     │                 │                   │              │           │
     │                 │           2. Check Headers      │           │
     │                 │         (x-pass-id, x-sig, etc) │           │
     │                 │                   │              │           │
     │           3. Return 402            │              │           │
     │         Payment Required           │              │           │
     │                 │                   │              │           │
     │           4. Purchase              │              │           │
     │         AccessPass                 │              │           │
     │         (on-chain)                 │              │           │
     │                 │                   │              │           │
     │           5. Sign Headers          │              │           │
     │         (x-pass-id, x-sig)         │              │           │
     │                 │                   │              │           │
     │           6. Request               │              │           │
     │         (with headers)             │              │           │
     │                 │                   │              │           │
     │                 │           7. Verify AccessPass  │           │
     │                 │         (exists? valid? owner?) │           │
     │                 │                   │              │           │
     │                 │           8. Fetch ResourceEntry│           │
     │                 │         (get walrus_cid, seal_policy)       │
     │                 │                   │              │           │
     │           9. Fetch Encrypted       │              │           │
     │         Content from Walrus        │              │           │
     │                 │                   │              │           │
     │          10. Return Encrypted      │              │           │
     │         Blob to Client             │              │           │
     │                 │                   │              │           │
     │          11. Decrypt Content       │              │           │
     │         using Seal SDK             │              │           │
     │         (client-side or server-side)             │           │
     │                 │                   │              │           │
     └─────────────────┴───────────────────┴──────────────┴───────────┘
```

---

## 🔐 Component Details

### 1. Registry App (Content Registration)

**Purpose**: Website where content owners register and encrypt their content.

**Location**: `registry-app/`

**Key Files**:
- `app/api/registry/register/route.ts` - API endpoint for registration
- `lib/seal.ts` - Seal encryption utilities
- `lib/walrus.ts` - Walrus upload utilities

**Registration Flow**:

1. **Content Upload**
   ```typescript
   // User uploads file (image, video, document, etc.)
   const file = formData.get('file')
   ```

2. **Encryption with Seal**
   ```typescript
   // Create Seal client
   const sealClient = createSealClient(packageId, rpcUrl, threshold)
   
   // Encrypt content
   const encryptedData = await sealClient.encrypt({
     data: fileBuffer,
     policyId: sealPolicyId, // Generated by Seal
     packageId: packageId,
   })
   ```
   - Seal creates an `EncryptedObject` with:
     - `packageId`: Sui package ID (32 bytes)
     - `id`: Policy ID (37 bytes: 32-byte base + 5-byte nonce)
     - Encrypted content bytes
     - Threshold (number of key servers needed)

3. **Upload to Walrus**
   ```typescript
   // HTTP PUT request to Walrus publisher
   const response = await fetch(`${publisherUrl}/v1/blobs?epochs=1`, {
     method: 'PUT',
     body: encryptedData,
     headers: { 'Content-Type': 'application/octet-stream' },
   })
   ```
   - Returns: `blobId` (used to retrieve content later)

4. **Register on Sui Blockchain**
   ```typescript
   // Call Move function: registry::register_resource
   tx.moveCall({
     target: `${packageId}::registry::register_resource`,
     arguments: [
       domain,           // e.g., "www.example.com"
       resource,         // e.g., "/premium/content"
       walrusCid,        // Walrus blob ID
       sealPolicy,       // Seal policy ID (hex string)
       sealPolicyBytes,  // Policy ID as bytes
       price,            // Price in MIST (1 SUI = 10^9 MIST)
       receiver,         // Address that receives payments
       maxUses,          // Maximum uses per AccessPass
       validityDuration, // Validity duration in milliseconds
     ],
   })
   ```
   - Creates a `ResourceEntry` object on-chain
   - Returns: `resourceEntryId` (object ID)

**Result**: Content is encrypted, stored on Walrus, and metadata is registered on Sui.

---

### 2. Paywall Middleware (Access Control)

**Purpose**: Express middleware that protects routes behind payments.

**Location**: `packages/ai-paywall/src/middleware.ts`

**How It Works**:

#### Request Flow:

1. **Request Arrives** (no headers)
   ```javascript
   GET /premium/content
   ```

2. **Middleware Checks Headers**
   ```typescript
   const hasHeaders = hasRequiredHeaders(req)
   // Checks for: x-pass-id, x-signer, x-sig, x-ts
   ```

3. **No Headers → Return 402 Payment Required**
   ```json
   {
     "status": 402,
     "paymentRequired": true,
     "price": "0.01",
     "domain": "www.example.com",
     "resource": "/premium/content",
     "nonce": "unique-nonce",
     "receiver": "0x...",
     "packageId": "0x...",
     "treasuryId": "0x...",
     "passCounterId": "0x..."
   }
   ```

4. **With Headers → Verify AccessPass**
   ```typescript
   // Fetch AccessPass from Sui blockchain
   const accessPass = await fetchAccessPass(passId, packageId, rpcUrl)
   
   // Verify:
   // 1. AccessPass exists on-chain
   // 2. Owner matches signer (x-signer header)
   // 3. Domain/resource matches
   // 4. Not expired
   // 5. Has remaining uses
   // 6. Signature is valid
   ```

5. **Valid AccessPass → Fetch Content**
   ```typescript
   // Get ResourceEntry from registry
   const resourceEntry = await fetchResourceEntry(
     registryId,
     packageId,
     domain,
     resource,
     rpcUrl
   )
   
   // Fetch encrypted blob from Walrus
   const encryptedBlob = await fetchFromWalrus(resourceEntry.walrus_cid)
   
   // Return to client (client decrypts)
   // OR decrypt server-side if SessionKey provided
   ```

**Key Features**:
- ✅ Verifies AccessPass on-chain (no database needed!)
- ✅ Validates signatures to prevent forgery
- ✅ Checks expiry and remaining uses
- ✅ Fetches encrypted content from Walrus
- ✅ Optional server-side decryption

---

### 3. PaywallClient (Client SDK)

**Purpose**: Client library for AI bots to access protected content.

**Location**: `packages/ai-paywall/src/client.ts`

**Key Methods**:

#### `access(url)` - One-line access

```javascript
const content = await client.access('http://example.com/premium')
```

**What it does automatically**:

1. **Make Request**
   ```typescript
   const response = await fetch(url)
   ```

2. **Handle 402 Payment Required**
   ```typescript
   if (response.status === 402) {
     const challenge = await response.json()
     
     // Check for existing AccessPass
     let accessPassId = await this.findExistingAccessPass(
       challenge.domain,
       challenge.resource
     )
     
     // Purchase if needed
     if (!accessPassId) {
       accessPassId = await this.purchaseAccessPass({
         price: challenge.price,
         domain: challenge.domain,
         resource: challenge.resource,
         nonce: challenge.nonce,
         receiver: challenge.receiver,
       })
     }
     
     // Sign headers
     const signature = await this.signMessage(
       accessPassId,
       challenge.domain,
       challenge.resource,
       timestamp
     )
     
     // Retry request with headers
     const authenticatedResponse = await fetch(url, {
       headers: {
         'x-pass-id': accessPassId,
         'x-signer': this.address,
         'x-sig': signature,
         'x-ts': timestamp,
       },
     })
   }
   ```

3. **Return Content**
   - Encrypted blob (ArrayBuffer) or
   - Decrypted content (if `autoDecrypt` option used)

#### `decrypt(encryptedBlob, resourceEntryId, accessPassId)` - Decrypt content

```javascript
const decrypted = await client.decrypt(encryptedBlob, resourceEntryId, accessPassId)
```

**What it does**:

1. **Parse EncryptedObject**
   ```typescript
   const encryptedObject = EncryptedObject.parse(encryptedBlob)
   const policyId = encryptedObject.id // 37-byte policy ID
   ```

2. **Create SessionKey**
   ```typescript
   const sessionKey = await SessionKey.create({
     address: userAddress,
     packageId: packageId,
     ttlMin: 10,
     suiClient: suiClient,
   })
   
   // Sign SessionKey with wallet
   const signature = await keypair.signPersonalMessage(
     sessionKey.getPersonalMessage()
   )
   await sessionKey.setPersonalMessageSignature(signature)
   ```

3. **Build seal_approve Transaction**
   ```typescript
   tx.moveCall({
     target: `${packageId}::registry::seal_approve`,
     arguments: [
       tx.pure.vector("u8", policyIdBytes), // Policy ID (37 bytes)
       tx.object(resourceEntryId),          // ResourceEntry object
       tx.object(accessPassId),             // AccessPass object
       tx.object("0x6"),                    // Clock
     ],
   })
   const txBytes = await tx.build({ onlyTransactionKind: true })
   ```

4. **Fetch Decryption Keys**
   ```typescript
   await sealClient.fetchKeys({
     ids: [policyIdHex], // Policy ID as hex string
     txBytes,            // Transaction bytes
     sessionKey,         // Signed SessionKey
     threshold: 2,       // Number of key servers needed
   })
   ```

5. **Decrypt Content**
   ```typescript
   const decryptedData = await sealClient.decrypt({
     data: encryptedBlob,
     sessionKey,
     txBytes, // MUST be same txBytes as fetchKeys!
   })
   ```

**Key Points**:
- ✅ Handles coin splitting automatically
- ✅ Purchases AccessPass on-chain
- ✅ Signs headers for authentication
- ✅ Decrypts content using Seal
- ✅ Reuses same `txBytes` for `fetchKeys` and `decrypt` (critical!)

---

### 4. Sui Blockchain (On-Chain Components)

**Purpose**: Store AccessPasses and ResourceEntry registry.

**Location**: `contracts/sources/`

#### Registry Contract (`registry.move`)

**ResourceEntry Object**:
```move
public struct ResourceEntry has key, store {
    id: UID,
    domain: String,              // "www.example.com"
    resource: String,            // "/premium/content"
    walrus_cid: String,          // Walrus blob ID
    seal_policy: String,         // Seal policy ID (hex)
    seal_policy_bytes: vector<u8>, // Policy ID as bytes
    price: u64,                  // Price in MIST
    receiver: address,           // Payment receiver
    max_uses: u64,               // Max uses per pass
    validity_duration: u64,      // Validity in milliseconds
    owner: address,              // Resource owner
    created_at: u64,             // Timestamp
    active: bool,                // Active status
}
```

**seal_approve Function**:
```move
public entry fun seal_approve(
    id: vector<u8>,              // Policy ID (37 bytes)
    resource_entry: &ResourceEntry,
    access_pass: &AccessPass,
    clock: &Clock,
    ctx: &mut TxContext
)
```

- Verifies AccessPass is valid for this resource
- Checks domain/resource match
- Checks expiry and remaining uses
- Called by Seal key servers to authorize decryption

#### Paywall Contract (`paywall.move`)

**AccessPass Object**:
```move
public struct AccessPass has key, store {
    id: UID,
    pass_id: u64,                // Unique pass ID
    owner: address,              // Pass owner
    domain: String,              // Domain this pass is for
    resource: String,            // Resource path
    remaining: u64,              // Remaining uses
    expiry: u64,                 // Expiry timestamp
    nonce: vector<u8>,           // Nonce for replay protection
    price_paid: u64,             // Price paid in MIST
}
```

**Key Functions**:
- `purchase_pass()` - Create new AccessPass
- `consume_pass()` - Decrement remaining uses
- `get_access_pass_*()` - Read AccessPass fields

---

### 5. Walrus Storage (Encrypted Content)

**Purpose**: Decentralized storage for encrypted content.

**How It Works**:

1. **Upload** (HTTP PUT)
   ```
   PUT https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=1
   Content-Type: application/octet-stream
   
   [encrypted bytes]
   ```

2. **Response**
   ```json
   {
     "info": {
       "newlyCreated": {
         "blobId": "wqwm17mRGo5PkXPo5p_I-RXtNIH4kdM-UnPVksBQ5lY",
         "blobObject": { ... }
       }
     }
   }
   ```

3. **Retrieve** (HTTP GET)
   ```
   GET https://aggregator.walrus-testnet.walrus.space/v1/blobs/{blobId}
   ```

**Features**:
- ✅ Distributed storage (multiple publishers)
- ✅ Content-addressable (blob ID = content hash)
- ✅ Decentralized (no single point of failure)

---

### 6. Seal Encryption (Zero-Knowledge Encryption)

**Purpose**: Zero-knowledge encryption where key servers can't see content.

**How It Works**:

1. **Encryption** (Registry App)
   ```typescript
   // Create policy with threshold (e.g., 2 of 3 servers needed)
   const encrypted = await sealClient.encrypt({
     data: contentBytes,
     policyId: customPolicyId, // Or auto-generated
     packageId: packageId,
   })
   ```
   - Creates `EncryptedObject` with encrypted content
   - Policy ID = 32-byte base + 5-byte nonce = 37 bytes
   - Threshold determines how many key servers needed

2. **Decryption** (PaywallClient)
   ```typescript
   // Create SessionKey (time-limited access)
   const sessionKey = await SessionKey.create({
     address: userAddress,
     packageId: packageId,
     ttlMin: 10, // 10 minutes
   })
   
   // Sign SessionKey with wallet
   await sessionKey.setPersonalMessageSignature(signature)
   
   // Build seal_approve transaction (authorizes decryption)
   const txBytes = await buildSealApproveTransaction(...)
   
   // Fetch keys from Seal key servers
   await sealClient.fetchKeys({
     ids: [policyIdHex],
     txBytes,
     sessionKey,
   })
   
   // Decrypt (uses same txBytes!)
   const decrypted = await sealClient.decrypt({
     data: encryptedBlob,
     sessionKey,
     txBytes, // Critical: same as fetchKeys!
   })
   ```

**Key Features**:
- ✅ Zero-knowledge (key servers never see content)
- ✅ Threshold cryptography (e.g., 2 of 3 servers)
- ✅ On-chain authorization (seal_approve function)
- ✅ Time-limited access (SessionKey TTL)

---

## 🔄 Complete Flow Example

### Step 1: Content Owner Registers Content

```javascript
// 1. Upload file to registry-app
POST /api/registry/register
FormData: { file: File, domain: "...", resource: "...", price: "0.01" }

// 2. Server encrypts with Seal
const encrypted = await sealClient.encrypt({ data: fileBuffer })

// 3. Upload to Walrus
const walrusResult = await uploadToWalrus({ encryptedData: encrypted })

// 4. Register on Sui
await registerResourceOnChain({
  domain, resource, walrusCid: walrusResult.blobId,
  sealPolicy: policyId, price, receiver, ...
})

// 5. Return ResourceEntry ID
{ resourceEntryId: "0x...", sealPolicyId: "...", walrusBlobId: "..." }
```

### Step 2: AI Bot Accesses Content

```javascript
// 1. Initialize client
const client = new PaywallClient({ privateKey: "..." })

// 2. Access protected route (automatic!)
const encryptedBlob = await client.access("http://example.com/premium")

// What happened:
// - Request → 402 Payment Required
// - Purchase AccessPass on-chain
// - Sign headers
// - Retry request → 200 OK (encrypted blob)

// 3. Decrypt content
const decrypted = await client.decrypt(
  encryptedBlob,
  resourceEntryId,
  accessPassId
)

// What happened:
// - Create SessionKey
// - Sign SessionKey
// - Build seal_approve transaction
// - Fetch keys from Seal servers
// - Decrypt content
```

---

## 🔑 Key Concepts

### AccessPass
- On-chain object representing payment for content access
- Contains: owner, domain, resource, remaining uses, expiry
- Purchased once, used multiple times (until uses exhausted)

### ResourceEntry
- On-chain object representing registered content
- Contains: domain, resource, walrus_cid, seal_policy, price
- Links domain/resource to encrypted content location

### Seal Policy ID
- 37 bytes: 32-byte base + 5-byte nonce
- Used to identify encryption policy
- Required for Seal key server authorization

### SessionKey
- Time-limited key for Seal decryption
- Must be signed by wallet owner
- Expires after TTL (e.g., 10 minutes)

### Transaction Bytes (txBytes)
- Critical: Must be IDENTICAL for `fetchKeys` and `decrypt`
- Contains `seal_approve` transaction
- Used by Seal servers to verify authorization

---

## 🛡️ Security Features

1. **On-Chain Verification**: AccessPass verified on Sui (no database)
2. **Signature Verification**: Headers signed with wallet private key
3. **Zero-Knowledge Encryption**: Seal servers never see content
4. **Threshold Cryptography**: Multiple key servers required
5. **Replay Protection**: Nonces prevent request replay
6. **Time-Limited Access**: SessionKey expires after TTL
7. **Decentralized Storage**: Walrus has no single point of failure

---

## 📊 Data Flow Summary

```
Content Registration:
File → Seal Encryption → Walrus Storage → Sui Registry
                                    ↓
                            ResourceEntry (on-chain)

Content Access:
Request → 402 → Purchase AccessPass (on-chain) → Sign Headers → 200
                                                      ↓
                                              Encrypted Blob (Walrus)
                                                      ↓
                                    Fetch Keys (Seal Servers) → Decrypt
```

This architecture ensures:
- ✅ Content owners control access via blockchain
- ✅ AI bots pay automatically via AccessPass
- ✅ Content is encrypted end-to-end
- ✅ No centralized database required
- ✅ Decentralized and trustless

