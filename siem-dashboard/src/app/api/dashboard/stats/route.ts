import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminId } from "@/utils/serverAuth";

export async function GET() {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const whereClause = { adminId };
  
  // A simplistic version of the stats for MVP
  const totalLogs = await prisma.securityLog.count({ where: whereClause });
  const blockedTotal = await prisma.securityLog.count({ where: { ...whereClause, isBlocked: true } });
  const criticalTotal = await prisma.securityLog.count({ where: { ...whereClause, severity: "Critical" } });
  
  // unique IP sources
  const sources = await prisma.securityLog.findMany({
    where: { ...whereClause, isBlocked: false },
    select: { sourceIp: true },
    distinct: ["sourceIp"],
  });
  const sourcesTotal = sources.length;

  const stats = [
    {
      label: "Attacks Blocked", value: String(blockedTotal),
      change: "+0%", sub: "Last 24 Hours",
      icon: "ShieldAlert", iconBg: "bg-red-500/10", iconColor: "text-red-400", changeBg: "bg-green-500/10 text-green-400",
    },
    {
      label: "Total Threats", value: String(criticalTotal),
      change: "+0%", sub: "Active Incidents",
      icon: "AlertTriangle", iconBg: "bg-amber-500/10", iconColor: "text-amber-400", changeBg: "bg-green-500/10 text-green-400",
    },
    {
      label: "Active Sources", value: String(sourcesTotal),
      change: "+0%", sub: "Unique IP Addresses",
      icon: "Users", iconBg: "bg-cyan-500/10", iconColor: "text-cyan-400", changeBg: "bg-green-500/10 text-green-400",
    }
  ];

  return NextResponse.json({ stats, totalEvents: totalLogs });
}
