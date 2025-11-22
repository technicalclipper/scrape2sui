# Contract Testing Commands

## Important Contract Information
- **Package ID**: `0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f`
- **Treasury Object ID**: `0x6018aa0359bba7af126f9c837325ff2bdddebc250a33bff420c3e2e6d9519808`
- **PassCounter Object ID**: `0x6cd4a831ed04f75da5e5a2a14710830dc26d1a929b4e5f50a4e71d3e3b4ee85c`

## Step 1: Verify Deployed Objects

```bash
# Check Treasury object exists and is shared
sui client object 0x6018aa0359bba7af126f9c837325ff2bdddebc250a33bff420c3e2e6d9519808

# Check PassCounter object exists and is shared
sui client object 0x6cd4a831ed04f75da5e5a2a14710830dc26d1a929b4e5f50a4e71d3e3b4ee85c

# Check your account balance
sui client gas
```

## Step 2: Purchase an Access Pass

First, split a coin for payment (replace with your coin ID):

```bash
# Split 0.1 SUI for payment (adjust amount as needed)
# Get a coin ID from: sui client gas
sui client split-coin --coin-id <YOUR_COIN_ID> --amounts 100000000 --gas-budget 100000000
```

Then call purchase_pass:

```bash
# Purchase a pass with:
# - domain: "example.com" 
# - resource: "/hidden"
# - remaining: 5 uses
# - expiry: 0 (no expiry) or timestamp in milliseconds
# - nonce: "unique-nonce-123"

PACKAGE_ID="0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f"
TREASURY_ID="0x6018aa0359bba7af126f9c837325ff2bdddebc250a33bff420c3e2e6d9519808"
PASS_COUNTER_ID="0x6cd4a831ed04f75da5e5a2a14710830dc26d1a929b4e5f50a4e71d3e3b4ee85c"

# Convert strings to bytes (example.com = 6578616d706c652e636f6d in hex)
# Or use: echo -n "example.com" | xxd -p
DOMAIN_HEX=$(echo -n "example.com" | xxd -p | tr -d '\n')
RESOURCE_HEX=$(echo -n "/hidden" | xxd -p | tr -d '\n')
NONCE_HEX=$(echo -n "test-nonce-$(date +%s)" | xxd -p | tr -d '\n')

sui client call \
  --package $PACKAGE_ID \
  --module paywall \
  --function purchase_pass \
  --args <YOUR_PAYMENT_COIN_ID> "$DOMAIN_HEX" "$RESOURCE_HEX" 5 0 "$NONCE_HEX" $TREASURY_ID $PASS_COUNTER_ID \
  --gas-budget 100000000
```

## Step 3: Check Your AccessPass

After purchasing, you'll get an AccessPass object. Save the object ID from the transaction output, then:

```bash
# View your AccessPass object
sui client object <ACCESS_PASS_OBJECT_ID>
```

## Step 4: Consume the Pass

```bash
# Consume one use from the pass (replace with actual AccessPass object ID)
sui client call \
  --package $PACKAGE_ID \
  --module paywall \
  --function consume_pass \
  --args <ACCESS_PASS_OBJECT_ID> \
  --gas-budget 100000000
```

## Step 5: Verify Pass Consumption

```bash
# Check the pass again - remaining should be decremented
sui client object <ACCESS_PASS_OBJECT_ID>
```

## Helper: Quick Test Scripts

### 1. Verify Contract Deployment
```bash
cd /home/technicalclipper/sui2scrape/contracts
./test-contract.sh
```
This verifies all deployed objects exist.

### 2. Test consume_pass
```bash
cd /home/technicalclipper/sui2scrape/contracts
./test-consume.sh [ACCESS_PASS_ID]
```
This tests consuming a pass. If no ID provided, uses the example pass ID.

