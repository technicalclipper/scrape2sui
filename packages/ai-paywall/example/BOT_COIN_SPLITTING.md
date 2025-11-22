# How Bots Automatically Handle Coin Splitting

## The Problem

When a bot wants to purchase an AccessPass, it needs to:
1. Know which coin to use for payment
2. Split the exact amount needed (0.01 SUI)
3. Pass that coin to the purchase function

But bots don't manually select coins - the SDK handles this automatically!

## How It Works (Automatically)

The `PaywallClient` SDK automatically:

### Step 1: Get All Available Coins

```typescript
// SDK automatically queries wallet for all coins
const coins = await client.getCoins();
// Returns: [{ coinId: '0x...', balance: 1000000000n }, ...]
```

### Step 2: Select Best Coin

```typescript
// SDK automatically finds a coin with sufficient balance
const coinId = await client.selectCoinForPayment(amount);
// Returns the best coin ID to use
```

**Selection logic:**
- Finds coins with enough balance (payment amount + gas)
- Sorts by balance (largest first)
- Picks the first suitable coin

### Step 3: Split if Needed

```typescript
// SDK automatically splits if the coin is too large
const paymentCoinId = await client.splitCoin(coinId, amount);
// Creates new coin with exactly the payment amount
```

**Splitting logic:**
- Checks if coin has exact amount → use it directly
- If coin is larger → split to create exact amount
- Returns the new coin ID ready for payment

### Step 4: Purchase AccessPass

```typescript
// SDK uses the prepared coin to purchase
const accessPassId = await client.purchaseAccessPass({
  price: '0.01',
  domain: 'www.example.com',
  resource: '/premium',
  // ... other params
});
// All coin management happens automatically!
```

## Complete Bot Example

```javascript
const { PaywallClient } = require('ai-paywall');

// Bot initializes with private key
const bot = new PaywallClient({
  privateKey: process.env.PRIVATE_KEY, // Private key
});

// ONE function call does everything:
const result = await bot.payForAccess('http://localhost:3000/premium');

// What happens under the hood:
// 1. ✅ Fetches 402 response → gets price, domain, resource, nonce
// 2. ✅ Gets all coins from wallet: bot.getCoins()
// 3. ✅ Selects best coin: bot.selectCoinForPayment()
// 4. ✅ Splits coin if needed: bot.splitCoin() ← AUTOMATIC!
// 5. ✅ Purchases AccessPass with exact payment
// 6. ✅ Signs headers for authentication
// 7. ✅ Returns ready-to-use headers

// Use the headers to access content
const response = await fetch('http://localhost:3000/premium', {
  headers: result.headers,
});
```

## Manual Control (If Needed)

If you want more control, you can do it manually:

```javascript
// Step 1: Check available coins
const coins = await bot.getCoins();
console.log('Available coins:', coins);
// Output: [
//   { coinId: '0xabc...', balance: 5000000000n }, // 5 SUI
//   { coinId: '0xdef...', balance: 1000000000n }, // 1 SUI
// ]

// Step 2: Select coin (automatically picks best one)
const coinId = await bot.selectCoinForPayment(BigInt(10_000_000));
// Picks the 1 SUI coin (enough for 0.01 SUI payment + gas)

// Step 3: Split coin (automatically creates exact amount)
const paymentCoinId = await bot.splitCoin(coinId, BigInt(10_000_000));
// Creates new coin with exactly 10,000,000 MIST (0.01 SUI)

// Step 4: Purchase (uses the split coin)
const accessPassId = await bot.purchaseAccessPass({
  price: '0.01',
  domain: 'www.example.com',
  resource: '/premium',
  remaining: 10,
  expiry: 0,
  nonce: '1234567890-abc',
});
```

## How Coin Selection Works

The SDK's `selectCoinForPayment()` function:

1. **Gets all coins** owned by the wallet
2. **Filters coins** with sufficient balance:
   ```
   coin.balance >= (paymentAmount + gasBuffer)
   ```
3. **Sorts by balance** (largest first) to optimize coin usage
4. **Returns first suitable coin** or `null` if insufficient balance

**Example:**
```javascript
Available coins:
  - Coin A: 5 SUI (5,000,000,000 MIST) ← Selected (largest)
  - Coin B: 1 SUI (1,000,000,000 MIST) ← Also sufficient
  - Coin C: 0.001 SUI (1,000,000 MIST) ← Too small

Need to pay: 0.01 SUI (10,000,000 MIST)

Result: Selects Coin A (5 SUI) and splits 0.01 SUI from it
```

## Why This is Better Than Manual

**Manual approach:**
```bash
# Bot needs to:
1. Query coins: sui client gas
2. Manually pick a coin ID
3. Split coin: sui client split-coins --coins 0x... --amounts 10000000
4. Extract new coin ID from output
5. Use that coin in purchase
# ❌ Complex, error-prone, requires parsing CLI output
```

**SDK approach:**
```javascript
// Bot just calls:
await bot.payForAccess(url);
// ✅ Simple, automatic, handles all edge cases
```

## Edge Cases Handled

1. **Exact amount coin exists** → Use it directly (no split needed)
2. **Only large coins** → Split from largest coin
3. **Insufficient balance** → Clear error message
4. **Multiple coins** → Automatically selects best one
5. **Gas estimation** → Includes gas buffer in calculations

## Summary

**Bots don't need to know coin IDs!** The SDK:
- ✅ Automatically queries wallet for coins
- ✅ Automatically selects the best coin
- ✅ Automatically splits if needed
- ✅ Handles all edge cases
- ✅ Provides simple API: `bot.payForAccess(url)`

The bot just needs:
- Private key (for signing transactions)
- URL to the protected endpoint (to get 402 challenge)

Everything else is handled automatically! 🎉

