import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminId } from "@/utils/serverAuth";
import countryCoords from "@/lib/country-coords.json";

type CountryCoordEntry = { lat: number; lng: number; name: string };
const coordsMap = countryCoords as Record<string, CountryCoordEntry>;

export async function GET() {
  const adminId = await getAdminId();
  if (!adminId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Aggregate security logs by countryCode
  const grouped = await prisma.securityLog.groupBy({
    by: ["countryCode"],
    where: {
      adminId,
      countryCode: { not: null },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  const threats = grouped
    .filter((g) => g.countryCode && g.countryCode !== "LO" && g.countryCode !== "?")
    .map((g) => {
      const code = g.countryCode!;
      const coords = coordsMap[code];
      return {
        countryCode: code,
        country: coords?.name || code,
        lat: coords?.lat || 0,
        lng: coords?.lng || 0,
        count: g._count.id,
      };
    })
    .filter((t) => t.lat !== 0 && t.lng !== 0);

  const totalAttacks = threats.reduce((sum, t) => sum + t.count, 0);

  return NextResponse.json({
    threats,
    totalCountries: threats.length,
    totalAttacks,
  });
}
