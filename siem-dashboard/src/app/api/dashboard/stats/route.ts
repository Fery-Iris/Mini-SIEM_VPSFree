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
    select: { ipAddress: true },
    distinct: ["ipAddress"],
  });
  const sourcesTotal = sources.length;

  const stats = [
    {
      Label: "Attacks Blocked", Value: String(blockedTotal),
      Change: "+0%", Sub: "Last 24 Hours",
      Icon: "ShieldAlert", IconBg: "bg-red-50", IconColor: "text-red-400", ChangeBg: "bg-green-100 text-green-700",
    },
    {
      Label: "Total Threats", Value: String(criticalTotal),
      Change: "+0%", Sub: "Active Incidents",
      Icon: "AlertTriangle", IconBg: "bg-amber-50", IconColor: "text-amber-400", ChangeBg: "bg-green-100 text-green-700",
    },
    {
      Label: "Active Sources", Value: String(sourcesTotal),
      Change: "+0%", Sub: "Unique IP Addresses",
      Icon: "Users", IconBg: "bg-cyan-50", IconColor: "text-cyan-500", ChangeBg: "bg-green-100 text-green-700",
    }
  ];

  return NextResponse.json({ stats, totalEvents: totalLogs });
}
