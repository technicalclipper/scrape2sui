# Testing the Full Flow

This guide shows you how to test the complete ai-paywall payment flow.

## Prerequisites

1. **Server running**: The Express server should be running on port 3000
2. **Sui CLI configured**: You need `sui` CLI installed and configured for testnet
3. **SUI balance**: You need some SUI in your wallet for purchasing AccessPass

## Quick Start

### 1. Start the Server

```bash
cd packages/ai-paywall
npm run build
node example/server.js
```

The server will start on `http://localhost:3000`

### 2. Test 402 Response (No Payment)

```bash
curl http://localhost:3000/premium
```

**Expected Response (402)**:
```json
{
  "status": 402,
  "paymentRequired": true,
  "price": "0.01",
  "priceInMist": "10000000",
  "receiver": "0x35f9ccbc7bfe156def618db1ddbca994fb383ee1254539dacf49006e1ea9d6be",
  "packageId": "0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f",
  "treasuryId": "0x6018aa0359bba7af126f9c837325ff2bdddebc250a33bff420c3e2e6d9519808",
  "passCounterId": "0x6cd4a831ed04f75da5e5a2a14710830dc26d1a929b4e5f50a4e71d3e3b4ee85c",
  "domain": "www.example.com",
  "resource": "/premium",
  "nonce": "1234567890-abc123"
}
```

Save the `nonce` from the response - you'll need it for purchasing.

### 3. Purchase AccessPass

Use the Sui CLI to purchase an AccessPass:

```bash
# First, get your coin IDs
sui client gas

# Split a coin for payment (0.01 SUI = 10,000,000 MIST)
sui client split-coins \
  --gas-budget 10000000 \
  --coins <YOUR_COIN_ID> \
  --amounts 10000000

# Purchase AccessPass
sui client call \
  --package 0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f \
  --module paywall \
  --function purchase_pass \
  --args <PAYMENT_COIN_ID> \
    "www.example.com" \
    "/premium" \
    10 \
    0 \
    "1234567890-abc123" \
  --gas-budget 10000000
```

**Parameters:**
- `PAYMENT_COIN_ID`: The coin you split (10,000,000 MIST = 0.01 SUI)
- Domain: `"www.example.com"` (matches your server.js config)
- Resource: `"/premium"` (matches the route)
- Remaining: `10` (10 uses)
- Expiry: `0` (no expiry) or timestamp in milliseconds
- Nonce: The nonce from the 402 response

**After purchase**, extract the **AccessPass object ID** from the transaction output:
- Look for "Created Objects" section
- Find object with type containing `AccessPass`
- Copy the object ID (starts with `0x`)

### 4. Test with Valid AccessPass

```bash
# Get AccessPass details
sui client object <ACCESS_PASS_ID>

# Extract owner address from the output
OWNER=$(sui client object <ACCESS_PASS_ID> --json | jq -r '.data.content.fields.owner')
TIMESTAMP=$(date +%s)000

# Make request with headers
curl http://localhost:3000/premium \
  -H "x-pass-id: <ACCESS_PASS_ID>" \
  -H "x-signer: $OWNER" \
  -H "x-sig: placeholder-signature" \
  -H "x-ts: $TIMESTAMP"
```

**Expected Response (200)**:
```json
{
  "success": true,
  "message": "Premium content unlocked!",
  "accessPass": { ... },
  "data": {
    "article": "Premium article content here...",
    "author": "John Doe",
    "timestamp": "..."
  }
}
```

Or **403** if signature verification fails (which is expected with placeholder signature).

## Automated Testing Script

You can use the automated test script:

```bash
cd packages/ai-paywall/example
chmod +x test-full-flow.sh
./test-full-flow.sh
```

This script will:
1. Test 402 response
2. Show you how to purchase AccessPass
3. Guide you through testing with valid headers

## Common Issues

### "AccessPass not found"
- Make sure the AccessPass ID is correct
- Verify the pass exists: `sui client object <PASS_ID>`

### "Invalid domain or resource"
- Domain and resource must match exactly what's in the AccessPass
- Check server.js config matches your purchase parameters

### "Signature verification failed"
- The middleware uses basic signature validation (Option 1)
- Full signature verification requires signing with the owner's private key
- For testing, this might fail - but AccessPass validation should still work

### "Pass expired" or "No remaining uses"
- Check expiry timestamp (0 means no expiry)
- Check remaining count in AccessPass object

## Testing Checklist

- [ ] Server starts without errors
- [ ] 402 response returns correct payment details
- [ ] Can purchase AccessPass on Sui
- [ ] AccessPass object created successfully
- [ ] Can verify AccessPass exists on Sui
- [ ] Request with headers validates correctly
- [ ] Domain/resource matching works
- [ ] Expiry validation works (if expiry set)
- [ ] Remaining uses decrement works (if consuming)

## Next Steps

Once basic testing works:
1. Implement proper signature signing in your client
2. Test with different expiry times
3. Test remaining uses countdown
4. Test with multiple concurrent requests
5. Monitor Sui RPC calls and performance

