import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminId } from "@/utils/serverAuth";
import { blockIpInCloudflare } from "@/lib/cloudflare";

export async function GET() {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const threats = await prisma.securityLog.findMany({
    where: { adminId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    threats: threats.map((t) => {
      let matchedRulesArr: string[] = [];
      try {
        if (t.matchedRules) {
          matchedRulesArr = JSON.parse(t.matchedRules);
        }
      } catch (e) {}

      return {
        ...t,
        CreatedAt: t.createdAt.toISOString(),
        latestUpdate: t.createdAt.toISOString(),
        attackType: t.action,
        publicIp: t.ipAddressPublic || "",
        lat: 0, // Simplified for now, in a real app this uses GeoIP
        lng: 0,
        matchedRules: matchedRulesArr,
      };
    }),
  });
}

// POST endpoint for SDK v2.0 to report threats with scoring data
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader)
    return NextResponse.json({ error: "API key missing" }, { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const apiKey = await prisma.apiKey.findFirst({
    where: { keyValue: token, isActive: 1 },
  });

  if (!apiKey)
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  try {
    const body = await req.json();

    // v2.0 SDK fields (with backward compatibility for v1)
    const {
      ipAddress,
      action,
      severity,
      payload,
      userAgent,
      // v2.0 scoring fields:
      score = 0,
      accumulatedScore = 0,
      matchedRules = [],
      decision = "LOG",
    } = body as {
      ipAddress?: string;
      action?: string;
      severity?: string;
      payload?: string;
      userAgent?: string;
      score?: number;
      accumulatedScore?: number;
      matchedRules?: string[];
      decision?: string;
    };

    // Derive isBlocked from decision or severity (backward compat)
    const isBlocked =
      decision === "BLOCK" ||
      severity === "Critical" ||
      severity === "High";

    // Fetch AdminConfig for this admin (for Telegram settings)
    const adminConfig = await prisma.adminConfig.findUnique({
      where: { adminId: apiKey.adminId },
    });

    const ip = ipAddress || "unknown";
    let countryCode: string | null = null;
    let country: string | null = null;

    if (ip !== "unknown" && ip !== "127.0.0.1" && ip !== "::1" && !ip.startsWith("192.168.") && !ip.startsWith("10.")) {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode`, {
          signal: AbortSignal.timeout(1500),
        });
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.status === "success") {
            countryCode = geoData.countryCode;
            country = geoData.country;
          }
        }
      } catch (e) {}
    }

    if (!countryCode) {
      countryCode = "ID";
      country = "Indonesia";
    }

    const log = await prisma.securityLog.create({
      data: {
        adminId: apiKey.adminId,
        sourceIp: ip,
        action: action || "WAF_BLOCK",
        severity: severity || "High",
        detail: payload || "",
        fingerprint: userAgent || "",
        countryCode,
        country,
        isBlocked,
        // v2.0 scoring fields
        score,
        accumulatedScore,
        matchedRules: matchedRules.length > 0 ? JSON.stringify(matchedRules) : null,
        decision,
      },
    });

    // Fire-and-forget: Cloudflare WAF sync for blocked IPs
    if (isBlocked) {
      blockIpInCloudflare(
        ipAddress || "unknown",
        `[Mini-SIEM SDK] Blocked: ${action}`
      ).catch(console.error);
    }

    // Fire-and-forget: Telegram alert if BLOCK or ALERT decision + Telegram configured
    if (
      (decision === "BLOCK" || decision === "ALERT") &&
      adminConfig?.telegramEnabled &&
      adminConfig.telegramBotToken &&
      adminConfig.telegramChatId
    ) {
      sendTelegramAlert(
        adminConfig.telegramBotToken,
        adminConfig.telegramChatId,
        {
          ip: ipAddress || "unknown",
          score: accumulatedScore,
          matchedRules,
          decision,
          severity: severity || "High",
          blockThreshold: adminConfig.blockThreshold,
        }
      ).catch(console.error);
    }

    return NextResponse.json({ success: true, logId: log.id }, { status: 201 });
  } catch (error) {
    console.error("[threats/route] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Telegram Alert Helper ─── //

async function sendTelegramAlert(
  botToken: string,
  chatId: string,
  data: {
    ip: string;
    score: number;
    matchedRules: string[];
    decision: string;
    severity: string;
    blockThreshold: number;
  }
) {
  const emoji = data.decision === "BLOCK" ? "🚫" : "⚠️";
  const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

  const message =
    `${emoji} *Mini-SIEM Alert*\n\n` +
    `*IP:* \`${data.ip}\`\n` +
    `*Decision:* ${data.decision}\n` +
    `*Accumulated Score:* ${data.score} / ${data.blockThreshold}\n` +
    `*Severity:* ${data.severity}\n` +
    `*Matched Rules:*\n${data.matchedRules.map((r) => `  • ${r}`).join("\n")}\n` +
    `*Time (WIB):* ${now}`;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown",
    }),
  });
}
