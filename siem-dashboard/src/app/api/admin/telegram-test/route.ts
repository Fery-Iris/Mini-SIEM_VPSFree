import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminId } from "@/utils/serverAuth";

// POST: Kirim test alert ke Telegram untuk verifikasi koneksi
export async function POST() {
  const adminId = await getAdminId();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.adminConfig.findUnique({ where: { adminId } });

  if (!config?.telegramBotToken || !config?.telegramChatId) {
    return NextResponse.json(
      { error: "Telegram bot token dan chat ID belum dikonfigurasi" },
      { status: 400 }
    );
  }

  const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  const message =
    `✅ *Mini-SIEM Test Alert*\n\n` +
    `Koneksi Telegram berhasil dikonfigurasi!\n\n` +
    `*Threshold Blokir:* ${config.blockThreshold}\n` +
    `*Threshold Alert:* ${config.alertThreshold}\n` +
    `*Time Window:* ${config.scoreWindowMinutes} menit\n` +
    `*Waktu:* ${now}`;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.telegramChatId,
          text: message,
          parse_mode: "Markdown",
        }),
      }
    );

    const result = await res.json() as { ok: boolean; description?: string };

    if (!result.ok) {
      return NextResponse.json(
        { error: `Telegram error: ${result.description}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: "Test alert terkirim!" });
  } catch (error) {
    return NextResponse.json(
      { error: "Gagal mengirim ke Telegram" },
      { status: 500 }
    );
  }
}
