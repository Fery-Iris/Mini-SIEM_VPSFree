import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminId } from "@/utils/serverAuth";
import crypto from "crypto";

// GET: Ambil semua API key milik admin
export async function GET() {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await prisma.apiKey.findMany({
    where: { adminId },
    orderBy: { createdAt: "desc" },
  });

  // Mask key value: hanya tampilkan 8 karakter pertama
  const masked = keys.map((k) => ({
    id: k.id,
    keyValue: k.keyValue.substring(0, 8) + "••••••••••••••••••••••••",
    keyPreview: k.keyValue.substring(0, 8),
    isActive: k.isActive,
    createdAt: k.createdAt.toISOString(),
  }));

  return NextResponse.json({ keys: masked });
}
