# Integration Guide - Lines of Code Required

## 📊 Summary

### Website Owner
**~2-3 lines of code** ✅

### Client Bot/AI Agent  
**~15-25 lines of code** ✅

---

## 🏢 For Website Owner

### Installation
```bash
npm install ai-paywall
```

### Integration Code (2-3 lines)

```javascript
const express = require('express');
const { paywall } = require('ai-paywall');

const app = express();

// Protect a route - ONLY THIS IS NEEDED!
app.use('/hidden', paywall({
  price: '0.1',                    // Price in SUI
  receiver: '0xABC123',            // Your wallet address (optional, uses contract default)
  domain: 'www.example.com',       // Your domain
  contractAddress: '0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f'
}));

// Your existing route handler - no changes needed!
app.get('/hidden', (req, res) => {
  res.send('This is premium content!');
});
```

**Total: 2-3 lines added** ✅

---

## 🤖 For Client Bot/AI Agent

### Installation
```bash
npm install @ai-paywall/client
```

### Integration Code (~15-25 lines)

```javascript
const { PaywallClient } = require('@ai-paywall/client');

// Initialize client (once per agent)
const client = new PaywallClient({
  packageId: '0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f',
  privateKey: process.env.AGENT_PRIVATE_KEY  // Your Sui private key
});

// Function to access protected content
async function accessProtectedContent(url) {
  try {
    // First attempt - might get 402
    let response = await fetch(url);
    
    if (response.status === 402) {
      // Payment required
      const paymentInfo = await response.json();
      
      // Purchase access pass
      const accessPass = await client.payForAccess({
        domain: paymentInfo.domain,
        resource: paymentInfo.resource,
        price: paymentInfo.price,
        nonce: paymentInfo.nonce,
        treasuryId: paymentInfo.treasuryId,
        passCounterId: paymentInfo.passCounterId
      });
      
      // Retry with signed headers
      response = await fetch(url, {
        headers: {
          'x-pass-id': accessPass.passId,
          'x-signer': accessPass.owner,
          'x-sig': accessPass.signature,
          'x-ts': accessPass.timestamp
        }
      });
    }
    
    // Get content
    const content = await response.text();
    return content;
    
  } catch (error) {
    console.error('Access failed:', error);
    throw error;
  }
}

// Usage
const content = await accessProtectedContent('https://www.example.com/hidden');
console.log(content);
```

**Total: ~15-25 lines** (depending on error handling)

---

## 📝 Simplified Client Usage (If SDK is well-designed)

If we make the SDK super simple:

```javascript
const { PaywallClient } = require('@ai-paywall/client');

const client = new PaywallClient({
  packageId: '0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f',
  privateKey: process.env.AGENT_PRIVATE_KEY
});

// That's it! SDK handles 402 automatically
const content = await client.fetchWithPayment('https://www.example.com/hidden');
```

**Could be just 4-5 lines!** ✨

---

## 🎯 Key Points

1. **Website Owner**: Just add 1 middleware line - that's it!
2. **Client Bot**: 15-25 lines (or 4-5 if SDK is smart about 402 handling)
3. **No complex setup** - everything works out of the box
4. **Contract handles all validation** - middleware just reads and verifies

This is very minimal integration effort for both sides! 🚀

