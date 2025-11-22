# Quick Test Guide

## Step 1: Start the Server

```bash
cd packages/ai-paywall
npm run build
node example/server.js
```

Server runs on `http://localhost:3000`

## Step 2: Test 402 Response

Open a new terminal and run:

```bash
curl http://localhost:3000/premium
```

**Expected**: You should get a 402 response with payment details and a `nonce`.

Save the `nonce` from the response!

## Step 3: Purchase AccessPass

In the same terminal (with Sui CLI configured):

```bash
# 1. Check your gas coins
sui client gas

# 2. Split a coin for payment (0.01 SUI = 10,000,000 MIST)
# Replace <YOUR_COIN_ID> with an actual coin ID from step 1
# 
# ⚠️ Why split? The contract takes the ENTIRE coin, not a partial amount.
# If you have a 1 SUI coin and pass it directly, you'd pay 1 SUI instead of 0.01 SUI!
# Splitting ensures you pay exactly 0.01 SUI.
#
# If you already have a coin with exactly 10,000,000 MIST (0.01 SUI), you can skip this step.
sui client split-coins \
  --gas-budget 10000000 \
  --coins <YOUR_COIN_ID> \
  --amounts 10000000

# This creates a new coin with 10,000,000 MIST - note the coin ID!

# 3. Purchase AccessPass
# Replace:
#   <PAYMENT_COIN_ID> - The coin from step 2
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

**Important**: 
- Domain must be: `"www.example.com"` (matches your server.js)
- Resource must be: `"/premium"` (matches your route)
- Remaining: `10` (10 uses)
- Expiry: `0` (no expiry)
- Nonce: Use the one from the 402 response!

## Step 4: Get AccessPass ID

After purchase, look at the transaction output. Find:
- **"Created Objects"** section
- Object with type containing `AccessPass`
- Copy the **object ID** (starts with `0x`, 66 characters)

Or query it:
```bash
sui client object <ACCESS_PASS_ID>
```

## Step 5: Test with AccessPass

```bash
# Get owner address
OWNER=$(sui client object <ACCESS_PASS_ID> --json | jq -r '.data.content.fields.owner')
TIMESTAMP=$(date +%s)000

# Test with headers
curl http://localhost:3000/premium \
  -H "x-pass-id: <ACCESS_PASS_ID>" \
  -H "x-signer: $OWNER" \
  -H "x-sig: test-signature" \
  -H "x-ts: $TIMESTAMP"
```

**Expected**: 
- If pass is valid → 200 OK with premium content
- If signature invalid → 403 (but pass should still be valid)

## Complete Example Commands

Here's a complete example (replace placeholders):

```bash
# 1. Test 402
curl http://localhost:3000/premium

# Response will have nonce like: "1234567890-abc123"

# 2. Purchase (replace COIN_ID and NONCE)
sui client split-coins --gas-budget 10000000 --coins 0xYOUR_COIN_ID --amounts 10000000

sui client call \
  --package 0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f \
  --module paywall \
  --function purchase_pass \
  --args 0xNEW_COIN_ID "www.example.com" "/premium" 10 0 "1234567890-abc123" \
  --gas-budget 10000000

# 3. Extract AccessPass ID from output
# Look for: Created Objects -> AccessPass -> Object ID: 0x...

# 4. Test with pass
curl http://localhost:3000/premium \
  -H "x-pass-id: 0xACCESS_PASS_ID" \
  -H "x-signer: 0xYOUR_ADDRESS" \
  -H "x-sig: test" \
  -H "x-ts: $(date +%s)000"
```

## Troubleshooting

**"AccessPass not found"**
- Double-check the AccessPass ID
- Verify it exists: `sui client object <PASS_ID>`

**"Invalid domain or resource"**
- Domain must exactly match: `www.example.com`
- Resource must exactly match: `/premium`
- Check what you used in `purchase_pass` call

**"Signature verification failed"**
- This is expected with placeholder signature
- The pass should still be validated successfully
- For production, implement proper signing

