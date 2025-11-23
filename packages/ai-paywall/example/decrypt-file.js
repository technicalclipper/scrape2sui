#!/usr/bin/env node
/**
 * Decrypt an encrypted blob file using Seal
 *
 * Usage:
 *   export PRIVATE_KEY=your-private-key
 *   node example/decrypt-file.js [encrypted-file.bin]
 *
 * This script will:
 * 1. Read the encrypted blob file
 * 2. Create and sign a SessionKey
 * 3. Decrypt the content using Seal
 * 4. Save the decrypted content
 */

const fs = require("fs");
const { PaywallClient } = require("../dist/index");
const { SealClient, SessionKey, EncryptedObject } = require("@mysten/seal");
// Use @mysten/sui (newer package) for Seal compatibility, same as Seal examples
const { SuiClient, getFullnodeUrl } = require("@mysten/sui/client");
const { Transaction } = require("@mysten/sui/transactions");
const { fromHex } = require("@mysten/sui/utils");
const contractConfig = require("../dist/config/contract.json");

// Registered content constants
const REGISTERED_CONTENT = {
  domain: "www.newkrish.com",
  resource: "/hidden/dog",
  walrusBlobId: "LL8hDTU3rwr7OoiNVyHllGPUiLEoFPATTup2kKnaduE",
  sealPolicyId:
    "84aa2a83dfd9d4ccc926458b79ab1a2deac4c3f40e619ccc0e162c1f064a0e823c94668dfb",
  resourceEntryId:
    "0xd77c4f3b7807b0c50fdb0e1fe194aa384581ce9a57a667b5ba9f4d79af174738",
};

const SEAL_SERVER_OBJECT_IDS = [
  "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
  "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
];

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
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

async function main() {
  const encryptedFile = process.argv[2] || "encrypted-content.bin";

  log(
    "╔════════════════════════════════════════════════════════════╗",
    colors.cyan
  );
  log(
    "║   Decrypt Encrypted Blob File                              ║",
    colors.cyan
  );
  log(
    "╚════════════════════════════════════════════════════════════╝",
    colors.cyan
  );
  log("");

  if (!fs.existsSync(encryptedFile)) {
    log(`❌ File not found: ${encryptedFile}`, colors.red);
    process.exit(1);
  }

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    log("❌ PRIVATE_KEY environment variable not set!", colors.red);
    process.exit(1);
  }

  try {
    // Read encrypted file
    log(`📖 Reading encrypted file: ${encryptedFile}`, colors.cyan);
    const encryptedBlob = fs.readFileSync(encryptedFile);
    log(`   Size: ${encryptedBlob.length} bytes`, colors.cyan);
    log("");

    // Initialize client
    log("🔑 Initializing PaywallClient...", colors.cyan);
    const client = new PaywallClient({ privateKey });
    const userAddress = client.keypair.toSuiAddress();
    log(`   Address: ${userAddress}`, colors.cyan);
    log("");

    // Find AccessPass
    log("🎫 Finding AccessPass...", colors.cyan);
    const accessPassId = await client.findExistingAccessPass(
      REGISTERED_CONTENT.domain,
      REGISTERED_CONTENT.resource
    );

    if (!accessPassId) {
      log("❌ No AccessPass found! Purchase one first.", colors.red);
      process.exit(1);
    }
    log(`   ✅ Found AccessPass: ${accessPassId}`, colors.green);
    log("");

    // Parse encrypted object
    log("🔍 Parsing encrypted object...", colors.cyan);
    const encryptedData = new Uint8Array(encryptedBlob);
    const encryptedObject = EncryptedObject.parse(encryptedData);
    const fullId = encryptedObject.id;
    const threshold = encryptedObject.threshold;
    log(`   Encrypted object ID: ${fullId}`, colors.cyan);
    log(`   Threshold: ${threshold}`, colors.cyan);
    log(`   Services: ${encryptedObject.services.length}`, colors.cyan);
    log("");

    // Create Sui and Seal clients
    log("🔧 Creating Seal client...", colors.cyan);
    const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });
    const sealClient = new SealClient({
      suiClient: suiClient,
      serverConfigs: SEAL_SERVER_OBJECT_IDS.map((id) => ({
        objectId: id,
        weight: 1,
      })),
      verifyKeyServers: false,
    });

    // Create and sign SessionKey
    log("🔐 Creating SessionKey...", colors.cyan);
    const sessionKey = await SessionKey.create({
      address: userAddress,
      packageId: contractConfig.packageId,
      ttlMin: 10,
      suiClient: suiClient,
    });

    log("✍️  Signing SessionKey...", colors.cyan);
    const personalMessage = sessionKey.getPersonalMessage();
    const signatureResult = await client.keypair.signPersonalMessage(
      personalMessage
    );

    // Extract signature - Seal expects the signature as a string (base64 encoded)
    // Based on Seal examples, they use signPersonalMessage from wallet which returns { signature: string }
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
        // Convert Uint8Array to base64 string
        const { toB64 } = require("@mysten/sui/utils");
        signatureString = toB64(signatureResult.signature);
      } else if ("bytes" in signatureResult) {
        const { toB64 } = require("@mysten/sui/utils");
        const bytes =
          signatureResult.bytes instanceof Uint8Array
            ? signatureResult.bytes
            : new Uint8Array(Object.values(signatureResult.bytes));
        signatureString = toB64(bytes);
      } else {
        // Try to extract and convert
        const values = Object.values(signatureResult);
        if (values.length > 0) {
          const { toB64 } = require("@mysten/sui/utils");
          if (values[0] instanceof Uint8Array) {
            signatureString = toB64(values[0]);
          } else {
            signatureString = toB64(new Uint8Array(values[0]));
          }
        } else {
          throw new Error("Could not extract signature from result");
        }
      }
    } else if (signatureResult instanceof Uint8Array) {
      const { toB64 } = require("@mysten/sui/utils");
      signatureString = toB64(signatureResult);
    } else {
      throw new Error("Invalid signature result type");
    }

    await sessionKey.setPersonalMessageSignature(signatureString);
    log("   ✅ SessionKey signed", colors.green);
    log("");

    // Build seal_approve transaction
    // The transaction must use the fullId (encrypted object ID) in the moveCall
    // Our registry::seal_approve takes policy bytes, but Seal expects the fullId
    // We need to pass the fullId as the first argument (policy bytes)
    log("📝 Building seal_approve transaction...", colors.cyan);

    // Create a moveCall constructor function like Seal examples
    // The 'id' parameter is the fullId (encrypted object ID), which matches the policy ID
    const moveCallConstructor = (tx, id) => {
      // Use fromHex directly like Seal examples do
      tx.moveCall({
        target: `${contractConfig.packageId}::registry::seal_approve`,
        arguments: [
          tx.pure.vector("u8", fromHex(id)),
          tx.object(REGISTERED_CONTENT.resourceEntryId),
          tx.object(accessPassId),
          tx.object("0x6"), // Clock
        ],
      });
    };

    // Build transaction with fullId
    const tx = new Transaction();
    moveCallConstructor(tx, fullId);
    const txBytes = await tx.build({
      client: suiClient,
      onlyTransactionKind: true,
    });

    // Fetch keys - use threshold from encrypted object
    log("🔑 Fetching decryption keys...", colors.cyan);
    await sealClient.fetchKeys({
      ids: [fullId],
      txBytes,
      sessionKey,
      threshold: threshold, // Use threshold from encrypted object
    });
    log("   ✅ Keys fetched", colors.green);
    log("");

    // Decrypt - use the SAME transaction bytes as fetchKeys
    // The Seal decrypt function verifies the nonce using the transaction bytes
    // They must match exactly what was used for fetchKeys
    log("🔓 Decrypting content...", colors.cyan);
    const decryptedData = await sealClient.decrypt({
      data: encryptedData,
      sessionKey,
      txBytes, // Use the EXACT same txBytes as fetchKeys
    });
    log(`   ✅ Decrypted (${decryptedData.length} bytes)`, colors.green);
    log("");

    // Save decrypted content
    log("💾 Saving decrypted content...", colors.cyan);
    const decryptedBuffer = Buffer.from(decryptedData);

    // Try to save as text if it's valid UTF-8
    try {
      const text = decryptedBuffer.toString("utf8");
      if (!text.includes("\0") && text.length === decryptedBuffer.length) {
        fs.writeFileSync("decrypted-content.txt", text, "utf8");
        log("   ✅ Saved as: decrypted-content.txt", colors.green);
        log("");
        log("📄 Content preview:", colors.cyan);
        const preview = text.substring(0, Math.min(500, text.length));
        console.log(preview.split("\n").slice(0, 10).join("\n"));
        if (text.length > 500) {
          log(`   ... (${text.length - 500} more characters)`, colors.cyan);
        }
      } else {
        throw new Error("Not valid text");
      }
    } catch {
      fs.writeFileSync("decrypted-content.bin", decryptedBuffer);
      log("   ✅ Saved as: decrypted-content.bin", colors.green);
      log(`   Size: ${decryptedBuffer.length} bytes`, colors.cyan);
    }

    log("");
    log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      colors.cyan
    );
    log("✅ Decryption Complete!", colors.green);
    log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      colors.cyan
    );
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, colors.red);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
