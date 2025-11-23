// 🚀 SIMPLEST USAGE - Just 4 lines of code!
// All contract interactions are abstracted - you only need your private key

const { PaywallClient } = require('../dist/index');

// 1. Initialize with private key
const bot = new PaywallClient({
  privateKey: process.env.PRIVATE_KEY || 'suiprivkey1qq4zwedasw8nc0jcpdrkkznff9rkjajp5hque5felwe3ysa6erjgy9gw62r',
});

// 2. Access protected route - that's it!
// Note: The /premium endpoint maps to domain: www.krish.com, resource: /hidden/dog
async function main() {
  const content = await bot.access('http://localhost:3000/premium');
  console.log('✅ Content:', content);
  
  // If content is an encrypted blob, you'll need to decrypt it
  // See test-with-decryption.js for decryption example
}

main().catch(console.error);

// That's it! Everything else is automatic:
// ✅ Detects 402 payment required
// ✅ Purchases AccessPass (handles coin splitting automatically)
// ✅ Signs headers
// ✅ Makes authenticated request
// ✅ Returns content

