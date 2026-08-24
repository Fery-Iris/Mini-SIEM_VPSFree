import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminId } from "@/utils/serverAuth";
import { blockIpInCloudflare } from "@/lib/cloudflare";

/**
 * POST /api/detection/block
 * Dashboard-facing endpoint: manually block an IP from the Detection Panel.
 * Auth: JWT (dashboard session).
 */
export async function POST(req: Request) {
  const adminId = await getAdminId();
  if (!adminId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { ip } = await req.json();
    if (!ip)
      return NextResponse.json({ error: "IP is required" }, { status: 400 });

    // Mark all existing logs for this IP (belonging to this admin) as blocked
    await prisma.securityLog.updateMany({
      where: { adminId, sourceIp: ip },
      data: { isBlocked: true, decision: "BLOCK" },
    });

    // Sync to Cloudflare WAF (fire-and-forget; failure is non-fatal)
    blockIpInCloudflare(ip, "[Mini-SIEM Dashboard] Manual block").catch(
      (err) => console.error("[block/route] Cloudflare sync failed:", err)
    );

    return NextResponse.json({ success: true, message: `IP ${ip} blocked successfully` });
  } catch (error) {
    console.error("[block/route] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
