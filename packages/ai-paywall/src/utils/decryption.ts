// Decryption utility for Seal-encrypted content from Walrus
// Based on Seal examples decryption flow

import { SealClient, SessionKey, NoAccessError, EncryptedObject } from '@mysten/seal';
// Note: Seal requires @mysten/sui (not @mysten/sui.js) for compatibility
// We'll try to use @mysten/sui if available, otherwise fall back to @mysten/sui.js
let SuiClientModule: any;
let TransactionModule: any;
let UtilsModule: any;

try {
  // Try newer @mysten/sui package first (compatible with Seal)
  SuiClientModule = require('@mysten/sui/client');
  TransactionModule = require('@mysten/sui/transactions');
  UtilsModule = require('@mysten/sui/utils');
} catch {
  // Fall back to older @mysten/sui.js package
  SuiClientModule = require('@mysten/sui.js/client');
  TransactionModule = require('@mysten/sui.js/transactions');
  UtilsModule = require('@mysten/sui.js/utils');
}

const { SuiClient, getFullnodeUrl } = SuiClientModule;
const { Transaction, TransactionBlock } = TransactionModule;
const { fromHEX, fromHex } = UtilsModule;

// Seal key server object IDs for testnet (from Seal examples)
const DEFAULT_SERVER_OBJECT_IDS = [
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75',
  '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
];

export interface DecryptionOptions {
  packageId: string;
  registryId: string;
  resourceId: string;
  accessPassId: string;
  walrusCid: string;
  sealPolicyId: string; // Hex string policy ID
  rpcUrl?: string;
  network?: 'testnet' | 'mainnet' | 'devnet';
  threshold?: number;
  sessionKeySignature?: string; // Optional: if provided, use existing session key
  userAddress?: string; // Required if creating new session key
}

export interface DecryptionResult {
  decryptedData: Uint8Array;
  contentType?: string;
}

/**
 * Create Seal client
 * Note: SealClient requires a SuiClient that's compatible with its version
 * We'll create the client inside the SealClient constructor
 */
function createSealClient(
  packageId: string,
  rpcUrl: string,
  threshold: number = 2
): SealClient {
  // Create SuiClient - Seal will use its own compatible version
  const suiClient = new SuiClient({ url: rpcUrl });

  return new SealClient({
    suiClient: suiClient as any, // Type assertion to handle version compatibility
    serverConfigs: DEFAULT_SERVER_OBJECT_IDS.map((id) => ({
      objectId: id,
      weight: 1,
    })),
    verifyKeyServers: false,
  });
}

/**
 * Normalize hex string (remove 0x prefix, lowercase)
 */
function normalizeHexString(hex: string): string {
  const cleaned = hex.startsWith('0x') ? hex.slice(2) : hex;
  return cleaned.toLowerCase();
}

/**
 * Fetch encrypted blob from Walrus aggregator
 */
async function fetchFromWalrus(walrusCid: string): Promise<ArrayBuffer> {
  // Walrus aggregator URLs (from Seal examples)
  const aggregators = [
    'https://aggregator.walrus-testnet.walrus.space',
    'https://wal-aggregator-testnet.staketab.org',
    'https://walrus-testnet-aggregator.redundex.com',
    'https://walrus-testnet-aggregator.nodes.guru',
    'https://aggregator.walrus.banansen.dev',
    'https://walrus-testnet-aggregator.everstake.one',
  ];

  // Try each aggregator until one succeeds
  for (const aggregator of aggregators) {
    try {
      const url = `${aggregator}/v1/blobs/${walrusCid}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        return await response.arrayBuffer();
      }
    } catch (err) {
      console.warn(`Failed to fetch from ${aggregator}:`, err);
      continue;
    }
  }

  throw new Error(`Failed to fetch encrypted blob from Walrus (CID: ${walrusCid})`);
}

/**
 * Construct Move call for seal_approve
 */
function constructSealApproveCall(
  packageId: string,
  registryId: string,
  resourceId: string,
  accessPassId: string,
  policyIdBytes: Uint8Array
): (tx: typeof TransactionBlock, id: string) => void {
  return (tx: typeof TransactionBlock, id: string) => {
    // The id parameter is the full policy ID (with package prefix)
    // But seal_approve expects the id without package prefix
    // We need to extract just the policy part
    
    tx.moveCall({
      target: `${packageId}::registry::seal_approve`,
      arguments: [
        tx.pure(Array.from(policyIdBytes), 'vector<u8>'), // id: vector<u8> (policy ID without package prefix)
        tx.object(resourceId), // resource_entry: &ResourceEntry
        tx.object(accessPassId), // access_pass: &AccessPass
        tx.object('0x6'), // clock: &Clock (Sui clock object)
      ],
    });
  };
}

/**
 * Decrypt content using Seal
 * 
 * This function fetches encrypted content from Walrus and decrypts it using Seal.
 * It requires a SessionKey which must be created and signed by the client.
 * 
 * For server-side decryption, the client should:
 * 1. Create a SessionKey using Seal SDK
 * 2. Sign it with their wallet
 * 3. Send the exported SessionKey (with signature) to the server
 * 4. Server imports the SessionKey and uses it for decryption
 */
export async function decryptContent(
  options: DecryptionOptions & {
    exportedSessionKey?: any; // ExportedSessionKey from client
  }
): Promise<DecryptionResult> {
  const {
    packageId,
    registryId,
    resourceId,
    accessPassId,
    walrusCid,
    sealPolicyId,
    rpcUrl = getFullnodeUrl('testnet'),
    threshold = 2,
    exportedSessionKey,
  } = options;

  // Step 1: Fetch encrypted blob from Walrus
  console.log(`[Decryption] Fetching encrypted blob from Walrus: ${walrusCid}`);
  const encryptedBlob = await fetchFromWalrus(walrusCid);
  console.log(`[Decryption] Fetched ${encryptedBlob.byteLength} bytes from Walrus`);

  // Step 2: Parse encrypted object to get the full ID
  const encryptedData = new Uint8Array(encryptedBlob);
  const encryptedObject = EncryptedObject.parse(encryptedData);
  const fullId = encryptedObject.id;
  console.log(`[Decryption] Encrypted object ID: ${fullId}`);

  // Step 3: Create Seal client and Sui client
  // Use the Sui client from @mysten/sui.js which is compatible with Seal
  const suiClient = new SuiClient({ url: rpcUrl });
  const sealClient = createSealClient(packageId, rpcUrl, threshold);

  // Step 4: Import SessionKey if provided, otherwise return encrypted blob
  if (!exportedSessionKey) {
    // Return encrypted blob for client-side decryption
    return {
      decryptedData: encryptedData,
    };
  }

  // Import the SessionKey
  // SessionKey.import expects a compatible SuiClient
  const sessionKey = await SessionKey.import(exportedSessionKey, suiClient as any);
  console.log(`[Decryption] SessionKey imported for address: ${sessionKey.getAddress()}`);

  // Step 5: Convert policy ID hex string to bytes
  const normalizedPolicyId = normalizeHexString(sealPolicyId);
  // Use fromHex if available (newer API), otherwise fromHEX
  const hexConverter = fromHex || fromHEX;
  const policyIdBytes = hexConverter(normalizedPolicyId);

  // Step 6: Build transaction with seal_approve call
  const moveCallConstructor = constructSealApproveCall(
    packageId,
    registryId,
    resourceId,
    accessPassId,
    policyIdBytes
  );

  // Step 7: Fetch decryption keys from Seal servers
  console.log(`[Decryption] Fetching decryption keys from Seal servers...`);
  // Use Transaction if available (newer API), otherwise TransactionBlock
  const TxClass = Transaction || TransactionBlock;
  const tx = new TxClass();
  moveCallConstructor(tx, fullId);
  const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

  try {
    await sealClient.fetchKeys({
      ids: [fullId],
      txBytes,
      sessionKey,
      threshold,
    });
    console.log(`[Decryption] Keys fetched successfully`);
  } catch (err) {
    if (err instanceof NoAccessError) {
      throw new Error('No access to decryption keys - AccessPass may be invalid or expired');
    }
    throw new Error(`Failed to fetch decryption keys: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 8: Decrypt the content
  console.log(`[Decryption] Decrypting content...`);
  try {
    const decryptedData = await sealClient.decrypt({
      data: encryptedData,
      sessionKey,
      txBytes,
    });
    console.log(`[Decryption] Content decrypted successfully (${decryptedData.length} bytes)`);

    return {
      decryptedData,
    };
  } catch (err) {
    if (err instanceof NoAccessError) {
      throw new Error('No access to decryption keys');
    }
    throw new Error(`Failed to decrypt content: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Fetch encrypted blob from Walrus (without decryption)
 * This can be used when client-side decryption is preferred
 */
export async function fetchEncryptedBlob(walrusCid: string): Promise<ArrayBuffer> {
  return await fetchFromWalrus(walrusCid);
}

