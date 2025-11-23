#!/usr/bin/env node
/**
 * Test with Registered Content
 *
 * This test uses the actual registered content from registry-app:
 * - Domain: www.newkrish.com
 * - Resource: /hidden/dog
 * - Walrus Blob ID: LL8hDTU3rwr7OoiNVyHllGPUiLEoFPATTup2kKnaduE
 * - Seal Policy ID: 84aa2a83dfd9d4ccc926458b79ab1a2deac4c3f40e619ccc0e162c1f064a0e823c94668dfb
 * - Resource Entry ID: 0xd77c4f3b7807b0c50fdb0e1fe194aa384581ce9a57a667b5ba9f4d79af174738
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
const { fromHex, toB64 } = require("@mysten/sui/utils");
const contractConfig = require("../dist/config/contract.json");

// Registered content from registry-app
const REGISTERED_CONTENT = {
  domain: "www.newkrish.com",
  resource: "/hidden/dog",
  walrusBlobId: "LL8hDTU3rwr7OoiNVyHllGPUiLEoFPATTup2kKnaduE",
  sealPolicyId:
    "84aa2a83dfd9d4ccc926458b79ab1a2deac4c3f40e619ccc0e162c1f064a0e823c94668dfb",
  resourceEntryId:
    "0xd77c4f3b7807b0c50fdb0e1fe194aa384581ce9a57a667b5ba9f4d79af174738",
  walrusObjectId:
    "0x98beeefcb2c49b2648eb3289807d701623189b6eebc4ce0ee2d5879eaa767be6",
};

const SERVER_URL = "http://localhost:3000";
const ENDPOINT = "/hidden/dog"; // Matches registered resource in registry

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
    const fullId = encryptedObject.id;
    const threshold = encryptedObject.threshold;
    log(`   Encrypted object ID: ${fullId}`, colors.cyan);
    log(`   Threshold: ${threshold}`, colors.cyan);

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

    // Build seal_approve transaction using moveCallConstructor pattern from Seal examples
    log("   Building seal_approve transaction...", colors.yellow);
    const moveCallConstructor = (tx, id) => {
      tx.moveCall({
        target: `${packageId}::registry::seal_approve`,
        arguments: [
          tx.pure.vector("u8", fromHex(id)),
          tx.object(resourceId),
          tx.object(accessPassId),
          tx.object("0x6"), // Clock
        ],
      });
    };

    const tx = new Transaction();
    moveCallConstructor(tx, fullId);
    const txBytes = await tx.build({
      client: suiClient,
      onlyTransactionKind: true,
    });

    // Fetch decryption keys
    log("   Fetching decryption keys from Seal servers...", colors.yellow);
    try {
      await sealClient.fetchKeys({
        ids: [fullId],
        txBytes,
        sessionKey,
        threshold: threshold,
      });
      log("   ✅ Keys fetched successfully", colors.green);
    } catch (err) {
      log(`   ❌ Failed to fetch keys: ${err.message}`, colors.red);
      throw err;
    }

    // Decrypt content - rebuild transaction like Seal examples
    log("   Decrypting content...", colors.yellow);
    try {
      const decryptTx = new Transaction();
      moveCallConstructor(decryptTx, fullId);
      const decryptTxBytes = await decryptTx.build({
        client: suiClient,
        onlyTransactionKind: true,
      });

      const decryptedData = await sealClient.decrypt({
        data: encryptedData,
        sessionKey,
        txBytes: decryptTxBytes,
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
  } catch (error) {
    log(`   ❌ Decryption error: ${error.message}`, colors.red);
    if (error.stack) {
      log(
        `   Stack: ${error.stack.split("\n").slice(0, 3).join("\n")}`,
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

    // Get AccessPass ID from the client's recent purchase
    // The client should have stored it, but we'll need to get it from the purchase
    log("");
    log("   Getting AccessPass ID...", colors.yellow);

    // Find the most recent AccessPass for this domain/resource
    const existingPass = await client.findExistingAccessPass(
      REGISTERED_CONTENT.domain,
      REGISTERED_CONTENT.resource
    );

    if (!existingPass) {
      log("   ⚠️  No AccessPass found - cannot decrypt", colors.yellow);
      log("   Saving encrypted blob for manual decryption...", colors.yellow);
      const fs = require("fs");
      fs.writeFileSync("encrypted-content.bin", Buffer.from(encryptedBlob));
      log("   ✅ Saved to: encrypted-content.bin", colors.green);
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

      // Try to determine file type
      const decryptedBuffer = Buffer.from(decryptedData);

      // Check if it's text (UTF-8)
      let isText = true;
      let textContent = null;
      try {
        textContent = decryptedBuffer.toString("utf8");
        // Check if it contains valid UTF-8 text
        if (
          textContent.includes("\0") ||
          textContent.length !== decryptedBuffer.length
        ) {
          isText = false;
        }
      } catch {
        isText = false;
      }

      if (isText && textContent) {
        // Save as text file
        fs.writeFileSync("decrypted-content.txt", textContent, "utf8");
        log(
          "   ✅ Saved decrypted text to: decrypted-content.txt",
          colors.green
        );
        log("");
        log("   Decrypted content preview:", colors.cyan);
        const preview = textContent.substring(
          0,
          Math.min(500, textContent.length)
        );
        console.log("   " + preview.split("\n").slice(0, 10).join("\n   "));
        if (textContent.length > 500) {
          log(
            `   ... (${textContent.length - 500} more characters)`,
            colors.cyan
          );
        }
      } else {
        // Save as binary file
        fs.writeFileSync("decrypted-content.bin", decryptedBuffer);
        log(
          "   ✅ Saved decrypted binary to: decrypted-content.bin",
          colors.green
        );
        log(`   Size: ${decryptedBuffer.length} bytes`, colors.cyan);
      }
    } catch (decryptError) {
      log("");
      log(
        "   ⚠️  Decryption failed, saving encrypted blob instead",
        colors.yellow
      );
      const fs = require("fs");
      fs.writeFileSync("encrypted-content.bin", Buffer.from(encryptedBlob));
      log("   ✅ Saved to: encrypted-content.bin", colors.green);
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
