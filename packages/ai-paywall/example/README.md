# Examples

This directory contains essential example scripts demonstrating the ai-paywall package.

## Core Examples

### `server.js`
Express server example showing how to use the paywall middleware.

```bash
node example/server.js
```

### `bot-example.js`
Simple bot example demonstrating basic PaywallClient usage.

```bash
export PRIVATE_KEY=your-private-key
node example/bot-example.js
```

### `step-by-step-flow.js`
Complete flow demonstration showing each step:
1. Encounter 402 Payment Required
2. Purchase AccessPass
3. Get content with authenticated request

```bash
export PRIVATE_KEY=your-private-key
node example/step-by-step-flow.js
```

### `test-registered-content.js`
Full encryption/decryption flow with registered content from registry-app.

```bash
export PRIVATE_KEY=your-private-key
export WALRUS_DOMAIN=www.demo1.com
export WALRUS_RESOURCE=/hidden/dog
export RESOURCE_ENTRY_ID=0x...
export SEAL_POLICY_ID=...
node example/test-registered-content.js
```

### `test-complete-flow.js`
End-to-end test covering the complete flow.

```bash
export PRIVATE_KEY=your-private-key
node example/test-complete-flow.js
```

### `decrypt-file.js`
Decrypt a saved encrypted blob file.

```bash
export PRIVATE_KEY=your-private-key
node example/decrypt-file.js encrypted-blob.bin
```

## Generated Files

Generated files (`.bin`, `.gif`, `.jpg`, etc.) are automatically ignored by git.
They are created when running the example scripts that decrypt content.

