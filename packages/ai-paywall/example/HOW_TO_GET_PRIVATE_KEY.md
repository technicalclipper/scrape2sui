# How to Get Your Sui Private Key

There are several ways to get your Sui private key from the CLI:

## Method 1: Export Using Sui Keytool (Recommended)

```bash
# List all keys to see available addresses
sui keytool list

# Export a specific key by address (use --key-identity flag)
sui keytool export --key-identity <address>

# Or export the active address
sui keytool export --key-identity $(sui client active-address)
```

**Example:**
```bash
# Get your active address
sui client active-address
# Output: 0x1f22826945a2236a98721bb7752c5af204b90363cfe75409d401fc96709b33c5

# Export the key for that address
sui keytool export --key-identity 0x1f22826945a2236a98721bb7752c5af204b90363cfe75409d401fc96709b33c5
```

This will output the private key in hex format (without `0x` prefix).

## Method 2: Export in Base64 Format

```bash
# Export in base64 (useful for some SDKs)
sui keytool export <address> --base64
```

## Method 3: Read from Keystore File

The keys are stored in: `~/.sui/sui_config/keystore`

You can read the file directly (it's JSON format):

```bash
cat ~/.sui/sui_config/keystore
```

The file contains an array of key objects. Each key has:
- `flag`: The key type (0 = Ed25519)
- `value`: The private key (base64 encoded)

## Method 4: Using Sui Client (For Active Address)

```bash
# Get active address
ACTIVE_ADDRESS=$(sui client active-address)

# Export that address's key (use --key-identity flag)
sui keytool export --key-identity $ACTIVE_ADDRESS
```

## Format for PaywallClient

The `PaywallClient` accepts private keys in **three formats**:

1. **Sui Bech32 format** (recommended - what `sui keytool export` gives you):
   ```javascript
   const client = new PaywallClient({
     privateKey: 'suiprivkey1qq4zwedasw8nc0jcpdrkkznff9rkjajp5hque5felwe3ysa6erjgy9gw62r'
   });
   ```

2. **Hex string** (with or without `0x` prefix):
   ```javascript
   const client = new PaywallClient({
     privateKey: '0x1234567890abcdef...' // or without 0x
   });
   ```

3. **Base64 string**:
   ```javascript
   const client = new PaywallClient({
     privateKey: 'base64encodedkey...'
   });
   ```

**Your exported private key from the command above is:**
```
suiprivkey1qq4zwedasw8nc0jcpdrkkznff9rkjajp5hque5felwe3ysa6erjgy9gw62r
```

You can use this **directly** in `PaywallClient` - no conversion needed!

## Example: Export and Use

```bash
# 1. Get your active address
ACTIVE_ADDRESS=$(sui client active-address)
echo "Active address: $ACTIVE_ADDRESS"

# 2. Export your key (use --key-identity flag)
# This outputs a table - extract just the private key
sui keytool export --key-identity $ACTIVE_ADDRESS | grep "exportedPrivateKey" | awk '{print $3}' > my-private-key.txt

# 3. Use it in your bot
export PRIVATE_KEY=$(cat my-private-key.txt)
node example/simple-bot-example.js
```

**Quick one-liner (extract just the key):**
```bash
# Export and extract the private key value
export PRIVATE_KEY=$(sui keytool export --key-identity $(sui client active-address) | grep "exportedPrivateKey" | awk '{print $3}')
echo "Private key: $PRIVATE_KEY"
```

**Or use it directly in code:**
```javascript
const { PaywallClient } = require('./dist/index');

const client = new PaywallClient({
  privateKey: 'suiprivkey1qq4zwedasw8nc0jcpdrkkznff9rkjajp5hque5felwe3ysa6erjgy9gw62r'
});

// Now access protected routes!
const content = await client.access('http://localhost:3000/premium');
```

## Security Warning ⚠️

**NEVER commit your private key to git!**

- Add `*.key`, `*private-key*` to `.gitignore`
- Use environment variables: `process.env.PRIVATE_KEY`
- Never share your private key publicly
- Keep it secure and backed up safely

## Quick Test

After exporting, test it:

```javascript
const { PaywallClient } = require('./dist/index');

const client = new PaywallClient({
  privateKey: 'your-exported-key-here'
});

// Test by accessing a protected route
client.access('http://localhost:3000/premium')
  .then(content => console.log('✅ Success!', content))
  .catch(err => console.error('❌ Error:', err.message));
```

