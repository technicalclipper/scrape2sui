# Examples

This directory contains essential example scripts demonstrating the ai-paywall package.

## Quick Start

### Setting Up a New Server

If you've already registered content in registry-app and want to serve it:

```bash
# 1. Set your registered content details
export WALRUS_DOMAIN=www.yourdomain.com
export WALRUS_RESOURCE=/your/resource/path
export RECEIVER_ADDRESS=0x...    # Your wallet address

# 2. Run the example server
node example/new-server-example.js

# 3. Test it
curl http://localhost:3000/your/resource/path  # Should return 402
```

See **[SERVER_SETUP_GUIDE.md](../SERVER_SETUP_GUIDE.md)** for complete setup instructions.

### Using PaywallClient (Client Example)

If you want to access protected content as a client:

```bash
# 1. Set your client configuration
export PRIVATE_KEY=your-private-key
export SERVER_URL=http://localhost:3000
export WALRUS_DOMAIN=www.yourdomain.com
export WALRUS_RESOURCE=/your/resource/path

# 2. Run the client example
node example/new-client-example.js
```

The client will automatically:
- Handle 402 payment required
- Purchase AccessPass if needed
- Sign headers and authenticate
- Get encrypted content
- Decrypt using Seal (ResourceEntry ID from server headers)

See **[new-client-example.js](./new-client-example.js)** for the complete example.

## Core Examples

### `new-server-example.js` ⭐ NEW
Minimal example showing how to set up a new server with registered content.

```bash
export WALRUS_DOMAIN=www.yourdomain.com
export WALRUS_RESOURCE=/your/resource/path
export RECEIVER_ADDRESS=0x...
node example/new-server-example.js
```

### `new-client-example.js` ⭐ NEW
Simple client example showing how to use PaywallClient to access protected content.

```bash
export PRIVATE_KEY=your-private-key
export SERVER_URL=http://localhost:3000
export WALRUS_DOMAIN=www.yourdomain.com
export WALRUS_RESOURCE=/your/resource/path
node example/new-client-example.js
```

### `server.js`
Full-featured Express server example with detailed error handling.

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

