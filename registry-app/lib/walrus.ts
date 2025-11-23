// Walrus storage integration using @mysten/walrus SDK
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client"
import { walrus } from "@mysten/walrus"
import type { Signer } from "@mysten/sui/cryptography"
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import { fromHex } from "@mysten/sui/utils"

export interface WalrusUploadOptions {
  encryptedData: Uint8Array
  epochs?: number
  network?: "testnet" | "mainnet" | "devnet"
  signer: Signer // Required - must provide a signer for SDK
  deletable?: boolean // Whether blob can be deleted (default: true)
}

export interface WalrusUploadResult {
  blobId: string
  blobObject: {
    id: string
    registered_epoch: number
    blob_id: string
    size: string
    storage: {
      id: string
      start_epoch: number
      end_epoch: number
      storage_size: string
    }
  }
}

/**
 * Upload encrypted data to Walrus using the official TypeScript SDK
 * This is the recommended approach as it handles all the complexity
 * of encoding, registering, uploading, and certifying blobs.
 */
export async function uploadToWalrus(
  options: WalrusUploadOptions
): Promise<WalrusUploadResult> {
  const {
    encryptedData,
    epochs = 1,
    network = "testnet",
    signer,
    deletable = true,
  } = options

  if (!signer) {
    throw new Error("Signer is required for Walrus upload. Provide a keypair with sufficient SUI and WAL tokens.")
  }

  try {
    // Create Sui client extended with Walrus SDK
    const suiClient = new SuiClient({
      url: getFullnodeUrl(network),
      network,
    })

    // Check signer balance before attempting upload
    const signerAddress = signer.toSuiAddress()
    console.log(`Checking balance for signer: ${signerAddress}`)
    
    try {
      const coins = await suiClient.getCoins({
        owner: signerAddress,
        coinType: "0x2::sui::SUI",
      })
      const totalBalance = coins.data.reduce((sum, coin) => sum + BigInt(coin.balance), BigInt(0))
      console.log(`Signer SUI balance: ${totalBalance.toString()} MIST (${Number(totalBalance) / 1_000_000_000} SUI)`)
      
      if (totalBalance < BigInt(10_000_000)) { // Less than 0.01 SUI
        console.warn("Warning: Signer has very low SUI balance. Upload may fail due to insufficient gas.")
      }
    } catch (balanceError) {
      console.warn("Could not check signer balance:", balanceError)
    }

    // Extend client with Walrus SDK
    const walrusClient = suiClient.$extend(
      walrus({
        // Use upload relay for better performance (optional but recommended)
        uploadRelay: {
          host: `https://upload-relay.${network}.walrus.space`,
          sendTip: {
            max: 1_000_000, // Max 1 SUI tip (in MIST)
          },
        },
      })
    )

    console.log(`Uploading ${encryptedData.length} bytes to Walrus (${network})...`)
    console.log(`Using upload relay: https://upload-relay.${network}.walrus.space`)

    // Use the SDK's writeBlob method which handles:
    // 1. Encoding the blob
    // 2. Registering on-chain
    // 3. Uploading to storage nodes (or upload relay)
    // 4. Certifying the blob
    const result = await walrusClient.walrus.writeBlob({
      blob: encryptedData,
      epochs,
      deletable,
      signer,
    })

    console.log(`Successfully uploaded to Walrus. Blob ID: ${result.blobId}`)

    return {
      blobId: result.blobId,
      blobObject: {
        id: result.blobObject.id.id,
        registered_epoch: result.blobObject.registered_epoch,
        blob_id: result.blobObject.blob_id,
        size: result.blobObject.size,
        storage: {
          id: result.blobObject.storage.id.id,
          start_epoch: result.blobObject.storage.start_epoch,
          end_epoch: result.blobObject.storage.end_epoch,
          storage_size: result.blobObject.storage.storage_size,
        },
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    const errorCause = error instanceof Error && error.cause ? String(error.cause) : undefined
    
    console.error("Walrus SDK upload failed:")
    console.error("  Message:", errorMessage)
    console.error("  Stack:", errorStack)
    console.error("  Cause:", errorCause)
    console.error("  Full error:", error)
    
    // Check for specific error patterns
    if (errorMessage.includes("insufficient") || errorMessage.includes("balance") || errorMessage.includes("InsufficientGas")) {
      throw new Error(
        `Insufficient funds: The signer needs SUI for gas and WAL tokens for storage. ` +
        `Signer address: ${signer.toSuiAddress()}. ` +
        `Error: ${errorMessage}`
      )
    }
    
    if (errorMessage.includes("timeout") || errorMessage.includes("network") || errorMessage.includes("ECONNREFUSED") || errorMessage.includes("fetch failed")) {
      throw new Error(
        `Network error: Unable to connect to Walrus services. ` +
        `Please check your network connection and try again. ` +
        `Error: ${errorMessage}`
      )
    }
    
    if (errorMessage.includes("WAL") || errorMessage.includes("wal")) {
      throw new Error(
        `WAL token issue: ${errorMessage}. ` +
        `The signer needs WAL tokens for storage costs. ` +
        `Signer address: ${signer.toSuiAddress()}`
      )
    }

    // Return the full error message for debugging
    throw new Error(`Walrus upload failed: ${errorMessage}${errorCause ? ` (Cause: ${errorCause})` : ""}`)
  }
}
