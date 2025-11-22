// Sui client for bot/client SDK
// Handles automatic coin splitting and payment

import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { fromB64, toB64 } from '@mysten/sui.js/utils';
import { PaymentChallenge } from './types';
import contractConfig from './config/contract.json';

/**
 * Client SDK for AI bots to purchase AccessPass
 */
export class PaywallClient {
  private client: SuiClient;
  private keypair: Ed25519Keypair;

  constructor(options: {
    privateKey: string; // Base64 encoded private key or hex string
    rpcUrl?: string;
  }) {
    this.client = new SuiClient({
      url: options.rpcUrl || contractConfig.rpcUrl,
    });
    
    // Initialize keypair from private key
    try {
      // Try base64 first
      const privateKeyBytes = fromB64(options.privateKey);
      this.keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
    } catch {
      // Try hex string
      const privateKeyBytes = Uint8Array.from(Buffer.from(options.privateKey.replace('0x', ''), 'hex'));
      this.keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
    }
  }

  /**
   * Get all coins owned by the wallet
   */
  async getCoins(): Promise<Array<{ coinId: string; balance: bigint }>> {
    const address = this.keypair.toSuiAddress();
    const coins = await this.client.getCoins({
      owner: address,
      coinType: '0x2::sui::SUI',
    });

    return coins.data.map(coin => ({
      coinId: coin.coinObjectId,
      balance: BigInt(coin.balance),
    }));
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
   */
  async splitCoin(coinId: string, amount: bigint): Promise<string> {
    const tx = new TransactionBlock();
    const [splitCoin] = tx.splitCoins(tx.object(coinId), [amount]);
    
    // Transfer the split coin to self (to keep it)
    tx.transferObjects([splitCoin], this.keypair.toSuiAddress());

    // Sign and execute
    const result = await this.client.signAndExecuteTransactionBlock({
      signer: this.keypair,
      transactionBlock: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    // Extract the new coin ID from object changes
    if (result.objectChanges) {
      for (const change of result.objectChanges) {
        if (change.type === 'created' && change.objectType.includes('Coin')) {
          return change.objectId;
        }
      }
    }

    throw new Error('Failed to get split coin ID from transaction');
  }

  /**
   * Purchase AccessPass - automatically handles coin selection and splitting
   */
  async purchaseAccessPass(options: {
    price: string; // Price in SUI (e.g., "0.01")
    domain: string;
    resource: string;
    remaining: number;
    expiry: number; // 0 for no expiry, or timestamp in ms
    nonce: string;
  }): Promise<string> {
    // Convert price to MIST (bigint)
    const priceMist = BigInt(Math.floor(parseFloat(options.price) * 1_000_000_000));

    // Step 1: Get coins
    const coins = await this.getCoins();
    if (coins.length === 0) {
      throw new Error('No coins available. Please add SUI to your wallet.');
    }

    // Step 2: Find a coin with enough balance
    const gasBuffer = BigInt(10_000_000); // Gas buffer
    const totalNeeded = priceMist + gasBuffer;
    
    let paymentCoinId: string | null = null;
    
    // Check if we have a coin with exactly the right amount
    for (const coin of coins) {
      if (coin.balance === priceMist) {
        paymentCoinId = coin.coinId;
        break;
      }
    }

    // If no exact match, split from a larger coin
    if (!paymentCoinId) {
      const sourceCoinId = await this.selectCoinForPayment(priceMist);
      if (!sourceCoinId) {
        throw new Error('Insufficient balance. Need at least ' + options.price + ' SUI + gas.');
      }

      // Split the exact amount needed
      console.log(`Splitting ${options.price} SUI from coin ${sourceCoinId}...`);
      paymentCoinId = await this.splitCoin(sourceCoinId, priceMist);
      console.log(`Created payment coin: ${paymentCoinId}`);
    }

    // Step 3: Purchase AccessPass
    const tx = new TransactionBlock();

    // Convert strings to bytes (UTF-8)
    const domainBytes = Array.from(new TextEncoder().encode(options.domain));
    const resourceBytes = Array.from(new TextEncoder().encode(options.resource));
    const nonceBytes = Array.from(new TextEncoder().encode(options.nonce));

    // Call purchase_pass
    tx.moveCall({
      target: `${contractConfig.packageId}::paywall::purchase_pass`,
      arguments: [
        tx.object(paymentCoinId), // Payment coin
        tx.pure(domainBytes, 'vector<u8>'),
        tx.pure(resourceBytes, 'vector<u8>'),
        tx.pure(options.remaining, 'u64'),
        tx.pure(options.expiry, 'u64'),
        tx.pure(nonceBytes, 'vector<u8>'),
        tx.object(contractConfig.treasuryId), // Treasury
        tx.object(contractConfig.passCounterId), // PassCounter
      ],
    });

    // Sign and execute
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
        if (change.type === 'created' && change.objectType.includes('AccessPass')) {
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
    const message = JSON.stringify({ passId, domain, resource, ts: timestamp });
    const messageBytes = new TextEncoder().encode(message);
    const signatureResult = await this.keypair.signPersonalMessage(messageBytes);
    // signatureResult has a signature property that's Uint8Array
    const sig = (signatureResult as any).signature || (signatureResult as any).bytes || signatureResult;
    const signatureBytes = sig instanceof Uint8Array ? sig : new Uint8Array(sig);
    return toB64(signatureBytes);
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
}
