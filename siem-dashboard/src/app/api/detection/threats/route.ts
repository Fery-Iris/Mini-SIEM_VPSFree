import { blockIpInCloudflare } from "@/lib/cloudflare";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminId } from "@/utils/serverAuth";

export async function GET() {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const threats = await prisma.securityLog.findMany({
    where: { adminId },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  return NextResponse.json({ threats: threats.map(t => ({...t, CreatedAt: t.createdAt.toISOString()})) });
}

// POST endpoint for SDK to report threats
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "API key missing" }, { status: 401 });
  
  const token = authHeader.replace("Bearer ", "");
  const apiKey = await prisma.apiKey.findUnique({ where: { key: token } });
  
  if (!apiKey) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  try {
    const body = await req.json();
    const { ipAddress, action, severity, payload, userAgent } = body;

    const log = await prisma.securityLog.create({
      data: {
        adminId: apiKey.adminId,
        ipAddress: ipAddress || "unknown",
        action: action || "WAF_BLOCK",
        severity: severity || "High",
        payload: payload || "",
        userAgent: userAgent || "",
        isBlocked: true, // WAF blocked it
      }
    });

    // Phase 4: Sync to Cloudflare WAF if it's a critical block
    if (severity === "Critical" || severity === "High") {
      // Fire and forget (async)
      blockIpInCloudflare(ipAddress || "unknown", "[Mini-SIEM SDK] Blocked: " + action).catch(console.error);
    }

    return NextResponse.json({ success: true, logId: log.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


