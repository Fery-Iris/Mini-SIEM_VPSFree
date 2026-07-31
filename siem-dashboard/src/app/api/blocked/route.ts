import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// To get blocked IP list for the SDK (API Key required)
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "API key missing" }, { status: 401 });
  
  const token = authHeader.replace("Bearer ", "");
  const apiKey = await prisma.apiKey.findUnique({ where: { key: token } });
  
  if (!apiKey) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  const blockedLogs = await prisma.securityLog.findMany({
    where: { adminId: apiKey.adminId, isBlocked: true },
    select: { ipAddress: true },
    distinct: ["ipAddress"]
  });

  return NextResponse.json({
    blocked_ips: blockedLogs.map(l => l.ipAddress)
  });
}
