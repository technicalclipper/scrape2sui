# ✅ Server is Running! Test the Full Flow

## Current Status
- ✅ Server running on `http://localhost:3000`
- ✅ 402 Payment Required response working
- ✅ Nonce generation working
- ✅ All contract IDs configured

## Step 1: Test 402 Response (Already Done ✅)

```bash
curl http://localhost:3000/premium
```

Response shows payment details with nonce. **Save the nonce!**

## Step 2: Purchase AccessPass

In a new terminal, run these Sui CLI commands:

```bash
# 1. Check your gas coins
sui client gas

# 2. Split a coin for payment (0.01 SUI = 10,000,000 MIST)
# Replace <YOUR_COIN_ID> with a coin ID from step 1
sui client split-coins \
  --gas-budget 10000000 \
  --coins <YOUR_COIN_ID> \
  --amounts 10000000

# Note the new coin ID created above!

# 3. Purchase AccessPass
# Replace:
#   <PAYMENT_COIN_ID> - The coin ID from step 2
#   <NONCE> - The nonce from the 402 response
sui client call \
  --package 0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f \
  --module paywall \
  --function purchase_pass \
  --args <PAYMENT_COIN_ID> \
    "www.example.com" \
    "/premium" \
    10 \
    0 \
    "<NONCE>" \
  --gas-budget 10000000
```

**Important Parameters:**
- Domain: `"www.example.com"` (must match server.js)
- Resource: `"/premium"` (must match the route)
- Remaining: `10` (10 uses)
- Expiry: `0` (no expiry)
- Nonce: Use the one from the 402 response

**After purchase**, look at the transaction output:
- Find "**Created Objects**" section
- Find object with type containing `AccessPass`
- Copy the **Object ID** (starts with `0x`, 66 characters)

## Step 3: Test with AccessPass

```bash
# Replace <ACCESS_PASS_ID> with the ID from Step 2
# Replace <OWNER_ADDRESS> with your wallet address

# Get owner address automatically:
OWNER=$(sui client object <ACCESS_PASS_ID> --json | jq -r '.data.content.fields.owner')
TIMESTAMP=$(date +%s)000

# Test with headers
curl http://localhost:3000/premium \
  -H "x-pass-id: <ACCESS_PASS_ID>" \
  -H "x-signer: $OWNER" \
  -H "x-sig: test-signature" \
  -H "x-ts: $TIMESTAMP"
```

**Expected Response (200):**
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

Or **403** if signature verification fails (expected with placeholder signature).

## Quick Test Script

You can also use the automated test script:

```bash
cd packages/ai-paywall/example
chmod +x test-step-by-step.sh
./test-step-by-step.sh
```

## Troubleshooting

**"Cannot find module 'express'"**
- Already fixed! Express is installed as dev dependency.

**"AccessPass not found"**
- Double-check the AccessPass ID
- Verify: `sui client object <PASS_ID>`

**"Invalid domain or resource"**
- Domain must exactly match: `www.example.com`
- Resource must exactly match: `/premium`
- Check what you used in `purchase_pass`

**"Signature verification failed"**
- This is expected with placeholder signature
- Pass validation should still work
- For production, implement proper signing

## Running the Server

```bash
cd packages/ai-paywall

# Build TypeScript
npm run build

# Start server
npm run start
# or
node example/server.js

# Or with nodemon (auto-restart on changes)
npm install -g nodemon
nodemon example/server.js
```

The server should show:
```
🚀 Server running on http://localhost:3000
📝 Public endpoint: http://localhost:3000/
💰 Protected endpoint: http://localhost:3000/premium
```

