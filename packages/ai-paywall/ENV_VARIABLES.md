# Environment Variables

This package uses environment variables to configure registered content details. Set these variables before running any scripts.

## Required Environment Variables

### Walrus/Registry Configuration

```bash
# Domain registered in the registry
export WALRUS_DOMAIN=www.demo1.com

# Resource path registered in the registry
export WALRUS_RESOURCE=/hidden/dog

# Walrus Blob ID from registry registration
export WALRUS_BLOB_ID=wqwm17mRGo5PkXPo5p_I-RXtNIH4kdM-UnPVksBQ5lY

# Seal Policy ID from registry registration
export SEAL_POLICY_ID=f02db2d9f0844665d33376e822e6c2e0c150344572fb7b8f4d4b6323621b5895cbe9653375

# Resource Entry ID from registry registration (on-chain object ID)
export RESOURCE_ENTRY_ID=0x44ace4be0c2ca4bf48bdb4f6a8069ff2beb73c3b33409035cffefa160ff40f5d
```

### Optional Environment Variables

```bash
# Server URL for testing (defaults to http://localhost:3000)
export SERVER_URL=http://localhost:3000

# Private key for testing (required for test scripts)
export PRIVATE_KEY=your-private-key-here
```

## Usage

All hardcoded values have been replaced with environment variable lookups with defaults. The defaults match the current registered content:

- Domain: `www.demo1.com`
- Resource: `/hidden/dog`
- Walrus Blob ID: `wqwm17mRGo5PkXPo5p_I-RXtNIH4kdM-UnPVksBQ5lY`
- Seal Policy ID: `f02db2d9f0844665d33376e822e6c2e0c150344572fb7b8f4d4b6323621b5895cbe9653375`
- Resource Entry ID: `0x44ace4be0c2ca4bf48bdb4f6a8069ff2beb73c3b33409035cffefa160ff40f5d`

## Setting Environment Variables

### Linux/Mac:
```bash
export WALRUS_DOMAIN=www.demo1.com
export WALRUS_RESOURCE=/hidden/dog
export WALRUS_BLOB_ID=wqwm17mRGo5PkXPo5p_I-RXtNIH4kdM-UnPVksBQ5lY
export SEAL_POLICY_ID=f02db2d9f0844665d33376e822e6c2e0c150344572fb7b8f4d4b6323621b5895cbe9653375
export RESOURCE_ENTRY_ID=0x44ace4be0c2ca4bf48bdb4f6a8069ff2beb73c3b33409035cffefa160ff40f5d
export PRIVATE_KEY=your-private-key
```

### Windows (PowerShell):
```powershell
$env:WALRUS_DOMAIN="www.demo1.com"
$env:WALRUS_RESOURCE="/hidden/dog"
$env:WALRUS_BLOB_ID="wqwm17mRGo5PkXPo5p_I-RXtNIH4kdM-UnPVksBQ5lY"
$env:SEAL_POLICY_ID="f02db2d9f0844665d33376e822e6c2e0c150344572fb7b8f4d4b6323621b5895cbe9653375"
$env:RESOURCE_ENTRY_ID="0x44ace4be0c2ca4bf48bdb4f6a8069ff2beb73c3b33409035cffefa160ff40f5d"
$env:PRIVATE_KEY="your-private-key"
```

## Files Updated

The following files now use environment variables with defaults:

- `constants.ts` - Main constants file
- `example/test-registered-content.js` - Test script for registered content
- `example/server.js` - Example Express server
- `example/decrypt-file.js` - Decryption example
- `example/test-complete-flow.js` - Complete flow test
- `example/test-with-decryption.js` - Test with decryption
- `src/middleware.ts` - Middleware with hardcoded domain check updated

