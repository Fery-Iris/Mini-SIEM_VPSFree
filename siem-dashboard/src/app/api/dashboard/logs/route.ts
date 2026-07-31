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
      ...l,
      CreatedAt: l.createdAt.toISOString(),
      Flag: "??" // Simplified flag mapper
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  });
}
