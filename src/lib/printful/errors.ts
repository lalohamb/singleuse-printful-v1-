export class PrintfulApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PrintfulApiError";
  }

  get isRateLimit() {
    return this.status === 429;
  }
  get isUnauthorized() {
    return this.status === 401;
  }
  get isNotFound() {
    return this.status === 404;
  }
  get isServerError() {
    return this.status >= 500;
  }

  /** Safe message for client responses — no internal detail */
  get clientMessage(): string {
    if (this.isUnauthorized) return "Printful authentication failed. Check your API token.";
    if (this.isNotFound) return "The requested Printful resource was not found.";
    if (this.isRateLimit) return "Printful rate limit reached. Please wait before retrying.";
    if (this.isServerError) return "Printful service is temporarily unavailable.";
    return "Printful request failed.";
  }
}
