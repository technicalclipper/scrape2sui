// Walrus storage integration - following seal/examples pattern
// Uses simple HTTP PUT requests to Walrus publishers (no SDK needed)
// This matches the approach used in seal/examples/frontend/src/EncryptAndUpload.tsx

export interface WalrusUploadOptions {
  encryptedData: Uint8Array
  epochs?: number
  network?: "testnet" | "mainnet" | "devnet"
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

// Walrus publisher URLs for testnet (from seal/examples)
const WALRUS_PUBLISHERS = {
  testnet: [
    "https://publisher.walrus-testnet.walrus.space",
    "https://walrus-testnet-publisher.redundex.com",
    "https://walrus-testnet-publisher.nodes.guru",
    "https://publisher.walrus.banansen.dev",
    "https://walrus-testnet-publisher.everstake.one",
  ],
  mainnet: [
    "https://publisher.walrus-mainnet.walrus.space",
  ],
  devnet: [
    "https://publisher.walrus-devnet.walrus.space",
  ],
}

/**
 * Upload encrypted data to Walrus using HTTP PUT (same as seal/examples)
 * Following the pattern from seal/examples/frontend/src/EncryptAndUpload.tsx
 * 
 * This simply uploads the encrypted blob via HTTP. On-chain registration
 * is handled separately in the registry registration flow.
 */
export async function uploadToWalrus(
  options: WalrusUploadOptions
): Promise<WalrusUploadResult> {
  const {
    encryptedData,
    epochs = 1,
    network = "testnet",
  } = options

  const publishers = WALRUS_PUBLISHERS[network] || WALRUS_PUBLISHERS.testnet
  const publisherUrl = publishers[0] // Use first publisher (same as seal/examples default)

  console.log(`Uploading ${encryptedData.length} bytes to Walrus (${network})...`)
  console.log(`Using publisher: ${publisherUrl}`)

  try {
    // Upload blob using HTTP PUT (same as seal/examples storeBlob function)
    // Uint8Array is valid BodyInit, but TypeScript needs explicit type assertion in server-side context
    const body: BodyInit = encryptedData as unknown as BodyInit
    
    const response = await fetch(`${publisherUrl}/v1/blobs?epochs=${epochs}`, {
      method: 'PUT',
      body: body,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    })

    if (!response.ok) {
      // Try next publisher if available
      if (publishers.length > 1) {
        console.warn(`Upload failed on ${publisherUrl}, trying next publisher...`)
        const nextPublisher = publishers[1]
        const retryBody: BodyInit = encryptedData as unknown as BodyInit
        const retryResponse = await fetch(`${nextPublisher}/v1/blobs?epochs=${epochs}`, {
          method: 'PUT',
          body: retryBody,
          headers: {
            'Content-Type': 'application/octet-stream',
          },
        })
        
        if (!retryResponse.ok) {
          const errorText = await retryResponse.text().catch(() => 'Unknown error')
          throw new Error(`Walrus upload failed: HTTP ${retryResponse.status} - ${errorText}`)
        }
        
        const retryResponseData = await retryResponse.json()
        console.log("Walrus retry response structure:", JSON.stringify(retryResponseData, null, 2))
        
        // Extract info wrapper (following seal/examples pattern)
        const retryInfo = retryResponseData.info || retryResponseData
        
        let retryBlobId: string
        let retryBlobObject: any
        
        // Handle both response formats: newlyCreated or alreadyCertified
        if (retryInfo.newlyCreated) {
          retryBlobId = retryInfo.newlyCreated.blobObject?.blobId || retryInfo.newlyCreated.blobObject?.blob_id
          retryBlobObject = retryInfo.newlyCreated.blobObject
        } else if (retryInfo.alreadyCertified) {
          retryBlobId = retryInfo.alreadyCertified.blobId || retryInfo.alreadyCertified.blob_id
          retryBlobObject = {
            blobId: retryBlobId,
            registered_epoch: retryInfo.alreadyCertified.endEpoch,
            id: retryInfo.alreadyCertified.event?.txDigest || '',
          }
        } else {
          // Fallback: try to extract from root level
          retryBlobId = retryInfo.blobId || retryInfo.blob_id || retryResponseData.blobId || retryResponseData.blob_id
          retryBlobObject = retryInfo.blobObject || retryInfo
        }
        
        if (!retryBlobId) {
          console.error("Could not extract blobId from retry response:", JSON.stringify(retryResponseData, null, 2))
          throw new Error("Walrus upload succeeded but could not extract blob ID from response")
        }
        
        console.log(`Successfully uploaded to Walrus (retry). Blob ID: ${retryBlobId}`)
        
        // Return in expected format
        return {
          blobId: retryBlobId,
          blobObject: {
            id: retryBlobObject?.id?.id || retryBlobObject?.id || '',
            registered_epoch: retryBlobObject?.registered_epoch || 0,
            blob_id: retryBlobObject?.blobId || retryBlobObject?.blob_id || retryBlobId,
            size: retryBlobObject?.size || encryptedData.length.toString(),
            storage: {
              id: retryBlobObject?.storage?.id?.id || retryBlobObject?.storage?.id || '',
              start_epoch: retryBlobObject?.storage?.start_epoch || 0,
              end_epoch: retryBlobObject?.storage?.end_epoch || retryBlobObject?.storage?.endEpoch || 0,
              storage_size: retryBlobObject?.storage?.storage_size || encryptedData.length.toString(),
            },
          },
        }
      }
      
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Walrus upload failed: HTTP ${response.status} - ${errorText}`)
    }

    // Parse response - Walrus returns { info: { newlyCreated: {...} } } or { info: { alreadyCertified: {...} } }
    const responseData = await response.json()
    console.log("Walrus response structure:", JSON.stringify(responseData, null, 2))
    
    // Extract info wrapper (following seal/examples pattern)
    const info = responseData.info || responseData
    
    let blobId: string
    let blobObject: any
    
    // Handle both response formats: newlyCreated or alreadyCertified
    if (info.newlyCreated) {
      blobId = info.newlyCreated.blobObject?.blobId || info.newlyCreated.blobObject?.blob_id
      blobObject = info.newlyCreated.blobObject
    } else if (info.alreadyCertified) {
      blobId = info.alreadyCertified.blobId || info.alreadyCertified.blob_id
      blobObject = {
        blobId: blobId,
        registered_epoch: info.alreadyCertified.endEpoch,
        id: info.alreadyCertified.event?.txDigest || '',
      }
    } else {
      // Fallback: try to extract from root level
      blobId = info.blobId || info.blob_id || responseData.blobId || responseData.blob_id
      blobObject = info.blobObject || info
    }
    
    if (!blobId) {
      console.error("Could not extract blobId from response:", JSON.stringify(responseData, null, 2))
      throw new Error("Walrus upload succeeded but could not extract blob ID from response")
    }
    
    console.log(`Successfully uploaded to Walrus. Blob ID: ${blobId}`)
    
    // Return in expected format
    return {
      blobId: blobId,
      blobObject: {
        id: blobObject?.id?.id || blobObject?.id || '',
        registered_epoch: blobObject?.registered_epoch || 0,
        blob_id: blobObject?.blobId || blobObject?.blob_id || blobId,
        size: blobObject?.size || encryptedData.length.toString(),
        storage: {
          id: blobObject?.storage?.id?.id || blobObject?.storage?.id || '',
          start_epoch: blobObject?.storage?.start_epoch || 0,
          end_epoch: blobObject?.storage?.end_epoch || blobObject?.storage?.endEpoch || 0,
          storage_size: blobObject?.storage?.storage_size || encryptedData.length.toString(),
        },
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error("Walrus upload failed:")
    console.error("  Message:", errorMessage)
    console.error("  Stack:", errorStack)
    console.error("  Full error:", error)
    
    // Check for specific error patterns
    if (errorMessage.includes("timeout") || errorMessage.includes("network") || errorMessage.includes("ECONNREFUSED") || errorMessage.includes("fetch failed")) {
      throw new Error(
        `Network error: Unable to connect to Walrus services. ` +
        `Please check your network connection and try again. ` +
        `Error: ${errorMessage}`
      )
    }

    // Return the full error message for debugging
    throw new Error(`Walrus upload failed: ${errorMessage}`)
  }
}
