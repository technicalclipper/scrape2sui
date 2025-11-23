# Steps to Purchase AccessPass and Fetch Content

After registering content in the registry-app, follow these steps to purchase an AccessPass and fetch the decrypted content.

## Prerequisites Checklist

- [x] Content registered in registry-app:
  - Domain: `www.newkrish.com`
  - Resource: `/hidden/dog`
  - Walrus Blob ID: `LL8hDTU3rwr7OoiNVyHllGPUiLEoFPATTup2kKnaduE`
  - Seal Policy ID: `84aa2a83dfd9d4ccc926458b79ab1a2deac4c3f40e619ccc0e162c1f064a0e823c94668dfb`
  - Resource Entry ID: `0xd77c4f3b7807b0c50fdb0e1fe194aa384581ce9a57a667b5ba9f4d79af174738`
- [ ] Server running with paywall middleware
- [ ] Private key with SUI balance
- [x] Contract IDs updated in `contract.json` (already done from deployment)

## Step 1: Start the Server

```bash
cd packages/ai-paywall
npm run build
node example/server.js
```

The server should start on `http://localhost:3000`

**Important**: The server is already configured with the registered content:

```javascript
app.use(
  "/premium",
  paywall({
    price: "0.01",
    receiver:
      "0x043d0499d17b09ffffd91a3eebb684553ca7255e273c69ed72e355950e0d77be",
    domain: "www.newkrish.com", // Matches registered domain
  })
);
```

The `/premium` endpoint maps to:

- Domain: `www.newkrish.com`
- Resource: `/hidden/dog`

## Step 2: Set Your Private Key

```bash
export PRIVATE_KEY=your-sui-private-key
```

You can get your private key from:

- Sui CLI: `sui keytool export --key-identity <address>`
- Or see `HOW_TO_GET_PRIVATE_KEY.md` for detailed instructions

## Step 3: Purchase AccessPass and Fetch Content

### Method 1: Simple One-Line (Easiest)

```javascript
const { PaywallClient } = require("ai-paywall");

const client = new PaywallClient({
  privateKey: process.env.PRIVATE_KEY,
});

// Everything is automatic!
const content = await client.access("http://localhost:3000/premium");
console.log(content);
```

**What this does automatically:**

1. Makes request → Gets 402 Payment Required
2. Purchases AccessPass (handles coin splitting)
3. Signs headers
4. Retries request with headers
5. Returns content

### Method 2: Step-by-Step (More Control)

```javascript
const { PaywallClient } = require("ai-paywall");

// 1. Initialize
const client = new PaywallClient({
  privateKey: process.env.PRIVATE_KEY,
});

// 2. Get 402 challenge
const response = await fetch("http://localhost:3000/premium");
const challenge = await response.json(); // { price, domain, resource, nonce, receiver }

// 3. Purchase AccessPass
const { headers, accessPassId } = await client.payForAccess(
  "http://localhost:3000/premium"
);

// 4. Request content
const contentResponse = await fetch("http://localhost:3000/premium", {
  headers,
});

// 5. Handle response
if (
  contentResponse.headers
    .get("content-type")
    ?.includes("application/octet-stream")
) {
  // Encrypted blob - save it
  const encryptedBlob = await contentResponse.arrayBuffer();
  const fs = require("fs");
  fs.writeFileSync("encrypted-content.bin", Buffer.from(encryptedBlob));
  console.log("Saved encrypted blob to encrypted-content.bin");
} else {
  // JSON response
  const json = await contentResponse.json();
  console.log("Content:", json);
}
```

## Step 4: Decrypt Content (If Encrypted)

If you received an encrypted blob, you need to decrypt it using Seal SDK:

```javascript
const { SealClient, SessionKey, EncryptedObject } = require("@mysten/seal");
const { SuiClient, getFullnodeUrl } = require("@mysten/sui.js/client");
const { TransactionBlock } = require("@mysten/sui.js/transactions");
const { fromHEX } = require("@mysten/sui.js/utils");
const contractConfig = require("ai-paywall/dist/config/contract.json");

// You need these from the registry:
// - resourceId (from registry lookup)
// - sealPolicyId (from registry)
// - accessPassId (from purchase)
// - encryptedBlob (from response)

// Create SessionKey
const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });
const sessionKey = await SessionKey.create({
  address: client.keypair.toSuiAddress(),
  packageId: contractConfig.packageId,
  ttlMin: 10,
  suiClient,
});

// Sign SessionKey (requires wallet interaction)
// In production, use wallet adapter
const personalMessage = sessionKey.getPersonalMessage();
// ... sign with wallet ...
await sessionKey.setPersonalMessageSignature(signature);

// Decrypt
const sealClient = new SealClient({
  suiClient,
  serverConfigs: [
    {
      objectId:
        "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
      weight: 1,
    },
    {
      objectId:
        "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
      weight: 1,
    },
  ],
  verifyKeyServers: false,
});

const policyIdBytes = fromHEX(normalizeHexString(sealPolicyId));
const tx = new TransactionBlock();
tx.moveCall({
  target: `${contractConfig.packageId}::registry::seal_approve`,
  arguments: [
    tx.pure(Array.from(policyIdBytes), "vector<u8>"),
    tx.object(resourceId),
    tx.object(accessPassId),
    tx.object("0x6"), // Clock
  ],
});
const txBytes = await tx.build({
  client: suiClient,
  onlyTransactionKind: true,
});

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

console.log("Decrypted content:", decryptedData);
```

## Quick Test Scripts

### Test 1: Simple Access (Recommended)

```bash
export PRIVATE_KEY=your-key
node example/simple-bot-example.js
```

### Test 2: Test with Registered Content

```bash
export PRIVATE_KEY=your-key
node example/test-registered-content.js
```

### Test 3: Complete Flow with Decryption

```bash
export PRIVATE_KEY=your-key
node example/test-with-decryption.js
```

### Test 4: Original Test (Uses Sui CLI)

```bash
node example/test-complete-flow.js
```

## Troubleshooting

### "Expected 402, got 200"

- Server might not have paywall middleware
- Check that route uses `paywall()` middleware

### "Resource not found in registry"

- Domain/resource must match what you registered
- Check registry-app to verify registration

### "AccessPass not found"

- Wait 2-3 seconds after purchase for indexing
- Verify AccessPass ID is correct

### "Signature verification failed"

- Check private key is correct
- Verify AccessPass owner matches signer

## What Gets Returned?

1. **If content is encrypted with Seal:**

   - Server returns encrypted blob (binary)
   - Headers include: `X-Walrus-CID`, `X-Seal-Policy`, `X-Resource-ID`
   - Client must decrypt using Seal SDK

2. **If content is not encrypted (mock):**

   - Server returns JSON response
   - Contains mock content data

3. **If server has SessionKey signature:**
   - Server decrypts automatically
   - Returns decrypted content

## Next Steps

- See `QUICK_START.md` for a condensed guide
- See `README_DECRYPTION.md` for detailed decryption instructions
- See `README.md` for all available examples
