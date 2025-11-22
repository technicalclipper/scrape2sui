// Example: How a bot would use the PaywallClient SDK
// This shows how coin splitting happens automatically

const { PaywallClient } = require('../dist/index');

// Bot initializes with private key
const bot = new PaywallClient({
  privateKey: process.env.PRIVATE_KEY, // Base64 or hex private key
  // rpcUrl: 'https://fullnode.testnet.sui.io:443' // Optional
});

async function main() {
  try {
    // Complete flow: Automatically handles everything
    const result = await bot.payForAccess('http://localhost:3000/premium');
    
    console.log('✅ AccessPass purchased:', result.accessPassId);
    console.log('Headers:', result.headers);
    
    // Use headers to access protected content
    const response = await fetch('http://localhost:3000/premium', {
      headers: result.headers,
    });
    
    const content = await response.json();
    console.log('✅ Premium content:', content);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// What happens under the hood:
// 1. Bot calls payForAccess(url)
// 2. Fetches 402 response → gets price, domain, resource, nonce
// 3. Calls purchaseAccessPass() which:
//    - Gets all coins: bot.getCoins()
//    - Selects best coin: bot.selectCoinForPayment()
//    - Splits if needed: bot.splitCoin() ← AUTOMATIC!
//    - Purchases AccessPass
// 4. Signs headers for authentication
// 5. Returns headers ready to use

// Manual example (if you want more control):
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
  });
  
  console.log('AccessPass ID:', accessPassId);
}

if (require.main === module) {
  main();
}

module.exports = { main, manualExample };

