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

- **Domain**: `DOMAIN`
- **Resource**: `/hidden/dog`
- **Walrus Blob ID**: `CJdVQYMwrqww9u7413CuQTDvOLaeZlurHfwkeDXSx4I`
- **Seal Policy ID**: `c16ea2047827a5f2fca199bdacf13934539d053f4bd3a922e3c93175ba17759d8067f0ee3f`
- **Resource Entry ID**: `0x5c6f02b39b6e02de098a68c0d72fc7a812365403f2e27e5ede2e49ff8ab34333`

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
