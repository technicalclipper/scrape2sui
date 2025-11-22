// Sui SDK helpers

import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { AccessPass } from '../types';

/**
 * Default RPC URL for testnet
 */
const DEFAULT_RPC_URL = getFullnodeUrl('testnet');

/**
 * Create Sui client instance
 */
export function createSuiClient(rpcUrl?: string): SuiClient {
  return new SuiClient({
    url: rpcUrl || DEFAULT_RPC_URL,
  });
}

/**
 * Promise with timeout wrapper
 * Properly clears timeout if promise resolves before timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      timeoutId = null;
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  return Promise.race([
    promise
      .then((result) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        return result;
      })
      .catch((error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        throw error;
      }),
    timeoutPromise,
  ]).catch((error) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    throw error;
  });
}

/**
 * Fetch AccessPass object from Sui
 */
export async function fetchAccessPass(
  passId: string,
  packageId: string,
  rpcUrl?: string
): Promise<AccessPass | null> {
  const client = createSuiClient(rpcUrl);

  try {
    // Validate pass ID format
    if (!passId || !passId.startsWith('0x') || passId.length !== 66) {
      console.error('[Sui] Invalid pass ID format:', passId);
      return null;
    }

    console.log(`[Sui] Fetching object: ${passId}`);
    const startTime = Date.now();

    // Fetch object from Sui with timeout (10 seconds)
    const objectPromise = client.getObject({
      id: passId,
      options: {
        showContent: true,
        showType: true,
        showOwner: true,
      },
    });

    const object = await withTimeout(
      objectPromise,
      10000, // 10 second timeout
      'Timeout: Failed to fetch AccessPass from Sui within 10 seconds'
    ).catch((error) => {
      const elapsed = Date.now() - startTime;
      console.error(`[Sui] Error fetching AccessPass (after ${elapsed}ms):`, error.message);
      throw error;
    });

    const elapsed = Date.now() - startTime;
    console.log(`[Sui] Object fetched in ${elapsed}ms`);

    if (!object || !object.data || object.error) {
      console.error('Error fetching object:', object?.error || 'No data');
      return null;
    }

    // Verify object type matches AccessPass from our contract
    const objectType = object.data.type;
    if (objectType && !objectType.includes('AccessPass')) {
      console.error('Object is not an AccessPass:', objectType);
      return null;
    }

    // Parse AccessPass from object content
    const content = object.data.content;
    if (content && 'fields' in content) {
      const fields = content.fields as any;
      
      // Helper to extract string from Sui string::String field
      // Sui string::String can be: plain string or nested { bytes: Uint8Array }
      const extractString = (field: any): string => {
        if (typeof field === 'string') {
          return field;
        }
        if (field && typeof field === 'object') {
          // Handle nested structure: { bytes: "base64..." } or { bytes: Uint8Array }
          if ('bytes' in field) {
            if (typeof field.bytes === 'string') {
              // Base64 encoded bytes - decode to string
              try {
                return Buffer.from(field.bytes, 'base64').toString('utf8');
              } catch (e) {
                return field.bytes;
              }
            }
            // Already a string in the bytes field
            return String(field.bytes);
          }
          // Try to convert object to string
          return JSON.stringify(field);
        }
        return String(field || '');
      };
      
      // AccessPass structure from contract:
      // - pass_id: u64
      // - owner: address (string)
      // - domain: string::String
      // - resource: string::String
      // - remaining: u64
      // - expiry: u64 (milliseconds)
      // - nonce: string::String
      // - price_paid: u64
      return {
        pass_id: Number(fields.pass_id) || 0,
        owner: String(fields.owner || ''),
        domain: extractString(fields.domain),
        resource: extractString(fields.resource),
        remaining: Number(fields.remaining) || 0,
        expiry: Number(fields.expiry) || 0,
        nonce: extractString(fields.nonce),
        price_paid: String(fields.price_paid) || '0',
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching AccessPass:', error);
    return null;
  }
}

/**
 * Verify AccessPass is valid (not expired, has remaining uses)
 */
export function isAccessPassValid(pass: AccessPass): boolean {
  // Check remaining uses
  if (pass.remaining <= 0) {
    return false;
  }

  // Check expiry (0 means no expiry)
  if (pass.expiry > 0) {
    const currentTime = Date.now();
    if (currentTime >= pass.expiry) {
      return false;
    }
  }

  return true;
}

/**
 * Normalize resource path (remove trailing slash for consistency)
 */
function normalizeResourcePath(path: string): string {
  // Remove trailing slash, but keep root path as '/'
  if (path === '/' || path === '') {
    return '/';
  }
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

/**
 * Verify AccessPass matches domain and resource
 */
export function matchesAccessPass(
  pass: AccessPass,
  domain: string,
  resource: string
): boolean {
  // Normalize both paths to handle trailing slash differences
  const normalizedPassResource = normalizeResourcePath(pass.resource);
  const normalizedRequestResource = normalizeResourcePath(resource);
  
  const domainMatch = pass.domain === domain;
  const resourceMatch = normalizedPassResource === normalizedRequestResource;
  
  console.log(`[Sui] Resource match check:`, {
    passDomain: pass.domain,
    requestDomain: domain,
    domainMatch,
    passResource: pass.resource,
    normalizedPassResource,
    requestResource: resource,
    normalizedRequestResource,
    resourceMatch,
  });
  
  return domainMatch && resourceMatch;
}
