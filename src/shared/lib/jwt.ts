export interface DecodedJwt {
  exp?: number;
  iat?: number;
  sub?: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

/**
 * Safely decode a standard JWT token payload without external libraries.
 */
export function decodeJwt(token: string): DecodedJwt | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload) as DecodedJwt;
  } catch {
    return null;
  }
}

/**
 * Checks if a JWT token is expired or will expire within `bufferSeconds`.
 * Default buffer is 60 seconds (proactively refreshes 1 minute before expiry).
 */
export function isTokenExpired(token: string | null, bufferSeconds = 60): boolean {
  if (!token) return true;
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.exp) return false;
  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp <= currentTime + bufferSeconds;
}

/**
 * Returns remaining seconds until token expires. Returns 0 if expired or null.
 */
export function getTokenRemainingSeconds(token: string | null): number {
  if (!token) return 0;
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.exp) return 0;
  const diff = decoded.exp - Math.floor(Date.now() / 1000);
  return Math.max(0, diff);
}
