// Main export file

export { paywall } from './middleware';
export type {
  PaywallOptions,
  PaywallRequest,
  PaywallMiddleware,
  PaymentChallenge,
  AccessPass,
  SignedHeaders,
} from './types';

export {
  PaymentRequiredError,
  InvalidPassError,
  ExpiredPassError,
  NoRemainingUsesError,
  SignatureVerificationError,
} from './errors';

// Client SDK for bots
export { PaywallClient } from './client';
