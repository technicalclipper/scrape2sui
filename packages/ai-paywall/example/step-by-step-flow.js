#!/usr/bin/env node
/**
 * Step-by-Step Flow Example
 * 
 * This script demonstrates the complete PaywallClient flow:
 * 1. First request encounters 402 Payment Required
 * 2. Purchase AccessPass
 * 3. Get the content with authenticated request
 * 
 * Usage:
 *   export PRIVATE_KEY=your-private-key
 *   node example/step-by-step-flow.js
 */

const { PaywallClient } = require('../dist/index');

// Colors for output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const ENDPOINT = process.env.WALRUS_RESOURCE || "/hidden/dog"; // Protected route

async function main() {
  log(
    "╔════════════════════════════════════════════════════════════╗",
    colors.blue
  );
  log(
    "║   Step-by-Step PaywallClient Flow Demonstration          ║",
    colors.blue
  );
  log(
    "╚════════════════════════════════════════════════════════════╝",
    colors.blue
  );
  log("");

  // Check for private key
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    log("❌ PRIVATE_KEY environment variable not set!", colors.red);
    log("   Set it with: export PRIVATE_KEY=your-private-key", colors.yellow);
    process.exit(1);
  }

  try {
    // Step 0: Initialize PaywallClient
    log("🔧 Step 0: Initializing PaywallClient...", colors.cyan);
    const client = new PaywallClient({
      privateKey: privateKey,
    });
    const address = client.keypair.toSuiAddress();
    log(`   ✅ Client initialized`, colors.green);
    log(`   📍 Address: ${address}`, colors.cyan);
    log("");

    // Step 1: Make initial request - will get 402 Payment Required
    log("1️⃣  Step 1: Making initial request (expecting 402)...", colors.cyan);
    log(`   URL: ${SERVER_URL}${ENDPOINT}`, colors.yellow);
    
    const initialResponse = await fetch(`${SERVER_URL}${ENDPOINT}`);
    log(`   Status: ${initialResponse.status}`, colors.cyan);

    if (initialResponse.status !== 402) {
      log(`   ❌ Expected 402, got ${initialResponse.status}`, colors.red);
      if (initialResponse.status === 200) {
        const content = await initialResponse.text();
        log(`   Content: ${content.substring(0, 200)}...`, colors.yellow);
        log("   ℹ️  Access granted immediately (might already have valid pass)", colors.yellow);
        return;
      } else {
        throw new Error(`Unexpected status: ${initialResponse.status}`);
      }
    }

    log("   ✅ Received 402 Payment Required", colors.green);
    
    // Parse the payment challenge
    const challenge = await initialResponse.json();
    log("   📋 Payment Challenge:", colors.cyan);
    log(`      - Price: ${challenge.price} SUI`, colors.yellow);
    log(`      - Domain: ${challenge.domain}`, colors.yellow);
    log(`      - Resource: ${challenge.resource}`, colors.yellow);
    log(`      - Receiver: ${challenge.receiver}`, colors.yellow);
    log(`      - Nonce: ${challenge.nonce}`, colors.yellow);
    log("");

    // Step 2: Check for existing AccessPass
    log("2️⃣  Step 2: Checking for existing AccessPass...", colors.cyan);
    const normalizedResource = challenge.resource === '/' ? '/' : challenge.resource.replace(/\/$/, '');
    
    let accessPassId = await client.findExistingAccessPass(challenge.domain, normalizedResource);
    
    if (accessPassId) {
      log(`   ✅ Found existing AccessPass: ${accessPassId}`, colors.green);
    } else {
      log(`   ℹ️  No existing AccessPass found`, colors.yellow);
      log("");

      // Step 3: Purchase AccessPass
      log("3️⃣  Step 3: Purchasing AccessPass...", colors.cyan);
      log(`   Price: ${challenge.price} SUI`, colors.yellow);
      log(`   Domain: ${challenge.domain}`, colors.yellow);
      log(`   Resource: ${normalizedResource}`, colors.yellow);
      log("   ⏳ Processing payment (this may take a moment)...", colors.yellow);

      try {
        accessPassId = await client.purchaseAccessPass({
          price: challenge.price,
          domain: challenge.domain,
          resource: normalizedResource,
          remaining: 10, // Default remaining uses
          expiry: 0, // No expiry
          nonce: challenge.nonce,
          receiver: challenge.receiver,
        });

        log(`   ✅ AccessPass purchased successfully!`, colors.green);
        log(`   🎫 AccessPass ID: ${accessPassId}`, colors.green);
        
        // Wait for AccessPass to be indexed on-chain
        log("   ⏳ Waiting for AccessPass to be indexed on-chain...", colors.yellow);
        await new Promise(resolve => setTimeout(resolve, 2000));
        log("   ✅ AccessPass indexed", colors.green);
      } catch (error) {
        log(`   ❌ Failed to purchase AccessPass: ${error.message}`, colors.red);
        if (error.stack) {
          console.error(error.stack);
        }
        throw error;
      }
    }
    log("");

    // Step 4: Sign headers for authenticated request
    log("4️⃣  Step 4: Signing headers for authenticated request...", colors.cyan);
    const timestamp = Date.now().toString();
    
    let signature;
    try {
      signature = await client.signMessage(
        accessPassId,
        challenge.domain,
        normalizedResource,
        timestamp
      );
      log("   ✅ Headers signed successfully", colors.green);
      log(`   📝 Signature: ${signature.substring(0, 20)}...`, colors.cyan);
    } catch (error) {
      log(`   ❌ Failed to sign headers: ${error.message}`, colors.red);
      throw error;
    }
    log("");

    // Step 5: Make authenticated request with headers
    log("5️⃣  Step 5: Making authenticated request...", colors.cyan);
    log(`   URL: ${SERVER_URL}${ENDPOINT}`, colors.yellow);
    
    const authenticatedHeaders = {
      'x-pass-id': accessPassId,
      'x-signer': address,
      'x-sig': signature,
      'x-ts': timestamp,
      'Connection': 'close',
    };

    log("   📋 Headers:", colors.cyan);
    log(`      - x-pass-id: ${accessPassId}`, colors.yellow);
    log(`      - x-signer: ${address}`, colors.yellow);
    log(`      - x-ts: ${timestamp}`, colors.yellow);
    log(`      - x-sig: ${signature.substring(0, 20)}...`, colors.yellow);
    log("");

    const authenticatedResponse = await fetch(`${SERVER_URL}${ENDPOINT}`, {
      method: 'GET',
      headers: authenticatedHeaders,
    });

    log(`   Status: ${authenticatedResponse.status}`, colors.cyan);

    if (authenticatedResponse.status !== 200) {
      const errorText = await authenticatedResponse.text();
      log(`   ❌ Request failed with status ${authenticatedResponse.status}`, colors.red);
      log(`   Response: ${errorText}`, colors.yellow);
      throw new Error(`Request failed: ${authenticatedResponse.status}`);
    }

    log("   ✅ Request successful! Content received", colors.green);
    log("");

    // Step 6: Process the content
    log("6️⃣  Step 6: Processing content...", colors.cyan);
    
    const contentType = authenticatedResponse.headers.get('content-type');
    let content;

    if (contentType && contentType.includes('application/octet-stream')) {
      // Binary content (encrypted blob)
      content = await authenticatedResponse.arrayBuffer();
      log(`   📦 Received encrypted blob (${content.byteLength} bytes)`, colors.green);
      log(`   ℹ️  This is encrypted content that can be decrypted with client.decrypt()`, colors.yellow);
    } else if (contentType && contentType.includes('application/json')) {
      // JSON content
      content = await authenticatedResponse.json();
      log(`   📄 Received JSON content`, colors.green);
      log(`   Content: ${JSON.stringify(content).substring(0, 200)}...`, colors.yellow);
    } else {
      // Try to get as text
      content = await authenticatedResponse.text();
      log(`   📄 Received text content (${content.length} chars)`, colors.green);
      log(`   Preview: ${content.substring(0, 200)}...`, colors.yellow);
    }

    log("");

    // Step 7: Consume AccessPass (decrement remaining uses)
    log("7️⃣  Step 7: Consuming AccessPass (decrementing remaining uses)...", colors.cyan);
    try {
      await client.consumeAccessPass(accessPassId);
      log("   ✅ AccessPass consumed successfully", colors.green);
    } catch (error) {
      log(`   ⚠️  Warning: Failed to consume AccessPass: ${error.message}`, colors.yellow);
      log("   ℹ️  This is non-critical - content was already received", colors.yellow);
    }

    log("");
    log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      colors.blue
    );
    log("✅ Flow Complete! Successfully accessed protected content", colors.green);
    log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      colors.blue
    );
    log("");

    // Summary
    log("📊 Summary:", colors.cyan);
    log(`   - AccessPass ID: ${accessPassId}`, colors.yellow);
    log(`   - Domain: ${challenge.domain}`, colors.yellow);
    log(`   - Resource: ${normalizedResource}`, colors.yellow);
    log(`   - Price Paid: ${challenge.price} SUI`, colors.yellow);
    log(`   - Content Type: ${contentType || 'unknown'}`, colors.yellow);
    log(`   - Content Size: ${content.byteLength || content.length || 'N/A'} bytes`, colors.yellow);
    log("");

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, colors.red);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the flow
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { main };

