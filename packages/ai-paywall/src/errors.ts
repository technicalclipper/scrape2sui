// Custom error classes

/**
 * Payment required error (402)
 */
export class PaymentRequiredError extends Error {
  public readonly statusCode = 402;
  public readonly paymentRequired = true;

  constructor(
    public readonly price: string,
    public readonly packageId: string,
    public readonly treasuryId: string,
    public readonly passCounterId: string,
    public readonly domain: string,
    public readonly resource: string,
    public readonly nonce: string,
    public readonly receiver?: string
  ) {
    super('Payment required to access this resource');
    this.name = 'PaymentRequiredError';
  }

  toJSON(): object {
    return {
      status: this.statusCode,
      paymentRequired: this.paymentRequired,
      price: this.price,
      priceInMist: this.priceToMist(this.price),
      receiver: this.receiver || '',
      packageId: this.packageId,
      treasuryId: this.treasuryId,
      passCounterId: this.passCounterId,
      domain: this.domain,
      resource: this.resource,
      nonce: this.nonce,
    };
  }

  private priceToMist(price: string): string {
    // Convert SUI to MIST (1 SUI = 1,000,000,000 MIST)
    const suiAmount = parseFloat(price);
    return Math.floor(suiAmount * 1_000_000_000).toString();
  }
}

/**
 * Invalid pass error
 */
export class InvalidPassError extends Error {
  public readonly statusCode = 403;

  constructor(message: string = 'Invalid access pass') {
    super(message);
    this.name = 'InvalidPassError';
  }
}

/**
 * Expired pass error
 */
export class ExpiredPassError extends Error {
  public readonly statusCode = 403;

  constructor(message: string = 'Access pass has expired') {
    super(message);
    this.name = 'ExpiredPassError';
  }
}

/**
 * No remaining uses error
 */
export class NoRemainingUsesError extends Error {
  public readonly statusCode = 403;

  constructor(message: string = 'Access pass has no remaining uses') {
    super(message);
    this.name = 'NoRemainingUsesError';
  }
}

/**
 * Signature verification error
 */
export class SignatureVerificationError extends Error {
  public readonly statusCode = 403;

  constructor(message: string = 'Invalid signature') {
    super(message);
    this.name = 'SignatureVerificationError';
  }
}
