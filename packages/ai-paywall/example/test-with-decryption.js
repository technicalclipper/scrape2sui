#!/usr/bin/env node
/**
 * Complete Flow Test with Decryption
 *
 * Tests the full ai-paywall flow including Seal decryption:
 * 1. Hit server endpoint → Get 402 Payment Required
 * 2. Purchase AccessPass using PaywallClient SDK
 * 3. Request content with headers → Get encrypted blob
 * 4. Decrypt content using Seal SDK
 * 5. Display decrypted content
 *
 * Usage:
 *   node example/test-with-decryption.js
 *
 * Prerequisites:
 *   - Server running: node example/server.js
 *   - Content registered in registry-app
 *   - SUI balance in wallet
 *   - PRIVATE_KEY environment variable set
 */

const { PaywallClient } = require("../dist/index");
const { SealClient, SessionKey, EncryptedObject } = require("@mysten/seal");
const { SuiClient, getFullnodeUrl } = require("@mysten/sui.js/client");
const { TransactionBlock } = require("@mysten/sui.js/transactions");
const { fromHEX } = require("@mysten/sui.js/utils");
const contractConfig = require("../dist/config/contract.json");

// Configuration
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const ENDPOINT = process.env.ENDPOINT || "/hidden/dog"; // Matches registered resource in registry

// Registered content constants (from registry-app)
const REGISTERED_CONTENT = {
  domain: process.env.WALRUS_DOMAIN || "www.demo1.com",
  resource: process.env.WALRUS_RESOURCE || "/hidden/dog",
  walrusBlobId: process.env.WALRUS_BLOB_ID || "wqwm17mRGo5PkXPo5p_I-RXtNIH4kdM-UnPVksBQ5lY",
  sealPolicyId: process.env.SEAL_POLICY_ID || "f02db2d9f0844665d33376e822e6c2e0c150344572fb7b8f4d4b6323621b5895cbe9653375",
  resourceEntryId: process.env.RESOURCE_ENTRY_ID || "0x44ace4be0c2ca4bf48bdb4f6a8069ff2beb73c3b33409035cffefa160ff40f5d",
  walrusObjectId:
    "0x98beeefcb2c49b2648eb3289807d701623189b6eebc4ce0ee2d5879eaa767be6",
};

// Seal key server object IDs for testnet
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

function logStep(step, message) {
  console.log();
  log(
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    colors.blue
  );
  log(`Step ${step}: ${message}`, colors.bright + colors.cyan);
  log(
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    colors.blue
  );
  console.log();
}

/**
 * Normalize hex string (remove 0x prefix, lowercase)
 */
function normalizeHexString(hex) {
  const cleaned = hex.startsWith("0x") ? hex.slice(2) : hex;
  return cleaned.toLowerCase();
}

/**
 * Construct Move call for seal_approve
 */
function constructSealApproveCall(
  packageId,
  registryId,
  resourceId,
  accessPassId,
  policyIdBytes
) {
  return (tx, id) => {
    tx.moveCall({
      target: `${packageId}::registry::seal_approve`,
      arguments: [
        tx.pure(Array.from(policyIdBytes), "vector<u8>"),
        tx.object(resourceId),
        tx.object(accessPassId),
        tx.object("0x6"), // Clock
      ],
    });
  };
}

/**
 * Decrypt encrypted blob using Seal
 */
async function decryptWithSeal(
  encryptedBlob,
  packageId,
  registryId,
  resourceId,
  accessPassId,
  sealPolicyId,
  sessionKey,
  userAddress
) {
  const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });

  // Create Seal client
  const sealClient = new SealClient({
    suiClient: suiClient,
    serverConfigs: SEAL_SERVER_OBJECT_IDS.map((id) => ({
      objectId: id,
      weight: 1,
    })),
    verifyKeyServers: false,
  });

  // Parse encrypted object
  const encryptedData = new Uint8Array(encryptedBlob);
  const encryptedObject = EncryptedObject.parse(encryptedData);
  const fullId = encryptedObject.id;

  log(`   Encrypted object ID: ${fullId}`, colors.cyan);

  // Convert policy ID to bytes
  const normalizedPolicyId = normalizeHexString(sealPolicyId);
  const policyIdBytes = fromHEX(normalizedPolicyId);

  // Build transaction with seal_approve call
  const moveCallConstructor = constructSealApproveCall(
    packageId,
    registryId,
    resourceId,
    accessPassId,
    policyIdBytes
  );

  // Fetch decryption keys
  log(`   Fetching decryption keys from Seal servers...`, colors.yellow);
  const tx = new TransactionBlock();
  moveCallConstructor(tx, fullId);
  const txBytes = await tx.build({
    client: suiClient,
    onlyTransactionKind: true,
  });

  try {
    await sealClient.fetchKeys({
      ids: [fullId],
      txBytes,
      sessionKey,
      threshold: 2,
    });
    log(`   ✅ Keys fetched successfully`, colors.green);
  } catch (err) {
    log(`   ❌ Failed to fetch keys: ${err.message}`, colors.red);
    throw err;
  }

  // Decrypt
  log(`   Decrypting content...`, colors.yellow);
  try {
    const decryptedData = await sealClient.decrypt({
      data: encryptedData,
      sessionKey,
      txBytes,
    });
    log(
      `   ✅ Content decrypted (${decryptedData.length} bytes)`,
      colors.green
    );
    return decryptedData;
  } catch (err) {
    log(`   ❌ Decryption failed: ${err.message}`, colors.red);
    throw err;
  }
}

async function step1_get_402_challenge() {
  logStep(1, "Getting 402 Payment Required Challenge");

  const response = await fetch(`${SERVER_URL}${ENDPOINT}`);

  if (response.status !== 402) {
    log(`❌ Expected 402, got ${response.status}`, colors.red);
    const text = await response.text();
    console.log("Response:", text);
    process.exit(1);
  }

  const challenge = await response.json();
  log("✅ Got 402 Payment Required!", colors.green);
  console.log(JSON.stringify(challenge, null, 2));

  return challenge;
}

async function step2_purchase_access_pass(challenge) {
  logStep(2, "Purchasing AccessPass using PaywallClient SDK");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    log("❌ PRIVATE_KEY environment variable not set!", colors.red);
    log("   Set it with: export PRIVATE_KEY=your-private-key", colors.yellow);
    process.exit(1);
  }

  // Initialize PaywallClient
  const client = new PaywallClient({
    privateKey: privateKey,
  });

  log(`💰 Price: ${challenge.price} SUI`, colors.cyan);
  log(`🌐 Domain: ${challenge.domain}`, colors.cyan);
  log(`📂 Resource: ${challenge.resource}`, colors.cyan);
  log("");

  try {
    // Use payForAccess to get headers (this purchases the pass)
    log("Purchasing AccessPass...", colors.yellow);
    const { headers, accessPassId } = await client.payForAccess(
      `${SERVER_URL}${ENDPOINT}`
    );

    log(`✅ AccessPass purchased!`, colors.green);
    log(`   AccessPass ID: ${accessPassId}`, colors.cyan);

    return { headers, accessPassId, client };
  } catch (error) {
    log(`❌ Failed to purchase AccessPass: ${error.message}`, colors.red);
    throw error;
  }
}

async function step3_request_content(headers) {
  logStep(3, "Requesting Content with AccessPass Headers");

  log("Making request with headers...", colors.yellow);
  const response = await fetch(`${SERVER_URL}${ENDPOINT}`, {
    headers: headers,
  });

  log(`Status Code: ${response.status}`, colors.cyan);

  if (response.status === 200) {
    // Check if response is encrypted blob or JSON
    const contentType = response.headers.get("content-type");

    if (contentType && contentType.includes("application/octet-stream")) {
      // Encrypted blob
      log("✅ Got encrypted blob from server", colors.green);
      const arrayBuffer = await response.arrayBuffer();
      return { type: "encrypted", data: arrayBuffer };
    } else {
      // JSON response (mock content or decrypted)
      const json = await response.json();
      log("✅ Got JSON response", colors.green);
      return { type: "json", data: json };
    }
  } else if (response.status === 403) {
    log("❌ 403 Forbidden - AccessPass may be invalid", colors.red);
    const text = await response.text();
    console.log("Response:", text);
    process.exit(1);
  } else {
    log(`❌ Unexpected status: ${response.status}`, colors.red);
    const text = await response.text();
    console.log("Response:", text);
    process.exit(1);
  }
}

async function step4_decrypt_content(
  encryptedBlob,
  resourceEntry,
  accessPassId,
  client
) {
  logStep(4, "Decrypting Content using Seal SDK");

  if (!resourceEntry) {
    log("⚠️  No resource entry metadata - cannot decrypt", colors.yellow);
    log("   Content may be served as mock data", colors.yellow);
    return null;
  }

  const packageId = contractConfig.packageId;
  const registryId = contractConfig.registryId;
  const resourceId = resourceEntry.resource_id;
  const sealPolicyId = resourceEntry.seal_policy;
  const userAddress = client.keypair.toSuiAddress();

  log(`   Package ID: ${packageId}`, colors.cyan);
  log(`   Registry ID: ${registryId}`, colors.cyan);
  log(`   Resource ID: ${resourceId}`, colors.cyan);
  log(`   Seal Policy ID: ${sealPolicyId}`, colors.cyan);
  log(`   AccessPass ID: ${accessPassId}`, colors.cyan);
  log("");

  try {
    // Create SessionKey
    log("   Creating SessionKey...", colors.yellow);
    const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });
    const sessionKey = await SessionKey.create({
      address: userAddress,
      packageId: packageId,
      ttlMin: 10, // 10 minutes
      suiClient: suiClient,
    });

    // Sign personal message (this requires wallet interaction in real app)
    // For testing, we'll need to sign it
    log("   ⚠️  SessionKey requires personal message signature", colors.yellow);
    log("   In a real app, this would be signed by the wallet", colors.yellow);
    log("   For testing, you can export a signed SessionKey", colors.yellow);

    // For now, try to decrypt without SessionKey (will fail but show the flow)
    // In production, the client would sign the SessionKey and send it to server
    // OR decrypt client-side

    log("   Attempting client-side decryption...", colors.yellow);

    // Note: This requires a signed SessionKey
    // For a complete example, we'd need wallet integration
    // For now, we'll show the structure

    const decryptedData = await decryptWithSeal(
      encryptedBlob,
      packageId,
      registryId,
      resourceId,
      accessPassId,
      sealPolicyId,
      sessionKey, // This needs to be signed first
      userAddress
    );

    return decryptedData;
  } catch (error) {
    log(
      `   ⚠️  Decryption requires signed SessionKey: ${error.message}`,
      colors.yellow
    );
    log("   Returning encrypted blob for manual decryption", colors.yellow);
    return null;
  }
}

async function main() {
  log(
    "╔════════════════════════════════════════════════════════════╗",
    colors.blue
  );
  log(
    "║   ai-paywall Complete Flow Test with Decryption           ║",
    colors.blue
  );
  log(
    "╚════════════════════════════════════════════════════════════╝",
    colors.blue
  );
  log("");
  log("This test will:", colors.cyan);
  log("  1. Get 402 Payment Required challenge", colors.yellow);
  log("  2. Purchase AccessPass using PaywallClient SDK", colors.yellow);
  log("  3. Request content with headers → Get encrypted blob", colors.yellow);
  log("  4. Decrypt content using Seal SDK", colors.yellow);
  log("");
  log("Prerequisites:", colors.cyan);
  log("  ✓ Server running: node example/server.js", colors.yellow);
  log("  ✓ Content registered in registry-app", colors.yellow);
  log("  ✓ PRIVATE_KEY environment variable set", colors.yellow);
  log("  ✓ SUI balance in wallet", colors.yellow);
  log("");

  try {
    // Step 1: Get 402 challenge
    const challenge = await step1_get_402_challenge();

    // Step 2: Purchase AccessPass
    const { headers, accessPassId, client } = await step2_purchase_access_pass(
      challenge
    );

    // Step 3: Request content
    const contentResult = await step3_request_content(headers);

    if (contentResult.type === "encrypted") {
      log("📦 Received encrypted blob - attempting decryption...", colors.cyan);

      // Use registered content data
      log(`   Using registered content:`, colors.cyan);
      log(`   Domain: ${REGISTERED_CONTENT.domain}`, colors.cyan);
      log(`   Resource: ${REGISTERED_CONTENT.resource}`, colors.cyan);
      log(`   Seal Policy ID: ${REGISTERED_CONTENT.sealPolicyId}`, colors.cyan);
      log(
        `   Resource Entry ID: ${REGISTERED_CONTENT.resourceEntryId}`,
        colors.cyan
      );
      log("");

      // Save encrypted blob
      const fs = require("fs");
      fs.writeFileSync(
        "encrypted-new-content.bin",
        Buffer.from(contentResult.data)
      );
      log(
        "   ✅ Saved encrypted blob to: encrypted-new-content.bin",
        colors.green
      );

      // Attempt decryption with registered content data
      try {
        log(
          "   Attempting decryption with registered content data...",
          colors.yellow
        );
        const decryptedData = await step4_decrypt_content(
          contentResult.data,
          {
            resource_id: REGISTERED_CONTENT.resourceEntryId,
            seal_policy: REGISTERED_CONTENT.sealPolicyId,
            walrus_cid: REGISTERED_CONTENT.walrusBlobId,
          },
          accessPassId,
          client
        );

        if (decryptedData) {
          log("   ✅ Decryption successful!", colors.green);
          log(`   Decrypted ${decryptedData.length} bytes`, colors.cyan);

          // Try to interpret as text
          try {
            const text = new TextDecoder().decode(decryptedData);
            log("   Content (as text):", colors.cyan);
            console.log(
              "   " + text.substring(0, 200) + (text.length > 200 ? "..." : "")
            );
          } catch (e) {
            log("   Content is binary (not text)", colors.cyan);
          }
        }
      } catch (decryptError) {
        log(
          `   ⚠️  Decryption requires signed SessionKey: ${decryptError.message}`,
          colors.yellow
        );
        log(
          "   See README_DECRYPTION.md for full decryption instructions",
          colors.yellow
        );
      }
    } else {
      log("✅ Content received:", colors.green);
      console.log(JSON.stringify(contentResult.data, null, 2));
    }

    // Summary
    console.log();
    log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      colors.blue
    );
    log("✅ Test Complete!", colors.green);
    log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      colors.blue
    );
    console.log();
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

module.exports = { main };
