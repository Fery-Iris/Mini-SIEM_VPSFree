import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminId } from "@/utils/serverAuth";

// DELETE: Hapus (deactivate) API Key berdasarkan id
export async function DELETE(req: Request) {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID key diperlukan" }, { status: 400 });

  // Pastikan key ini milik admin yang sedang login
  const key = await prisma.apiKey.findFirst({
    where: { id: parseInt(id), adminId },
  });

  if (!key) return NextResponse.json({ error: "Key tidak ditemukan" }, { status: 404 });

  // Soft delete: set isActive = 0
  await prisma.apiKey.update({
    where: { id: key.id },
    data: { isActive: 0 },
  });

  return NextResponse.json({ success: true, message: "API Key berhasil dinonaktifkan." });
}
