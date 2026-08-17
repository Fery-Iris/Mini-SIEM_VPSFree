import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminId } from "@/utils/serverAuth";
import crypto from "crypto";

// POST: Generate API Key — ENFORCE: hanya boleh 1 key aktif per admin
export async function POST() {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Cek apakah admin sudah punya key aktif
  const existingActive = await prisma.apiKey.findFirst({
    where: { adminId, isActive: 1 },
  });

  if (existingActive) {
    return NextResponse.json(
      {
        error: "Single API Key Policy",
        message:
          "Anda sudah memiliki 1 API Key aktif. Mini-SIEM melarang penggunaan lebih dari satu API Key pada satu sistem untuk mencegah bentrok record di database. Hapus key yang ada terlebih dahulu sebelum membuat yang baru.",
      },
      { status: 409 }
    );
  }

  // Generate key baru: prefix msiem_ + 32 random hex chars
  const keyValue = "msiem_" + crypto.randomBytes(24).toString("hex");

  const newKey = await prisma.apiKey.create({
    data: {
      adminId,
      keyValue,
      isActive: 1,
    },
  });

  // Return full key ONCE — ini satu-satunya kesempatan user melihat key penuh
  return NextResponse.json(
    {
      success: true,
      key: {
        id: newKey.id,
        keyValue, // Full key — only shown once
        createdAt: newKey.createdAt.toISOString(),
      },
      warning:
        "Simpan API Key ini sekarang. Demi keamanan, key tidak akan ditampilkan lagi setelah halaman ini ditutup.",
    },
    { status: 201 }
  );
}
