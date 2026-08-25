import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminId } from "@/utils/serverAuth";

export async function GET(req: Request) {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  
  const skip = (page - 1) * limit;

  const logs = await prisma.securityLog.findMany({
    where: { adminId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: skip,
  });
  
  const total = await prisma.securityLog.count({ where: { adminId } });

  return NextResponse.json({
    logs: logs.map(l => {
      const ip = l.sourceIp || l.ipAddressPublic || "";
      // Extract clean userAgent vs payload:
      // l.fingerprint stores actual HTTP User-Agent string
      // l.detail stores WAF payload / URL match details
      let userAgentStr = l.fingerprint || null;
      let payloadStr = l.detail || null;

      if (!userAgentStr && l.detail && l.detail.startsWith("Mozilla/")) {
        userAgentStr = l.detail;
        payloadStr = null;
      }

      return {
        id: l.id,
        adminId: l.adminId,
        userIdentity: l.userIdentity,
        action: l.action,
        severity: l.severity,
        ipAddress: ip,
        sourceIp: l.sourceIp || "",
        ipAddressPublic: l.ipAddressPublic || null,
        countryCode: l.countryCode || "ID",
        country: l.country || "Indonesia",
        userAgent: userAgentStr,
        payload: payloadStr,
        isBlocked: l.isBlocked,
        createdAt: l.createdAt.toISOString(),
        matchedRules: l.matchedRules || null,
        decision: l.decision || null,
        score: l.score,
        accumulatedScore: l.accumulatedScore,
      };
    }),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  });
}

