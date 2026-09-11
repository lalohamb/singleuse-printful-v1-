import { randomBytes, createHmac } from 'crypto';

function getLicenseSecret(): string {
  const secret = process.env.LICENSE_HMAC_SECRET;
  if (!secret) {
    throw new Error('LICENSE_HMAC_SECRET is not configured. Set a secure secret in your environment before generating or validating licenses.');
  }
  return secret;
}

/** Generates a license key in format PPL-XXXX-XXXX-XXXX-XXXX */
export function generateLicenseKey(): string {
  const segments = Array.from({ length: 4 }, () =>
    randomBytes(2).toString('hex').toUpperCase()
  );
  return `PPL-${segments.join('-')}`;
}

/** Returns a short checksum suffix for a key (for display/verification) */
export function checksumFor(key: string): string {
  return createHmac('sha256', getLicenseSecret()).update(key).digest('hex').slice(0, 8).toUpperCase();
}

/** Validates format: PPL-XXXX-XXXX-XXXX-XXXX */
export function isValidKeyFormat(key: string): boolean {
  return /^PPL-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(key);
}
