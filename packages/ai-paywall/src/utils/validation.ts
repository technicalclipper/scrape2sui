// Input validation

import { PaywallOptions } from '../types';

/**
 * Validates paywall options
 */
export function validateOptions(options: { price: string; receiver: string; domain: string; packageId: string; treasuryId: string; passCounterId: string }): void {
  if (!options.price || parseFloat(options.price) <= 0) {
    throw new Error('Price must be greater than 0');
  }

  if (!options.receiver || typeof options.receiver !== 'string') {
    throw new Error('Receiver wallet address is required');
  }

  if (!options.domain || typeof options.domain !== 'string') {
    throw new Error('Domain is required and must be a string');
  }

  if (!options.packageId || !isValidSuiAddress(options.packageId)) {
    throw new Error('Valid packageId (Sui address) is required');
  }

  if (!options.treasuryId || !isValidSuiAddress(options.treasuryId)) {
    throw new Error('Valid treasuryId (Sui address) is required');
  }

  if (!options.passCounterId || !isValidSuiAddress(options.passCounterId)) {
    throw new Error('Valid passCounterId (Sui address) is required');
  }
}

/**
 * Validates Sui address format
 */
export function isValidSuiAddress(address: string): boolean {
  // Sui addresses are 64 hex characters (32 bytes) prefixed with 0x
  return /^0x[a-fA-F0-9]{64}$/.test(address);
}

/**
 * Generates a unique nonce
 */
export function generateNonce(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Validates AccessPass headers
 */
export function hasRequiredHeaders(req: any): boolean {
  return !!(
    req.headers['x-pass-id'] &&
    req.headers['x-signer'] &&
    req.headers['x-sig'] &&
    req.headers['x-ts']
  );
}
