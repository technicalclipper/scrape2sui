#!/usr/bin/env node
/**
 * Test with Registered Content
 * 
 * This test uses the actual registered content from registry-app:
 * - Domain: www.krish.com
 * - Resource: /hidden/dog
 * - Walrus Blob ID: w5HhcKzcAxbdfOoSW1Y_Xk4i1LbwiNrm6WVYJDuvNWQ
 * - Seal Policy ID: 3f0435b67209d368487713d895ab999271bd9e67f05cf847b7d6cdde70e48409
 * - Resource Entry ID: 0xcb7d2b8547d42740adbb1e81ce90aa1750bad886aed3ed50f8aefad80133b4b5
 * 
 * Usage:
 *   export PRIVATE_KEY=your-private-key
 *   node example/test-registered-content.js
 */

const { PaywallClient } = require('../dist/index');

// Registered content from registry-app
const REGISTERED_CONTENT = {
  domain: 'www.krish.com',
  resource: '/hidden/dog',
  walrusBlobId: 'w5HhcKzcAxbdfOoSW1Y_Xk4i1LbwiNrm6WVYJDuvNWQ',
  sealPolicyId: '3f0435b67209d368487713d895ab999271bd9e67f05cf847b7d6cdde70e48409',
  resourceEntryId: '0xcb7d2b8547d42740adbb1e81ce90aa1750bad886aed3ed50f8aefad80133b4b5',
  walrusObjectId: '0x98beeefcb2c49b2648eb3289807d701623189b6eebc4ce0ee2d5879eaa767be6',
};

const SERVER_URL = 'http://localhost:3000';
const ENDPOINT = '/premium'; // Server maps this to www.krish.com /hidden/dog

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function main() {
  log('╔════════════════════════════════════════════════════════════╗', colors.blue);
  log('║   Testing with Registered Content                         ║', colors.blue);
  log('╚════════════════════════════════════════════════════════════╝', colors.blue);
  log('');
  log('Registered Content:', colors.cyan);
  log(`  Domain: ${REGISTERED_CONTENT.domain}`, colors.yellow);
  log(`  Resource: ${REGISTERED_CONTENT.resource}`, colors.yellow);
  log(`  Walrus Blob ID: ${REGISTERED_CONTENT.walrusBlobId}`, colors.yellow);
  log(`  Seal Policy ID: ${REGISTERED_CONTENT.sealPolicyId}`, colors.yellow);
  log(`  Resource Entry ID: ${REGISTERED_CONTENT.resourceEntryId}`, colors.yellow);
  log('');

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    log('❌ PRIVATE_KEY environment variable not set!', colors.red);
    log('   Set it with: export PRIVATE_KEY=your-private-key', colors.yellow);
    process.exit(1);
  }

  try {
    // Initialize PaywallClient
    log('1️⃣  Initializing PaywallClient...', colors.cyan);
    const client = new PaywallClient({
      privateKey: privateKey,
    });
    log(`   ✅ Client initialized (address: ${client.keypair.toSuiAddress()})`, colors.green);
    log('');

    // Access protected content
    log('2️⃣  Accessing protected content...', colors.cyan);
    log(`   URL: ${SERVER_URL}${ENDPOINT}`, colors.yellow);
    log(`   Expected domain: ${REGISTERED_CONTENT.domain}`, colors.yellow);
    log(`   Expected resource: ${REGISTERED_CONTENT.resource}`, colors.yellow);
    log('');

    const content = await client.access(`${SERVER_URL}${ENDPOINT}`);
    
    log('3️⃣  Content received!', colors.cyan);
    
    // Check if content is an encrypted blob or JSON
    if (Buffer.isBuffer(content) || content instanceof ArrayBuffer) {
      log('   📦 Received encrypted blob', colors.yellow);
      log(`   Size: ${content.byteLength || content.length} bytes`, colors.cyan);
      
      // Save encrypted blob
      const fs = require('fs');
      fs.writeFileSync('encrypted-content.bin', Buffer.from(content));
      log('   ✅ Saved to: encrypted-content.bin', colors.green);
      
      log('');
      log('   To decrypt, you need:', colors.yellow);
      log('   1. Signed SessionKey from wallet', colors.yellow);
      log('   2. Resource Entry ID: ' + REGISTERED_CONTENT.resourceEntryId, colors.yellow);
      log('   3. Seal Policy ID: ' + REGISTERED_CONTENT.sealPolicyId, colors.yellow);
      log('   4. AccessPass ID (from purchase)', colors.yellow);
      log('');
      log('   See README_DECRYPTION.md for decryption instructions', colors.cyan);
    } else if (typeof content === 'object') {
      log('   📄 Received JSON response', colors.yellow);
      console.log(JSON.stringify(content, null, 2));
    } else {
      log('   📄 Received text response', colors.yellow);
      console.log(content);
    }

    log('');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.blue);
    log('✅ Test Complete!', colors.green);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.blue);
    log('');

  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Run test
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main, REGISTERED_CONTENT };

