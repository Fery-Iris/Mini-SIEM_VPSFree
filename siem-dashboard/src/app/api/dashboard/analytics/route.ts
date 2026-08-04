import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminId } from "@/utils/serverAuth";

export async function GET(req: Request) {
  const adminId = await getAdminId();
  if (!adminId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") || "24h";

  // Calculate the start date based on range
  const now = new Date();
  let startDate: Date;
  let bucketFormat: "hour" | "day";

  switch (range) {
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      bucketFormat = "day";
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      bucketFormat = "day";
      break;
    default: // 24h
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      bucketFormat = "hour";
      break;
  }

  // Fetch all logs within range
  const logs = await prisma.securityLog.findMany({
    where: {
      adminId,
      createdAt: { gte: startDate },
    },
    select: {
      createdAt: true,
      isBlocked: true,
      action: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Build time-series buckets
  const buckets = new Map<string, { safe: number; blocked: number }>();

  // Pre-fill buckets so chart has continuous data
  if (bucketFormat === "hour") {
    for (let i = 0; i < 24; i++) {
      const d = new Date(startDate.getTime() + i * 60 * 60 * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:00`;
      buckets.set(key, { safe: 0, blocked: 0 });
    }
  } else {
    const days = range === "7d" ? 7 : 30;
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      buckets.set(key, { safe: 0, blocked: 0 });
    }
  }

  // Populate buckets from logs
  for (const log of logs) {
    const d = log.createdAt;
    let key: string;
    if (bucketFormat === "hour") {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:00`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    if (!buckets.has(key)) {
      buckets.set(key, { safe: 0, blocked: 0 });
    }

    const bucket = buckets.get(key)!;
    if (log.isBlocked) {
      bucket.blocked++;
    } else {
      bucket.safe++;
    }
  }

  const timeSeries = Array.from(buckets.entries()).map(([time, data]) => ({
    time,
    safe: data.safe,
    blocked: data.blocked,
  }));

  // Attack type distribution
  const attackCounts = new Map<string, number>();
  for (const log of logs) {
    if (log.isBlocked && log.action) {
      const action = log.action || "Unknown";
      attackCounts.set(action, (attackCounts.get(action) || 0) + 1);
    }
  }

  const totalBlocked = logs.filter((l) => l.isBlocked).length;
  const attackTypes = Array.from(attackCounts.entries())
    .map(([type, count]) => ({
      type,
      count,
      percentage: totalBlocked > 0 ? Math.round((count / totalBlocked) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8); // Top 8 attack types

  return NextResponse.json({
    timeSeries,
    attackTypes,
    summary: {
      totalSafe: logs.filter((l) => !l.isBlocked).length,
      totalBlocked,
      range,
    },
  });
}
