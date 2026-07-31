const blockedIPs = new Map<string, number>();

// Cache TTL is 60 seconds to avoid querying SIEM dashboard constantly
const CACHE_TTL_MS = 60000;

export function isIPBlockedLocally(ip: string): boolean {
  const expiry = blockedIPs.get(ip);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    blockedIPs.delete(ip);
    return false;
  }
  return true;
}

export function cacheBlockedIP(ip: string) {
  blockedIPs.set(ip, Date.now() + CACHE_TTL_MS);
}

