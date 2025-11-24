// Sui client for bot/client SDK
// Handles automatic coin splitting and payment

import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { fromB64, toB64 } from '@mysten/sui.js/utils';
import { bech32 } from 'bech32';
import { PaymentChallenge } from './types';
import contractConfig from './config/contract.json';
// Seal imports for decryption (following seal/examples pattern)
import { SealClient, SessionKey, EncryptedObject } from '@mysten/seal';
import { SuiClient as SealSuiClient, getFullnodeUrl as getSealFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex, toHex, toB64 as toB64Seal } from '@mysten/sui/utils';

// Seal server object IDs for testnet (from seal/examples)
const SEAL_SERVER_OBJECT_IDS = [
  "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
  "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
];

// Constants for Sui private key format
const SUI_PRIVATE_KEY_PREFIX = 'suiprivkey';
const SIGNATURE_FLAG_TO_SCHEME: Record<number, 'ED25519' | 'Secp256k1' | 'Secp256r1'> = {
  0: 'ED25519',
  1: 'Secp256k1',
  2: 'Secp256r1',
};

/**
 * Client SDK for AI bots to purchase AccessPass
 */
export class PaywallClient {
  private client: SuiClient;
  private keypair: Ed25519Keypair;

  constructor(options: {
    privateKey: string; // Sui bech32 format (suiprivkey1...), base64, or hex string
    rpcUrl?: string;
  }) {
    this.client = new SuiClient({
      url: options.rpcUrl || contractConfig.rpcUrl,
    });
    
    // Initialize keypair from private key
    // Supports multiple formats: Sui bech32 (suiprivkey1...), base64, or hex
    try {
      // Try Sui bech32 format first (suiprivkey1...)
      if (options.privateKey.startsWith(SUI_PRIVATE_KEY_PREFIX)) {
        // Decode bech32 format manually
        const { prefix, words } = bech32.decode(options.privateKey);
        if (prefix !== SUI_PRIVATE_KEY_PREFIX) {
          throw new Error('Invalid private key prefix');
        }
        const extendedSecretKey = new Uint8Array(bech32.fromWords(words));
        const secretKey = extendedSecretKey.slice(1); // Skip the flag byte
        const signatureScheme = SIGNATURE_FLAG_TO_SCHEME[extendedSecretKey[0]];
        
        if (signatureScheme !== 'ED25519') {
          throw new Error(`Unsupported signature scheme: ${signatureScheme}. Only ED25519 is supported.`);
        }
        
        this.keypair = Ed25519Keypair.fromSecretKey(secretKey);
      } else {
        // Try base64
        try {
          const privateKeyBytes = fromB64(options.privateKey);
          this.keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
        } catch {
          // Try hex string
          const privateKeyBytes = Uint8Array.from(Buffer.from(options.privateKey.replace('0x', ''), 'hex'));
          this.keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
        }
      }
    } catch (error) {
      throw new Error(`Failed to initialize keypair from private key: ${error instanceof Error ? error.message : 'Unknown error'}. Supported formats: suiprivkey1..., base64, or hex.`);
    }
  }

  /**
   * Find existing AccessPass for a domain/resource owned by this wallet
   * Returns the AccessPass object ID if found, null otherwise
   */
  async findExistingAccessPass(domain: string, resource: string): Promise<string | null> {
    const ownerAddress = this.keypair.toSuiAddress();
    console.log(`[PaywallClient] Searching for existing AccessPass for ${domain}${resource}...`);
    
    try {
      // Query PassPurchased events to find passes owned by this address
      // Since AccessPass is a shared object, we can't query by owner directly
      // Instead, we query events where owner matches
      const events = await this.client.queryEvents({
        query: {
          MoveModule: {
            package: contractConfig.packageId,
            module: 'paywall',
          },
        },
        order: 'descending',
        limit: 100, // Check last 100 purchases
      });

      // Filter events for PassPurchased where owner matches and domain/resource match
      const matchingEvents = events.data.filter((event) => {
        if (event.type?.includes('PassPurchased')) {
          const parsedJson = event.parsedJson as any;
          if (parsedJson && parsedJson.owner === ownerAddress) {
            // Normalize paths for comparison (remove trailing slashes)
            const eventDomain = parsedJson.domain || '';
            const eventResource = parsedJson.resource || '';
            const normalizedEventResource = eventResource === '/' ? '/' : eventResource.replace(/\/$/, '');
            const normalizedTargetResource = resource === '/' ? '/' : resource.replace(/\/$/, '');
            
            return eventDomain === domain && normalizedEventResource === normalizedTargetResource;
          }
        }
        return false;
      });

      if (matchingEvents.length === 0) {
        console.log(`[PaywallClient] No existing AccessPass found`);
        return null;
      }

      // Get the most recent matching event
      const mostRecentEvent = matchingEvents[0];
      console.log(`[PaywallClient] Found ${matchingEvents.length} matching event(s), checking most recent...`);

      // Find the AccessPass object ID from transaction
      // The AccessPass object ID should be in the transaction's created objects
      if (mostRecentEvent.id?.txDigest) {
        const txDigest = mostRecentEvent.id.txDigest;
        const tx = await this.client.getTransactionBlock({
          digest: txDigest,
          options: {
            showObjectChanges: true,
          },
        });

        if (tx.objectChanges) {
          // Find the AccessPass object that was created in this transaction
          for (const change of tx.objectChanges) {
            if (change.type === 'created' && change.objectType && change.objectType.includes('AccessPass')) {
              const passId = change.objectId;
              
              // Verify this pass is still valid by fetching it
              try {
                const pass = await this.client.getObject({
                  id: passId,
                  options: {
                    showContent: true,
                  },
                });

                if (pass.data && pass.data.content && 'fields' in pass.data.content) {
                  const fields = (pass.data.content as any).fields;
                  
                  // Extract string fields (handle Sui string::String format)
                  const extractString = (field: any): string => {
                    if (typeof field === 'string') return field;
                    if (field && typeof field === 'object' && 'bytes' in field) {
                      if (typeof field.bytes === 'string') {
                        try {
                          return Buffer.from(field.bytes, 'base64').toString('utf8');
                        } catch {
                          return field.bytes;
                        }
                      }
                      return String(field.bytes);
                    }
                    return String(field || '');
                  };

                  const passDomain = extractString(fields.domain);
                  const passResource = extractString(fields.resource);
                  const passOwner = String(fields.owner || '');
                  const remaining = Number(fields.remaining || 0);
                  const expiry = Number(fields.expiry || 0);

                  // Verify it matches and is still valid
                  const normalizedPassResource = passResource === '/' ? '/' : passResource.replace(/\/$/, '');
                  const normalizedTargetResource = resource === '/' ? '/' : resource.replace(/\/$/, '');
                  
                  if (passOwner === ownerAddress && 
                      passDomain === domain && 
                      normalizedPassResource === normalizedTargetResource &&
                      remaining > 0 &&
                      (expiry === 0 || Date.now() < expiry)) {
                    console.log(`[PaywallClient] ✅ Found valid existing AccessPass: ${passId} (remaining: ${remaining})`);
                    return passId;
                  }
                }
              } catch (error) {
                console.log(`[PaywallClient] Could not verify pass ${passId}:`, error);
                continue;
              }
            }
          }
        }
      }

      console.log(`[PaywallClient] No valid existing AccessPass found`);
      return null;
    } catch (error: any) {
      console.error(`[PaywallClient] Error searching for existing AccessPass:`, error);
      // Don't throw - just return null and purchase a new pass
      return null;
    }
  }

  /**
   * Consume one use from an AccessPass (decrement remaining)
   */
  async consumeAccessPass(passId: string): Promise<void> {
    console.log(`[PaywallClient] Consuming AccessPass: ${passId}`);
    
    try {
      const sender = this.keypair.toSuiAddress();
      const tx = new TransactionBlock();
      tx.setSender(sender);

      // Call consume_pass function
      tx.moveCall({
        target: `${contractConfig.packageId}::paywall::consume_pass`,
        arguments: [
          tx.object(passId),
        ],
      });

      tx.setGasBudget(10000000);

      // Sign and execute
      const result = await this.client.signAndExecuteTransactionBlock({
        signer: this.keypair,
        transactionBlock: tx,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      console.log(`[PaywallClient] ✅ AccessPass consumed (remaining uses decremented)`);
    } catch (error: any) {
      console.error(`[PaywallClient] Error consuming AccessPass:`, error);
      throw new Error(`Failed to consume AccessPass: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get all coins owned by the wallet (paginated to get all coins)
   */
  async getCoins(): Promise<Array<{ coinId: string; balance: bigint }>> {
    const address = this.keypair.toSuiAddress();
    const allCoins: Array<{ coinId: string; balance: bigint }> = [];
    let cursor: string | null = null;
    
    do {
      const result = await this.client.getCoins({
        owner: address,
        coinType: '0x2::sui::SUI',
        cursor: cursor || undefined,
      });

      allCoins.push(...result.data.map(coin => ({
        coinId: coin.coinObjectId,
        balance: BigInt(coin.balance),
      })));

      cursor = result.nextCursor || null;
    } while (cursor);

    return allCoins;
  }

  /**
   * Select best coin for splitting
   * Returns coin with sufficient balance
   */
  async selectCoinForPayment(amount: bigint): Promise<string | null> {
    const coins = await this.getCoins();
    
    // Find a coin with sufficient balance (amount + gas)
    const gasBuffer = BigInt(10_000_000); // 0.01 SUI for gas
    const totalNeeded = amount + gasBuffer;

    // Sort by balance (largest first)
    const sortedCoins = coins.sort((a, b) => {
      if (b.balance > a.balance) return 1;
      if (b.balance < a.balance) return -1;
      return 0;
    });

    // Find first coin with enough balance
    for (const coin of sortedCoins) {
      if (coin.balance >= totalNeeded) {
        return coin.coinId;
      }
    }

    // No single coin has enough - could merge coins or throw error
    return null;
  }

  /**
   * Split coin and return the new coin ID
   * The source coin must have enough balance left for gas after splitting
   * Note: The split coin is already owned by the sender, no transfer needed
   */
  async splitCoin(coinId: string, amount: bigint): Promise<string> {
    const sender = this.keypair.toSuiAddress();
    
    // Verify the coin has enough balance for both split amount and gas
    const coin = await this.client.getObject({
      id: coinId,
      options: { showContent: true },
    });
    
    if (!coin.data || !coin.data.content || 'fields' in coin.data.content === false) {
      throw new Error(`Coin ${coinId} not found`);
    }
    
    const coinBalance = BigInt((coin.data.content as any).fields?.balance || '0');
    const gasNeeded = BigInt(10_000_000); // ~0.01 SUI for gas
    const minRequired = amount + gasNeeded;
    
    if (coinBalance < minRequired) {
      throw new Error(`Coin balance (${coinBalance}) is insufficient. Need ${minRequired} (${amount} for payment + ${gasNeeded} for gas)`);
    }
    
    const tx = new TransactionBlock();
    tx.setSender(sender);
    
    // IMPORTANT: In Sui, you cannot use the same coin for both splitting and gas in the same transaction
    // If we only have 1 coin, we need to split from tx.gas (the gas coin itself)
    // This is a workaround for the single-coin case
    // Split from the gas coin - this creates a new coin for payment
    // The remaining balance of the gas coin will be used for gas
    const [splitCoin] = tx.splitCoins(tx.gas, [amount]);
    
    // Transfer the split coin to self (it's already owned, but this makes it explicit)
    // Actually, don't transfer - it's already owned by sender

    // Set gas budget
    tx.setGasBudget(10000000);

    // Sign and execute
    const result = await this.client.signAndExecuteTransactionBlock({
      signer: this.keypair,
      transactionBlock: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      },
    });

    // Extract the new coin ID from object changes
    // When splitting from tx.gas, the split coin might not appear as "created"
    // So we need to query for coins after the transaction
    if (result.objectChanges) {
      for (const change of result.objectChanges) {
        // Look for created coins (any coin type)
        if (change.type === 'created') {
          const objectType = change.objectType || '';
          if (objectType.includes('Coin') || objectType.includes('coin')) {
            console.log(`[PaywallClient] Found created coin: ${change.objectId} (type: ${objectType})`);
            return change.objectId;
          }
        }
      }
    }

    // Also check effects.created (alternative location)
    if (result.effects && result.effects.created) {
      for (const created of result.effects.created) {
        if (created.reference && created.reference.objectId) {
          const coinId = created.reference.objectId;
          // Verify it's a coin by checking the object
          try {
            const obj = await this.client.getObject({
              id: coinId,
              options: { showType: true },
            });
            if (obj.data && obj.data.type && (obj.data.type.includes('Coin') || obj.data.type.includes('coin'))) {
              console.log(`[PaywallClient] Found created coin from effects: ${coinId}`);
              return coinId;
            }
          } catch (e) {
            // Skip if we can't verify
          }
        }
      }
    }

    // When splitting from tx.gas, the split coin might not appear in objectChanges
    // The split coin is returned as a transaction result, but we need to get its object ID
    // Let's check transaction events and also query coins after a delay
    console.log('[PaywallClient] Split coin not found in objectChanges, checking events and querying coins...');
    
    // Check events for coin creation
    if (result.events && result.events.length > 0) {
      console.log(`[PaywallClient] Found ${result.events.length} event(s), checking for coin creation...`);
      for (const event of result.events) {
        console.log(`[PaywallClient] Event type: ${event.type}`);
        if (event.parsedJson) {
          console.log(`[PaywallClient] Event data:`, JSON.stringify(event.parsedJson, null, 2));
        }
      }
    }
    
    const address = this.keypair.toSuiAddress();
    
    // Wait longer for the transaction to be fully indexed and the split coin to appear
    console.log('[PaywallClient] Waiting for transaction to be indexed...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Query coins multiple times with increasing delays if needed
    let coinsAfter;
    for (let attempt = 0; attempt < 3; attempt++) {
      coinsAfter = await this.client.getCoins({
        owner: address,
        coinType: '0x2::sui::SUI',
      });
      
      console.log(`[PaywallClient] Attempt ${attempt + 1}: Found ${coinsAfter.data.length} coin(s)`);
      
      // Find the coin with the exact amount we split (the new payment coin)
      const targetAmount = amount.toString();
      const targetBigInt = amount;
      
      for (const coin of coinsAfter.data) {
        const coinBalance = BigInt(coin.balance);
        console.log(`[PaywallClient] Coin ${coin.coinObjectId}: ${coin.balance} MIST (${Number(coin.balance) / 1_000_000_000} SUI)`);
        
        // Exact match
        if (coin.balance === targetAmount) {
          console.log(`[PaywallClient] ✅ Found split coin by exact balance: ${coin.coinObjectId}`);
          return coin.coinObjectId;
        }
        
        // Approximate match (within 1% tolerance)
        const diff = coinBalance > targetBigInt ? coinBalance - targetBigInt : targetBigInt - coinBalance;
        const tolerance = targetBigInt / BigInt(100); // 1% tolerance
        if (diff <= tolerance && coinBalance <= targetBigInt + tolerance) {
          console.log(`[PaywallClient] ✅ Found split coin by approximate balance: ${coin.coinObjectId} (balance: ${coin.balance}, target: ${targetAmount})`);
          return coin.coinObjectId;
        }
      }
      
      // If we found more coins than before, the split coin might be there
      if (coinsAfter.data.length > 1) {
        // Find the coin that's closest to the target amount
        const candidates = coinsAfter.data
          .map(c => ({ id: c.coinObjectId, balance: BigInt(c.balance) }))
          .filter(c => c.balance <= targetBigInt + (targetBigInt / BigInt(10))) // Within 10% of target
          .sort((a, b) => {
            const diffA = targetBigInt > a.balance ? targetBigInt - a.balance : a.balance - targetBigInt;
            const diffB = targetBigInt > b.balance ? targetBigInt - b.balance : b.balance - targetBigInt;
            return diffA < diffB ? -1 : diffA > diffB ? 1 : 0;
          });
        
        if (candidates.length > 0) {
          console.log(`[PaywallClient] ✅ Using closest coin to target: ${candidates[0].id} (balance: ${candidates[0].balance})`);
          return candidates[0].id;
        }
      }
      
      // Wait before next attempt
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Debug: log the full result to see what we got
    console.error('[PaywallClient] Failed to extract split coin ID. Transaction result:');
    console.error(JSON.stringify({
      objectChanges: result.objectChanges,
      effects: result.effects ? {
        created: result.effects.created,
        mutated: result.effects.mutated,
      } : null,
    }, null, 2));
    throw new Error('Failed to get split coin ID from transaction. Check logs for transaction details.');
  }

  /**
   * Split coin and purchase AccessPass in a single transaction
   * This is needed when we only have 1 coin and need to split from tx.gas
   */
  private async splitAndPurchase(options: {
    price: string;
    domain: string;
    resource: string;
    remaining: number;
    expiry: number;
    nonce: string;
    receiver: string;
  }): Promise<string> {
    const sender = this.keypair.toSuiAddress();
    const priceMist = BigInt(Math.floor(parseFloat(options.price) * 1_000_000_000));
    
    const tx = new TransactionBlock();
    tx.setSender(sender);
    
    // Split from tx.gas - this creates the payment coin
    const [paymentCoin] = tx.splitCoins(tx.gas, [priceMist]);
    
    // Convert strings to bytes (UTF-8)
    const domainBytes = Array.from(new TextEncoder().encode(options.domain));
    const resourceBytes = Array.from(new TextEncoder().encode(options.resource));
    const nonceBytes = Array.from(new TextEncoder().encode(options.nonce));

    // Call purchase_pass with the split coin
    tx.moveCall({
      target: `${contractConfig.packageId}::paywall::purchase_pass`,
      arguments: [
        paymentCoin, // Use the split coin reference directly
        tx.pure(domainBytes, 'vector<u8>'),
        tx.pure(resourceBytes, 'vector<u8>'),
        tx.pure(options.remaining, 'u64'),
        tx.pure(options.expiry, 'u64'),
        tx.pure(nonceBytes, 'vector<u8>'),
        tx.pure.address(options.receiver), // Receiver address - use .address() helper
        tx.object(contractConfig.passCounterId),
      ],
    });

    // Set gas budget
    tx.setGasBudget(10000000);

    // Sign and execute
    console.log(`[PaywallClient] Splitting and purchasing in single transaction...`);
    const result = await this.client.signAndExecuteTransactionBlock({
      signer: this.keypair,
      transactionBlock: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    // Extract AccessPass ID from created objects
    if (result.objectChanges) {
      for (const change of result.objectChanges) {
        if (change.type === 'created' && change.objectType && change.objectType.includes('AccessPass')) {
          console.log(`✅ AccessPass purchased: ${change.objectId}`);
          return change.objectId;
        }
      }
    }

    throw new Error('Failed to get AccessPass ID from transaction');
  }

  /**
   * Purchase AccessPass - automatically handles coin selection and splitting
   * Combines split and purchase in a single transaction for better gas handling
   */
  async purchaseAccessPass(options: {
    price: string; // Price in SUI (e.g., "0.01")
    domain: string;
    resource: string;
    remaining: number;
    expiry: number; // 0 for no expiry, or timestamp in ms
    nonce: string;
    receiver: string; // Receiver wallet address
  }): Promise<string> {
    // Convert price to MIST (bigint)
    const priceMist = BigInt(Math.floor(parseFloat(options.price) * 1_000_000_000));

    // Step 1: Get coins
    const coins = await this.getCoins();
    if (coins.length === 0) {
      throw new Error('No coins available. Please add SUI to your wallet.');
    }

    // Step 2: Find a suitable coin
    const gasBuffer = BigInt(10_000_000); // Gas buffer (~0.01 SUI)
    const totalNeeded = priceMist + gasBuffer;
    
    let sourceCoinId: string | null = null;
    let needsSplit = false;
    
    // Check if we have a coin with exactly the right amount
    for (const coin of coins) {
      if (coin.balance === priceMist) {
        sourceCoinId = coin.coinId;
        needsSplit = false;
        break;
      }
    }

    // If no exact match, find a coin with enough balance for split + gas
    if (!sourceCoinId) {
      for (const coin of coins) {
        if (coin.balance >= totalNeeded) {
          sourceCoinId = coin.coinId;
          needsSplit = true;
          break;
        }
      }
      
      // If still no coin, try to find any coin with enough for payment (we'll handle gas separately)
      if (!sourceCoinId) {
        for (const coin of coins) {
          if (coin.balance >= priceMist) {
            sourceCoinId = coin.coinId;
            needsSplit = true;
            break;
          }
        }
      }
      
      if (!sourceCoinId) {
        throw new Error(`Insufficient balance. Need at least ${options.price} SUI. Available: ${coins.reduce((sum, c) => sum + c.balance, BigInt(0)) / BigInt(1_000_000_000)} SUI`);
      }
    }

    // Step 3: Log coin information for debugging
    console.log(`[PaywallClient] Found ${coins.length} coin(s)`);
    const totalBalance = coins.reduce((sum, c) => sum + c.balance, BigInt(0));
    console.log(`[PaywallClient] Total balance: ${Number(totalBalance) / 1_000_000_000} SUI`);

    // Step 4: Handle coin splitting and purchase
    // If we only have 1 coin and need to split, combine split and purchase in one transaction
    // because we can't extract the split coin ID when splitting from tx.gas
    if (needsSplit && coins.length === 1) {
      // Single coin case: combine split and purchase in one transaction
      console.log(`[PaywallClient] Single coin detected - combining split and purchase in one transaction...`);
      return await this.splitAndPurchase(options);
    }
    
    // Multiple coins or exact match: split first, then purchase
    let paymentCoinId: string | null = null;
    
    if (needsSplit) {
      // Multiple coins: split in separate transaction
      console.log(`[PaywallClient] Splitting ${options.price} SUI from coin ${sourceCoinId}...`);
      // For multiple coins, we can split from a specific coin (not tx.gas)
      const sender = this.keypair.toSuiAddress();
      const tx = new TransactionBlock();
      tx.setSender(sender);
      
      const [splitCoin] = tx.splitCoins(tx.object(sourceCoinId!), [priceMist]);
      tx.setGasBudget(10000000);
      
      const result = await this.client.signAndExecuteTransactionBlock({
        signer: this.keypair,
        transactionBlock: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });
      
      // Extract split coin ID
      if (result.objectChanges) {
        for (const change of result.objectChanges) {
          if (change.type === 'created' && change.objectType && change.objectType.includes('Coin')) {
            paymentCoinId = change.objectId;
            break;
          }
        }
      }
      
      if (!paymentCoinId) {
        throw new Error('Failed to get split coin ID from transaction');
      }
      
      console.log(`[PaywallClient] Created payment coin: ${paymentCoinId}`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for indexing
    } else {
      // Use the coin directly
      paymentCoinId = sourceCoinId!;
    }

    // Step 5: Purchase AccessPass using the payment coin
    const sender = this.keypair.toSuiAddress();
    const tx = new TransactionBlock();
    tx.setSender(sender);

    // Convert strings to bytes (UTF-8)
    const domainBytes = Array.from(new TextEncoder().encode(options.domain));
    const resourceBytes = Array.from(new TextEncoder().encode(options.resource));
    const nonceBytes = Array.from(new TextEncoder().encode(options.nonce));

    // Call purchase_pass with the payment coin
    tx.moveCall({
      target: `${contractConfig.packageId}::paywall::purchase_pass`,
      arguments: [
        tx.object(paymentCoinId!), // Payment coin (either split or direct)
        tx.pure(domainBytes, 'vector<u8>'),
        tx.pure(resourceBytes, 'vector<u8>'),
        tx.pure(options.remaining, 'u64'),
        tx.pure(options.expiry, 'u64'),
        tx.pure(nonceBytes, 'vector<u8>'),
        tx.pure.address(options.receiver), // Receiver address - use .address() helper
        tx.object(contractConfig.passCounterId), // PassCounter
      ],
    });

    // Set gas budget
    tx.setGasBudget(10000000);

    // Sign and execute
    console.log(`[PaywallClient] Purchasing AccessPass...`);
    const result = await this.client.signAndExecuteTransactionBlock({
      signer: this.keypair,
      transactionBlock: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    // Extract AccessPass ID from created objects
    if (result.objectChanges) {
      for (const change of result.objectChanges) {
        if (change.type === 'created' && change.objectType && change.objectType.includes('AccessPass')) {
          console.log(`✅ AccessPass purchased: ${change.objectId}`);
          return change.objectId;
        }
      }
    }

    throw new Error('Failed to get AccessPass ID from transaction');
  }

  /**
   * Sign message for headers
   */
  async signMessage(passId: string, domain: string, resource: string, timestamp: string): Promise<string> {
    try {
      const message = JSON.stringify({ passId, domain, resource, ts: timestamp });
      const messageBytes = new TextEncoder().encode(message);
      
      console.log(`[PaywallClient] Signing message: ${message.substring(0, 100)}...`);
      
      const signatureResult = await this.keypair.signPersonalMessage(messageBytes);
      
      console.log(`[PaywallClient] Signature result type:`, typeof signatureResult);
      console.log(`[PaywallClient] Signature result keys:`, signatureResult ? Object.keys(signatureResult) : 'null/undefined');
      
      // signatureResult might be an object with signature property, or directly a Uint8Array
      let sig: Uint8Array | undefined;
      
      if (signatureResult instanceof Uint8Array) {
        sig = signatureResult;
      } else if (signatureResult && typeof signatureResult === 'object') {
        // Try different possible property names
        sig = (signatureResult as any).signature || 
              (signatureResult as any).bytes || 
              (signatureResult as any).signatureBytes ||
              (signatureResult as any).data;
      }
      
      if (!sig) {
        console.error(`[PaywallClient] Could not extract signature from result:`, signatureResult);
        throw new Error('Failed to extract signature from signPersonalMessage result');
      }
      
      if (!(sig instanceof Uint8Array)) {
        // Try to convert to Uint8Array
        if (Array.isArray(sig)) {
          sig = new Uint8Array(sig);
        } else if (typeof sig === 'string') {
          // If it's already a base64 string, return it
          return sig;
        } else {
          sig = new Uint8Array(Object.values(sig));
        }
      }
      
      const base64Signature = toB64(sig);
      console.log(`[PaywallClient] Signature generated, length: ${base64Signature.length}`);
      
      if (!base64Signature || base64Signature.length === 0) {
        throw new Error('Generated signature is empty');
      }
      
      return base64Signature;
    } catch (error: any) {
      console.error(`[PaywallClient] Error signing message:`, error);
      throw new Error(`Failed to sign message: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Complete flow: Get 402 challenge, purchase pass, return headers
   */
  async payForAccess(url: string): Promise<{
    headers: {
      'x-pass-id': string;
      'x-signer': string;
      'x-sig': string;
      'x-ts': string;
    };
    accessPassId: string;
  }> {
    // Step 1: Get 402 challenge
    const response = await fetch(url);
    if (response.status !== 402) {
      throw new Error(`Expected 402, got ${response.status}`);
    }

    const challenge = await response.json() as PaymentChallenge;
    
    // Step 2: Purchase AccessPass
    const accessPassId = await this.purchaseAccessPass({
      price: challenge.price,
      domain: challenge.domain,
      resource: challenge.resource,
      remaining: 10, // Default
      expiry: 0, // No expiry
      nonce: challenge.nonce,
      receiver: challenge.receiver, // Pass receiver from challenge
    });

    // Step 3: Sign headers
    const timestamp = Date.now().toString();
    const signature = await this.signMessage(accessPassId, challenge.domain, challenge.resource, timestamp);

    return {
      headers: {
        'x-pass-id': accessPassId,
        'x-signer': this.keypair.toSuiAddress(),
        'x-sig': signature,
        'x-ts': timestamp,
      },
      accessPassId,
    };
  }

  /**
   * ONE-LINE ACCESS: Automatically handles payment and returns content
   * This is the main method clients should use - everything is abstracted!
   * 
   * @param url - The protected route URL
   * @param options - Optional: retry attempts, timeout, autoDecrypt, etc.
   * @returns The response data from the protected route (decrypted if autoDecrypt is enabled)
   * 
   * @example
   * ```javascript
   * // Basic usage - returns encrypted blob
   * const encrypted = await client.access('http://example.com/premium');
   * 
   * // With automatic decryption
   * const decrypted = await client.access('http://example.com/premium', {
   *   autoDecrypt: {
   *     domain: 'www.example.com',
   *     resource: '/premium',
   *     resourceEntryId: process.env.RESOURCE_ENTRY_ID
   *   }
   * });
   * ```
   */
  async access(
    url: string,
    options?: {
      retries?: number;
      timeout?: number;
      autoDecrypt?: {
        domain: string;
        resource: string;
        resourceEntryId?: string; // Optional: if not provided, will be extracted from response headers
      };
    }
  ): Promise<any> {
    const maxRetries = options?.retries || 1;
    const timeout = options?.timeout || 30000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Step 1: Try to access the route
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Connection': 'close',
          },
          signal: AbortSignal.timeout(timeout),
        });

        // Step 2: If we get 200, return the content
        if (response.status === 200) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/octet-stream')) {
            return await response.arrayBuffer();
          } else if (contentType && contentType.includes('application/json')) {
            return await response.json();
          } else {
            // Try JSON first, fallback to arrayBuffer
            try {
              const text = await response.text();
              try {
                return JSON.parse(text);
              } catch {
                return Buffer.from(text, 'binary');
              }
            } catch {
              return await response.arrayBuffer();
            }
          }
        }

        // Step 3: If we get 402, check for existing pass first, then purchase if needed
        if (response.status === 402) {
          const challenge = await response.json() as PaymentChallenge;
          
          // Normalize resource path (remove trailing slash except for root)
          const normalizedResource = challenge.resource === '/' ? '/' : challenge.resource.replace(/\/$/, '');
          
          // Check if we already have a valid AccessPass for this domain/resource
          let accessPassId = await this.findExistingAccessPass(challenge.domain, normalizedResource);
          
          if (!accessPassId) {
            console.log(`[PaywallClient] No existing AccessPass found, purchasing new one...`);
            console.log(`[PaywallClient] Payment required: ${challenge.price} SUI`);
            
            // Purchase AccessPass (automatically handles coin splitting)
            accessPassId = await this.purchaseAccessPass({
              price: challenge.price,
              domain: challenge.domain,
              resource: normalizedResource,
              remaining: 10, // Default remaining uses
              expiry: 0, // No expiry
              nonce: challenge.nonce,
              receiver: challenge.receiver,
            });

            console.log(`[PaywallClient] AccessPass purchased: ${accessPassId}`);
            
            // Wait a moment for the AccessPass to be indexed on-chain
            console.log(`[PaywallClient] Waiting for AccessPass to be indexed...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            console.log(`[PaywallClient] Using existing AccessPass: ${accessPassId}`);
          }

          // Sign headers
          const timestamp = Date.now().toString();
          const signature = await this.signMessage(
            accessPassId!,
            challenge.domain,
            normalizedResource,
            timestamp
          );

          // Validate signature is a non-empty string
          if (!signature || typeof signature !== 'string' || signature.length === 0) {
            throw new Error('Invalid signature generated');
          }

          const headers = {
            'x-pass-id': accessPassId,
            'x-signer': this.keypair.toSuiAddress(),
            'x-sig': signature,
            'x-ts': timestamp,
            'Connection': 'close',
          };
          
          console.log(`[PaywallClient] Signature length: ${signature.length}, first 20 chars: ${signature.substring(0, 20)}`);

          // Retry request with signed headers
          console.log(`[PaywallClient] Requesting content with AccessPass...`);
          console.log(`[PaywallClient] Headers:`, {
            'x-pass-id': accessPassId,
            'x-signer': this.keypair.toSuiAddress(),
            'x-ts': timestamp,
            'x-sig': signature.substring(0, 20) + '...',
          });
          
          const contentResponse = await fetch(url, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(timeout),
          });

          if (contentResponse.status === 200) {
            // Success! Now consume one use from the AccessPass
            try {
              await this.consumeAccessPass(accessPassId!);
            } catch (consumeError) {
              // Log error but don't fail the request - consumption is best-effort
              console.error(`[PaywallClient] Warning: Failed to consume AccessPass:`, consumeError);
            }
            
            // Check content type to determine if it's JSON or binary
            const contentType = contentResponse.headers.get('content-type');
            let content: any;
            
            if (contentType && contentType.includes('application/octet-stream')) {
              // Binary content (encrypted blob)
              content = await contentResponse.arrayBuffer();
            } else if (contentType && contentType.includes('application/json')) {
              // JSON content
              content = await contentResponse.json();
            } else {
              // Try JSON first, fallback to arrayBuffer
              try {
                const text = await contentResponse.text();
                try {
                  content = JSON.parse(text);
                } catch {
                  // Not JSON, return as buffer
                  content = Buffer.from(text, 'binary');
                }
              } catch {
                // If text() fails, try arrayBuffer
                content = await contentResponse.arrayBuffer();
              }
            }

            // Auto-decrypt if requested and content is an encrypted blob
            if (options?.autoDecrypt && (content instanceof ArrayBuffer || Buffer.isBuffer(content) || content instanceof Uint8Array)) {
              console.log(`[PaywallClient] Auto-decrypting content...`);
              try {
                // Get resourceEntryId from headers if not provided in options
                let resourceEntryId = options.autoDecrypt.resourceEntryId;
                if (!resourceEntryId) {
                  const headerValue = contentResponse.headers.get('X-Resource-Entry-ID');
                  resourceEntryId = headerValue || undefined;
                  if (!resourceEntryId) {
                    throw new Error('ResourceEntry ID not found in response headers. Server must provide X-Resource-Entry-ID header.');
                  }
                  console.log(`[PaywallClient] Using ResourceEntry ID from server headers: ${resourceEntryId}`);
                }
                
                const decrypted = await this.decrypt(
                  content,
                  resourceEntryId,
                  accessPassId!
                );
                return decrypted;
              } catch (decryptError: any) {
                console.error(`[PaywallClient] Auto-decryption failed:`, decryptError.message);
                // Return encrypted blob if decryption fails (allow manual decryption)
                return content;
              }
            }
            
            return content;
          } else {
            // Get error details from response
            let errorDetails = '';
            try {
              const errorBody = await contentResponse.json();
              errorDetails = JSON.stringify(errorBody, null, 2);
            } catch (e) {
              errorDetails = await contentResponse.text();
            }
            throw new Error(`Unexpected status after payment: ${contentResponse.status}\nResponse: ${errorDetails}`);
          }
        }

        // Step 4: Handle other status codes
        throw new Error(`Unexpected status: ${response.status}`);
      } catch (error: any) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        console.log(`[PaywallClient] Attempt ${attempt + 1} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
      }
    }

    throw new Error('Failed to access protected route after retries');
  }

  /**
   * Get method - alias for access() for convenience
   */
  async get(url: string, options?: { retries?: number; timeout?: number }): Promise<any> {
    return this.access(url, options);
  }

  /**
   * Decrypt encrypted content using Seal
   * 
   * This method decrypts Seal-encrypted content that was fetched via access().
   * It follows the exact pattern from seal/examples for compatibility.
   * 
   * @param encryptedBlob - The encrypted blob (ArrayBuffer or Uint8Array) from access()
   * @param resourceEntryId - The ResourceEntry object ID from the registry
   * @param accessPassId - The AccessPass ID that was used for access
   * @returns Decrypted content as Uint8Array
   * 
   * @example
   * ```javascript
   * const encryptedBlob = await client.access(url);
   * const decrypted = await client.decrypt(encryptedBlob, resourceEntryId, accessPassId);
   * // Save or use decrypted content
   * ```
   */
  async decrypt(
    encryptedBlob: ArrayBuffer | Uint8Array,
    resourceEntryId: string,
    accessPassId: string
  ): Promise<Uint8Array> {
    const packageId = contractConfig.packageId;
    const userAddress = this.keypair.toSuiAddress();

    // Normalize hex string helper (same as test-registered-content.js)
    const normalizeHexString = (hex: string): string => {
      let cleaned = hex.startsWith("0x") ? hex.slice(2) : hex;
      cleaned = cleaned.toLowerCase();
      return cleaned;
    };

    try {
      // Parse encrypted object
      const encryptedData = new Uint8Array(encryptedBlob);
      const encryptedObject = EncryptedObject.parse(encryptedData);
      const threshold = encryptedObject.threshold;

      // Extract policy ID from encrypted object
      // encryptedObject.id is the policy ID (37 bytes), not the full ID
      const policyId: any = encryptedObject.id;
      const encryptedPackageId = encryptedObject.packageId || packageId;

      // Convert policy ID to bytes
      let policyIdBytes: Uint8Array;
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

      // Get policy ID as hex string for Seal operations
      const policyIdHex =
        typeof policyId === "string"
          ? normalizeHexString(policyId)
          : toHex(policyIdBytes);

      // Create Sui and Seal clients (using @mysten/sui for Seal compatibility)
      const suiClient = new SealSuiClient({ url: getSealFullnodeUrl("testnet") });
      const sealClient = new SealClient({
        suiClient: suiClient as any, // Type assertion to handle version compatibility
        serverConfigs: SEAL_SERVER_OBJECT_IDS.map((id) => ({
          objectId: id,
          weight: 1,
        })),
        verifyKeyServers: false,
      });

      // Create SessionKey
      const sessionKey = await SessionKey.create({
        address: userAddress,
        packageId: packageId,
        ttlMin: 10,
        suiClient: suiClient as any, // Type assertion to handle version compatibility
      });

      // Sign SessionKey
      const personalMessage = sessionKey.getPersonalMessage();
      const signatureResult = await this.keypair.signPersonalMessage(personalMessage);

      // Extract signature as base64 string (following test-registered-content.js pattern)
      let signatureString: string;
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
          signatureResult.signature &&
          typeof signatureResult.signature === "object"
        ) {
          // Check if signature is a Uint8Array
          const sig = (signatureResult as any).signature;
          if (sig && (sig.constructor === Uint8Array || sig instanceof Uint8Array)) {
            signatureString = toB64Seal(sig as Uint8Array);
          } else {
            throw new Error("Invalid signature format");
          }
        } else if ("bytes" in signatureResult) {
          const bytesValue = (signatureResult as any).bytes;
          let bytes: Uint8Array;
          if (bytesValue instanceof Uint8Array) {
            bytes = bytesValue;
          } else if (Array.isArray(bytesValue)) {
            bytes = new Uint8Array(bytesValue as number[]);
          } else if (bytesValue && typeof bytesValue === "object") {
            const values = Object.values(bytesValue);
            if (values.length > 0 && typeof values[0] === "number") {
              bytes = new Uint8Array(values as number[]);
            } else {
              throw new Error("Could not extract signature bytes");
            }
          } else {
            throw new Error("Invalid signature bytes format");
          }
          signatureString = toB64Seal(bytes);
        } else {
          const values = Object.values(signatureResult);
          if (values.length > 0 && values[0] && typeof values[0] === "object") {
            const firstValue = values[0] as any;
            if (firstValue && (firstValue.constructor === Uint8Array || firstValue instanceof Uint8Array)) {
              signatureString = toB64Seal(firstValue as Uint8Array);
            } else {
              throw new Error("Could not extract signature");
            }
          } else {
            throw new Error("Could not extract signature");
          }
        }
      } else if (signatureResult && typeof signatureResult === "object") {
        const sigResult = signatureResult as any;
        if (sigResult.constructor === Uint8Array || sigResult instanceof Uint8Array) {
          signatureString = toB64Seal(sigResult as Uint8Array);
        } else {
          throw new Error("Invalid signature result");
        }
      } else {
        throw new Error("Invalid signature result");
      }

      await sessionKey.setPersonalMessageSignature(signatureString);

      // Build seal_approve transaction (following seal/examples pattern)
      const moveCallConstructor = (tx: Transaction, id: string) => {
        // id is the policy ID as hex string
        // Convert to bytes using fromHex, matching seal/examples pattern
        tx.moveCall({
          target: `${packageId}::registry::seal_approve`,
          arguments: [
            tx.pure.vector("u8", Array.from(fromHex(id))), // Convert hex string to bytes
            tx.object(resourceEntryId),
            tx.object(accessPassId),
            tx.object("0x6"), // Clock
          ],
        });
      };

      // Build transaction for fetchKeys using policy ID
      const tx = new Transaction();
      moveCallConstructor(tx, policyIdHex);
      const txBytes = await tx.build({
        client: suiClient,
        onlyTransactionKind: true,
      });

      // Fetch decryption keys (following seal/examples pattern)
      // Use policy ID (hex string) like seal/examples do
      await sealClient.fetchKeys({
        ids: [policyIdHex], // Use policy ID (hex string) like seal/examples
        txBytes,
        sessionKey,
        threshold: threshold,
      });

      // Decrypt content - use the SAME transaction bytes as fetchKeys
      const decryptedData = await sealClient.decrypt({
        data: encryptedData,
        sessionKey,
        txBytes: txBytes, // Use the EXACT same txBytes as fetchKeys (critical for nonce verification)
      });

      return decryptedData;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error) || "Unknown error";
      throw new Error(`Decryption failed: ${errorMsg}`);
    }
  }

  /**
   * Access and decrypt content in one call
   * 
   * This is a convenience method that combines access() and decrypt().
   * It automatically fetches encrypted content and decrypts it using Seal.
   * The ResourceEntry ID is automatically extracted from server response headers.
   * 
   * @param url - The protected route URL
   * @param domain - The domain registered in the registry
   * @param resource - The resource path registered in the registry
   * @param options - Optional: retry attempts, timeout, resourceEntryId (fallback if header missing)
   * @returns Decrypted content as Uint8Array
   * 
   * @example
   * ```javascript
   * // Server provides ResourceEntry ID via X-Resource-Entry-ID header
   * const decrypted = await client.accessAndDecrypt(
   *   'http://example.com/premium',
   *   'www.example.com',
   *   '/premium'
   * );
   * ```
   */
  async accessAndDecrypt(
    url: string,
    domain: string,
    resource: string,
    options?: {
      retries?: number;
      timeout?: number;
      resourceEntryId?: string; // Optional fallback if server doesn't provide header
    }
  ): Promise<Uint8Array> {
    const maxRetries = options?.retries || 1;
    const timeout = options?.timeout || 30000;

    // Step 1: Access the content and capture response headers
    let resourceEntryId: string | undefined = options?.resourceEntryId;
    let accessPassId: string | undefined;
    let encryptedBlob: ArrayBuffer | Uint8Array | undefined;

    // Use access() with autoDecrypt disabled initially so we can capture headers
    // We'll make our own request to get headers
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // First, get access pass (may need to purchase)
        const foundPass = await this.findExistingAccessPass(domain, resource);
        accessPassId = foundPass || undefined;
        
        if (!accessPassId) {
          // No pass yet - access() will handle purchasing
          // Make initial request to get 402 and purchase pass
          const initialResponse = await fetch(url, {
            method: 'GET',
            headers: { 'Connection': 'close' },
            signal: AbortSignal.timeout(timeout),
          });

          if (initialResponse.status === 402) {
            const challenge = await initialResponse.json() as PaymentChallenge;
            const normalizedResource = challenge.resource === '/' ? '/' : challenge.resource.replace(/\/$/, '');
            
            console.log(`[PaywallClient] Purchasing AccessPass...`);
            accessPassId = await this.purchaseAccessPass({
              price: challenge.price,
              domain: challenge.domain,
              resource: normalizedResource,
              remaining: 10,
              expiry: 0,
              nonce: challenge.nonce,
              receiver: challenge.receiver,
            });
            
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        if (!accessPassId) {
          throw new Error(`No AccessPass found for ${domain}${resource}`);
        }

        // Now make authenticated request to get content and headers
        const timestamp = Date.now().toString();
        const signature = await this.signMessage(
          accessPassId,
          domain,
          resource.replace(/\/$/, '') || resource,
          timestamp
        );

        const headers = {
          'x-pass-id': accessPassId,
          'x-signer': this.keypair.toSuiAddress(),
          'x-sig': signature,
          'x-ts': timestamp,
          'Connection': 'close',
        };

        const contentResponse = await fetch(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(timeout),
        });

        if (contentResponse.status !== 200) {
          throw new Error(`Unexpected status: ${contentResponse.status}`);
        }

        // Extract ResourceEntry ID from headers (server provides this)
        if (!resourceEntryId) {
          const headerValue = contentResponse.headers.get('X-Resource-Entry-ID');
          if (!headerValue) {
            throw new Error(
              'ResourceEntry ID not found in response headers (X-Resource-Entry-ID). ' +
              'Make sure your server is configured to send this header, or provide it as an option.'
            );
          }
          resourceEntryId = headerValue;
          console.log(`[PaywallClient] Using ResourceEntry ID from server: ${resourceEntryId}`);
        }

        // Get encrypted blob
        const contentType = contentResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/octet-stream')) {
          encryptedBlob = await contentResponse.arrayBuffer();
        } else {
          // Try to parse as binary
          encryptedBlob = await contentResponse.arrayBuffer();
        }

        // Consume AccessPass
        try {
          await this.consumeAccessPass(accessPassId);
        } catch (consumeError) {
          console.error(`[PaywallClient] Warning: Failed to consume AccessPass:`, consumeError);
        }

        break; // Success
      } catch (error: any) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        console.log(`[PaywallClient] Attempt ${attempt + 1} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!encryptedBlob || !resourceEntryId || !accessPassId) {
      throw new Error('Failed to get encrypted content, ResourceEntry ID, or AccessPass');
    }

    // Step 2: Decrypt the content
    return await this.decrypt(encryptedBlob, resourceEntryId, accessPassId);
  }
}
