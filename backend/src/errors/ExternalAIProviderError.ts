export class ExternalAIProviderError extends Error {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    // Sanitize any accidental token leakage matching typical token patterns (hf_..., Bearer ..., etc.)
    const sanitized = message
      .replace(/hf_[a-zA-Z0-9]+/g, '[REDACTED]')
      .replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, 'Bearer [REDACTED]');
    super(sanitized);
    this.name = 'ExternalAIProviderError';
    this.statusCode = statusCode;
  }
}
