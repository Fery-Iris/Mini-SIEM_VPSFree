import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// SDK-facing endpoint: returns blocked IP list using API Key auth (backward compat).
// The dashboard uses GET /api/blocked (JWT auth) instead.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader)
    return NextResponse.json({ error: "API key missing" }, { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const apiKey = await prisma.apiKey.findFirst({
    where: { keyValue: token, isActive: 1 },
  });

  if (!apiKey)
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  const blockedLogs = await prisma.securityLog.findMany({
    where: { adminId: apiKey.adminId, isBlocked: true },
    select: { sourceIp: true },
    distinct: ["sourceIp"],
  });

  return NextResponse.json({
    blocked_ips: blockedLogs.map((l) => l.sourceIp),
  });
}
