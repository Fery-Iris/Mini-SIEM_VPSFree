import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminId } from "@/utils/serverAuth";

// Dashboard-facing endpoint: returns blocked IPs with timestamps (JWT auth)
export async function GET() {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Use `createdAt` of the earliest isBlocked=true log per IP as the block timestamp.
  // Ordering asc ensures the first row per distinct IP is the original block event.
  const blockedLogs = await prisma.securityLog.findMany({
    where: { adminId, isBlocked: true },
    select: { sourceIp: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    distinct: ["sourceIp"],
  });

  return NextResponse.json({
    blocked_ips: blockedLogs.map((l) => ({
      ip: l.sourceIp,
      blockedAt: l.createdAt.toISOString(),
    })),
  });
}
