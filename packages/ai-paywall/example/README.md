# ai-paywall Examples

Example usage of the ai-paywall middleware.

## Quick Start

### 1. Start the Server

```bash
npm run build
npm start
# Server runs on http://localhost:3000
```

### 2. Purchase AccessPass and Fetch Content

**Option A: Simple One-Line (Recommended)**

```bash
export PRIVATE_KEY=your-private-key
node example/simple-bot-example.js
```

**Option B: Complete Test with Decryption**

```bash
export PRIVATE_KEY=your-private-key
node example/test-with-decryption.js
```

**Option C: Original Test (Uses Sui CLI)**

```bash
npm test
# or
node example/test-complete-flow.js
```

## Quick Start Guide

See **[QUICK_START.md](./QUICK_START.md)** for step-by-step instructions on:
- Purchasing AccessPass using PaywallClient SDK
- Fetching encrypted content
- Decrypting content with Seal SDK

## Complete Flow

The tests demonstrate the complete flow:
- ✅ Hit server → Get 402 Payment Required
- ✅ Purchase AccessPass using PaywallClient SDK (or Sui CLI)
- ✅ Verify AccessPass on Sui
- ✅ Request content with headers → Get encrypted blob
- ✅ Decrypt content using Seal SDK (optional)

## Prerequisites

1. **Build the middleware**:
   ```bash
   npm run build
   ```

2. **Express** (already installed as dev dependency)

3. **Sui CLI configured** for testnet with SUI balance

## Files

- `server.js` - Example Express server with paywall middleware
- `test-complete-flow.js` - Complete end-to-end test (uses Sui CLI)
- `test-with-decryption.js` - Complete test with Seal decryption
- `test-registered-content.js` - Test with actual registered content from registry-app
- `simple-bot-example.js` - Simplest example using PaywallClient SDK
- `bot-example.js` - Example bot using PaywallClient SDK

## Registered Content

The examples are configured to work with content registered in registry-app:
- **Domain**: `www.krish.com`
- **Resource**: `/hidden/dog`
- **Walrus Blob ID**: `w5HhcKzcAxbdfOoSW1Y_Xk4i1LbwiNrm6WVYJDuvNWQ`
- **Seal Policy ID**: `3f0435b67209d368487713d895ab999271bd9e67f05cf847b7d6cdde70e48409`
- **Resource Entry ID**: `0xcb7d2b8547d42740adbb1e81ce90aa1750bad886aed3ed50f8aefad80133b4b5`

The server endpoint `/premium` maps to this registered content.

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
