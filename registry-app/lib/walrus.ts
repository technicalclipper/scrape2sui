// Walrus storage integration
// Based on the Seal examples pattern

export interface WalrusService {
  id: string
  name: string
  publisherUrl: string
  aggregatorUrl: string
}

// Default Walrus services from Seal examples
export const DEFAULT_WALRUS_SERVICES: WalrusService[] = [
  {
    id: "service1",
    name: "walrus.space",
    publisherUrl: "/publisher1",
    aggregatorUrl: "/aggregator1",
  },
  {
    id: "service2",
    name: "staketab.org",
    publisherUrl: "/publisher2",
    aggregatorUrl: "/aggregator2",
  },
  {
    id: "service3",
    name: "redundex.com",
    publisherUrl: "/publisher3",
    aggregatorUrl: "/aggregator3",
  },
  {
    id: "service4",
    name: "nodes.guru",
    publisherUrl: "/publisher4",
    aggregatorUrl: "/aggregator4",
  },
  {
    id: "service5",
    name: "banansen.dev",
    publisherUrl: "/publisher5",
    aggregatorUrl: "/aggregator5",
  },
  {
    id: "service6",
    name: "everstake.one",
    publisherUrl: "/publisher6",
    aggregatorUrl: "/aggregator6",
  },
]

export interface WalrusUploadOptions {
  encryptedData: Uint8Array
  epochs?: number
  service?: WalrusService
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

function getPublisherUrl(path: string, service: WalrusService): string {
  const cleanPath = path.replace(/^\/+/, "").replace(/^v1\//, "")
  return `${service.publisherUrl}/v1/${cleanPath}`
}

function getAggregatorUrl(path: string, service: WalrusService): string {
  const cleanPath = path.replace(/^\/+/, "").replace(/^v1\//, "")
  return `${service.aggregatorUrl}/v1/${cleanPath}`
}

export async function uploadToWalrus(
  options: WalrusUploadOptions
): Promise<WalrusUploadResult> {
  const { encryptedData, epochs = 1, service = DEFAULT_WALRUS_SERVICES[0] } = options

  const publisherUrl = getPublisherUrl(`/v1/blobs?epochs=${epochs}`, service)

  try {
    const response = await fetch(publisherUrl, {
      method: "PUT",
      body: encryptedData,
      headers: {
        "Content-Type": "application/octet-stream",
      },
    })

    if (!response.ok) {
      throw new Error(`Walrus upload failed: ${response.status} ${response.statusText}`)
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
    // Try fallback services if first one fails
    if (service.id !== DEFAULT_WALRUS_SERVICES[0].id) {
      throw error
    }

    // Try other services
    for (const fallbackService of DEFAULT_WALRUS_SERVICES.slice(1)) {
      try {
        return await uploadToWalrus({
          encryptedData,
          epochs,
          service: fallbackService,
        })
      } catch {
        // Continue to next service
      }
    }

    throw new Error(
      `Failed to upload to Walrus after trying all services: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

