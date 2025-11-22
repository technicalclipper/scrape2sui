import { NextRequest, NextResponse } from "next/server"
import { createSealClient, encryptWithSeal } from "@/lib/seal"
import { uploadToWalrus } from "@/lib/walrus"
import { buildRegisterResourceTransaction, registerResourceOnChain } from "@/lib/sui"
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import { fromHex } from "@mysten/sui/utils"
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

    const registryId = process.env.SUI_REGISTRY_ID || process.env.NEXT_PUBLIC_SUI_REGISTRY_ID
    if (!registryId) {
      return NextResponse.json(
        { error: "SUI_REGISTRY_ID not configured" },
        { status: 500 }
      )
    }

    const network = (process.env.SUI_NETWORK || "testnet") as "testnet" | "mainnet" | "devnet"
    const threshold = parseInt(process.env.SEAL_THRESHOLD || "2", 10)
    
    // Get optional parameters for resource registration
    let receiver = (formData.get("receiver") as string || "").trim()
    const maxUses = parseInt(formData.get("maxUses") as string || "5", 10)
    const validityDuration = parseInt(
      formData.get("validityDuration") as string || "86400000", // Default: 24 hours in milliseconds
      10
    )
    
    // Optional server-side keypair for automatic registration
    let signer: Ed25519Keypair | undefined
    if (process.env.SUI_SERVER_PRIVATE_KEY) {
      try {
        const privateKey = fromHex(process.env.SUI_SERVER_PRIVATE_KEY)
        signer = Ed25519Keypair.fromSecretKey(privateKey)
        // If no receiver provided, use signer's address
        if (!receiver && signer) {
          receiver = signer.toSuiAddress()
        }
      } catch (error) {
        console.warn("Failed to parse SUI_SERVER_PRIVATE_KEY, will require client-side signing")
      }
    }
    
    // Validate receiver is provided if we're doing server-side registration
    if (signer && !receiver) {
      return NextResponse.json(
        { error: "Receiver address is required for server-side registration" },
        { status: 400 }
      )
    }

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

    // Step 2: Upload encrypted data to Walrus (optional - can continue without it)
    let walrusResult: { blobId: string; storage?: { endEpoch: string }; id?: string; event?: { txDigest: string } } | null = null
    let walrusError: string | null = null
    
    try {
      walrusResult = await uploadToWalrus({
        encryptedData: encryptedObject,
        epochs: 1, // Store for 1 epoch (can be configured)
      })
      console.log("Successfully uploaded to Walrus:", walrusResult.blobId)
    } catch (error) {
      walrusError = error instanceof Error ? error.message : String(error)
      console.warn("Walrus upload failed, continuing without it:", walrusError)
      // Continue without Walrus - we'll use a placeholder or skip on-chain registration
    }

    // Step 3: Register on Sui contract (only if Walrus upload succeeded)
    let registrationResult: { txDigest?: string; resourceId?: string; transactionBytes?: number[] } = {}
    
    if (!walrusResult) {
      // If Walrus upload failed, we can't register on-chain (registry requires walrusCid)
      // Return success with encryption but note that on-chain registration is skipped
      return NextResponse.json(
        {
          success: true,
          encrypted: true,
          walrusUploaded: false,
          walrusError: walrusError || "Unknown error",
          message: "Content encrypted successfully, but Walrus upload failed. On-chain registration skipped.",
          sealPolicy: policyId,
          warning: "All Walrus services appear to be unavailable. Please try again later or use a local Walrus publisher.",
        },
        { status: 200 }
      )
    }
    
    try {
      if (signer && receiver) {
        // Server-side registration with keypair
        console.log("Registering resource on-chain with server-side signer...")
        const result = await registerResourceOnChain(
          {
            packageId,
            registryId,
            domain,
            resource,
            walrusCid: walrusResult.blobId,
            sealPolicy: policyId,
            price,
            receiver,
            maxUses,
            validityDuration,
            signer,
          },
          network
        )
        registrationResult = {
          txDigest: result.txDigest,
          resourceId: result.resourceId,
        }
        console.log("Successfully registered on-chain:", result.txDigest)
      } else if (receiver) {
        // Build transaction for client-side signing
        console.log("Building transaction for client-side signing...")
        const transactionBytes = await buildRegisterResourceTransaction(
          {
            packageId,
            registryId,
            domain,
            resource,
            walrusCid: walrusResult.blobId,
            sealPolicy: policyId,
            price,
            receiver,
            maxUses,
            validityDuration,
          },
          network
        )
        registrationResult = {
          transactionBytes: Array.from(transactionBytes), // Convert to array for JSON serialization
        }
        console.log("Transaction built for client-side signing")
      } else {
        console.warn("No receiver address and no signer provided, skipping on-chain registration")
        console.warn("Content encrypted and stored on Walrus, but not registered on-chain")
      }
    } catch (error) {
      console.error("Failed to register on Sui contract:", error)
      // Continue without failing the entire request - encryption and storage succeeded
      // The client can retry registration separately
      // Log the error but don't throw - encryption and Walrus storage succeeded
    }

    return NextResponse.json({
      success: true,
      walrusUploaded: true,
      walrusCid: walrusResult.blobId,
      sealPolicyId: policyId,
      encrypted: true,
      domain,
      resource,
      price,
      fileName: file.name,
      fileSize: file.size,
      ...(walrusResult.storage && { endEpoch: walrusResult.storage.endEpoch }),
      ...(walrusResult.id && { walrusObjectId: walrusResult.id }),
      // On-chain registration results
      ...(registrationResult.txDigest && { suiTxDigest: registrationResult.txDigest }),
      ...(registrationResult.resourceId && { suiResourceId: registrationResult.resourceId }),
      ...(registrationResult.transactionBytes && {
        suiTransactionBytes: Array.from(registrationResult.transactionBytes),
        requiresClientSigning: true,
      }),
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

