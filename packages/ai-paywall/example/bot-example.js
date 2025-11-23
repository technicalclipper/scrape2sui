// Example: How a bot would use the PaywallClient SDK
// ALL CONTRACT INTERACTIONS ARE ABSTRACTED - Just provide private key!

const { PaywallClient } = require('../dist/index');

// Bot initializes with ONLY private key - that's it!
const bot = new PaywallClient({
  privateKey: process.env.PRIVATE_KEY || 'your-private-key-here', // Base64 or hex private key
  // rpcUrl: 'https://fullnode.testnet.sui.io:443' // Optional - defaults to testnet
});

async function main() {
  try {
    // 🎯 ONE-LINE ACCESS - Everything is automatic!
    // - Detects 402 payment required
    // - Automatically purchases AccessPass (handles coin splitting)
    // - Signs headers
    // - Makes request with headers
    // - Returns content
    const content = await bot.access('http://localhost:3000/premium');
    
    console.log('✅ Premium content:', content);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Alternative: Use .get() method (same as .access())
async function alternativeExample() {
  const content = await bot.get('http://localhost:3000/premium');
  console.log('Content:', content);
}

// What happens under the hood (ALL AUTOMATIC):
// 1. Bot calls bot.access(url)
// 2. Makes request → Gets 402 Payment Required
// 3. Extracts challenge (price, domain, resource, nonce, receiver)
// 4. Calls purchaseAccessPass() which:
//    - Gets all coins: getCoins()
//    - Selects best coin: selectCoinForPayment()
//    - Splits if needed: splitCoin() ← AUTOMATIC!
//    - Purchases AccessPass on-chain
// 5. Signs headers with AccessPass
// 6. Retries request with signed headers
// 7. Returns content

// Advanced: Manual control (if you need more control):
async function manualExample() {
  // Step 1: Check available coins
  const coins = await bot.getCoins();
  console.log('Available coins:', coins);
  // Output: [{ coinId: '0x...', balance: 1000000000n }, ...]
  
  // Step 2: Select coin for payment (0.01 SUI)
  const coinId = await bot.selectCoinForPayment(BigInt(10_000_000));
  console.log('Selected coin:', coinId);
  
  // Step 3: Split coin if needed
  const paymentCoinId = await bot.splitCoin(coinId, BigInt(10_000_000));
  console.log('Split coin created:', paymentCoinId);
  
  // Step 4: Purchase (or use purchaseAccessPass which does steps 1-3 automatically)
  const accessPassId = await bot.purchaseAccessPass({
    price: '0.01',
    domain: 'www.example.com',
    resource: '/premium',
    remaining: 10,
    expiry: 0,
    nonce: '1234567890-abc123',
    receiver: '0x...', // Receiver address from 402 challenge
  });
  
  console.log('AccessPass ID:', accessPassId);
}

if (require.main === module) {
  main();
}

module.exports = { main, manualExample };

