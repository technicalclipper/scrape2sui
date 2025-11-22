// TypeScript types and interfaces

import { Request, Response, NextFunction } from 'express';

/**
 * Options for configuring the paywall middleware
 * Contract details are baked into the package
 * User only needs to provide: price, receiver (wallet address), domain
 */
export interface PaywallOptions {
  /** Price in SUI (e.g., "0.1" for 0.1 SUI) */
  price: string;
  /** Receiver wallet address - where payments go */
  receiver: string;
  /** Domain name (e.g., "www.example.com") */
  domain: string;
  /** Mock content to serve after verification (optional, for testing) */
  mockContent?: string;
}

/**
 * Payment challenge response (402 Payment Required)
 */
export interface PaymentChallenge {
  status: 402;
  paymentRequired: true;
  price: string;
  priceInMist: string;
  receiver: string;
  packageId: string;
  treasuryId: string;
  passCounterId: string;
  domain: string;
  resource: string;
  nonce: string;
}

/**
 * AccessPass object from Sui contract
 */
export interface AccessPass {
  pass_id: string | number;
  owner: string;
  domain: string;
  resource: string;
  remaining: number;
  expiry: number;
  nonce: string;
  price_paid: string | number;
}

/**
 * Signed headers from client
 */
export interface SignedHeaders {
  'x-pass-id': string;
  'x-signer': string;
  'x-sig': string;
  'x-ts': string;
}

/**
 * Express request with paywall headers
 */
export interface PaywallRequest extends Request {
  paywall?: {
    accessPass?: AccessPass;
    verified?: boolean;
  };
}

/**
 * Express middleware type
 */
export type PaywallMiddleware = (
  req: PaywallRequest,
  res: Response,
  next: NextFunction
) => void;
