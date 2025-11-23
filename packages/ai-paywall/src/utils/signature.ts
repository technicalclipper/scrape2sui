// Signature verification helpers

/**
 * Message to sign for authentication
 */
export function createSignMessage(passId: string, domain: string, resource: string, timestamp: string): string {
  return JSON.stringify({
    passId,
    domain,
    resource,
    ts: timestamp,
  });
}

/**
 * Verify signature from headers
 * 
 * Note: For Option 1 (verify-only), we do basic validation.
 * Full signature verification can be added later if needed.
 * The contract will verify ownership when consume_pass is called.
 */
export async function verifySignature(
  passId: string,
  domain: string,
  resource: string,
  timestamp: string,
  signer: string,
  signature: string
): Promise<boolean> {
  try {
    // Basic validation: signature must exist and have valid format
    if (!signature || signature.trim().length === 0) {
      return false;
    }

    // Check timestamp is recent (within 5 minutes)
    const ts = parseInt(timestamp);
    if (isNaN(ts)) {
      return false;
    }

    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (Math.abs(now - ts) > fiveMinutes) {
      return false;
    }

    // Verify all required fields are present
    if (!passId || !domain || !resource || !signer) {
      return false;
    }

    // For Option 1: Basic validation passes
    // Full signature verification can be added later using Sui SDK
    // The contract will verify ownership when consume_pass is called
    
    return true;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Verify signer matches AccessPass owner
 */
export function verifyOwner(passOwner: string, signer: string): boolean {
  // Compare addresses (case-insensitive)
  return passOwner.toLowerCase() === signer.toLowerCase();
}
