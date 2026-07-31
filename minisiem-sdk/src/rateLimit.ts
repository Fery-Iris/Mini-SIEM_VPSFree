type RateLimitStore = {
  count: number;
  resetTime: number;
};

// Global map in the isolate memory
const requestCounts = new Map<string, RateLimitStore>();

// Configuration (Defaults)
const LIMIT_PER_WINDOW = 60; // Max 60 requests
const WINDOW_DURATION_MS = 60000; // per 1 minute (60 seconds)

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);

  // If no record exists or window expired, reset bucket for this IP
  if (!record || now > record.resetTime) {
    requestCounts.set(ip, {
      count: 1,
      resetTime: now + WINDOW_DURATION_MS
    });
    return true; // Allowed
  }

  // Increment count
  record.count += 1;

  // Check if threshold exceeded
  if (record.count > LIMIT_PER_WINDOW) {
    return false; // Blocked (Rate Limited)
  }

  // Allowed
  return true;
}

// Cleanup function to prevent memory leak in long-running isolates
export function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [ip, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(ip);
    }
  }
}

