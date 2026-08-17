import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminId } from "@/utils/serverAuth";

// GET: Ambil config milik admin yang sedang login
export async function GET() {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Upsert: buat config default jika belum ada
  const config = await prisma.adminConfig.upsert({
    where: { adminId },
    create: { adminId },
    update: {},
  });

  // Jangan expose telegramBotToken secara penuh
  return NextResponse.json({
    ...config,
    telegramBotToken: config.telegramBotToken ? "***configured***" : null,
  });
}

// PATCH: Update config (threshold, telegram settings)
export async function PATCH(req: Request) {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json() as {
      blockThreshold?: number;
      alertThreshold?: number;
      scoreWindowMinutes?: number;
      telegramBotToken?: string;
      telegramChatId?: string;
      telegramEnabled?: boolean;
    };

    // Validasi threshold values
    if (body.blockThreshold !== undefined) {
      if (body.blockThreshold < 1 || body.blockThreshold > 16) {
        return NextResponse.json(
          { error: "blockThreshold harus antara 1 dan 16" },
          { status: 400 }
        );
      }
    }
    if (body.alertThreshold !== undefined) {
      if (body.alertThreshold < 1 || body.alertThreshold > 16) {
        return NextResponse.json(
          { error: "alertThreshold harus antara 1 dan 16" },
          { status: 400 }
        );
      }
    }
    if (
      body.alertThreshold !== undefined &&
      body.blockThreshold !== undefined &&
      body.alertThreshold >= body.blockThreshold
    ) {
      return NextResponse.json(
        { error: "alertThreshold harus lebih kecil dari blockThreshold" },
        { status: 400 }
      );
    }

    const updated = await prisma.adminConfig.upsert({
      where: { adminId },
      create: {
        adminId,
        ...(body.blockThreshold !== undefined && { blockThreshold: body.blockThreshold }),
        ...(body.alertThreshold !== undefined && { alertThreshold: body.alertThreshold }),
        ...(body.scoreWindowMinutes !== undefined && { scoreWindowMinutes: body.scoreWindowMinutes }),
        ...(body.telegramBotToken !== undefined && { telegramBotToken: body.telegramBotToken }),
        ...(body.telegramChatId !== undefined && { telegramChatId: body.telegramChatId }),
        ...(body.telegramEnabled !== undefined && { telegramEnabled: body.telegramEnabled }),
      },
      update: {
        ...(body.blockThreshold !== undefined && { blockThreshold: body.blockThreshold }),
        ...(body.alertThreshold !== undefined && { alertThreshold: body.alertThreshold }),
        ...(body.scoreWindowMinutes !== undefined && { scoreWindowMinutes: body.scoreWindowMinutes }),
        ...(body.telegramBotToken !== undefined && { telegramBotToken: body.telegramBotToken }),
        ...(body.telegramChatId !== undefined && { telegramChatId: body.telegramChatId }),
        ...(body.telegramEnabled !== undefined && { telegramEnabled: body.telegramEnabled }),
      },
    });

    return NextResponse.json({
      success: true,
      config: {
        ...updated,
        telegramBotToken: updated.telegramBotToken ? "***configured***" : null,
      },
    });
  } catch (error) {
    console.error("[admin-config] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
