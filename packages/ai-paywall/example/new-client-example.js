#!/usr/bin/env node
/**
 * Example: Using PaywallClient to access protected content
 * 
 * This shows how clients (AI bots) can access content protected by the paywall.
 * The client automatically handles payment, authentication, and decryption.
 * 
 * Prerequisites:
 * - Server is running with protected routes (see new-server-example.js)
 * - You have a private key with SUI for payments
 * 
 * Usage:
 *   export PRIVATE_KEY=your-private-key
 *   export SERVER_URL=http://localhost:3000
 *   export WALRUS_DOMAIN=www.demo1.com
 *   export WALRUS_RESOURCE=/hidden/dog
 *   node example/new-client-example.js
 */

try {
  require("dotenv").config();
} catch (e) {
  // ignore: `dotenv` is optional for example users
}

const { PaywallClient } = require('../dist/index');
const fs = require('fs');
const path = require('path');

// ============================================
// STEP 1: Configuration
// ============================================
const CONFIG = {
  // Your private key (required for signing and payments)
  privateKey: process.env.PRIVATE_KEY || (() => {
    throw new Error('PRIVATE_KEY environment variable is required');
  })(),
  
  // Server URL (where protected content is hosted)
  serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
  
  // Domain and resource from registry (must match server configuration)
  domain: process.env.WALRUS_DOMAIN || 'www.demo1.com',
  resource: process.env.WALRUS_RESOURCE || '/hidden/dog',
};

// ============================================
// STEP 2: Initialize PaywallClient
// ============================================
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║          PaywallClient Example                          ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

const client = new PaywallClient({
  privateKey: CONFIG.privateKey,
});

const clientAddress = client.keypair.toSuiAddress();
console.log(`✅ PaywallClient initialized`);
console.log(`   Address: ${clientAddress}`);
console.log(`   Server: ${CONFIG.serverUrl}`);
console.log(`   Domain: ${CONFIG.domain}`);
console.log(`   Resource: ${CONFIG.resource}`);
console.log('');

// ============================================
// STEP 3: Access Protected Content
// ============================================
const protectedUrl = `${CONFIG.serverUrl}${CONFIG.resource}`;

async function main() {
  try {
    console.log(`📡 Accessing protected content...`);
    console.log(`   URL: ${protectedUrl}`);
    console.log('');

    // ============================================
    // OPTION 1: Access and decrypt in one call (Recommended)
    // ============================================
    // This automatically:
    // - Handles 402 payment required
    // - Purchases AccessPass if needed
    // - Signs headers
    // - Gets encrypted content
    // - Extracts ResourceEntry ID from server headers
    // - Decrypts content using Seal
    console.log('🔓 Accessing and decrypting content...');
    const decryptedContent = await client.accessAndDecrypt(
      protectedUrl,
      CONFIG.domain,
      CONFIG.resource
    );

    console.log('✅ Successfully decrypted content!');
    console.log(`   Size: ${decryptedContent.length} bytes`);
    console.log('');

    // ============================================
    // STEP 4: Save Decrypted Content
    // ============================================
    // Detect file type and save with appropriate extension
    const fileExtension = detectFileType(decryptedContent);
    const outputFileName = `decrypted-content${fileExtension}`;
    const outputPath = path.join(__dirname, outputFileName);

    fs.writeFileSync(outputPath, Buffer.from(decryptedContent));
    console.log(`💾 Saved decrypted content:`);
    console.log(`   File: ${outputFileName}`);
    console.log(`   Path: ${outputPath}`);
    console.log('');

    // ============================================
    // SUCCESS!
    // ============================================
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║          ✅ Access Successful!                           ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`📄 Decrypted content saved to: ${outputFileName}`);
    console.log(`💰 AccessPass was purchased/used automatically`);
    console.log(`🔐 Content was decrypted using Seal encryption`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Detect file type from magic bytes and return appropriate extension
 */
function detectFileType(data) {
  if (data.length < 4) return '.bin';

  // PNG: 89 50 4E 47
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
    return '.png';
  }

  // JPEG: FF D8 FF
  if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
    return '.jpg';
  }

  // GIF: 47 49 46 38
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) {
    return '.gif';
  }

  // WebP: RIFF...WEBP
  if (
    data.length >= 12 &&
    data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
    data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50
  ) {
    return '.webp';
  }

  // Check if it's text (ASCII/UTF-8)
  let isText = true;
  for (let i = 0; i < Math.min(data.length, 1024); i++) {
    if (data[i] < 9 || (data[i] > 13 && data[i] < 32 && data[i] !== 127)) {
      isText = false;
      break;
    }
  }
  if (isText) {
    return '.txt';
  }

  return '.bin';
}

main();

