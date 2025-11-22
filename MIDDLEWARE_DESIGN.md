# Middleware Design - Smart SDK Support

## 🎯 Goal
Keep client integration to **4-5 lines of code** with smart SDK that auto-handles 402.

---

## 📦 Middleware Implementation (ai-paywall package)

### Key Features:
1. **Returns 402 with structured JSON** - Easy for SDK to parse
2. **Verifies signed headers** - Validates AccessPass from Sui
3. **Serves mock content** - After successful verification
4. **No gas cost** - Only reads from Sui, doesn't consume

### 402 Response Format:
```json
{
  "status": 402,
  "paymentRequired": true,
  "price": "0.1",
  "priceInMist": 100000000,
  "receiver": "0xABC123",
  "packageId": "0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f",
  "treasuryId": "0x6018aa0359bba7af126f9c837325ff2bdddebc250a33bff420c3e2e6d9519808",
  "passCounterId": "0x6cd4a831ed04f75da5e5a2a14710830dc26d1a929b4e5f50a4e71d3e3b4ee85c",
  "domain": "www.example.com",
  "resource": "/hidden",
  "nonce": "uuid-here"
}
```

---

## 🤖 Client SDK Design (smart auto-handling)

### Usage (4-5 lines):
```javascript
const { PaywallClient } = require('@ai-paywall/client');

const client = new PaywallClient({
  packageId: '0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f',
  privateKey: process.env.AGENT_PRIVATE_KEY,
  rpcUrl: 'https://fullnode.testnet.sui.io'  // Optional, has default
});

// SDK automatically:
// 1. Detects 402 response
// 2. Calls purchase_pass
// 3. Signs headers
// 4. Retries request
const content = await client.fetchWithPayment('https://www.example.com/hidden');
```

### SDK Internal Flow:
```javascript
async fetchWithPayment(url) {
  // 1. First request
  let response = await fetch(url);
  
  // 2. If 402, handle payment
  if (response.status === 402) {
    const paymentInfo = await response.json();
    
    // 3. Purchase pass
    const accessPass = await this.purchasePass(paymentInfo);
    
    // 4. Sign headers
    const headers = this.signHeaders(accessPass, paymentInfo);
    
    // 5. Retry with headers
    response = await fetch(url, { headers });
  }
  
  // 6. Return content
  return await response.text();
}
```

---

## 🔑 Key Implementation Notes:

1. **Middleware 402 Response** - Must include all data SDK needs
2. **SDK Auto-retry** - Handles 402 → purchase → retry automatically
3. **Signature Verification** - Middleware verifies signatures match AccessPass owner
4. **Mock Content** - For testing, middleware serves mock content after verification

This design keeps both sides minimal code! 🚀

