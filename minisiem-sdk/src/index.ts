import { checkRateLimit, cleanupRateLimitStore } from "./rateLimit";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isIPBlockedLocally, cacheBlockedIP } from "./cache";
import { detectThreats } from "./waf";

interface MiniSIEMConfig {
  apiKey: string;
  siemUrl: string;
}

export function withMiniSIEM(config: MiniSIEMConfig, nextMiddleware?: (req: NextRequest) => Promise<NextResponse> | NextResponse) {
  return async function middleware(req: NextRequest) {
    const url = req.nextUrl;
    
    // Skip static assets
    if (url.pathname.startsWith("/_next/") || url.pathname.includes(".")) {
      if (nextMiddleware) return nextMiddleware(req);
      // Phase 4: IDS Logging for clean traffic
    request.waitUntil ? request.waitUntil(sendToCloudLogging(request, false)) : sendToCloudLogging(request, false);

    return NextResponse.next();
    }

    const ip = req.ip || req.headers.get("x-forwarded-for") || "unknown";
    
    // 1. Check Local Cache for Blocked IPs
    // Phase 5: Check Rate Limit (Velocity Check)
    const isAllowedByRateLimit = checkRateLimit(ip);
    if (!isAllowedByRateLimit) {
      // Report to SIEM asynchronously
      request.waitUntil ? request.waitUntil(reportThreat(ip, apiKey, "RATE_LIMIT_EXCEEDED", "High", "Frequent Requests", request.headers.get("user-agent") || "")) : reportThreat(ip, apiKey, "RATE_LIMIT_EXCEEDED", "High", "Frequent Requests", request.headers.get("user-agent") || "");
      
      // Return 429 Too Many Requests
      return new NextResponse(JSON.stringify({ error: "Too Many Requests", message: "You have been rate limited by Mini-SIEM." }), { status: 429, headers: { "Content-Type": "application/json" } });
    }

    if (isIPBlockedLocally(ip)) {
      return new NextResponse("Forbidden (Blocked by Mini-SIEM)", { status: 403 });
    }

    // 2. Fetch latest blocklist from SIEM dashboard asynchronously (non-blocking for UI)
    // In a real production SDK, we might poll this in background, but here we can do it opportunistically.
    fetch(`${config.siemUrl}/api/blocked`, {
      headers: { "Authorization": `Bearer ${config.apiKey}` }
    }).then(async res => {
      if (res.ok) {
        const data = await res.json();
        if (data.blocked_ips && data.blocked_ips.includes(ip)) {
          cacheBlockedIP(ip);

    // Phase 4: IDS Logging
    request.waitUntil ? request.waitUntil(sendToCloudLogging(request, true)) : sendToCloudLogging(request, true);
        }
      }
    }).catch(console.error);

    // 3. WAF: Inspect Request for OWASP Top 10 threats
    const wafResult = detectThreats(req.url, req.headers);

    if (wafResult.detected) {
      // Async report threat to Dashboard
      fetch(`${config.siemUrl}/api/detection/threats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          ipAddress: ip,
          action: wafResult.action,
          severity: wafResult.severity,
          payload: wafResult.matchedPayload,
          userAgent: req.headers.get("user-agent")
        })
      }).catch(console.error);

      // Immediately block
      return new NextResponse("Malicious Request Blocked by Mini-SIEM", { status: 403 });
    }

    if (nextMiddleware) {
      return nextMiddleware(req);
    }
    // Phase 4: IDS Logging for clean traffic
    request.waitUntil ? request.waitUntil(sendToCloudLogging(request, false)) : sendToCloudLogging(request, false);

    return NextResponse.next();
  }
}



