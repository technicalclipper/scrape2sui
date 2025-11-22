// Walrus storage integration
// Based on official Walrus documentation: https://docs.wal.app/usage/web-api.html
// Uses direct publisher endpoints with PUT /v1/blobs?epochs={epochs}

export interface WalrusService {
  id: string
  name: string
  publisherUrl: string
  aggregatorUrl: string
}

// Official Walrus testnet publisher (from docs.wal.app)
// According to https://docs.wal.app/usage/web-api.html#using-a-public-aggregator-or-publisher
// The main public testnet publisher is: https://publisher.walrus-testnet.walrus.space
// Individual publisher services may also be available but can be unreliable
export const DEFAULT_WALRUS_SERVICES: WalrusService[] = [
  {
    id: "official-testnet",
    name: "Official Testnet Publisher",
    publisherUrl: "https://publisher.walrus-testnet.walrus.space",
    aggregatorUrl: "https://aggregator.walrus-testnet.walrus.space",
  },
  // Fallback to individual services if main publisher is unavailable
  {
    id: "service1",
    name: "walrus.space",
    publisherUrl: "https://walrus.space/publisher1",
    aggregatorUrl: "https://walrus.space/aggregator1",
  },
  {
    id: "service2",
    name: "staketab.org",
    publisherUrl: "https://staketab.org/publisher2",
    aggregatorUrl: "https://staketab.org/aggregator2",
  },
  {
    id: "service3",
    name: "redundex.com",
    publisherUrl: "https://redundex.com/publisher3",
    aggregatorUrl: "https://redundex.com/aggregator3",
  },
  {
    id: "service4",
    name: "nodes.guru",
    publisherUrl: "https://nodes.guru/publisher4",
    aggregatorUrl: "https://nodes.guru/aggregator4",
  },
  {
    id: "service5",
    name: "banansen.dev",
    publisherUrl: "https://banansen.dev/publisher5",
    aggregatorUrl: "https://banansen.dev/aggregator5",
  },
  {
    id: "service6",
    name: "everstake.one",
    publisherUrl: "https://everstake.one/publisher6",
    aggregatorUrl: "https://everstake.one/aggregator6",
  },
]

export interface WalrusUploadOptions {
  encryptedData: Uint8Array
  epochs?: number
  service?: WalrusService // Optional: override default service
}

export interface WalrusUploadResult {
  blobId: string
  storage: {
    endEpoch: string
  }
  id?: string // Sui object ID if newly created
  event?: {
    txDigest: string
  }
}

export interface WalrusResponse {
  alreadyCertified?: {
    blobId: string
    endEpoch: string
    event: {
      txDigest: string
    }
  }
  newlyCreated?: {
    blobObject: {
      blobId: string
      id: string
      storage: {
        endEpoch: string
      }
    }
  }
}

/**
 * Get the publisher URL for Walrus blob upload
 * The publisher endpoint is: {publisherUrl}/v1/blobs?epochs={epochs}
 */
function getPublisherUrl(path: string, service: WalrusService): string {
  const cleanPath = path.replace(/^\/+/, "").replace(/^v1\//, "")
  const baseUrl = service.publisherUrl.endsWith("/")
    ? service.publisherUrl.slice(0, -1)
    : service.publisherUrl
  return `${baseUrl}/v1/${cleanPath}`
}

/**
 * Upload to a single Walrus service with timeout
 */
async function uploadToSingleService(
  service: WalrusService,
  encryptedData: Uint8Array,
  epochs: number,
  timeoutMs: number = 10000
): Promise<WalrusUploadResult> {
  const publisherUrl = getPublisherUrl(`/v1/blobs?epochs=${epochs}`, service)
  
  console.log(`Uploading to Walrus: ${publisherUrl}`)
  
  // Create AbortController for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    // Convert Uint8Array to a format fetch accepts
    // Create a new Uint8Array to ensure it's a standard ArrayBufferView
    const dataArray = new Uint8Array(encryptedData)
    const blob = new Blob([dataArray], { type: "application/octet-stream" })
    
    const response = await fetch(publisherUrl, {
      method: "PUT",
      body: blob,
      headers: {
        "Content-Type": "application/octet-stream",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      // Try to get error text, but limit it to avoid huge HTML responses
      let errorText = response.statusText
      try {
        const text = await response.text()
        // If it's HTML (like Cloudflare error pages), just use status
        if (!text.startsWith("<!DOCTYPE") && text.length < 500) {
          errorText = text
        }
      } catch {
        // Ignore parsing errors
      }
      
      throw new Error(
        `Walrus upload failed: ${response.status} ${errorText}`
      )
    }

    const result: WalrusResponse = await response.json()

    if (result.alreadyCertified) {
      return {
        blobId: result.alreadyCertified.blobId,
        storage: {
          endEpoch: result.alreadyCertified.endEpoch,
        },
        event: {
          txDigest: result.alreadyCertified.event.txDigest,
        },
      }
    } else if (result.newlyCreated) {
      return {
        blobId: result.newlyCreated.blobObject.blobId,
        storage: {
          endEpoch: result.newlyCreated.blobObject.storage.endEpoch,
        },
        id: result.newlyCreated.blobObject.id,
      }
    } else {
      throw new Error("Unexpected Walrus response format")
    }
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`)
    }
    throw error
  }
}

export async function uploadToWalrus(
  options: WalrusUploadOptions
): Promise<WalrusUploadResult> {
  const { encryptedData, epochs = 1, service = DEFAULT_WALRUS_SERVICES[0] } = options

  // If a specific service is provided, only try that one
  if (service.id !== DEFAULT_WALRUS_SERVICES[0].id) {
    return uploadToSingleService(service, encryptedData, epochs)
  }

  // Try all services in parallel for faster failure detection
  const servicesToTry = DEFAULT_WALRUS_SERVICES
  const errors: Error[] = []

  for (const walrusService of servicesToTry) {
    try {
      console.log(`Trying ${walrusService.name}...`)
      return await uploadToSingleService(walrusService, encryptedData, epochs, 8000) // 8 second timeout per service
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.warn(`${walrusService.name} failed: ${errorMessage}`)
      errors.push(error instanceof Error ? error : new Error(String(error)))
      // Continue to next service
    }
  }

  // All services failed
  const errorSummary = errors
    .map((e, i) => `${servicesToTry[i].name}: ${e.message}`)
    .join("; ")
  
  throw new Error(
    `Failed to upload to Walrus after trying all ${servicesToTry.length} services. ` +
    `All services appear to be unavailable (connection timeouts). ` +
    `Please try again later. Errors: ${errorSummary}`
  )
}

