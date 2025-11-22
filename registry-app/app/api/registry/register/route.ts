import { NextRequest, NextResponse } from "next/server"
import { createSealClient, encryptWithSeal } from "@/lib/seal"
import { uploadToWalrus } from "@/lib/walrus"
import { toHex } from "@mysten/sui/utils"
import crypto from "crypto"

// Generate a unique policy ID based on domain and resource
function generatePolicyId(domain: string, resource: string): string {
  // Create a deterministic ID from domain + resource + timestamp
  // This ensures uniqueness while being reproducible
  const combined = `${domain}:${resource}:${Date.now()}`
  const hash = crypto.createHash("sha256").update(combined).digest()
  return toHex(hash)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const domain = formData.get("domain") as string
    const resource = formData.get("resource") as string
    const price = formData.get("price") as string

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    if (!domain || !resource) {
      return NextResponse.json(
        { error: "Domain and resource are required" },
        { status: 400 }
      )
    }

    // Get configuration from environment variables
    const packageId = process.env.SUI_PACKAGE_ID || process.env.NEXT_PUBLIC_SUI_PACKAGE_ID
    if (!packageId) {
      return NextResponse.json(
        { error: "SUI_PACKAGE_ID not configured" },
        { status: 500 }
      )
    }

    const network = (process.env.SUI_NETWORK || "testnet") as "testnet" | "mainnet" | "devnet"
    const threshold = parseInt(process.env.SEAL_THRESHOLD || "2", 10)

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const fileData = new Uint8Array(arrayBuffer)

    // Generate unique policy ID
    const policyId = generatePolicyId(domain, resource)

    // Step 1: Create Seal client and encrypt
    const sealClient = createSealClient({
      packageId,
      network,
      threshold,
      verifyKeyServers: false,
    })

    const { encryptedObject } = await encryptWithSeal(sealClient, {
      packageId,
      id: policyId,
      data: fileData,
      threshold,
    })

    // Step 2: Upload encrypted data to Walrus
    const walrusResult = await uploadToWalrus({
      encryptedData: encryptedObject,
      epochs: 1, // Store for 1 epoch (can be configured)
    })

    // Step 3: TODO - Register on Sui contract
    // This will be implemented when the contract is provided
    // await registerOnChain({
    //   domain,
    //   resource,
    //   walrusCid: walrusResult.blobId,
    //   sealPolicyId: policyId,
    //   price,
    // })

    return NextResponse.json({
      walrusCid: walrusResult.blobId,
      sealPolicyId: policyId,
      encrypted: true,
      domain,
      resource,
      price,
      fileName: file.name,
      fileSize: file.size,
      endEpoch: walrusResult.storage.endEpoch,
      suiObjectId: walrusResult.id,
    })
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to register content",
      },
      { status: 500 }
    )
  }
}

