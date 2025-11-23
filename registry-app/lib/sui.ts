import { SuiClient, getFullnodeUrl } from "@mysten/sui/client"
import { Transaction } from "@mysten/sui/transactions"
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import { fromHex } from "@mysten/sui/utils"

export interface RegisterResourceParams {
  packageId: string
  registryId: string
  domain: string
  resource: string
  walrusCid: string
  sealPolicy: string
  price: string // Price in SUI (will be converted to MIST)
  receiver: string // Address that receives payment
  maxUses: number
  validityDuration: number // in milliseconds
  signer?: Ed25519Keypair // Optional signer for server-side transactions
}

export interface RegisterResourceResult {
  txDigest: string
  resourceId?: string
}

const SUI_TO_MIST = BigInt(1000000000) // 1 SUI = 10^9 MIST

/**
 * Convert SUI amount to MIST (smallest unit)
 */
export function suiToMist(sui: string): bigint {
  const suiNum = parseFloat(sui)
  if (isNaN(suiNum) || suiNum < 0) {
    throw new Error(`Invalid SUI amount: ${sui}`)
  }
  return BigInt(Math.floor(suiNum * Number(SUI_TO_MIST)))
}

/**
 * Register a resource on the Sui blockchain
 * 
 * Note: This function requires a signer. For client-side transactions,
 * the user should sign in their wallet. For server-side, you need to
 * provide a keypair with sufficient SUI for gas.
 */
export async function registerResourceOnChain(
  params: RegisterResourceParams,
  network: "testnet" | "mainnet" | "devnet" = "testnet"
): Promise<RegisterResourceResult> {
  const {
    packageId,
    registryId,
    domain,
    resource,
    walrusCid,
    sealPolicy,
    price,
    receiver,
    maxUses,
    validityDuration,
    signer,
  } = params

  const suiClient = new SuiClient({
    url: getFullnodeUrl(network),
  })

  // Convert price to MIST
  const priceMist = suiToMist(price)

  // Convert seal_policy hex string to bytes
  // Remove 0x prefix if present and convert to bytes
  const normalizedPolicy = sealPolicy.startsWith('0x') ? sealPolicy.slice(2) : sealPolicy;
  const policyBytes = fromHex(normalizedPolicy);

  // Build transaction
  const tx = new Transaction()

  // Clock is a well-known shared object at 0x6
  const clockId = "0x6"

  // Call register_resource function
  tx.moveCall({
    target: `${packageId}::registry::register_resource`,
    arguments: [
      tx.object(registryId), // registry: &mut Registry
      tx.pure.string(domain), // domain: String
      tx.pure.string(resource), // resource: String
      tx.pure.string(walrusCid), // walrus_cid: String
      tx.pure.string(sealPolicy), // seal_policy: String (hex string for display)
      tx.pure.vector('u8', Array.from(policyBytes)), // seal_policy_bytes: vector<u8> (hex-decoded)
      tx.pure.u64(priceMist.toString()), // price: u64
      tx.pure.address(receiver), // receiver: address
      tx.pure.u64(maxUses.toString()), // max_uses: u64
      tx.pure.u64(validityDuration.toString()), // validity_duration: u64
      tx.object(clockId), // clock: &Clock
    ],
  })

  // Execute transaction
  if (signer) {
    // Server-side execution with keypair
    const result = await suiClient.signAndExecuteTransaction({
      signer,
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
      },
    })

    // Extract resource ID from events
    const resourceRegisteredEvent = result.events?.find(
      (event) => event.type === `${packageId}::registry::ResourceRegistered`
    )

    return {
      txDigest: result.digest,
      resourceId: resourceRegisteredEvent
        ? (resourceRegisteredEvent.parsedJson as any)?.resource_id
        : undefined,
    }
  } else {
    // Return transaction bytes for client-side signing
    // This would typically be used with a wallet adapter
    throw new Error(
      "Server-side registration requires a signer. For client-side, use wallet adapter."
    )
  }
}

/**
 * Build a transaction for client-side signing
 * Returns the transaction bytes that can be signed by a wallet
 */
export async function buildRegisterResourceTransaction(
  params: RegisterResourceParams,
  network: "testnet" | "mainnet" | "devnet" = "testnet"
): Promise<Uint8Array> {
  const {
    packageId,
    registryId,
    domain,
    resource,
    walrusCid,
    sealPolicy,
    price,
    receiver,
    maxUses,
    validityDuration,
  } = params

  const suiClient = new SuiClient({
    url: getFullnodeUrl(network),
  })

  // Convert price to MIST
  const priceMist = suiToMist(price)

  // Convert seal_policy hex string to bytes
  // Remove 0x prefix if present and convert to bytes
  const normalizedPolicy = sealPolicy.startsWith('0x') ? sealPolicy.slice(2) : sealPolicy;
  const policyBytes = fromHex(normalizedPolicy);

  // Build transaction
  const tx = new Transaction()

  // Get Clock object ID
  const clockId = "0x6" // Clock is a shared object at 0x6

  // Call register_resource function
  tx.moveCall({
    target: `${packageId}::registry::register_resource`,
    arguments: [
      tx.object(registryId), // registry: &mut Registry
      tx.pure.string(domain), // domain: String
      tx.pure.string(resource), // resource: String
      tx.pure.string(walrusCid), // walrus_cid: String
      tx.pure.string(sealPolicy), // seal_policy: String (hex string for display)
      tx.pure.vector('u8', Array.from(policyBytes)), // seal_policy_bytes: vector<u8> (hex-decoded)
      tx.pure.u64(priceMist.toString()), // price: u64
      tx.pure.address(receiver), // receiver: address
      tx.pure.u64(maxUses.toString()), // max_uses: u64
      tx.pure.u64(validityDuration.toString()), // validity_duration: u64
      tx.object(clockId), // clock: &Clock
    ],
  })

  // Build the transaction
  return await tx.build({ client: suiClient })
}

