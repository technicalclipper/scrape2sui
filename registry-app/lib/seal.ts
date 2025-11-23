import { SealClient } from "@mysten/seal"
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client"

// Seal key server object IDs for testnet
// These are the verified key servers from the Seal examples
const DEFAULT_SERVER_OBJECT_IDS = [
  "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
  "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
]

export interface SealConfig {
  packageId: string
  serverObjectIds?: string[]
  network?: "testnet" | "mainnet" | "devnet"
  threshold?: number
  verifyKeyServers?: boolean
}

export function createSealClient(config: SealConfig): SealClient {
  const { serverObjectIds = DEFAULT_SERVER_OBJECT_IDS, network = "testnet", verifyKeyServers = false } = config

  const suiClient = new SuiClient({
    url: getFullnodeUrl(network),
  })

  return new SealClient({
    suiClient,
    serverConfigs: serverObjectIds.map((id) => ({
      objectId: id,
      weight: 1,
    })),
    verifyKeyServers,
  })
}

export interface EncryptOptions {
  packageId: string
  id: string // Policy ID (without package prefix)
  data: Uint8Array
  threshold?: number
}

/**
 * Normalize hex string for Seal (remove 0x prefix, ensure lowercase)
 */
function normalizeHexString(hex: string): string {
  // Remove 0x prefix if present
  const cleaned = hex.startsWith("0x") ? hex.slice(2) : hex
  // Ensure lowercase (Seal expects lowercase hex)
  return cleaned.toLowerCase()
}

export async function encryptWithSeal(
  client: SealClient,
  options: EncryptOptions
): Promise<{ encryptedObject: Uint8Array; key?: Uint8Array }> {
  const { packageId, id, data, threshold = 2 } = options

  try {
    // Seal expects packageId and id as normalized hex strings (lowercase, no 0x prefix)
    const normalizedPackageId = normalizeHexString(packageId)
    const normalizedId = normalizeHexString(id)

    const result = await client.encrypt({
      threshold,
      packageId: normalizedPackageId,
      id: normalizedId,
      data,
    })

    return {
      encryptedObject: result.encryptedObject,
      key: result.key,
    }
  } catch (error) {
    throw new Error(`Seal encryption failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

