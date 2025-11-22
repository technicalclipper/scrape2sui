// Express middleware implementation

import { Request, Response, NextFunction } from 'express';
import { PaywallOptions, PaywallRequest, PaymentChallenge, AccessPass } from './types';
import { PaymentRequiredError, InvalidPassError, ExpiredPassError, NoRemainingUsesError, SignatureVerificationError } from './errors';
import { validateOptions, generateNonce, hasRequiredHeaders } from './utils/validation';
import { fetchAccessPass, isAccessPassValid, matchesAccessPass } from './utils/sui';
import { verifySignature, verifyOwner } from './utils/signature';
import contractConfig from './config/contract.json';

/**
 * Create paywall middleware
 * Contract details are baked into the package
 * User only needs to provide: price, receiver (wallet address), domain
 */
export function paywall(options: PaywallOptions) {
  // Validate user options
  if (!options.price || parseFloat(options.price) <= 0) {
    throw new Error('Price must be greater than 0');
  }

  if (!options.receiver || typeof options.receiver !== 'string') {
    throw new Error('Receiver wallet address is required');
  }

  if (!options.domain || typeof options.domain !== 'string') {
    throw new Error('Domain is required');
  }

  // Contract details are baked into the package
  const normalizedOptions = {
    price: options.price,
    receiver: options.receiver, // User's wallet address
    domain: options.domain,
    packageId: contractConfig.packageId, // From package config
    treasuryId: contractConfig.treasuryId, // From package config
    passCounterId: contractConfig.passCounterId, // From package config
    rpcUrl: contractConfig.rpcUrl, // Hardcoded to testnet
    mockContent: options.mockContent || '{"message": "Access granted - Mock content for testing"}',
  };

  return async (req: PaywallRequest, res: Response, next: NextFunction) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[Paywall] Request ${requestId}: ${req.method} ${req.path}`);
    
    try {
      const resource = req.path;
      
      // Check if request has signed headers
      if (!hasRequiredHeaders(req)) {
        console.log(`[Paywall] Request ${requestId}: No headers - returning 402`);
        // No headers - return 402 Payment Required
        return sendPaymentChallenge(req, res, normalizedOptions, resource);
      }

      console.log(`[Paywall] Request ${requestId}: Headers found - verifying access`);
      // Has headers - verify pass
      // Wrap in try-catch to ensure all errors are caught
      try {
        await verifyAccess(req, res, normalizedOptions, resource);
        console.log(`[Paywall] Request ${requestId}: Verification passed`);
        
        // If verification passed, continue to next middleware (or serve content)
        // Only call next() if response hasn't been sent
        if (!res.headersSent) {
          console.log(`[Paywall] Request ${requestId}: Calling next()`);
          // Call next() without return to avoid blocking
          // Express will handle the response from the route handler
          next();
          return;
        } else {
          console.log(`[Paywall] Request ${requestId}: Headers already sent, skipping next()`);
        }
      } catch (verifyError: any) {
        console.error(`[Paywall] Request ${requestId}: Verification error:`, verifyError.message);
        // Re-throw to outer catch block for consistent error handling
        throw verifyError;
      }
    } catch (error: any) {
      // Handle errors
      console.error(`[Paywall] Request ${requestId}: Middleware error:`, error.message || error);
      
      // Don't try to send response if it's already been sent
      if (res.headersSent) {
        return;
      }
      
      if (error instanceof PaymentRequiredError) {
        return sendPaymentChallenge(req, res, normalizedOptions, req.path);
      }
      
      if (
        error instanceof InvalidPassError ||
        error instanceof ExpiredPassError ||
        error instanceof NoRemainingUsesError ||
        error instanceof SignatureVerificationError
      ) {
        return res.status(error.statusCode).json({
          error: error.name,
          message: error.message,
        });
      }

      // Unknown error - make sure we send a response
      return res.status(500).json({
        error: 'InternalServerError',
        message: error?.message || 'An error occurred while verifying access',
      });
    }
  };
}

/**
 * Send 402 Payment Required response
 */
function sendPaymentChallenge(
  req: Request,
  res: Response,
  options: { price: string; receiver: string; packageId: string; treasuryId: string; passCounterId: string; domain: string; rpcUrl: string; mockContent: string },
  resource: string
): void {
  const nonce = generateNonce();
  
  const challenge: PaymentChallenge = {
    status: 402,
    paymentRequired: true,
    price: options.price,
    priceInMist: convertSuiToMist(options.price),
    receiver: options.receiver, // User's wallet address
    packageId: options.packageId,
    treasuryId: options.treasuryId,
    passCounterId: options.passCounterId,
    domain: options.domain,
    resource: resource,
    nonce: nonce,
  };

  res.status(402).json(challenge);
}

/**
 * Verify access with signed headers
 */
async function verifyAccess(
  req: PaywallRequest,
  res: Response,
  options: { price: string; receiver: string; packageId: string; treasuryId: string; passCounterId: string; domain: string; rpcUrl: string; mockContent: string },
  resource: string
): Promise<void> {
  // Extract headers
  const passId = req.headers['x-pass-id'] as string;
  const signer = req.headers['x-signer'] as string;
  const signature = req.headers['x-sig'] as string;
  const timestamp = req.headers['x-ts'] as string;

  if (!passId || !signer || !signature || !timestamp) {
    throw new PaymentRequiredError(
      options.price,
      options.packageId,
      options.treasuryId,
      options.passCounterId,
      options.domain,
      resource,
      generateNonce(),
      options.receiver
    );
  }

  // Fetch AccessPass from Sui
  let accessPass: AccessPass | null = null;
  try {
    console.log(`[Paywall] Fetching AccessPass: ${passId}`);
    accessPass = await fetchAccessPass(passId, options.packageId, options.rpcUrl);
    console.log(`[Paywall] AccessPass fetched:`, accessPass ? 'found' : 'not found');
  } catch (error: any) {
    console.error('[Paywall] Error fetching AccessPass:', error);
    throw new InvalidPassError(`Failed to fetch AccessPass: ${error.message || 'Unknown error'}`);
  }
  
  if (!accessPass) {
    console.error('[Paywall] AccessPass not found on Sui');
    throw new InvalidPassError('AccessPass not found on Sui');
  }

  // Verify owner matches signer
  if (!verifyOwner(accessPass.owner, signer)) {
    throw new InvalidPassError('Signer does not own this AccessPass');
  }

  // Verify domain and resource match
  if (!matchesAccessPass(accessPass, options.domain, resource)) {
    throw new InvalidPassError('AccessPass domain or resource does not match');
  }

  // Verify pass is valid (not expired, has remaining uses)
  if (!isAccessPassValid(accessPass)) {
    if (accessPass.remaining <= 0) {
      throw new NoRemainingUsesError();
    }
    if (accessPass.expiry > 0 && Date.now() >= accessPass.expiry) {
      throw new ExpiredPassError();
    }
    throw new InvalidPassError('AccessPass is not valid');
  }

  // Verify signature
  const signatureValid = await verifySignature(
    passId,
    options.domain,
    resource,
    timestamp,
    signer,
    signature
  );

  if (!signatureValid) {
    throw new SignatureVerificationError();
  }

  // All checks passed! Store pass in request for later use
  req.paywall = {
    accessPass,
    verified: true,
  };

  // For testing: serve mock content if no next middleware
  // The actual content will be served by the route handler
  // But we can add this as a fallback for testing
  if (!res.headersSent) {
    // Don't send here - let the route handler send the response
    // This middleware just verifies and passes through
  }
}

/**
 * Convert SUI amount to MIST
 */
function convertSuiToMist(price: string): string {
  const suiAmount = parseFloat(price);
  return Math.floor(suiAmount * 1_000_000_000).toString();
}
