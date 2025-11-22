# ai-paywall

Middleware for protecting routes behind Sui blockchain payments - forces AI agents to pay before accessing premium content.

## Installation

```bash
npm install ai-paywall
```

## Usage

### Website Owner (Express Middleware)

```javascript
const express = require('express');
const { paywall } = require('ai-paywall');

const app = express();

// Protect a route - JUST THIS!
app.use('/hidden', paywall({
  price: '0.1',                    // Price in SUI
  domain: 'www.example.com',       // Your domain
  packageId: '0x...',              // Sui package ID (contract address)
  treasuryId: '0x...',             // Treasury shared object ID
  passCounterId: '0x...',          // PassCounter shared object ID
  mockContent: '{"message": "Mock content"}' // Optional: for testing
}));

// Your protected route
app.get('/hidden', (req, res) => {
  // Access granted - user has valid pass
  res.json({ content: 'Premium content here' });
});
```

### Example with Deployed Contract

```javascript
const { paywall } = require('ai-paywall');
const contractConfig = require('./contract-config.json'); // Your deployment config

app.use('/premium', paywall({
  price: '0.1',
  domain: 'www.example.com',
  packageId: contractConfig.packageId,
  treasuryId: contractConfig.treasuryId,
  passCounterId: contractConfig.passCounterId,
}));
```

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
- Example Express server (`example/server.js`)
- Test script (`example/test-middleware.js`)
- Detailed testing instructions (`example/README.md`)

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

```typescript
interface PaywallOptions {
  price: string;           // Price in SUI (e.g., "0.1")
  domain: string;          // Domain name (e.g., "www.example.com")
  packageId: string;       // Sui package ID (contract address)
  treasuryId: string;      // Treasury shared object ID
  passCounterId: string;   // PassCounter shared object ID
  receiver?: string;       // Optional: receiver address
  rpcUrl?: string;         // Optional: Sui RPC URL (default: testnet)
  mockContent?: string;    // Optional: mock content for testing
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

