#!/usr/bin/env node
/**
 * Test with Registered Content
 *
 * This test uses the actual registered content from registry-app:
 * - Domain: DOMAIN
 * - Resource: /hidden/dog
 * - Walrus Blob ID: CJdVQYMwrqww9u7413CuQTDvOLaeZlurHfwkeDXSx4I
 * - Seal Policy ID: c16ea2047827a5f2fca199bdacf13934539d053f4bd3a922e3c93175ba17759d8067f0ee3f
 * - Resource Entry ID: 0x5c6f02b39b6e02de098a68c0d72fc7a812365403f2e27e5ede2e49ff8ab34333
 *
 * Usage:
 *   export PRIVATE_KEY=your-private-key
 *   node example/test-registered-content.js
 */

const { PaywallClient } = require("../dist/index");
// Use @mysten/sui (newer package) for Seal compatibility, same as Seal examples
const { SealClient, SessionKey, EncryptedObject } = require("@mysten/seal");
const { SuiClient, getFullnodeUrl } = require("@mysten/sui/client");
const { Transaction } = require("@mysten/sui/transactions");
const { fromHex, toHex, toB64 } = require("@mysten/sui/utils");
const contractConfig = require("../dist/config/contract.json");
const REGISTERED_CONTENT = {
  domain: process.env.WALRUS_DOMAIN || "www.demo1.com",
  resource: process.env.WALRUS_RESOURCE || "/hidden/dog",
  walrusBlobId: process.env.WALRUS_BLOB_ID || "wqwm17mRGo5PkXPo5p_I-RXtNIH4kdM-UnPVksBQ5lY",
  sealPolicyId: process.env.SEAL_POLICY_ID || "f02db2d9f0844665d33376e822e6c2e0c150344572fb7b8f4d4b6323621b5895cbe9653375",
  resourceEntryId: process.env.RESOURCE_ENTRY_ID || "0x44ace4be0c2ca4bf48bdb4f6a8069ff2beb73c3b33409035cffefa160ff40f5d",
};

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const ENDPOINT = process.env.WALRUS_RESOURCE || "/hidden/dog"; // Matches registered resource in registry

// Seal server object IDs for testnet
const SEAL_SERVER_OBJECT_IDS = [
  "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
  "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
];

// Colors for output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function normalizeHexString(hex) {
  let cleaned = hex.startsWith("0x") ? hex.slice(2) : hex;
  cleaned = cleaned.toLowerCase();
  return cleaned;
}

async function decryptContentWithSeal(encryptedBlob, accessPassId, client) {
  log("4️⃣  Decrypting content...", colors.cyan);

  const packageId = contractConfig.packageId;
  const resourceId = REGISTERED_CONTENT.resourceEntryId;
  const userAddress = client.keypair.toSuiAddress();

  try {
    // Parse encrypted object
    const encryptedData = new Uint8Array(encryptedBlob);
    const encryptedObject = EncryptedObject.parse(encryptedData);
    const threshold = encryptedObject.threshold;
    log(`   Threshold: ${threshold}`, colors.cyan);

    // EncryptedObject has separate package_id and id fields
    // encryptedObject.id is the policy ID (37 bytes), not the full ID
    // For Seal operations, we need the full ID (package_id + id concatenated)
    // For seal_approve contract call, we need only the policy ID (37 bytes)

    log(
      `   Raw encryptedObject.id type: ${typeof encryptedObject.id}`,
      colors.cyan
    );
    log(
      `   Raw encryptedObject.id: ${
        typeof encryptedObject.id === "string"
          ? encryptedObject.id
          : toHex(new Uint8Array(encryptedObject.id))
      }`,
      colors.cyan
    );
    log(
      `   Raw encryptedObject.packageId: ${
        encryptedObject.packageId || "undefined"
      }`,
      colors.cyan
    );

    const policyId = encryptedObject.id; // This is the 37-byte policy ID
    const encryptedPackageId = encryptedObject.packageId || packageId; // Package ID from encrypted object or fallback

    // Convert policy ID to bytes
    let policyIdBytes;
    if (typeof policyId === "string") {
      const normalizedPolicyId = normalizeHexString(policyId);
      policyIdBytes = fromHex(normalizedPolicyId);
    } else if (policyId instanceof Uint8Array) {
      policyIdBytes = policyId;
    } else if (Array.isArray(policyId)) {
      policyIdBytes = new Uint8Array(policyId);
    } else {
      throw new Error(`Unexpected policy ID type: ${typeof policyId}`);
    }

    // Verify policy ID is 37 bytes
    if (policyIdBytes.length !== 37) {
      throw new Error(
        `Invalid policy ID length: expected 37 bytes (32-byte base + 5-byte nonce), got ${policyIdBytes.length}`
      );
    }

    // For Seal operations, use the policy ID directly (as hex string)
    // Seal SDK will construct the full ID internally using the package ID from EncryptedObject
    const policyIdHex =
      typeof policyId === "string"
        ? normalizeHexString(policyId)
        : toHex(policyIdBytes);

    // Construct full ID for reference (package_id + policy_id)
    // Note: Seal SDK may handle full ID construction internally, but we construct it here for completeness
    const normalizedPackageId = normalizeHexString(encryptedPackageId);
    const packageIdBytes = fromHex(normalizedPackageId);
    const fullIdBytes = new Uint8Array([...packageIdBytes, ...policyIdBytes]);
    const fullId = toHex(fullIdBytes); // Full ID as hex string

    // Extract nonce (last 5 bytes of policy ID)
    const nonceBytes = policyIdBytes.slice(-5);
    const nonceHex = toHex(nonceBytes);

    log(`   Package ID: ${encryptedPackageId}`, colors.cyan);
    log(`   Package ID length: ${packageIdBytes.length} bytes`, colors.cyan);
    log(`   Policy ID (37 bytes, hex): ${policyIdHex}`, colors.cyan);
    log(`   Policy ID length: ${policyIdBytes.length} bytes`, colors.cyan);
    log(`   Nonce (last 5 bytes, hex): ${nonceHex}`, colors.cyan);
    log(`   Full ID (69 bytes, hex): ${fullId}`, colors.cyan);
    log(`   Full ID length: ${fullIdBytes.length} bytes`, colors.cyan);
    log(`   Resource Entry ID: ${resourceId}`, colors.cyan);
    log(`   AccessPass ID: ${accessPassId}`, colors.cyan);

    // Create Sui and Seal clients
    const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });
    const sealClient = new SealClient({
      suiClient: suiClient,
      serverConfigs: SEAL_SERVER_OBJECT_IDS.map((id) => ({
        objectId: id,
        weight: 1,
      })),
      verifyKeyServers: false,
    });

    // Create SessionKey
    log("   Creating SessionKey...", colors.yellow);
    const sessionKey = await SessionKey.create({
      address: userAddress,
      packageId: packageId,
      ttlMin: 10,
      suiClient: suiClient,
    });

    // Sign SessionKey
    log("   Signing SessionKey...", colors.yellow);
    const personalMessage = sessionKey.getPersonalMessage();
    const signatureResult = await client.keypair.signPersonalMessage(
      personalMessage
    );

    // Extract signature as base64 string (Seal expects string, not bytes)
    let signatureString;
    if (typeof signatureResult === "string") {
      signatureString = signatureResult;
    } else if (signatureResult && typeof signatureResult === "object") {
      if (
        "signature" in signatureResult &&
        typeof signatureResult.signature === "string"
      ) {
        signatureString = signatureResult.signature;
      } else if (
        "signature" in signatureResult &&
        signatureResult.signature instanceof Uint8Array
      ) {
        signatureString = toB64(signatureResult.signature);
      } else if ("bytes" in signatureResult) {
        const bytes =
          signatureResult.bytes instanceof Uint8Array
            ? signatureResult.bytes
            : new Uint8Array(Object.values(signatureResult.bytes));
        signatureString = toB64(bytes);
      } else {
        const values = Object.values(signatureResult);
        if (values.length > 0 && values[0] instanceof Uint8Array) {
          signatureString = toB64(values[0]);
        } else {
          throw new Error("Could not extract signature");
        }
      }
    } else if (signatureResult instanceof Uint8Array) {
      signatureString = toB64(signatureResult);
    } else {
      throw new Error("Invalid signature result");
    }

    await sessionKey.setPersonalMessageSignature(signatureString);
    log("   ✅ SessionKey signed", colors.green);

    // Build seal_approve transaction
    // Following seal/examples pattern: moveCallConstructor receives id (policy ID hex string)
    // and converts it to bytes with fromHex(id) for the contract call
    log("   Building seal_approve transaction...", colors.yellow);
    log(`   Summary of all IDs:`, colors.bright);
    log(
      `   ┌─────────────────────────────────────────────────────────┐`,
      colors.bright
    );
    log(`   │ Package ID: ${encryptedPackageId.padEnd(65)}│`, colors.bright);
    log(`   │ Policy ID:  ${policyIdHex.padEnd(65)}│`, colors.bright);
    log(`   │ Nonce:      ${nonceHex.padEnd(65)}│`, colors.bright);
    log(
      `   │ Full ID:    ${fullId.substring(0, 65).padEnd(65)}│`,
      colors.bright
    );
    log(`   │ Resource:   ${resourceId.padEnd(65)}│`, colors.bright);
    log(`   │ AccessPass: ${accessPassId.padEnd(65)}│`, colors.bright);
    log(
      `   └─────────────────────────────────────────────────────────┘`,
      colors.bright
    );

    // Following seal/examples pattern exactly:
    // moveCallConstructor receives id (hex string) and uses fromHex(id) for contract call
    const moveCallConstructor = (tx, id) => {
      // id is the policy ID as hex string (like in seal/examples)
      // Convert to bytes using fromHex, matching seal/examples pattern
      tx.moveCall({
        target: `${packageId}::registry::seal_approve`,
        arguments: [
          tx.pure.vector("u8", Array.from(fromHex(id))), // Convert hex string to bytes like examples
          tx.object(resourceId),
          tx.object(accessPassId),
          tx.object("0x6"), // Clock
        ],
      });
    };

    // Build transaction for fetchKeys using policy ID (like seal/examples)
    const tx = new Transaction();
    moveCallConstructor(tx, policyIdHex); // Pass policy ID hex string
    const txBytes = await tx.build({
      client: suiClient,
      onlyTransactionKind: true,
    });

    // Log transaction bytes for debugging
    const txBytesHex = toHex(txBytes);
    const txBytesLength = txBytes.length;
    log("   Transaction built for seal_approve", colors.cyan);
    log(`   Transaction bytes length: ${txBytesLength} bytes`, colors.cyan);
    log(
      `   Transaction bytes (hex, first 100 chars): ${txBytesHex.substring(
        0,
        100
      )}...`,
      colors.cyan
    );

    // Fetch decryption keys
    // Following seal/examples pattern: use encryptedObject.id directly (policy ID as hex string)
    // The Seal SDK will handle constructing the full ID internally
    log("   Fetching decryption keys from Seal servers...", colors.yellow);
    log(`   Using policy ID for fetchKeys: ${policyIdHex}`, colors.yellow);
    log(`   Policy ID length: ${policyIdHex.length / 2} bytes (hex)`, colors.yellow);
    log(`   Using same txBytes (length: ${txBytesLength})`, colors.yellow);
    try {
      await sealClient.fetchKeys({
        ids: [policyIdHex], // Use policy ID (hex string) like seal/examples do
        txBytes,
        sessionKey,
        threshold: threshold,
      });
      log("   ✅ Keys fetched successfully", colors.green);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : String(err) || "Unknown error";
      log(`   ❌ Failed to fetch keys: ${errorMsg}`, colors.red);
      if (err && typeof err === "object" && "stack" in err) {
        log(`   Stack: ${String(err.stack)}`, colors.yellow);
      }
      throw err;
    }

    // Decrypt content
    // Following seal/examples pattern: build a fresh transaction for decrypt using the same ID
    // But use the SAME transaction bytes as fetchKeys to ensure nonce verification matches
    log("   Decrypting content...", colors.yellow);
    log(
      `   Using policy ID for decrypt transaction: ${policyIdHex}`,
      colors.yellow
    );
    log(
      `   Encrypted data length: ${encryptedData.length} bytes`,
      colors.yellow
    );
    
    // Build transaction for decrypt - use the SAME transaction bytes as fetchKeys
    // The Seal SDK will extract the ID from the encrypted data, so we just need matching txBytes
    log(`   Using SAME txBytes from fetchKeys (length: ${txBytesLength})`, colors.yellow);
    try {
      const decryptedData = await sealClient.decrypt({
        data: encryptedData,
        sessionKey,
        txBytes: txBytes, // Use the EXACT same txBytes as fetchKeys (critical for nonce verification)
      });
      log(
        `   ✅ Content decrypted (${decryptedData.length} bytes)`,
        colors.green
      );
      return decryptedData;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : String(err) || "Unknown error";
      log(`   ❌ Decryption failed: ${errorMsg}`, colors.red);
      if (err && typeof err === "object" && "stack" in err) {
        log(`   Stack: ${String(err.stack)}`, colors.yellow);
      }
      throw err;
    }
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error) || "Unknown error";
    log(`   ❌ Decryption error: ${errorMsg}`, colors.red);
    if (error && typeof error === "object" && "stack" in error) {
      log(
        `   Stack: ${String(error.stack).split("\n").slice(0, 3).join("\n")}`,
        colors.yellow
      );
    }
    throw error;
  }
}

async function main() {
  log(
    "╔════════════════════════════════════════════════════════════╗",
    colors.blue
  );
  log(
    "║   Testing with Registered Content                         ║",
    colors.blue
  );
  log(
    "╚════════════════════════════════════════════════════════════╝",
    colors.blue
  );
  log("");
  log("Registered Content:", colors.cyan);
  log(`  Domain: ${REGISTERED_CONTENT.domain}`, colors.yellow);
  log(`  Resource: ${REGISTERED_CONTENT.resource}`, colors.yellow);
  log(`  Walrus Blob ID: ${REGISTERED_CONTENT.walrusBlobId}`, colors.yellow);
  log(`  Seal Policy ID: ${REGISTERED_CONTENT.sealPolicyId}`, colors.yellow);
  log(
    `  Resource Entry ID: ${REGISTERED_CONTENT.resourceEntryId}`,
    colors.yellow
  );
  log("");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    log("❌ PRIVATE_KEY environment variable not set!", colors.red);
    log("   Set it with: export PRIVATE_KEY=your-private-key", colors.yellow);
    process.exit(1);
  }

  try {
    // Initialize PaywallClient
    log("1️⃣  Initializing PaywallClient...", colors.cyan);
    const client = new PaywallClient({
      privateKey: privateKey,
    });
    log(
      `   ✅ Client initialized (address: ${client.keypair.toSuiAddress()})`,
      colors.green
    );
    log("");

    // Access protected content
    log("2️⃣  Accessing protected content...", colors.cyan);
    log(`   URL: ${SERVER_URL}${ENDPOINT}`, colors.yellow);
    log(`   Expected domain: ${REGISTERED_CONTENT.domain}`, colors.yellow);
    log(`   Expected resource: ${REGISTERED_CONTENT.resource}`, colors.yellow);
    log("");

    const content = await client.access(`${SERVER_URL}${ENDPOINT}`);

    log("3️⃣  Content received!", colors.cyan);

    // Check if content is an encrypted blob or JSON
    let encryptedBlob = null;
    let accessPassId = null;

    if (Buffer.isBuffer(content) || content instanceof ArrayBuffer) {
      encryptedBlob = content;
      log("   📦 Received encrypted blob from Walrus", colors.green);
      log(
        `   Size: ${content.byteLength || content.length} bytes`,
        colors.cyan
      );
    } else if (typeof content === "object") {
      log("   📄 Received JSON response", colors.yellow);
      console.log(JSON.stringify(content, null, 2));
      return; // No decryption needed for JSON
    } else {
      log("   📄 Received text response", colors.yellow);
      console.log(content);
      return; // No decryption needed for text
    }

    // Get AccessPass ID for decryption
    // Note: client.access() may have already consumed an AccessPass, so we need to find one
    // that matches the domain/resource. The domain might differ slightly (e.g., www.newkrish.com vs www.new1krish.com)
    log("");
    log("   Getting AccessPass ID for decryption...", colors.yellow);

    // Try to find AccessPass for the registered domain/resource
    // If client.access() consumed one, we need to find another valid one (or the same one if it has remaining uses)
    let existingPass = await client.findExistingAccessPass(
      REGISTERED_CONTENT.domain,
      REGISTERED_CONTENT.resource
    );

    // If not found, try without the exact domain match (sometimes domains differ slightly)
    if (!existingPass) {
      log("   ⚠️  No AccessPass found for exact domain match, trying alternative lookup...", colors.yellow);
      // The client.access() may have used a slightly different domain
      // We'll need to rely on the AccessPass from the server response or query more broadly
      // For now, save the encrypted blob and note that AccessPass lookup failed
    }

    if (!existingPass) {
      log("   ⚠️  No AccessPass found - cannot decrypt", colors.yellow);
      log("   This may happen if:", colors.yellow);
      log("     1. The AccessPass was consumed and has no remaining uses", colors.yellow);
      log("     2. The domain/resource doesn't match exactly", colors.yellow);
      log("     3. No AccessPass was purchased for this content", colors.yellow);
      log("   Saving encrypted blob for manual decryption...", colors.yellow);
      const fs = require("fs");
      fs.writeFileSync("encrypted-new-content.bin", Buffer.from(encryptedBlob));
      log("   ✅ Saved to: encrypted-new-content.bin", colors.green);
      return;
    }

    accessPassId = existingPass;
    log(`   ✅ Found AccessPass: ${accessPassId}`, colors.green);
    log("");

    // Decrypt the content
    try {
      const decryptedData = await decryptContentWithSeal(
        encryptedBlob,
        accessPassId,
        client
      );

      // Save decrypted content
      log("");
      log("5️⃣  Saving decrypted content...", colors.cyan);
      const fs = require("fs");

      // Try to determine file type from content
      const decryptedBuffer = Buffer.from(decryptedData);
      
      // Detect file type by checking magic bytes (file signatures)
      function detectFileType(buffer) {
        // Check for image formats by magic bytes
        if (buffer.length >= 4) {
          // PNG: 89 50 4E 47
          if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            return { type: 'image', extension: 'png', mime: 'image/png' };
          }
          // JPEG: FF D8 FF
          if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
            return { type: 'image', extension: 'jpg', mime: 'image/jpeg' };
          }
          // GIF: 47 49 46 38 (GIF8)
          if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
            return { type: 'image', extension: 'gif', mime: 'image/gif' };
          }
          // WebP: Check for RIFF...WEBP
          if (buffer.length >= 12 && 
              buffer.toString('ascii', 0, 4) === 'RIFF' && 
              buffer.toString('ascii', 8, 12) === 'WEBP') {
            return { type: 'image', extension: 'webp', mime: 'image/webp' };
          }
          // SVG: Check if it starts with XML or <svg
          if (buffer.length >= 5) {
            const start = buffer.toString('utf8', 0, Math.min(100, buffer.length)).trim();
            if (start.startsWith('<?xml') || start.startsWith('<svg')) {
              return { type: 'image', extension: 'svg', mime: 'image/svg+xml' };
            }
          }
        }
        
        // Check if it's text (UTF-8)
        try {
          const textContent = buffer.toString("utf8");
          // Check if it contains valid UTF-8 text without null bytes
          if (!textContent.includes("\0") && textContent.length === buffer.length) {
            // Check if it looks like plain text (no binary control chars)
            const hasControlChars = /[\x00-\x08\x0E-\x1F]/.test(textContent.substring(0, 1000));
            if (!hasControlChars) {
              return { type: 'text', extension: 'txt', mime: 'text/plain' };
            }
          }
        } catch {
          // Not valid UTF-8
        }
        
        // Default: binary
        return { type: 'binary', extension: 'bin', mime: 'application/octet-stream' };
      }
      
      const fileInfo = detectFileType(decryptedBuffer);
      const filename = `decrypted-content.${fileInfo.extension}`;
      
      log(`   Detected file type: ${fileInfo.type} (${fileInfo.mime})`, colors.cyan);
      fs.writeFileSync(filename, decryptedBuffer);
      log(`   ✅ Saved decrypted ${fileInfo.type} to: ${filename}`, colors.green);
      log(`   Size: ${decryptedBuffer.length} bytes`, colors.cyan);
      
      // Show preview for images
      if (fileInfo.type === 'image') {
        log("   🖼️  Image file successfully decrypted!", colors.green);
      } else if (fileInfo.type === 'text') {
        log("");
        log("   Decrypted content preview:", colors.cyan);
        const preview = decryptedBuffer.toString('utf8').substring(0, Math.min(500, decryptedBuffer.length));
        console.log("   " + preview.split("\n").slice(0, 10).join("\n   "));
        if (decryptedBuffer.length > 500) {
          log(`   ... (${decryptedBuffer.length - 500} more characters)`, colors.cyan);
        }
      }
    } catch (decryptError) {
      log("");
      log(
        "   ⚠️  Decryption failed, saving encrypted blob instead",
        colors.yellow
      );
      const fs = require("fs");
      fs.writeFileSync("encrypted-new-content.bin", Buffer.from(encryptedBlob));
      log("   ✅ Saved to: encrypted-new-content.bin", colors.green);
      log(`   Error: ${decryptError.message}`, colors.red);
    }

    log("");
    log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      colors.blue
    );
    log("✅ Test Complete!", colors.green);
    log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      colors.blue
    );
    log("");
  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Run test
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { main, REGISTERED_CONTENT };
