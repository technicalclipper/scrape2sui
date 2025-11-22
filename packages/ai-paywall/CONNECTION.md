# Middleware → Deployed Contract Connection

## ✅ Connection Status: **CONNECTED**

The middleware is fully connected to your deployed Sui contract on testnet.

## Contract Details

- **Package ID**: `0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f`
- **Treasury ID**: `0x6018aa0359bba7af126f9c837325ff2bdddebc250a33bff420c3e2e6d9519808`
- **PassCounter ID**: `0x6cd4a831ed04f75da5e5a2a14710830dc26d1a929b4e5f50a4e71d3e3b4ee85c`
- **Network**: `testnet`
- **RPC URL**: `https://fullnode.testnet.sui.io:443`

## How It's Connected

### 1. Contract Configuration
The middleware uses the contract IDs from `contracts/contract-config.json`:
```json
{
  "packageId": "0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f",
  "treasuryId": "0x6018aa0359bba7af126f9c837325ff2bdddebc250a33bff420c3e2e6d9519808",
  "passCounterId": "0x6cd4a831ed04f75da5e5a2a14710830dc26d1a929b4e5f50a4e71d3e3b4ee85c",
  "network": "testnet"
}
```

### 2. AccessPass Fetching
The middleware fetches `AccessPass` objects from Sui using:
- **Sui SDK**: `@mysten/sui.js/client`
- **Method**: `client.getObject({ id: passId, options: { showContent: true } })`
- **Parsing**: Handles Sui `string::String` fields correctly (supports both plain strings and nested byte arrays)

### 3. Object Structure Mapping
The middleware maps the Move struct to TypeScript:
```typescript
// Move struct (contract)
public struct AccessPass has key, store {
    id: object::UID,
    pass_id: u64,
    owner: address,
    domain: string::String,
    resource: string::String,
    remaining: u64,
    expiry: u64,
    nonce: string::String,
    price_paid: u64,
}

// TypeScript type (middleware)
interface AccessPass {
  pass_id: string | number;
  owner: string;
  domain: string;
  resource: string;
  remaining: number;
  expiry: number;
  nonce: string;
  price_paid: string | number;
}
```

### 4. Verification Flow
When a request comes with headers (`x-pass-id`, `x-signer`, `x-sig`, `x-ts`):

1. **Fetch AccessPass** from Sui blockchain using the `passId`
2. **Validate object exists** and is of type `AccessPass`
3. **Parse fields** including Sui `string::String` fields (domain, resource, nonce)
4. **Verify ownership**: Check `pass.owner == signer`
5. **Verify domain/resource**: Match against middleware config
6. **Check expiry**: Compare `pass.expiry` with current time
7. **Check remaining uses**: Ensure `pass.remaining > 0`

### 5. String Field Parsing
The middleware handles Sui `string::String` fields correctly:
```typescript
// Handles both formats:
// 1. Plain string: "example.com"
// 2. Nested bytes: { bytes: "base64..." } → decode to string
const extractString = (field: any): string => {
  if (typeof field === 'string') return field;
  if (field?.bytes) {
    return Buffer.from(field.bytes, 'base64').toString('utf8');
  }
  return String(field || '');
};
```

## Example Usage

### Basic Setup
```javascript
const { paywall } = require('ai-paywall');

app.use('/premium', paywall({
  price: '0.1',
  domain: 'www.example.com',
  packageId: '0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f',
  treasuryId: '0x6018aa0359bba7af126f9c837325ff2bdddebc250a33bff420c3e2e6d9519808',
  passCounterId: '0x6cd4a831ed04f75da5e5a2a14710830dc26d1a929b4e5f50a4e71d3e3b4ee85c',
  rpcUrl: 'https://fullnode.testnet.sui.io:443',
}));
```

### Using Contract Config Helper (Optional)
```javascript
const { paywall, loadContractConfig, configToPaywallOptions } = require('ai-paywall');

// Load from contracts/contract-config.json
const config = loadContractConfig();
const options = configToPaywallOptions(config, '0.1', 'www.example.com');

app.use('/premium', paywall(options));
```

## Testing the Connection

### 1. Test with Invalid Pass ID
```bash
curl http://localhost:3000/premium \
  -H "x-pass-id: 0x1234567890abcdef..." \
  -H "x-signer: 0x..." \
  -H "x-sig: ..." \
  -H "x-ts: $(date +%s)000"
```
Expected: `403 InvalidPassError - AccessPass not found on Sui`

### 2. Test with Valid AccessPass
```bash
# First, purchase a pass using the contract
sui client call \
  --package 0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f \
  --module paywall \
  --function purchase_pass \
  --args <TREASURY_ID> <PASS_COUNTER_ID> "<domain>" "<resource>" <remaining> <expiry> "<nonce>" \
  --gas-budget 10000000

# Then use the AccessPass ID in headers
curl http://localhost:3000/premium \
  -H "x-pass-id: <ACTUAL_ACCESS_PASS_ID>" \
  -H "x-signer: <OWNER_ADDRESS>" \
  -H "x-sig: <SIGNATURE>" \
  -H "x-ts: <TIMESTAMP>"
```

Expected: `200 OK - Access granted`

## Connection Verification Checklist

- ✅ Contract IDs from `contract-config.json` are used
- ✅ Sui RPC URL points to testnet
- ✅ AccessPass objects are fetched from blockchain
- ✅ String fields (`domain`, `resource`, `nonce`) are parsed correctly
- ✅ Object type validation checks for `AccessPass`
- ✅ Expiry validation uses milliseconds (matches contract)
- ✅ Remaining uses validation matches contract logic
- ✅ Example server uses deployed contract IDs

## Next Steps

1. **Test with Real AccessPass**: Purchase a pass and test verification
2. **Monitor RPC Calls**: Check middleware logs for Sui RPC calls
3. **Error Handling**: Verify error messages are helpful
4. **Performance**: Consider caching AccessPass objects if needed

## Troubleshooting

### "AccessPass not found on Sui"
- Check pass ID is correct (66 chars, starts with `0x`)
- Verify pass exists on testnet: `sui client object <PASS_ID>`
- Check RPC URL is correct

### "Invalid object type"
- Verify object is actually an `AccessPass` type
- Check package ID matches deployed contract

### "String field parsing errors"
- Check middleware logs for raw object structure
- Verify string fields are in expected format

