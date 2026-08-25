import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unblockIpInCloudflare } from "@/lib/cloudflare";
import { getAdminId } from "@/utils/serverAuth";

export async function POST(req: Request) {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { ip } = await req.json();
    if (!ip) return NextResponse.json({ error: "IP is required" }, { status: 400 });

    // Update Prisma: mark all security logs for this IP as not blocked and reset decision
    await prisma.securityLog.updateMany({
      where: { adminId, sourceIp: ip },
      data: { isBlocked: false, decision: "LOG" }
    });

    // Cloudflare Unban
    await unblockIpInCloudflare(ip);

    return NextResponse.json({ success: true, message: `IP ${ip} unblocked successfully` });
  } catch (error) {
    console.error("Unblock API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

