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
    logs: logs.map(l => ({
      id: l.id,
      adminId: l.adminId,
      userIdentity: l.userIdentity,
      action: l.action,
      severity: l.severity,
      // Normalize: ipAddress = sourceIp (primary) fallback to ipAddressPublic
      ipAddress: l.sourceIp || l.ipAddressPublic || "",
      sourceIp: l.sourceIp || "",
      ipAddressPublic: l.ipAddressPublic || null,
      countryCode: l.countryCode || null,
      country: l.country || null,
      // userAgent is stored in the detail field (JSON or plain string)
      userAgent: l.detail || null,
      payload: null, // payload field removed; detail is used as userAgent
      isBlocked: l.isBlocked,
      createdAt: l.createdAt.toISOString(),
      // v2.0 enrichment fields for expanded detail panel
      matchedRules: l.matchedRules || null,   // JSON string array, e.g. '["SQLi","XSS"]'
      decision: l.decision || null,           // LOG | ALERT | BLOCK
      score: l.score,
      accumulatedScore: l.accumulatedScore,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  });
}

