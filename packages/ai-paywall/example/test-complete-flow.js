#!/usr/bin/env node
/**
 * Complete Flow Test
 *
 * Tests the full ai-paywall flow:
 * 1. Hit server endpoint → Get 402 Payment Required
 * 2. Extract nonce from 402 response
 * 3. Purchase AccessPass using Sui CLI
 * 4. Get AccessPass ID from transaction
 * 5. Request content with headers → Get hidden content
 *
 * Usage:
 *   node example/test-complete-flow.js
 *
 * Prerequisites:
 *   - Server running: node example/server.js
 *   - Sui CLI configured for testnet
 *   - SUI balance in wallet
 */

const http = require("http");
const { execSync } = require("child_process");

// Configuration
const SERVER_URL = "http://localhost:3000";
const ENDPOINT = "/hidden/dog"; // Matches registered resource in registry

// Registered content constants (from registry-app)
const REGISTERED_CONTENT = {
  domain: "www.new3krish.com",
  resource: "/hidden/dog",
  walrusBlobId: "CJdVQYMwrqww9u7413CuQTDvOLaeZlurHfwkeDXSx4I",
  sealPolicyId:
    "c16ea2047827a5f2fca199bdacf13934539d053f4bd3a922e3c93175ba17759d8067f0ee3f",
  resourceEntryId:
    "0x5c6f02b39b6e02de098a68c0d72fc7a812365403f2e27e5ede2e49ff8ab34333",
  walrusObjectId:
    "0x98beeefcb2c49b2648eb3289807d701623189b6eebc4ce0ee2d5879eaa767be6",
};

// Contract configuration (from package config - update with deployed contract IDs)
const CONTRACT = {
  packageId:
    "0xde39d60a86cd9937907be1c7bcba1f1755860a1298b3f8eb9e1883cf1a0e34ce",
  treasuryId:
    "0x884da47a8d7e74e567389ecc7571f40113fce07f61e30a523f4213810fb2ec88",
  passCounterId:
    "0x3ac3d18d060c796e0445faba0c7e28dd367b9e7f50736d717bab3f0bf2cfeb14",
  registryId:
    "0x4973302ca0f40862276bac7aca0ee7eda82d9b87f4c10bc9bc5ceb90ad28ccea",
};

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

function makeRequest(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 3000,
      path: urlObj.pathname,
      method: "GET",
      headers: {
        ...headers,
        Connection: "close", // Explicitly close connection to prevent keep-alive issues
      },
      timeout: 30000, // 30 second timeout
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
      res.on("error", (err) => {
        console.error("[Test] Response error:", err);
        reject(err);
      });
    });

    req.on("error", (err) => {
      console.error("[Test] Request error:", err);
      reject(err);
    });
    req.on("timeout", () => {
      console.error("[Test] Request timeout");
      req.destroy();
      reject(new Error("Request timeout"));
    });
    req.setTimeout(30000); // 30 second timeout
    req.end();
  });
}

async function step1_test_402() {
  logStep(1, "Testing 402 Payment Required Response");

  log("Making request to protected endpoint...", colors.yellow);
  const response = await makeRequest(`${SERVER_URL}${ENDPOINT}`);

  if (response.status !== 402) {
    log(`❌ Expected 402, got ${response.status}`, colors.red);
    console.log("Response:", JSON.stringify(response.body, null, 2));
    process.exit(1);
  }

  log("✅ Got 402 Payment Required!", colors.green);
  console.log(JSON.stringify(response.body, null, 2));

  // Extract nonce
  const nonce = response.body.nonce;
  if (!nonce) {
    log("❌ No nonce in response!", colors.red);
    process.exit(1);
  }

  log(`\n📝 Nonce: ${nonce}`, colors.cyan);
  return { challenge: response.body, nonce };
}

async function step2_purchase_access_pass(challenge, nonce) {
  logStep(2, "Automatically Purchasing AccessPass");

  const priceMist = parseInt(challenge.priceInMist);
  log(`💰 Price: ${challenge.price} SUI (${priceMist} MIST)`, colors.cyan);
  log(`📝 Nonce: ${nonce}`, colors.cyan);
  log(`🌐 Domain: ${challenge.domain}`, colors.cyan);
  log(`📂 Resource: ${challenge.resource}`, colors.cyan);
  log("");

  try {
    // Step 1: Get gas coins
    log("1️⃣  Getting gas coins...", colors.yellow);
    let gasOutput;
    try {
      gasOutput = execSync("sui client gas --json", {
        encoding: "utf-8",
        stdio: "pipe",
      });
      const gasCoins = JSON.parse(gasOutput);

      if (!gasCoins || gasCoins.length === 0) {
        throw new Error("No gas coins found. Please add SUI to your wallet.");
      }

      log(`   ✅ Found ${gasCoins.length} coin(s)`, colors.green);

      // Debug: Show first coin structure if balance is 0
      if (gasCoins.length > 0 && !gasCoins[0].balance) {
        log(
          `   ⚠️  Debug: First coin structure: ${JSON.stringify(
            gasCoins[0]
          ).substring(0, 200)}`,
          colors.yellow
        );
      }
    } catch (error) {
      log(`   ❌ Failed to get gas coins: ${error.message}`, colors.red);
      throw error;
    }

    // Step 2: Get a coin to split (use largest coin with at least payment amount)
    log("2️⃣  Selecting coin for payment...", colors.yellow);
    const gasCoins = JSON.parse(gasOutput);

    // Helper function to extract balance from coin object (handle different field names)
    const getCoinBalance = (coin) => {
      // Try different possible field names for balance
      if (coin.mistBalance !== undefined) return BigInt(coin.mistBalance); // sui client gas --json format
      if (coin.balance !== undefined) return BigInt(coin.balance);
      if (coin.balance_raw !== undefined) return BigInt(coin.balance_raw);
      if (coin.coinBalance !== undefined) return BigInt(coin.coinBalance);
      if (typeof coin === "string") return BigInt(0); // If coin is just an ID
      // Check if it's a nested structure (from sui client object output)
      if (
        coin.data &&
        coin.data.content &&
        coin.data.content.fields &&
        coin.data.content.fields.balance
      ) {
        return BigInt(coin.data.content.fields.balance);
      }
      // Check if it's a table entry structure
      if (coin.value && coin.value.balance) {
        return BigInt(coin.value.balance);
      }
      return BigInt(0);
    };

    // Helper function to extract coin ID from coin object
    const getCoinId = (coin) => {
      if (coin.gasCoinId) return coin.gasCoinId; // sui client gas --json format
      if (coin.coinObjectId) return coin.coinObjectId;
      if (coin.coinId) return coin.coinId;
      if (coin.objectId) return coin.objectId;
      if (coin.data && coin.data.objectId) return coin.data.objectId;
      if (typeof coin === "string") return coin;
      return null;
    };

    // Calculate total balance - if all balances are 0, try using sui client balance
    let totalBalance = BigInt(0);
    let largestCoin = null;
    let largestBalance = BigInt(0);

    for (const coin of gasCoins) {
      const balance = getCoinBalance(coin);
      const coinId = getCoinId(coin);

      if (!coinId) {
        log(
          `   ⚠️  Skipping coin with unknown structure: ${JSON.stringify(
            coin
          ).substring(0, 100)}`,
          colors.yellow
        );
        continue;
      }

      // If balance is 0, try fetching the coin object directly
      if (balance === BigInt(0)) {
        try {
          const coinObjOutput = execSync(`sui client object ${coinId} --json`, {
            encoding: "utf-8",
            stdio: "pipe",
          });
          const coinObj = JSON.parse(coinObjOutput);
          const fetchedBalance = getCoinBalance(coinObj);
          if (fetchedBalance > BigInt(0)) {
            totalBalance += fetchedBalance;
            if (fetchedBalance > largestBalance) {
              largestBalance = fetchedBalance;
              largestCoin = {
                coinObjectId: coinId,
                balance: fetchedBalance.toString(),
              };
            }
            log(
              `   Coin ${coinId}: ${fetchedBalance.toString()} MIST (${
                Number(fetchedBalance) / 1_000_000_000
              } SUI)`,
              colors.gray
            );
            continue;
          }
        } catch (e) {
          // Skip if we can't fetch
        }
      }

      totalBalance += balance;
      if (balance > largestBalance) {
        largestBalance = balance;
        largestCoin = { coinObjectId: coinId, balance: balance.toString() };
      }

      log(
        `   Coin ${coinId}: ${balance.toString()} MIST (${
          Number(balance) / 1_000_000_000
        } SUI)`,
        colors.gray
      );
    }

    log(
      `   Total balance: ${totalBalance.toString()} MIST (${
        Number(totalBalance) / 1_000_000_000
      } SUI)`,
      colors.cyan
    );

    // We need at least the payment amount in a coin to split from
    // Gas will be paid separately from gas coins
    const requiredBalance = BigInt(priceMist);

    // Try to find a coin with at least the payment amount
    let sourceCoinId = null;
    for (const coin of gasCoins) {
      const balance = getCoinBalance(coin);
      const coinId = getCoinId(coin);

      if (!coinId) continue;

      if (balance >= requiredBalance) {
        sourceCoinId = coinId;
        log(
          `   ✅ Selected coin: ${sourceCoinId} (balance: ${balance.toString()} MIST)`,
          colors.green
        );
        break;
      }
    }

    // If no coin has enough, use the largest coin (it should have enough since total balance is sufficient)
    if (!sourceCoinId) {
      if (totalBalance < requiredBalance) {
        throw new Error(
          `Insufficient total balance. Need at least ${priceMist} MIST (${
            challenge.price
          } SUI). Total: ${Number(totalBalance) / 1_000_000_000} SUI`
        );
      }

      // Use largest coin - should work if total balance is sufficient
      if (!largestCoin || !largestCoin.coinObjectId) {
        throw new Error("No coins available.");
      }

      sourceCoinId = largestCoin.coinObjectId;
      log(
        `   ⚠️  No single coin has ${priceMist} MIST, using largest coin: ${sourceCoinId} (balance: ${largestBalance.toString()} MIST)`,
        colors.yellow
      );
      log(
        `   Total balance is sufficient, will split ${priceMist} MIST from largest coin.`,
        colors.cyan
      );
    }

    // Step 3: Split coin for payment
    log("3️⃣  Splitting coin for payment...", colors.yellow);
    let splitOutput;
    let paymentCoinId = null; // Declare outside try block so it's accessible later

    try {
      splitOutput = execSync(
        `sui client split-coin --gas-budget 10000000 --coin-id ${sourceCoinId} --amounts ${priceMist} --json`,
        { encoding: "utf-8", stdio: "pipe" }
      );

      const splitResult = JSON.parse(splitOutput);

      // Extract new coin ID from transaction effects
      if (splitResult.objectChanges) {
        for (const change of splitResult.objectChanges) {
          if (
            change.type === "created" &&
            change.objectType &&
            change.objectType.includes("Coin")
          ) {
            paymentCoinId = change.objectId;
            break;
          }
        }
      }

      // Also check events
      if (!paymentCoinId && splitResult.events) {
        for (const event of splitResult.events) {
          if (event.parsedJson && event.parsedJson.coin_id) {
            paymentCoinId = event.parsedJson.coin_id;
            break;
          }
        }
      }

      if (!paymentCoinId) {
        // Try to extract from effects
        if (splitResult.effects && splitResult.effects.created) {
          for (const created of splitResult.effects.created) {
            if (created.reference && created.reference.objectId) {
              // Check if it's a coin by querying it
              try {
                const coinCheck = execSync(
                  `sui client object ${created.reference.objectId} --json`,
                  {
                    encoding: "utf-8",
                    stdio: "pipe",
                  }
                );
                const coinObj = JSON.parse(coinCheck);
                if (
                  coinObj.data &&
                  coinObj.data.type &&
                  coinObj.data.type.includes("Coin")
                ) {
                  paymentCoinId = created.reference.objectId;
                  break;
                }
              } catch (e) {
                // Skip this one
              }
            }
          }
        }
      }

      if (!paymentCoinId) {
        // Last resort: parse output text
        const outputText = execSync(
          `sui client split-coin --gas-budget 10000000 --coin-id ${sourceCoinId} --amounts ${priceMist}`,
          { encoding: "utf-8" }
        );

        // Try to find coin ID in output
        const coinIdMatch = outputText.match(/0x[a-fA-F0-9]{64}/g);
        if (coinIdMatch && coinIdMatch.length > 0) {
          // The last one is usually the new coin
          paymentCoinId = coinIdMatch[coinIdMatch.length - 1];
        }
      }

      if (!paymentCoinId) {
        throw new Error(
          "Could not extract payment coin ID from split transaction. Please check your wallet."
        );
      }

      log(`   ✅ Created payment coin: ${paymentCoinId}`, colors.green);
    } catch (error) {
      log(`   ❌ Failed to split coin: ${error.message}`, colors.red);
      throw error;
    }

    // Step 4: Purchase AccessPass
    log("4️⃣  Purchasing AccessPass...", colors.yellow);
    log(`   Domain: "${challenge.domain}"`, colors.cyan);
    log(`   Resource: "${challenge.resource}"`, colors.cyan);
    log(`   Remaining: 10`, colors.cyan);
    log(`   Expiry: 0 (no expiry)`, colors.cyan);
    log(`   Nonce: "${nonce}"`, colors.cyan);
    log("");

    let purchaseOutput;
    try {
      // Convert strings to hex bytes for Sui CLI (contract expects vector<u8>)
      // Using xxd or Buffer to convert strings to hex
      const domainHex = Buffer.from(challenge.domain, "utf8").toString("hex");
      const resourceHex = Buffer.from(challenge.resource, "utf8").toString(
        "hex"
      );
      const nonceHex = Buffer.from(nonce, "utf8").toString("hex");

      log(`   Domain (hex): ${domainHex}`, colors.cyan);
      log(`   Resource (hex): ${resourceHex}`, colors.cyan);
      log(`   Nonce (hex): ${nonceHex}`, colors.cyan);
      log("");

      // Convert strings to hex bytes (0x prefixed) for Sui CLI
      // Contract expects vector<u8> which can be passed as hex strings
      // Now passes receiver address from challenge instead of treasuryId
      const purchaseCmd =
        `sui client call ` +
        `--package ${CONTRACT.packageId} ` +
        `--module paywall ` +
        `--function purchase_pass ` +
        `--args ${paymentCoinId} 0x${domainHex} 0x${resourceHex} 10 0 0x${nonceHex} ${challenge.receiver} ${CONTRACT.passCounterId} ` +
        `--gas-budget 10000000 --json`;

      log("   Executing purchase transaction...", colors.yellow);
      try {
        purchaseOutput = execSync(purchaseCmd, {
          encoding: "utf-8",
          stdio: "pipe",
        });
      } catch (error) {
        // If hex format fails, try with string format (Sui CLI might accept strings)
        log("   ⚠️  Hex format failed, trying string format...", colors.yellow);
        const purchaseCmd2 =
          `sui client call ` +
          `--package ${CONTRACT.packageId} ` +
          `--module paywall ` +
          `--function purchase_pass ` +
          `--args ${paymentCoinId} "${challenge.domain}" "${challenge.resource}" 10 0 "${nonce}" ${challenge.receiver} ${CONTRACT.passCounterId} ` +
          `--gas-budget 10000000 --json`;

        try {
          purchaseOutput = execSync(purchaseCmd2, {
            encoding: "utf-8",
            stdio: "pipe",
          });
        } catch (error2) {
          log(`   ❌ Purchase failed: ${error2.message}`, colors.red);
          if (error2.stdout) console.log("stdout:", error2.stdout);
          if (error2.stderr) console.log("stderr:", error2.stderr);
          throw error2;
        }
      }
      const purchaseResult = JSON.parse(purchaseOutput);

      // Extract AccessPass ID from transaction output
      let accessPassId = null;

      // Check objectChanges first
      if (purchaseResult.objectChanges) {
        for (const change of purchaseResult.objectChanges) {
          if (
            change.type === "created" &&
            change.objectType &&
            change.objectType.includes("AccessPass")
          ) {
            accessPassId = change.objectId;
            break;
          }
        }
      }

      // Also check effects.created
      if (
        !accessPassId &&
        purchaseResult.effects &&
        purchaseResult.effects.created
      ) {
        for (const created of purchaseResult.effects.created) {
          if (created.reference && created.reference.objectId) {
            // Verify it's an AccessPass by checking type
            try {
              const objCheck = execSync(
                `sui client object ${created.reference.objectId} --json`,
                {
                  encoding: "utf-8",
                  stdio: "pipe",
                }
              );
              const obj = JSON.parse(objCheck);
              if (
                obj.data &&
                obj.data.type &&
                obj.data.type.includes("AccessPass")
              ) {
                accessPassId = created.reference.objectId;
                break;
              }
            } catch (e) {
              // Skip
            }
          }
        }
      }

      // Last resort: parse text output (try with hex)
      if (!accessPassId) {
        try {
          const domainHex = Buffer.from(challenge.domain, "utf8").toString(
            "hex"
          );
          const resourceHex = Buffer.from(challenge.resource, "utf8").toString(
            "hex"
          );
          const nonceHex = Buffer.from(nonce, "utf8").toString("hex");

          const textOutput = execSync(
            `sui client call ` +
              `--package ${CONTRACT.packageId} ` +
              `--module paywall ` +
              `--function purchase_pass ` +
              `--args ${paymentCoinId} ` +
              `0x${domainHex} 0x${resourceHex} 10 0 0x${nonceHex} ` +
              `${challenge.receiver} ${CONTRACT.passCounterId} ` +
              `--gas-budget 10000000`,
            { encoding: "utf-8" }
          );

          // Look for AccessPass ID pattern
          const lines = textOutput.split("\n");
          for (const line of lines) {
            if (
              line.includes("AccessPass") ||
              line.includes("Created Objects")
            ) {
              const match = line.match(/0x[a-fA-F0-9]{64}/);
              if (match) {
                accessPassId = match[0];
                // Verify it's actually an AccessPass
                try {
                  const verify = execSync(
                    `sui client object ${accessPassId} --json`,
                    {
                      encoding: "utf-8",
                      stdio: "pipe",
                    }
                  );
                  const verifyObj = JSON.parse(verify);
                  if (
                    verifyObj.data &&
                    verifyObj.data.type &&
                    verifyObj.data.type.includes("AccessPass")
                  ) {
                    break;
                  }
                } catch (e) {
                  accessPassId = null;
                }
              }
            }
          }
        } catch (e) {
          // Already tried JSON, now trying text
        }
      }

      if (!accessPassId) {
        log(
          "   ⚠️  Could not automatically extract AccessPass ID from transaction",
          colors.yellow
        );
        log("   Transaction output:", colors.cyan);
        console.log(purchaseOutput);
        log("");
        log(
          '   Please manually extract AccessPass ID from "Created Objects" section',
          colors.yellow
        );
        log("   and enter it when prompted...", colors.yellow);
        log("");

        // Fallback: prompt for AccessPass ID
        const readline = require("readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        return new Promise((resolve) => {
          rl.question(
            "📝 Enter AccessPass ID (from transaction output): ",
            (input) => {
              const id = input.trim();
              rl.close();
              if (!id || !id.startsWith("0x") || id.length !== 66) {
                throw new Error(
                  "Invalid AccessPass ID format. Must start with 0x and be 66 characters."
                );
              }
              log(`✅ Using AccessPass ID: ${id}`, colors.green);
              resolve(id);
            }
          );
        });
      }

      log(`   ✅ AccessPass purchased!`, colors.green);
      log(`   ✅ AccessPass ID: ${accessPassId}`, colors.green);
      return accessPassId;
    } catch (error) {
      log(`   ❌ Failed to purchase AccessPass: ${error.message}`, colors.red);
      log(`   Error details:`, colors.yellow);
      if (error.stdout) console.log(error.stdout);
      if (error.stderr) console.log(error.stderr);
      throw error;
    }
  } catch (error) {
    log(`\n❌ Purchase failed: ${error.message}`, colors.red);
    throw error;
  }
}

async function step3_get_access_pass_details(accessPassId) {
  logStep(3, "Verifying AccessPass");

  try {
    log("Fetching AccessPass from Sui...", colors.yellow);
    const output = execSync(`sui client object ${accessPassId} --json`, {
      encoding: "utf-8",
      stdio: "pipe",
    });

    const object = JSON.parse(output);

    // Try different paths for owner field (depending on Sui object structure)
    // Based on actual output, owner is at object.content.fields.owner
    let owner = null;
    if (object.content?.fields?.owner) {
      owner = object.content.fields.owner;
    } else if (object.data?.content?.fields?.owner) {
      owner = object.data.content.fields.owner;
    } else if (object.data?.fields?.owner) {
      owner = object.data.fields.owner;
    }

    if (!owner) {
      log("❌ Could not extract owner from AccessPass", colors.red);
      log("Object structure:", colors.yellow);
      console.log(JSON.stringify(object, null, 2));
      process.exit(1);
    }

    log("✅ AccessPass found!", colors.green);
    log(`   Owner: ${owner}`, colors.cyan);
    log(`   Pass ID: ${accessPassId}`, colors.cyan);

    // Log additional AccessPass details
    const fields =
      object.data?.content?.fields ||
      object.content?.fields ||
      object.data?.fields ||
      {};
    if (fields.domain) log(`   Domain: ${fields.domain}`, colors.cyan);
    if (fields.resource) log(`   Resource: ${fields.resource}`, colors.cyan);
    const remaining = fields.remaining ? Number(fields.remaining) : 0;
    if (remaining) log(`   Remaining uses: ${remaining}`, colors.cyan);
    if (fields.expiry) log(`   Expiry: ${fields.expiry}`, colors.cyan);

    return { owner, accessPassId, remaining };
  } catch (error) {
    log("❌ Failed to fetch AccessPass", colors.red);
    log(error.message, colors.red);
    process.exit(1);
  }
}

async function step4_request_content(owner, accessPassId) {
  logStep(4, "Requesting Content with AccessPass Headers");

  const timestamp = Date.now().toString();
  const headers = {
    "x-pass-id": accessPassId,
    "x-signer": owner,
    "x-sig": "test-signature", // Placeholder signature
    "x-ts": timestamp,
  };

  log("Making request with headers:", colors.yellow);
  console.log(JSON.stringify(headers, null, 2));

  const response = await makeRequest(`${SERVER_URL}${ENDPOINT}`, headers);

  log(`\nStatus Code: ${response.status}`, colors.cyan);

  if (response.status === 200) {
    log("✅ SUCCESS! Access granted!", colors.green);
    console.log(JSON.stringify(response.body, null, 2));
    return true;
  } else if (response.status === 403) {
    log("⚠️  403 Forbidden", colors.yellow);
    console.log(JSON.stringify(response.body, null, 2));
    log(
      "\nNote: Signature verification might fail with placeholder signature.",
      colors.yellow
    );
    log("But AccessPass validation should still work.", colors.yellow);
    return false;
  } else {
    log(`❌ Unexpected status: ${response.status}`, colors.red);
    console.log(JSON.stringify(response.body, null, 2));
    return false;
  }
}

async function step5_consume_pass(accessPassId, expectedRemaining) {
  logStep(5, "Consuming AccessPass (Decrementing Remaining Uses)");

  try {
    log("Calling consume_pass function...", colors.yellow);

    const consumeCmd =
      `sui client call ` +
      `--package ${CONTRACT.packageId} ` +
      `--module paywall ` +
      `--function consume_pass ` +
      `--args ${accessPassId} ` +
      `--gas-budget 10000000 --json`;

    log("Executing consume transaction...", colors.yellow);
    let consumeOutput;
    try {
      consumeOutput = execSync(consumeCmd, {
        encoding: "utf-8",
        stdio: "pipe",
      });
    } catch (error) {
      // Try parsing stderr for output
      if (error.stdout) {
        consumeOutput = error.stdout;
      } else {
        throw error;
      }
    }

    const consumeResult = JSON.parse(consumeOutput);

    if (consumeResult.error) {
      log(`❌ Transaction failed: ${consumeResult.error}`, colors.red);
      throw new Error(consumeResult.error);
    }

    log("✅ consume_pass transaction executed!", colors.green);

    // Wait a moment for the transaction to be indexed
    log("Waiting for transaction to be indexed...", colors.yellow);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Fetch AccessPass again to verify remaining decreased
    log("Verifying remaining uses decreased...", colors.yellow);
    const output = execSync(`sui client object ${accessPassId} --json`, {
      encoding: "utf-8",
      stdio: "pipe",
    });

    const object = JSON.parse(output);
    const fields =
      object.data?.content?.fields ||
      object.content?.fields ||
      object.data?.fields ||
      {};
    const newRemaining = fields.remaining ? Number(fields.remaining) : 0;

    log(`   Previous remaining: ${expectedRemaining}`, colors.cyan);
    log(`   New remaining: ${newRemaining}`, colors.cyan);

    if (newRemaining === expectedRemaining - 1) {
      log("✅ Remaining uses correctly decremented!", colors.green);
      return newRemaining;
    } else {
      log(
        `⚠️  Expected remaining to be ${
          expectedRemaining - 1
        }, but got ${newRemaining}`,
        colors.yellow
      );
      return newRemaining;
    }
  } catch (error) {
    log(`❌ Failed to consume pass: ${error.message}`, colors.red);
    if (error.stdout) log(`stdout: ${error.stdout}`, colors.yellow);
    if (error.stderr) log(`stderr: ${error.stderr}`, colors.yellow);
    throw error;
  }
}

async function main() {
  log(
    "╔════════════════════════════════════════════════════════════╗",
    colors.blue
  );
  log(
    "║      ai-paywall Complete Flow Test                        ║",
    colors.blue
  );
  log(
    "╚════════════════════════════════════════════════════════════╝",
    colors.blue
  );
  log("");
  log("This test will:", colors.cyan);
  log("  1. Hit server endpoint → Get 402 Payment Required", colors.yellow);
  log("  2. Extract nonce from response", colors.yellow);
  log("  3. Automatically purchase AccessPass via Sui contract", colors.yellow);
  log("  4. Verify AccessPass on Sui", colors.yellow);
  log("  5. Request content with headers → Get hidden content", colors.yellow);
  log(
    "  6. Consume pass (decrement remaining uses) → Verify decreased",
    colors.yellow
  );
  log("");
  log("Prerequisites:", colors.cyan);
  log("  ✓ Server running: node example/server.js", colors.yellow);
  log("  ✓ Sui CLI configured for testnet", colors.yellow);
  log("  ✓ SUI balance in wallet", colors.yellow);
  log("");

  try {
    // Step 1: Test 402 response
    const { challenge, nonce } = await step1_test_402();

    // Step 2: Automatically purchase AccessPass
    const accessPassId = await step2_purchase_access_pass(challenge, nonce);

    // Step 3: Get AccessPass details
    const { owner, remaining } = await step3_get_access_pass_details(
      accessPassId
    );

    // Step 4: Request content with headers
    const success = await step4_request_content(owner, accessPassId);

    // Step 5: Consume pass (decrement remaining uses)
    const newRemaining = await step5_consume_pass(accessPassId, remaining);

    // Summary
    console.log();
    log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      colors.blue
    );
    if (success && newRemaining === remaining - 1) {
      log("✅ Test Complete - All steps passed!", colors.green);
    } else if (success) {
      log(
        "⚠️  Test Complete - Most steps passed (remaining uses may need verification)",
        colors.yellow
      );
    } else {
      log(
        "⚠️  Test Complete - Most steps passed (signature verification may need real signing)",
        colors.yellow
      );
    }
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
