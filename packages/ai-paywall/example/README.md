# ai-paywall Examples

Example usage of the ai-paywall middleware.

## Quick Start

### 1. Start the Server

```bash
npm run build
npm start
# Server runs on http://localhost:3000
```

### 2. Run Complete Flow Test

In another terminal:

```bash
npm test
# or
node example/test-complete-flow.js
```

This will test the complete flow:
- ✅ Hit server → Get 402 Payment Required
- ✅ Extract nonce from response
- ✅ Purchase AccessPass (guided)
- ✅ Verify AccessPass on Sui
- ✅ Request content with headers → Get hidden content

## Prerequisites

1. **Build the middleware**:
   ```bash
   npm run build
   ```

2. **Express** (already installed as dev dependency)

3. **Sui CLI configured** for testnet with SUI balance

## Files

- `server.js` - Example Express server with paywall middleware
- `test-complete-flow.js` - Complete end-to-end test
- `bot-example.js` - Example bot using PaywallClient SDK

## Complete Flow Test

Run the comprehensive test:

```bash
npm test
```

**What it tests:**
1. ✅ Step 1: Hit server endpoint → Get 402 Payment Required
2. ✅ Step 2: Extract nonce, guide through purchasing AccessPass
3. ✅ Step 3: Verify AccessPass exists on Sui
4. ✅ Step 4: Request content with headers → Get hidden content

The test guides you through each step with clear instructions!

## Notes

- The middleware uses **Option 1: Verify-only** - checks the pass but doesn't consume it
- Pass consumption happens on-chain when the agent calls `consume_pass`
- The middleware validates:
  - Pass exists on Sui
  - Owner matches signer
  - Domain/resource match
  - Pass is not expired
  - Pass has remaining uses
