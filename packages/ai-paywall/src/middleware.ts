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
      // Get the full resource path (handle Express mounted routes)
      // req.originalUrl includes the full path, but we need to remove query string
      // If middleware is mounted at /premium and request is /premium, req.path is /, but we need /premium
      const resource = (req.baseUrl || '') + (req.path || '/');
      // Remove query string if present and normalize (remove trailing slash except for root)
      let resourcePath = resource.split('?')[0];
      if (resourcePath !== '/' && resourcePath.endsWith('/')) {
        resourcePath = resourcePath.slice(0, -1);
      }
      console.log(`[Paywall] Request ${requestId}: Resource path: ${resourcePath} (baseUrl: ${req.baseUrl}, path: ${req.path}, originalUrl: ${req.originalUrl})`);
      
      // Log all headers for debugging
      const headerKeys = Object.keys(req.headers);
      const paywallHeaders = {
        'x-pass-id': req.headers['x-pass-id'],
        'x-signer': req.headers['x-signer'],
        'x-sig': req.headers['x-sig'] ? (req.headers['x-sig'] as string).substring(0, 20) + '...' : undefined,
        'x-ts': req.headers['x-ts'],
      };
      console.log(`[Paywall] Request ${requestId}: Headers present:`, paywallHeaders);
      console.log(`[Paywall] Request ${requestId}: All header keys:`, headerKeys.filter(k => k.toLowerCase().startsWith('x-')));
      
      // Debug: Check raw header values
      console.log(`[Paywall] Request ${requestId}: Raw header values:`, {
        'x-pass-id': typeof req.headers['x-pass-id'],
        'x-signer': typeof req.headers['x-signer'],
        'x-sig': typeof req.headers['x-sig'],
        'x-sig-value': req.headers['x-sig'],
        'x-ts': typeof req.headers['x-ts'],
      });
      
      // Also check if headers are in rawHeaders (Express sometimes stores them there)
      if ((req as any).rawHeaders) {
        const rawHeaders = (req as any).rawHeaders;
        const sigIndex = rawHeaders.findIndex((h: string) => h.toLowerCase() === 'x-sig');
        if (sigIndex !== -1) {
          console.log(`[Paywall] Request ${requestId}: Found x-sig in rawHeaders at index ${sigIndex}, value:`, rawHeaders[sigIndex + 1]?.substring(0, 20) + '...');
        }
      }
      
      // Check if request has signed headers
      // Also check rawHeaders as fallback (Express sometimes stores headers there)
      let xSigValue = req.headers['x-sig'];
      if (!xSigValue && (req as any).rawHeaders) {
        const rawHeaders = (req as any).rawHeaders;
        const sigIndex = rawHeaders.findIndex((h: string) => h.toLowerCase() === 'x-sig');
        if (sigIndex !== -1 && rawHeaders[sigIndex + 1]) {
          xSigValue = rawHeaders[sigIndex + 1];
          // Also set it in req.headers for consistency
          req.headers['x-sig'] = xSigValue;
          console.log(`[Paywall] Request ${requestId}: Found x-sig in rawHeaders, using that value`);
        }
      }
      
      if (!hasRequiredHeaders(req)) {
        console.log(`[Paywall] Request ${requestId}: No headers detected - returning 402`);
        // No headers - return 402 Payment Required
        return sendPaymentChallenge(req, res, normalizedOptions, resourcePath);
      }

      console.log(`[Paywall] Request ${requestId}: Headers found - verifying access`);
      // Has headers - verify pass
      // Wrap in try-catch to ensure all errors are caught
      try {
        await verifyAccess(req, res, normalizedOptions, resourcePath);
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
        const resourcePath = (req.baseUrl || '') + (req.path || '/');
        return sendPaymentChallenge(req, res, normalizedOptions, resourcePath.split('?')[0]);
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

  console.log(`[Paywall] Verifying access - Headers:`, {
    passId: passId?.substring(0, 20) + '...',
    signer,
    hasSignature: !!signature,
    timestamp,
  });

  if (!passId || !signer || !signature || !timestamp) {
    console.error('[Paywall] Missing required headers');
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
    if (accessPass) {
      console.log(`[Paywall] AccessPass details:`, {
        owner: accessPass.owner,
        domain: accessPass.domain,
        resource: accessPass.resource,
        remaining: accessPass.remaining,
        expiry: accessPass.expiry,
      });
    }
  } catch (error: any) {
    console.error('[Paywall] Error fetching AccessPass:', error);
    throw new InvalidPassError(`Failed to fetch AccessPass: ${error.message || 'Unknown error'}`);
  }
  
  if (!accessPass) {
    console.error('[Paywall] AccessPass not found on Sui');
    throw new InvalidPassError('AccessPass not found on Sui');
  }

  // Verify owner matches signer
  console.log(`[Paywall] Verifying owner: ${accessPass.owner} === ${signer}`);
  if (!verifyOwner(accessPass.owner, signer)) {
    console.error('[Paywall] Owner mismatch');
    throw new InvalidPassError('Signer does not own this AccessPass');
  }
  console.log(`[Paywall] Owner verified`);

  // Verify domain and resource match
  console.log(`[Paywall] Verifying domain and resource match`);
  if (!matchesAccessPass(accessPass, options.domain, resource)) {
    console.error('[Paywall] Domain or resource mismatch');
    throw new InvalidPassError('AccessPass domain or resource does not match');
  }
  console.log(`[Paywall] Domain and resource verified`);

  // Verify pass is valid (not expired, has remaining uses)
  console.log(`[Paywall] Verifying pass validity (remaining: ${accessPass.remaining}, expiry: ${accessPass.expiry})`);
  if (!isAccessPassValid(accessPass)) {
    if (accessPass.remaining <= 0) {
      console.error('[Paywall] No remaining uses');
      throw new NoRemainingUsesError();
    }
    if (accessPass.expiry > 0 && Date.now() >= accessPass.expiry) {
      console.error('[Paywall] Pass expired');
      throw new ExpiredPassError();
    }
    console.error('[Paywall] Pass is not valid');
    throw new InvalidPassError('AccessPass is not valid');
  }
  console.log(`[Paywall] Pass validity verified`);

  // Verify signature
  console.log(`[Paywall] Verifying signature`);
  const signatureValid = await verifySignature(
    passId,
    options.domain,
    resource,
    timestamp,
    signer,
    signature
  );

  if (!signatureValid) {
    console.error('[Paywall] Signature verification failed');
    throw new SignatureVerificationError();
  }
  console.log(`[Paywall] Signature verified`);

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
