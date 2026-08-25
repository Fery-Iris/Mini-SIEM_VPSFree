/**
 * Mini-SIEM SDK v2.0 — Wazuh-Inspired Scoring Middleware
 *
 * Alur keputusan:
 *   Request masuk → WAF scan → Dapat level(s) dari semua rule yang cocok
 *     → accumulateScore(ip, levels)
 *     → totalScore = getAccumulatedScore(ip)
 *     → if totalScore < alertThreshold: LOG ONLY
 *     → if totalScore >= alertThreshold & < blockThreshold: LOG + ALERT
 *     → if totalScore >= blockThreshold: LOG + ALERT + BLOCK (return 403)
 *
 * PENTING: Satu sistem hanya boleh menggunakan SATU API Key.
 */

import { checkRateLimit, cleanupRateLimitStore } from "./rateLimit";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isIPBlockedLocally, cacheBlockedIP } from "./cache";
import { detectThreats, levelToSeverity } from "./waf";
import type { WAFMatch } from "./waf";
import {
  accumulateScore,
  cleanupScoreStore,
  configureAccumulator,
} from "./scoreAccumulator";
import type { AccumulatorConfig, ActionDecision, ScoreEvent, AccumulationResult } from "./scoreAccumulator";

// ─────────────── Types ─────────────── //

export interface MiniSIEMConfig {
  apiKey: string;
  siemUrl: string;

  /** Threshold skor untuk memblokir IP (default: 10) */
  blockThreshold?: number;
  /** Threshold skor untuk mengirim alert/Telegram (default: 7) */
  alertThreshold?: number;
  /** Jendela waktu akumulasi skor dalam milidetik (default: 5 menit) */
  scoreWindowMs?: number;
}

// ─────────────── Cleanup Interval ─────────────── //

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanupInterval() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    cleanupRateLimitStore();
    cleanupScoreStore();
  }, 60_000); // every 60 seconds
}

// ─────────────── Report to Dashboard ─────────────── //

interface ThreatReport {
  ipAddress: string;
  action: string;
  severity: string;
  score: number;
  accumulatedScore: number;
  matchedRules: string[];
  decision: ActionDecision;
  payload: string;
  userAgent: string;
}

async function reportThreat(
  siemUrl: string,
  apiKey: string,
  report: ThreatReport
): Promise<void> {
  try {
    await fetch(`${siemUrl}/api/detection/threats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(report),
    });
  } catch (err) {
    console.error("[Mini-SIEM SDK] Failed to report threat:", err);
  }
}

// ─────────────── Fetch Blocked IPs ─────────────── //

async function syncBlockedIPs(
  siemUrl: string,
  apiKey: string,
  ip: string
): Promise<void> {
  try {
    const res = await fetch(`${siemUrl}/api/blocked/list`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { blocked_ips?: string[] };
      if (data.blocked_ips && data.blocked_ips.includes(ip)) {
        cacheBlockedIP(ip);
      }
    }
  } catch (err) {
    // Silent fail — non-blocking
  }
}

// ─────────────── Main Middleware ─────────────── //

export function withMiniSIEM(
  config: MiniSIEMConfig,
  nextMiddleware?: (req: NextRequest) => Promise<NextResponse> | NextResponse
) {
  // Initialize accumulator config
  configureAccumulator({
    windowMs: config.scoreWindowMs,
    alertThreshold: config.alertThreshold,
    blockThreshold: config.blockThreshold,
  });

  // Start background cleanup
  startCleanupInterval();

  return async function middleware(req: NextRequest) {
    const url = req.nextUrl;

    // ─── Skip static assets ───
    if (url.pathname.startsWith("/_next/") || url.pathname.includes(".")) {
      if (nextMiddleware) return nextMiddleware(req);
      return NextResponse.next();
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userAgent = req.headers.get("user-agent") || "";

    // ─── 1. Check Local Blocked IP Cache ───
    if (isIPBlockedLocally(ip)) {
      return new NextResponse(
        JSON.stringify({
          error: "Forbidden",
          message: "Your IP has been blocked by Mini-SIEM.",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // ─── 2. Rate Limit Check ───
    const isAllowed = checkRateLimit(ip);
    if (!isAllowed) {
      // Rate limit exceeded — report as high-level event
      const rateEvents: ScoreEvent[] = [
        {
          ruleId: "RATE_001",
          ruleName: "Rate Limit Exceeded",
          level: 8,
          timestamp: Date.now(),
        },
      ];

      const result = accumulateScore(ip, rateEvents);

      // Report asynchronously
      reportThreat(config.siemUrl, config.apiKey, {
        ipAddress: ip,
        action: "RATE_LIMIT_EXCEEDED",
        severity: "High",
        score: 8,
        accumulatedScore: result.currentScore,
        matchedRules: ["Rate Limit Exceeded"],
        decision: result.action,
        payload: `${result.eventCount} events in score window`,
        userAgent,
      });

      return new NextResponse(
        JSON.stringify({
          error: "Too Many Requests",
          message: "You have been rate limited by Mini-SIEM.",
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // ─── 3. Sync blocked IPs from dashboard (non-blocking) ───
    syncBlockedIPs(config.siemUrl, config.apiKey, ip);

    // ─── 4. WAF Detection — Scan ALL rules ───
    const detection = detectThreats(req.url, req.headers);

    if (detection.detected) {
      // Convert WAF matches to score events
      const scoreEvents: ScoreEvent[] = detection.matches.map((m) => ({
        ruleId: m.ruleId,
        ruleName: m.ruleName,
        level: m.level,
        timestamp: Date.now(),
      }));

      // Accumulate score for this IP
      const result = accumulateScore(ip, scoreEvents);

      // Build severity from highest individual level
      const severity = levelToSeverity(detection.highestLevel);

      // Report to dashboard (always, regardless of action)
      reportThreat(config.siemUrl, config.apiKey, {
        ipAddress: ip,
        action: detection.matches.map((m) => m.ruleName).join(" + "),
        severity,
        score: detection.totalScore,
        accumulatedScore: result.currentScore,
        matchedRules: detection.matches.map((m) => m.ruleName),
        decision: result.action,
        payload: detection.matches
          .map((m) => `[${m.ruleId}] ${m.matchedPayload}`)
          .join(" | ")
          .substring(0, 500),
        userAgent,
      });

      // ─── Decision based on accumulated score ───
      switch (result.action) {
        case "BLOCK":
          // Block: Cache IP locally + return 403
          cacheBlockedIP(ip);
          return new NextResponse(
            JSON.stringify({
              error: "Forbidden",
              message: "Request blocked by Mini-SIEM WAF.",
              score: result.currentScore,
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            }
          );

        case "ALERT":
          // Alert: Log + send to dashboard (Telegram handled server-side)
          // But still allow the request through
          console.warn(
            `[Mini-SIEM] ALERT: IP ${ip} score ${result.currentScore} — ${detection.matches.map((m) => m.ruleName).join(", ")}`
          );
          break;

        case "LOG":
          // Log only — low-level detections, just record
          break;
      }
    }

    // ─── 5. Pass through to next middleware or response ───
    if (nextMiddleware) {
      return nextMiddleware(req);
    }
    return NextResponse.next();
  };
}

// ─────────────── Failed Authentication Tracker ─────────────── //

export interface FailedLoginOptions {
  username?: string;
  reason?: string;
}

/**
 * Report a failed login attempt to Mini-SIEM.
 * Increments accumulated threat score (+2 level points per failure) for the client IP.
 * Automatically triggers ALERT or BLOCK decisions based on threshold settings.
 */
export async function reportFailedLogin(
  req: Request | NextRequest,
  config: MiniSIEMConfig,
  options?: FailedLoginOptions
): Promise<AccumulationResult & { isBlocked: boolean }> {
  // Ensure accumulator is configured with SDK thresholds
  configureAccumulator({
    windowMs: config.scoreWindowMs,
    alertThreshold: config.alertThreshold,
    blockThreshold: config.blockThreshold,
  });

  let ip = "unknown";
  let userAgent = "";

  const headersObj = req.headers;
  if (headersObj && typeof headersObj.get === "function") {
    ip = headersObj.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    userAgent = headersObj.get("user-agent") || "";
  }

  const username = options?.username || "unknown";
  const reason = options?.reason || "Invalid credentials";

  // Score event: +2 points per failed authentication attempt
  const authEvent: ScoreEvent = {
    ruleId: "AUTH_001",
    ruleName: "Failed Login Attempt",
    level: 2,
    timestamp: Date.now(),
  };

  const result = accumulateScore(ip, [authEvent]);
  const isBlocked = result.action === "BLOCK" || isIPBlockedLocally(ip);

  if (result.action === "BLOCK") {
    cacheBlockedIP(ip);
  }

  // Report threat to SIEM Dashboard
  await reportThreat(config.siemUrl, config.apiKey, {
    ipAddress: ip,
    action: "Failed Login Attempt",
    severity: result.action === "BLOCK" ? "Critical" : result.action === "ALERT" ? "High" : "Medium",
    score: 2,
    accumulatedScore: result.currentScore,
    matchedRules: ["Failed Login Attempt"],
    decision: result.action,
    payload: `[AUTH_001] Target User: ${username} | Reason: ${reason} | Attempts in window: ${result.eventCount}`,
    userAgent,
  });

  return {
    ...result,
    isBlocked,
  };
}

// Re-export for convenience
export { WAF_RULES, detectThreats, levelToSeverity } from "./waf";
export type { WAFRule, WAFMatch, DetectionResult } from "./waf";
export type { AccumulatorConfig, ActionDecision, ScoreEvent, AccumulationResult } from "./scoreAccumulator";
export { configureAccumulator, getThresholds } from "./scoreAccumulator";
