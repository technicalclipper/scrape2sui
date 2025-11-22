# ai-paywall

Middleware for protecting routes behind Sui blockchain payments - forces AI agents to pay before accessing premium content.

## Installation

```bash
npm install ai-paywall
```

## Usage

### Website Owner (Express Middleware)

**Super Simple - Just 3 parameters!** Contract details are baked into the package.

```javascript
const express = require('express');
const { paywall } = require('ai-paywall');

const app = express();

// Protect a route - JUST THIS!
app.use('/premium', paywall({
  price: '0.01',                    // Price in SUI
  receiver: '0x...',                // Your wallet address (where payments go)
  domain: 'www.example.com',       // Your domain
}));

// Your protected route
app.get('/premium', (req, res) => {
  // Access granted - user has valid pass
  res.json({ content: 'Premium content here' });
});
```

**That's it!** All contract details (packageId, treasuryId, passCounterId) are automatically loaded from the package config.

### AI Bot / Client (Client SDK)

**Even Simpler - Just private key!** All contract interactions are abstracted.

```javascript
const { PaywallClient } = require('ai-paywall');

// 1. Initialize with private key
const bot = new PaywallClient({
  privateKey: process.env.PRIVATE_KEY, // Base64 or hex private key
});

// 2. Access protected route - ONE LINE!
const content = await bot.access('http://example.com/premium');

console.log(content); // Premium content!
```

**What happens automatically:**
- ✅ Detects 402 payment required
- ✅ Purchases AccessPass (handles coin splitting automatically)
- ✅ Signs headers
- ✅ Makes authenticated request
- ✅ Returns content

**That's it!** No need to:
- ❌ Manually handle 402 responses
- ❌ Split coins
- ❌ Call contract functions
- ❌ Sign headers
- ❌ Manage AccessPass lifecycle

## How It Works

1. **No Payment Headers**: Middleware returns `402 Payment Required` with payment details
2. **With Payment Headers**: Middleware verifies AccessPass on Sui blockchain
   - Checks pass exists and is valid
   - Verifies owner matches signer
   - Validates domain/resource match
   - Checks expiry and remaining uses
3. **Access Granted**: Request proceeds to your route handler

## Client Headers

Clients must include these headers when accessing protected routes:

- `x-pass-id`: AccessPass object ID
- `x-signer`: Owner address (signer)
- `x-sig`: Signature (base64 encoded)
- `x-ts`: Timestamp (milliseconds)

## Response Codes

- `402 Payment Required`: No payment headers or invalid pass
- `403 Forbidden`: Invalid pass, expired, or no remaining uses
- `200 OK`: Access granted (continues to your route)

## Examples

See the [examples](./example/) directory for:
- **Simple bot example** (`example/simple-bot-example.js`) - Just 4 lines!
- **Full bot example** (`example/bot-example.js`) - With advanced usage
- **Example server** (`example/server.js`) - Express server setup
- **Complete test** (`example/test-complete-flow.js`) - End-to-end test

### Quick Example

```bash
# Build the middleware
npm run build

# Run the example server
node example/server.js

# Test it
curl http://localhost:3000/premium
```

## Response Codes

- `402 Payment Required`: No payment headers - client needs to purchase pass
- `403 Forbidden`: Invalid pass, expired, or no remaining uses
- `200 OK`: Access granted - request proceeds to route handler

## How It Works (Option 1: Verify-Only)

1. **No Headers** → Returns `402 Payment Required` with payment details
2. **Has Headers** → Verifies AccessPass on Sui blockchain:
   - ✅ Pass exists and is valid
   - ✅ Owner matches signer
   - ✅ Domain/resource match
   - ✅ Not expired
   - ✅ Has remaining uses
3. **Valid** → Continues to route handler
4. **Invalid** → Returns `403 Forbidden`

**Note**: The middleware verifies but doesn't consume the pass. Pass consumption happens on-chain when the agent calls `consume_pass`.

## Client Integration

Clients must include these headers when accessing protected routes:

| Header | Description | Example |
|--------|-------------|---------|
| `x-pass-id` | AccessPass object ID | `0x1234...` |
| `x-signer` | Owner address (signer) | `0xabcd...` |
| `x-sig` | Signature (base64) | `signature...` |
| `x-ts` | Timestamp (ms) | `1704067200000` |

## Configuration Options

### Middleware Options

```typescript
interface PaywallOptions {
  price: string;           // Price in SUI (e.g., "0.01")
  receiver: string;        // Your wallet address (where payments go)
  domain: string;          // Domain name (e.g., "www.example.com")
  // Contract details (packageId, treasuryId, passCounterId) are auto-loaded!
}
```

### Client Options

```typescript
interface PaywallClientOptions {
  privateKey: string;      // Base64 or hex private key
  rpcUrl?: string;         // Optional: Sui RPC URL (default: testnet)
}
```

## Error Handling

The middleware throws custom errors:

- `PaymentRequiredError` (402) - No payment headers
- `InvalidPassError` (403) - Pass not found or invalid
- `ExpiredPassError` (403) - Pass has expired
- `NoRemainingUsesError` (403) - Pass has no remaining uses
- `SignatureVerificationError` (403) - Invalid signature

## Documentation

See `INTEGRATION_GUIDE.md` for detailed integration instructions.

